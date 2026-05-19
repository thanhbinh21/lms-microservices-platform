import '../lib/load-env.js';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger } from '@lms/logger';
import type { Prisma } from '../generated/prisma/index.js';
import prisma from '../lib/prisma.js';
import {
  buildAutoSttTranscriptId,
  computeContentHash,
  computeVideoHash,
} from '../lib/transcript-context.js';

type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

type SttResult = {
  fullText: string;
  segments: TranscriptSegment[];
  language?: string;
  durationSec?: number;
  confidence?: number;
  fileSizeMb?: number;
  provider?: string;
};

type TranscriptWorkerHandle = {
  stop: (signal?: string) => Promise<void>;
  pollNow: () => Promise<void>;
  isRunning: () => boolean;
};

const POLL_MS = Number(process.env.TRANSCRIPT_JOB_POLL_MS || 10_000);
const MAX_ATTEMPTS = Number(process.env.TRANSCRIPT_JOB_MAX_ATTEMPTS || 3);
const LOCK_TIMEOUT_MS = Number(process.env.TRANSCRIPT_JOB_LOCK_TIMEOUT_MS || 15 * 60_000);
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const YT_DLP_PATH = process.env.YT_DLP_PATH || '';
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const STT_PROVIDER = process.env.TRANSCRIPT_STT_PROVIDER || 'disabled';
const FASTER_WHISPER_MODEL = process.env.FASTER_WHISPER_MODEL || 'small';
const STT_LANGUAGE = process.env.TRANSCRIPT_STT_LANGUAGE || 'vi';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.TRANSCRIPT_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const DEEPGRAM_MODEL = process.env.TRANSCRIPT_DEEPGRAM_MODEL || 'nova-3';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_TRANSCRIBE_MODEL = process.env.TRANSCRIPT_OPENAI_MODEL || 'gpt-4o-mini-transcribe';
const OPENAI_MAX_DOWNLOAD_MB = Number(process.env.TRANSCRIPT_OPENAI_MAX_DOWNLOAD_MB || 25);

let stopping = false;
let polling = false;
let started = false;
let timer: NodeJS.Timeout | null = null;

function isYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

function errorCode(err: unknown): string {
  if (err instanceof Error && 'code' in err && typeof err.code === 'string') return err.code;
  return 'TRANSCRIPT_WORKER_ERROR';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function codedError(code: string, message: string): Error {
  const err = new Error(message);
  Object.assign(err, { code });
  return err;
}

function inferMimeType(url: string, sourceType?: string): string {
  const lower = url.split('?')[0]?.toLowerCase() || '';
  if (sourceType === 'YOUTUBE' || isYoutubeUrl(url)) return 'video/mp4';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

function getFileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split('/').filter(Boolean).pop();
    return name || 'lesson-video.mp4';
  } catch {
    return 'lesson-video.mp4';
  }
}

function parseTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value !== 'string') return 0;

  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
  return Math.max(0, parts[0] || 0);
}

function normalizeSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): TranscriptSegment | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const text = typeof record.text === 'string'
        ? record.text.trim()
        : typeof record.transcript === 'string'
          ? record.transcript.trim()
          : '';
      if (!text) return null;
      return {
        start: parseTimestamp(record.start),
        end: parseTimestamp(record.end),
        text,
      };
    })
    .filter((item): item is TranscriptSegment => Boolean(item));
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
}

function buildSingleSegment(fullText: string, durationSec?: number): TranscriptSegment[] {
  const text = fullText.trim();
  if (!text) return [];
  return [{ start: 0, end: durationSec || 0, text }];
}

function normalizeProviderResult(
  provider: string,
  payload: Record<string, unknown> | string,
  fallbackDurationSec?: number | null,
): SttResult {
  if (typeof payload === 'string') {
    const fullText = payload.trim();
    return {
      provider,
      fullText,
      segments: buildSingleSegment(fullText, fallbackDurationSec ?? undefined),
      language: STT_LANGUAGE,
      durationSec: fallbackDurationSec ?? undefined,
    };
  }

  const fullText = typeof payload.fullText === 'string'
    ? payload.fullText.trim()
    : typeof payload.transcript === 'string'
      ? payload.transcript.trim()
      : typeof payload.text === 'string'
        ? payload.text.trim()
        : '';
  const durationSec = typeof payload.durationSec === 'number'
    ? payload.durationSec
    : typeof payload.duration === 'number'
      ? payload.duration
      : fallbackDurationSec ?? undefined;
  const segments = normalizeSegments(payload.segments);

  return {
    provider,
    fullText,
    segments: segments.length > 0 ? segments : buildSingleSegment(fullText, durationSec),
    language: typeof payload.language === 'string' ? payload.language : STT_LANGUAGE,
    durationSec,
    confidence: typeof payload.confidence === 'number' ? payload.confidence : undefined,
  };
}

