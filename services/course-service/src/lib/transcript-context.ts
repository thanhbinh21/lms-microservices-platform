import crypto from 'node:crypto';
import type { Prisma } from '../generated/prisma/index.js';

export const TRANSCRIPT_PRIORITY = ['MANUAL', 'SUBTITLE_UPLOAD', 'AUTO_CONTEXT', 'AUTO_STT'] as const;

export type TranscriptSourceType = (typeof TRANSCRIPT_PRIORITY)[number] | string;
export type TranscriptContentKind = 'VERBATIM_TRANSCRIPT' | 'AI_CONTEXT';
export type TranscriptQuality = 'HIGH' | 'MEDIUM' | 'LOW';

export type LessonForAiContext = {
  id: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  sourceType: 'UPLOAD' | 'YOUTUBE' | string;
  duration?: number | null;
  chapterTitle?: string | null;
  courseTitle?: string | null;
  courseDescription?: string | null;
  courseLevel?: string | null;
  courseCategory?: string | null;
};

export type TranscriptCandidate = {
  id: string;
  sourceType: string;
  contentKind?: string | null;
  status: string;
  fullText: string | null;
  segments?: Prisma.JsonValue | null;
  language?: string | null;
  updatedAt?: Date;
};

export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function computeVideoHash(lesson: Pick<LessonForAiContext, 'videoUrl' | 'sourceType'>): string | null {
  if (!lesson.videoUrl?.trim()) return null;
  return crypto
    .createHash('sha256')
    .update(`${lesson.sourceType || 'UPLOAD'}:${lesson.videoUrl.trim()}`)
    .digest('hex');
}

export function buildAutoContextTranscriptId(lessonId: string): string {
  return `auto-context-${lessonId}`;
}

export function buildAutoSttTranscriptId(lessonId: string, videoHash: string): string {
  return `auto-stt-${lessonId}-${videoHash.slice(0, 16)}`;
}

export function buildAutoSttJobId(lessonId: string, videoHash: string): string {
  return `auto-stt-job-${lessonId}-${videoHash.slice(0, 16)}`;
}

export function getTranscriptPriority(sourceType: string): number {
  const index = TRANSCRIPT_PRIORITY.indexOf(sourceType as (typeof TRANSCRIPT_PRIORITY)[number]);
  return index === -1 ? TRANSCRIPT_PRIORITY.length : index;
}

export function getContentKindForSource(sourceType: string): TranscriptContentKind {
  return sourceType === 'AUTO_CONTEXT' ? 'AI_CONTEXT' : 'VERBATIM_TRANSCRIPT';
}

export function getQualityForSource(sourceType?: string | null): TranscriptQuality {
  if (sourceType === 'MANUAL' || sourceType === 'SUBTITLE_UPLOAD') return 'HIGH';
  if (sourceType === 'AUTO_CONTEXT') return 'MEDIUM';
  return 'LOW';
}

export function pickBestTranscript<T extends TranscriptCandidate>(transcripts: T[]): T | undefined {
  const sorted = [...transcripts].sort((a, b) => {
    const priority = getTranscriptPriority(a.sourceType) - getTranscriptPriority(b.sourceType);
    if (priority !== 0) return priority;
    return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
  });

  return (
    sorted.find((item) => item.status === 'READY' && Boolean(item.fullText?.trim()))
    ?? sorted.find((item) => item.status === 'PROCESSING' || item.status === 'PENDING')
    ?? sorted[0]
  );
}

function formatDurationForContext(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return 'Thoi luong video: chua co du lieu.';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `Thoi luong video uoc tinh: ${minutes} phut (${seconds} giay).`;
}

const KEYWORD_STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'this', 'that', 'your', 'you', 'are', 'was', 'were',
  'mot', 'cac', 'cho', 'voi', 'cua', 'la', 've', 'va', 'de', 'trong', 'tren', 'duoi', 'khi',
  'hoc', 'bai', 'khoa', 'noi', 'dung', 'giang', 'vien', 'phan', 'chuong', 'tong', 'quan',
  'co', 'ban', 'nang', 'cao', 'can', 'biet', 'tim', 'hieu', 'thuc', 'hanh', 'lam', 'quen',
]);

function normalizeKeywordInput(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function extractKeywords(text: string, limit = 24): string[] {
  const normalized = normalizeKeywordInput(text.replace(/https?:\/\/\S+/g, ' '));
  const tokens = normalized.match(/[a-z0-9+#.]{2,}/g) || [];
  const scores = new Map<string, number>();

  for (const token of tokens) {
    const clean = token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
    if (clean.length < 2 || KEYWORD_STOPWORDS.has(clean)) continue;
    if (clean.length < 3 && !['ai', 'js', 'c#', 'c++'].includes(clean)) continue;
    scores.set(clean, (scores.get(clean) || 0) + 1);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

function pickTopicSeeds(lesson: LessonForAiContext): string[] {
  return [
    lesson.courseTitle,
    lesson.courseCategory,
    lesson.courseLevel,
    lesson.courseDescription,
    lesson.chapterTitle,
    lesson.title,
    lesson.content,
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
}

export function buildAutoContextText(lesson: LessonForAiContext): string {
  const sourceLabel = lesson.sourceType === 'YOUTUBE' ? 'YouTube' : 'video upload/url';
  const seedText = pickTopicSeeds(lesson).join('\n');
  const keywords = extractKeywords(seedText);
  const parts = [
    'Che do AI context: KEYWORD_EXPANSION.',
    'Muc dich: dung text giang vien cung cap de xac dinh chu de va tu khoa, sau do AI mo rong kien thuc lien quan truc tiep. Day khong phai transcript loi noi trong video.',
    lesson.courseTitle ? `Ten khoa hoc: ${lesson.courseTitle}.` : '',
    lesson.courseDescription?.trim() ? `Mo ta khoa hoc:\n${lesson.courseDescription.trim()}` : '',
    lesson.courseCategory ? `Danh muc: ${lesson.courseCategory}.` : '',
    lesson.courseLevel ? `Trinh do: ${lesson.courseLevel}.` : '',
    lesson.chapterTitle ? `Chuong: ${lesson.chapterTitle}.` : '',
    `Tieu de bai hoc: ${lesson.title}.`,
    `Nguon video/hoc lieu: ${sourceLabel}${lesson.videoUrl ? ` (${lesson.videoUrl})` : ''}.`,
    formatDurationForContext(lesson.duration),
  ].filter(Boolean);

  if (lesson.content?.trim()) {
    parts.push(`Text bai hoc do giang vien cung cap:\n${lesson.content.trim()}`);
  } else {
    parts.push('Giang vien chua nhap text chi tiet cho bai hoc nay; AI se dua vao ten khoa hoc, mo ta khoa hoc, chuong va tieu de bai hoc.');
  }

  if (keywords.length > 0) {
    parts.push(`Tu khoa/chuyen de chinh:\n${keywords.map((keyword) => `- ${keyword}`).join('\n')}`);
  }

  parts.push(
    [
      'Ghi chu he thong:',
      '- AI chat va quiz duoc phep mo rong kien thuc nen tang dua tren tu khoa/chuyen de o tren.',
      '- Khong khang dinh day la noi dung chinh xac tung cau trong video.',
      '- Neu hoc vien hoi chi tiet khong co trong text, hay tra loi theo huong kien thuc tham khao va khuyen hoc vien xem bai hoc/hoi giang vien.',
    ].join('\n'),
  );

  return parts.join('\n\n');
}
