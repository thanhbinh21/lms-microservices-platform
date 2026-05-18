import { AI_SERVICE_ENV } from './env.js';
import { logger } from './logger.js';
import { Redis } from 'ioredis';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GeminiGenerateContentRequest {
  contents: GeminiMessage[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

export interface GeminiGenerateContentResponse {
  candidates?: {
    content: { parts: { text: string }[] };
    finishReason: string;
    safetyRatings?: unknown[];
  }[];
  promptFeedback?: {
    safetyRatings?: unknown[];
  };
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────────

interface SlidingWindowEntry {
  timestamp: number;
}

let rateLimitRedis: Redis | null | undefined;

async function getRedisForRateLimit() {
  if (rateLimitRedis !== undefined) return rateLimitRedis;
  const redisUrl = AI_SERVICE_ENV.REDIS_URL || AI_SERVICE_ENV.CACHE_REDIS_URL;
  if (!redisUrl) {
    rateLimitRedis = null;
    return null;
  }
  try {
    const client = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
    await client.connect();
    rateLimitRedis = client;
    return client;
  } catch {
    rateLimitRedis = null;
    return null;
  }
}

// In-memory fallback rate limiter
const memoryLimits = new Map<string, SlidingWindowEntry[]>();

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = await getRedisForRateLimit();

  if (redis) {
    try {
      const now = Date.now();
      const windowMs = windowSeconds * 1000;
      const windowStart = now - windowMs;

      // Remove old entries
      await redis.zremrangebyscore(key, 0, windowStart);
      const count = await redis.zcard(key);

      if (count >= maxRequests) {
        const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const resetAt = oldest.length >= 2 ? Number(oldest[1]) + windowMs : now + windowMs;
        return { allowed: false, remaining: 0, resetAt };
      }

      // Add new entry
      await redis.zadd(key, now, `${now}`);
      await redis.expire(key, windowSeconds);

      return { allowed: true, remaining: maxRequests - count - 1, resetAt: now + windowMs };
    } catch {
      // fall through to memory
    }
  }

  // Memory fallback
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = now - windowMs;

  const entries = memoryLimits.get(key) || [];
  const valid = entries.filter((e) => e.timestamp > windowStart);
  valid.push({ timestamp: now });
  memoryLimits.set(key, valid);

  // Cleanup old entries periodically
  if (valid.length === 1) {
    setTimeout(() => {
      const current = memoryLimits.get(key);
      if (current) {
        memoryLimits.set(
          key,
          current.filter((e) => e.timestamp > Date.now() - windowMs),
        );
      }
    }, windowMs);
  }

  if (valid.length > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: now + windowMs };
  }

  return { allowed: true, remaining: maxRequests - valid.length, resetAt: now + windowMs };
}

// ─── Gemini Client ─────────────────────────────────────────────────────────────

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface LlmStreamChunk {
  text: string;
  done: boolean;
  error?: string;
}

async function makeGeminiRequest(
  model: string,
  body: GeminiGenerateContentRequest,
  stream = false,
): Promise<Response> {
  const apiKey = AI_SERVICE_ENV.GEMINI_API_KEY;
  const action = stream ? 'streamGenerateContent' : 'generateContent';
  const params = new URLSearchParams({ key: apiKey });
  if (stream) params.set('alt', 'sse');
  const requestUrl = `${GEMINI_BASE_URL}/${model}:${action}?${params.toString()}`;

  return fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}&${stream ? 'alt=sse&' : ''}力=${stream ? 'streamGenerateContent' : 'generateContent'}`;

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
}

export async function generateText(
  prompt: string,
  systemInstruction?: string,
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const body: GeminiGenerateContentRequest = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 2048,
      responseMimeType: 'text/plain',
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const models = [AI_SERVICE_ENV.GEMINI_MODEL, AI_SERVICE_ENV.GEMINI_FALLBACK_MODEL, 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const res = await makeGeminiRequest(model, body);
      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        logger.warn({ model, status: res.status, err: errText }, 'Gemini request failed');
        continue;
      }

      const json = (await res.json()) as GeminiGenerateContentResponse;
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err) {
      logger.warn({ model, err }, 'Gemini stream/generate error');
    }
  }

  throw new Error('All Gemini models failed');
}

export async function* streamGenerateText(
  prompt: string,
  systemInstruction?: string,
  options?: { temperature?: number },
): AsyncGenerator<LlmStreamChunk> {
  const body: GeminiGenerateContentRequest = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: 8192,
      responseMimeType: 'text/plain',
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const models = [AI_SERVICE_ENV.GEMINI_MODEL, AI_SERVICE_ENV.GEMINI_FALLBACK_MODEL];

  for (const model of models) {
    try {
      const res = await makeGeminiRequest(model, body, true);
      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        logger.warn({ model, status: res.status, err: errText }, 'Gemini stream failed');
        continue;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield { text, done: false };
            }
          } catch {
            // skip malformed
          }
        }
      }

      yield { text: '', done: true };
      return;
    } catch (err) {
      logger.warn({ model, err }, 'Gemini stream error');
    }
  }

  yield { text: '', done: true, error: 'All models failed' };
}

export { initRedis, closeRedis } from './cache.js';