function runProcess(command: string, args: string[], timeoutMs = 30 * 60_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(codedError('PROCESS_TIMEOUT', `${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(codedError('PROCESS_FAILED', `${command} exited with code ${code}: ${stderr.slice(-1000)}`));
    });
  });
}

async function findWavFile(dir: string): Promise<string | null> {
  const files = await readdir(dir);
  const wav = files.find((file) => file.toLowerCase().endsWith('.wav'));
  return wav ? path.join(dir, wav) : null;
}

async function extractAudio(videoUrl: string, tempDir: string): Promise<string> {
  const outputPath = path.join(tempDir, 'audio.wav');

  if (isYoutubeUrl(videoUrl)) {
    if (!YT_DLP_PATH) {
      throw codedError('YOUTUBE_DOWNLOAD_TOOL_MISSING', 'YT_DLP_PATH is required for YouTube AUTO_STT');
    }

    const outputTemplate = path.join(tempDir, 'source.%(ext)s');
    await runProcess(YT_DLP_PATH, ['-x', '--audio-format', 'wav', '-o', outputTemplate, videoUrl]);
    const wavPath = await findWavFile(tempDir);
    if (!wavPath) {
      throw codedError('AUDIO_EXTRACTION_FAILED', 'yt-dlp did not produce a wav file');
    }
    return wavPath;
  }

  await runProcess(FFMPEG_PATH, ['-y', '-i', videoUrl, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', outputPath]);
  return outputPath;
}

async function transcribeWithFasterWhisper(audioPath: string): Promise<SttResult> {
  const pythonCode = `
import json
import sys
from faster_whisper import WhisperModel

audio_path = sys.argv[1]
model_name = sys.argv[2]
language = sys.argv[3] or None

model = WhisperModel(model_name, device="auto", compute_type="int8")
segments, info = model.transcribe(audio_path, language=language, beam_size=5, vad_filter=True)

items = []
texts = []
for segment in segments:
    text = segment.text.strip()
    if not text:
        continue
    items.append({"start": float(segment.start), "end": float(segment.end), "text": text})
    texts.append(text)

payload = {
    "language": getattr(info, "language", language or "vi"),
    "durationSec": int(getattr(info, "duration", 0) or 0),
    "segments": items,
    "fullText": " ".join(texts)
}
print(json.dumps(payload, ensure_ascii=False))
`;

  const { stdout } = await runProcess(PYTHON_PATH, ['-c', pythonCode, audioPath, FASTER_WHISPER_MODEL, STT_LANGUAGE]);
  const parsed = JSON.parse(stdout.trim()) as SttResult;
  return { ...parsed, provider: 'faster-whisper' };
}

async function transcribeWithMock(): Promise<SttResult> {
  return {
    fullText: 'Mock transcript chi dung cho test local. Khong dung trong production.',
    segments: [{ start: 0, end: 1, text: 'Mock transcript chi dung cho test local.' }],
    language: STT_LANGUAGE,
    durationSec: 1,
    provider: 'mock',
  };
}

async function transcribeWithGemini(videoUrl: string, lesson: { title: string; sourceType: string; duration: number | null }): Promise<SttResult> {
  if (!GEMINI_API_KEY) {
    throw codedError('GEMINI_API_KEY_MISSING', 'GEMINI_API_KEY is required for gemini-audio transcription');
  }

  const prompt = [
    'Generate a faithful transcript for this lesson video/audio.',
    'Return JSON only with this schema:',
    '{"language":"vi","durationSec":0,"segments":[{"start":0,"end":10,"text":"..."}],"fullText":"..."}',
    'Use Vietnamese when the speech is Vietnamese. Include timestamps in seconds when possible.',
    `Lesson title: ${lesson.title}`,
  ].join('\n');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              fileData: {
                fileUri: videoUrl,
                mimeType: inferMimeType(videoUrl, lesson.sourceType),
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw codedError('GEMINI_TRANSCRIBE_FAILED', `Gemini transcription failed ${res.status}: ${body.slice(0, 1000)}`);
  }

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim() || '';
  const parsed = extractJsonObject(text);
  return normalizeProviderResult('gemini-audio', parsed ?? text, lesson.duration);
}

async function transcribeWithDeepgram(videoUrl: string, lesson: { duration: number | null }): Promise<SttResult> {
  if (!DEEPGRAM_API_KEY) {
    throw codedError('DEEPGRAM_API_KEY_MISSING', 'DEEPGRAM_API_KEY is required for deepgram transcription');
  }

  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    smart_format: 'true',
    punctuate: 'true',
    detect_language: 'true',
    utterances: 'true',
  });
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: videoUrl }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw codedError('DEEPGRAM_TRANSCRIBE_FAILED', `Deepgram transcription failed ${res.status}: ${body.slice(0, 1000)}`);
  }

  const json = await res.json() as {
    metadata?: { duration?: number };
    results?: {
      channels?: Array<{ alternatives?: Array<{ transcript?: string; confidence?: number }> }>;
      utterances?: Array<{ start?: number; end?: number; transcript?: string; confidence?: number }>;
    };
  };
  const alternative = json.results?.channels?.[0]?.alternatives?.[0];
  const fullText = alternative?.transcript?.trim() || '';
  const segments = normalizeSegments(json.results?.utterances);

  return {
    provider: 'deepgram',
    fullText,
    segments: segments.length > 0 ? segments : buildSingleSegment(fullText, json.metadata?.duration ?? lesson.duration ?? undefined),
    language: STT_LANGUAGE,
    durationSec: json.metadata?.duration ?? lesson.duration ?? undefined,
    confidence: alternative?.confidence,
  };
}

async function transcribeWithOpenAi(videoUrl: string, lesson: { sourceType: string; duration: number | null }): Promise<SttResult> {
  if (!OPENAI_API_KEY) {
    throw codedError('OPENAI_API_KEY_MISSING', 'OPENAI_API_KEY is required for openai-audio transcription');
  }
  if (isYoutubeUrl(videoUrl)) {
    throw codedError('OPENAI_AUDIO_URL_UNSUPPORTED', 'OpenAI audio transcription requires a downloadable media file, not a YouTube page URL');
  }

  const mediaRes = await fetch(videoUrl);
  if (!mediaRes.ok) {
    throw codedError('OPENAI_MEDIA_DOWNLOAD_FAILED', `Cannot download media for OpenAI transcription: ${mediaRes.status}`);
  }

  const contentLength = Number(mediaRes.headers.get('content-length') || 0);
  const maxBytes = OPENAI_MAX_DOWNLOAD_MB * 1024 * 1024;
  if (contentLength > maxBytes) {
    throw codedError('OPENAI_MEDIA_TOO_LARGE', `Media is ${Math.ceil(contentLength / 1024 / 1024)}MB, max is ${OPENAI_MAX_DOWNLOAD_MB}MB`);
  }

  const buffer = await mediaRes.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw codedError('OPENAI_MEDIA_TOO_LARGE', `Media is ${Math.ceil(buffer.byteLength / 1024 / 1024)}MB, max is ${OPENAI_MAX_DOWNLOAD_MB}MB`);
  }

  const mimeType = mediaRes.headers.get('content-type')?.split(';')[0] || inferMimeType(videoUrl, lesson.sourceType);
  const form = new FormData();
  form.append('model', OPENAI_TRANSCRIBE_MODEL);
  form.append('language', STT_LANGUAGE);
  form.append('file', new Blob([buffer], { type: mimeType }), getFileNameFromUrl(videoUrl));

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw codedError('OPENAI_TRANSCRIBE_FAILED', `OpenAI transcription failed ${res.status}: ${body.slice(0, 1000)}`);
  }

  const json = await res.json() as { text?: string };
  const fullText = json.text?.trim() || '';
  return {
    provider: 'openai-audio',
    fullText,
    segments: buildSingleSegment(fullText, lesson.duration ?? undefined),
    language: STT_LANGUAGE,
    durationSec: lesson.duration ?? undefined,
    fileSizeMb: Math.ceil(buffer.byteLength / 1024 / 1024),
  };
}

async function transcribeWithLocalFasterWhisper(videoUrl: string): Promise<SttResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'lms-transcript-'));
  try {
    const audioPath = await extractAudio(videoUrl, tempDir);
    const audioStat = await stat(audioPath);
    const result = await transcribeWithFasterWhisper(audioPath);
    return { ...result, fileSizeMb: Math.ceil(audioStat.size / 1024 / 1024) };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function getProviderOrder(provider: string, videoUrl: string): string[] {
  if (provider === 'auto') {
    const order = isYoutubeUrl(videoUrl)
      ? ['gemini-audio', 'deepgram', 'openai-audio']
      : ['deepgram', 'gemini-audio', 'openai-audio'];
    return order.filter((item) => {
      if (item === 'gemini-audio') return Boolean(GEMINI_API_KEY);
      if (item === 'deepgram') return Boolean(DEEPGRAM_API_KEY);
      if (item === 'openai-audio') return Boolean(OPENAI_API_KEY);
      return false;
    });
  }

  return provider
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function transcribeLessonVideo(
  lesson: { title: string; videoUrl: string; sourceType: string; duration: number | null },
): Promise<SttResult> {
  const providers = getProviderOrder(STT_PROVIDER, lesson.videoUrl);
  if (providers.length === 0 || providers.includes('disabled')) {
    throw codedError(
      'STT_PROVIDER_DISABLED',
      'Set TRANSCRIPT_STT_PROVIDER=auto, gemini-audio, deepgram, openai-audio, or faster-whisper to enable AUTO_STT',
    );
  }

  const failures: string[] = [];
  for (const provider of providers) {
    try {
      if (provider === 'gemini-audio') return transcribeWithGemini(lesson.videoUrl, lesson);
      if (provider === 'deepgram') return transcribeWithDeepgram(lesson.videoUrl, lesson);
      if (provider === 'openai-audio') return transcribeWithOpenAi(lesson.videoUrl, lesson);
      if (provider === 'faster-whisper') return transcribeWithLocalFasterWhisper(lesson.videoUrl);
      if (provider === 'mock') return transcribeWithMock();
      throw codedError('UNKNOWN_STT_PROVIDER', `Unknown TRANSCRIPT_STT_PROVIDER: ${provider}`);
    } catch (err) {
      const message = `${provider}: ${errorCode(err)} ${errorMessage(err)}`;
      failures.push(message);
      logger.warn({ err, provider, lessonTitle: lesson.title }, 'STT provider failed, trying next provider if available');
    }
  }

  throw codedError('ALL_STT_PROVIDERS_FAILED', failures.join(' | ').slice(0, 3000));
}

async function claimNextJob() {
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);
  return prisma.$transaction(async (tx) => {
    const job = await tx.transcriptJob.findFirst({
      where: {
        attempts: { lt: MAX_ATTEMPTS },
        OR: [
          { status: 'QUEUED' },
          { status: 'PROCESSING', lockedAt: { lt: staleBefore } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!job) return null;

    return tx.transcriptJob.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lockedAt: new Date(),
        lastError: null,
      },
    });
  });
}

async function markJobFailed(jobId: string, transcriptId: string | null, err: unknown): Promise<void> {
  const code = errorCode(err);
  const message = errorMessage(err);

  await prisma.$transaction(async (tx) => {
    await tx.transcriptJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        lastError: `${code}: ${message}`.slice(0, 4000),
        lockedAt: null,
      },
    });

    if (transcriptId) {
      await tx.lessonTranscript.update({
        where: { id: transcriptId },
        data: {
          status: 'FAILED',
          errorCode: code,
          errorMessage: message.slice(0, 1000),
        },
      }).catch(async () => undefined);
    }
  });
}

async function processJob(job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>): Promise<void> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: job.lessonId },
    select: {
      id: true,
      title: true,
      content: true,
      videoUrl: true,
      sourceType: true,
      duration: true,
    },
  });

  if (!lesson || !lesson.videoUrl) {
    throw codedError('LESSON_VIDEO_NOT_FOUND', 'Lesson or videoUrl no longer exists');
  }

  const currentVideoHash = computeVideoHash(lesson);
  if (!currentVideoHash || currentVideoHash !== job.videoHash) {
    await prisma.transcriptJob.update({ where: { id: job.id }, data: { status: 'STALE', lockedAt: null } });
    return;
  }

  const transcriptId = buildAutoSttTranscriptId(lesson.id, currentVideoHash);
  await prisma.lessonTranscript.update({
    where: { id: transcriptId },
    data: { status: 'PROCESSING', errorCode: null, errorMessage: null },
  });

  try {
    const result = await transcribeLessonVideo({ ...lesson, videoUrl: lesson.videoUrl });
    const fullText = result.fullText.trim();
    const provider = result.provider || STT_PROVIDER;

    if (!fullText) {
      throw codedError('NO_SPEECH_DETECTED', 'STT provider returned an empty transcript');
    }

    await prisma.$transaction(async (tx) => {
      await tx.lessonTranscript.upsert({
        where: { id: transcriptId },
        create: {
          id: transcriptId,
          lessonId: lesson.id,
          sourceType: 'AUTO_STT',
          contentKind: 'VERBATIM_TRANSCRIPT',
          provider,
          language: result.language || STT_LANGUAGE,
          status: 'READY',
          fullText,
          segments: result.segments as unknown as Prisma.InputJsonValue,
          durationSec: result.durationSec || lesson.duration || null,
          fileSizeMb: result.fileSizeMb ?? null,
          confidence: result.confidence ?? null,
          contentHash: computeContentHash(fullText),
          videoHash: currentVideoHash,
          jobId: job.id,
          generatedAt: new Date(),
        },
        update: {
          sourceType: 'AUTO_STT',
          contentKind: 'VERBATIM_TRANSCRIPT',
          provider,
          language: result.language || STT_LANGUAGE,
          status: 'READY',
          fullText,
          segments: result.segments as unknown as Prisma.InputJsonValue,
          durationSec: result.durationSec || lesson.duration || null,
          fileSizeMb: result.fileSizeMb ?? null,
          confidence: result.confidence ?? null,
          contentHash: computeContentHash(fullText),
          videoHash: currentVideoHash,
          jobId: job.id,
          errorCode: null,
          errorMessage: null,
          generatedAt: new Date(),
        },
      });

      await tx.transcriptJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          lockedAt: null,
          completedAt: new Date(),
          lastError: null,
        },
      });
    });

    logger.info({ jobId: job.id, lessonId: lesson.id, provider }, 'AUTO_STT job completed');
  } catch (err) {
    await markJobFailed(job.id, transcriptId, err);
    logger.warn({ err, jobId: job.id, lessonId: lesson.id }, 'AUTO_STT job failed');
  }
}

async function pollJobs(): Promise<void> {
  if (polling || stopping) return;
  polling = true;

  try {
    while (!stopping) {
      const job = await claimNextJob();
      if (!job) break;
      try {
        await processJob(job);
      } catch (err) {
        const transcriptId = job.videoHash ? buildAutoSttTranscriptId(job.lessonId, job.videoHash) : null;
        await markJobFailed(job.id, transcriptId, err);
        logger.warn({ err, jobId: job.id, lessonId: job.lessonId }, 'AUTO_STT job failed before processing');
      }
    }
  } finally {
    polling = false;
  }
}

export function startTranscriptWorker(
  options: { exitOnStop?: boolean; immediate?: boolean } = {},
): TranscriptWorkerHandle {
  if (started) {
    return {
      stop: (signal = 'manual') => stopTranscriptWorker(signal, options.exitOnStop === true),
      pollNow: pollJobs,
      isRunning: () => started,
    };
  }

  stopping = false;
  started = true;
  logger.info({ pollMs: POLL_MS, provider: STT_PROVIDER }, '[TRANSCRIPT-WORKER] Khoi dong');

  if (options.immediate !== false) {
    void pollJobs();
  }

  timer = setInterval(() => {
    void pollJobs();
  }, POLL_MS);

  return {
    stop: (signal = 'manual') => stopTranscriptWorker(signal, options.exitOnStop === true),
    pollNow: pollJobs,
    isRunning: () => started,
  };
}

export async function stopTranscriptWorker(signal = 'manual', exitOnStop = false): Promise<void> {
  stopping = true;
  started = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  logger.info({ signal }, '[TRANSCRIPT-WORKER] Dang tat worker');

  if (exitOnStop) {
    await prisma.$disconnect();
    process.exit(0);
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isMainModule()) {
  const worker = startTranscriptWorker({ exitOnStop: true });
  process.on('SIGTERM', () => {
    void worker.stop('SIGTERM');
  });
  process.on('SIGINT', () => {
    void worker.stop('SIGINT');
  });
}
