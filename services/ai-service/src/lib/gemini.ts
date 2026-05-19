import { AI_SERVICE_ENV } from './env.js';
import { logger } from './logger.js';
import { Redis } from 'ioredis';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAiChatRequest {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface OpenAiChatResponse {
  choices?: {
    message?: { content?: string };
    delta?: { content?: string };
    finish_reason?: string | null;
  }[];
  error?: { message?: string; type?: string; code?: string | number };
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

// ─── LLM Client (DeepSeek -> Groq -> OpenRouter) ─────────────────────────────

const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

const STATIC_FALLBACK_TEXT = 'He thong AI tam thoi khong san sang. Vui long thu lai sau.';

interface LlmStreamChunk {
  text: string;
  done: boolean;
  error?: string;
  code?: 'RATE_LIMITED' | 'FAILED';
  retryAfterMs?: number;
}

interface ParsedGeminiError {
  message?: string;
  status?: string;
  retryAfterMs?: number;
}

export class GeminiRateLimitError extends Error {
  retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'GeminiRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export function isGeminiRateLimitError(err: unknown): err is GeminiRateLimitError {
  return err instanceof GeminiRateLimitError
    || (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'GeminiRateLimitError');
}

type ProviderName = 'deepseek' | 'groq' | 'openrouter';

interface ProviderConfig {
  name: ProviderName;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

function getProviderOrder(): ProviderName[] {
  const raw = (AI_SERVICE_ENV.AI_PROVIDER_ORDER || '').trim();
  if (!raw) return ['deepseek', 'groq', 'openrouter'];

  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item): item is ProviderName => ['deepseek', 'groq', 'openrouter'].includes(item));
}

function buildProviderConfigs(): ProviderConfig[] {
  const order = getProviderOrder();
  const configs: ProviderConfig[] = [];

  for (const name of order) {
    if (name === 'deepseek') {
      if (AI_SERVICE_ENV.DEEPSEEK_API_KEY && AI_SERVICE_ENV.DEEPSEEK_MODEL) {
        configs.push({
          name,
          baseUrl: PROVIDER_BASE_URLS.deepseek,
          apiKey: AI_SERVICE_ENV.DEEPSEEK_API_KEY,
          model: AI_SERVICE_ENV.DEEPSEEK_MODEL,
        });
      }
      continue;
    }

    if (name === 'groq') {
      if (AI_SERVICE_ENV.GROQ_API_KEY && AI_SERVICE_ENV.GROQ_MODEL) {
        configs.push({
          name,
          baseUrl: PROVIDER_BASE_URLS.groq,
          apiKey: AI_SERVICE_ENV.GROQ_API_KEY,
          model: AI_SERVICE_ENV.GROQ_MODEL,
        });
      }
      continue;
    }

    if (name === 'openrouter') {
      if (AI_SERVICE_ENV.OPENROUTER_API_KEY && AI_SERVICE_ENV.OPENROUTER_MODEL) {
        const extraHeaders: Record<string, string> = {};
        if (AI_SERVICE_ENV.OPENROUTER_APP_URL) extraHeaders['HTTP-Referer'] = AI_SERVICE_ENV.OPENROUTER_APP_URL;
        if (AI_SERVICE_ENV.OPENROUTER_APP_NAME) extraHeaders['X-Title'] = AI_SERVICE_ENV.OPENROUTER_APP_NAME;

        configs.push({
          name,
          baseUrl: PROVIDER_BASE_URLS.openrouter,
          apiKey: AI_SERVICE_ENV.OPENROUTER_API_KEY,
          model: AI_SERVICE_ENV.OPENROUTER_MODEL,
          extraHeaders: Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined,
        });
      }
    }
  }

  return configs;
}

async function makeChatRequest(
  provider: ProviderConfig,
  body: OpenAiChatRequest,
  stream = false,
): Promise<Response> {
  const requestUrl = `${provider.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.apiKey}`,
    ...(provider.extraHeaders || {}),
  };

  return fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, stream }),
    signal: AbortSignal.timeout(60_000),
  });
}

function parseRetryDelay(retryDelay?: string): number | undefined {
  if (!retryDelay) return undefined;
  const match = retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : undefined;
}

function parseGeminiError(errText: string): ParsedGeminiError {
  try {
    const parsed = JSON.parse(errText) as {
      error?: { message?: string; status?: string; details?: { retryDelay?: string }[] };
    };
    const retryDelay = parsed.error?.details?.find((detail) => detail.retryDelay)?.retryDelay;
    return {
      message: parsed.error?.message,
      status: parsed.error?.status,
      retryAfterMs: parseRetryDelay(retryDelay),
    };
  } catch {
    return { message: errText };
  }
}

function parseRetryAfterHeader(res: Response): number | undefined {
  const raw = res.headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, Math.ceil(seconds * 1000));
  }
  return undefined;
}

function isRateLimitError(status: number, parsed: ParsedGeminiError): boolean {
  if (status === 429) return true;
  if (parsed.status === 'RESOURCE_EXHAUSTED') return true;
  if (!parsed.message) return false;
  return /quota exceeded|rate limit|resource exhausted/i.test(parsed.message);
}

export async function generateText(
  prompt: string,
  systemInstruction?: string,
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const messages: LlmMessage[] = systemInstruction
    ? [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }];

  const body: OpenAiChatRequest = {
    model: 'unused',
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  const providers = buildProviderConfigs();
  if (providers.length === 0) {
    throw new Error('No LLM providers configured');
  }
  let rateLimitInfo: ParsedGeminiError | undefined;

  for (const provider of providers) {
    try {
      const res = await makeChatRequest({ ...provider, model: provider.model }, { ...body, model: provider.model });
      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        const parsedError = parseGeminiError(errText);
        logger.warn({ provider: provider.name, model: provider.model, status: res.status, err: errText }, 'LLM request failed');
        if (isRateLimitError(res.status, parsedError)) {
          rateLimitInfo = {
            ...parsedError,
            retryAfterMs: parsedError.retryAfterMs ?? parseRetryAfterHeader(res),
          };
        }
        continue;
      }

      const json = (await res.json()) as OpenAiChatResponse;
      const text = json.choices?.[0]?.message?.content;
      if (text) return text;
    } catch (err) {
      logger.warn({ provider: provider.name, err }, 'LLM generate error');
    }
  }

  if (rateLimitInfo) {
    throw new GeminiRateLimitError('Gemini rate limit exceeded', rateLimitInfo.retryAfterMs);
  }

  throw new Error('All Gemini models failed');
}

export async function* streamGenerateText(
  prompt: string,
  systemInstruction?: string,
  options?: { temperature?: number },
): AsyncGenerator<LlmStreamChunk> {
  const messages: LlmMessage[] = systemInstruction
    ? [{ role: 'system', content: systemInstruction }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }];

  const body: OpenAiChatRequest = {
    model: 'unused',
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: 2048,
  };

  const providers = buildProviderConfigs();

  for (const provider of providers) {
    try {
      const res = await makeChatRequest({ ...provider, model: provider.model }, { ...body, model: provider.model }, true);
      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        const parsedError = parseGeminiError(errText);
        logger.warn({ provider: provider.name, model: provider.model, status: res.status, err: errText }, 'LLM stream failed');
        if (isRateLimitError(res.status, parsedError)) {
          yield {
            text: '',
            done: true,
            error: 'RATE_LIMITED',
            code: 'RATE_LIMITED',
            retryAfterMs: parsedError.retryAfterMs ?? parseRetryAfterHeader(res),
          };
          return;
        }
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
          if (!data) continue;
          if (data === '[DONE]') {
            yield { text: '', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data) as OpenAiChatResponse;
            const text = parsed.choices?.[0]?.delta?.content;
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
      logger.warn({ provider: provider.name, err }, 'LLM stream error');
    }
  }

  yield { text: STATIC_FALLBACK_TEXT, done: false };
  yield { text: '', done: true, error: 'All models failed', code: 'FAILED' };
}

export { initRedis, closeRedis } from './cache.js';
