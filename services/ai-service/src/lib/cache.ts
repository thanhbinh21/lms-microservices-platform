import { logger } from './logger.js';
import { AI_SERVICE_ENV } from './env.js';
import { Redis } from 'ioredis';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const memoryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getRedisClient() {
  const redisUrl = AI_SERVICE_ENV.CACHE_REDIS_URL || AI_SERVICE_ENV.REDIS_URL;
  if (!redisUrl) return null;
  try {
    return new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
    });
  } catch {
    return null;
  }
}

const redis = getRedisClient();

async function initRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.connect();
      logger.info('[CACHE] Redis connected');
    } catch (err) {
      logger.warn({ err }, '[CACHE] Redis connect failed — using memory cache');
    }
  }
}

function closeRedis(): void {
  if (redis) {
    void redis.quit().catch(() => {});
  }
}

async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        logger.debug({ key }, '[CACHE] Redis hit');
        return parsed;
      }
    } catch {
      // fall through to memory
    }
  }

  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > Date.now()) {
    logger.debug({ key }, '[CACHE] Memory hit');
    return entry.value;
  }
  if (entry) {
    memoryCache.delete(key);
  }
  return null;
}

async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (redis) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
      return;
    } catch {
      // fall through to memory
    }
  }

  const expiresAt = Date.now() + ttlSeconds * 1000;
  memoryCache.set(key, { value, expiresAt });

  // Clean up old timer
  const existing = memoryTimers.get(key);
  if (existing) clearTimeout(existing);

  // Auto-evict
  const timer = setTimeout(() => {
    memoryCache.delete(key);
    memoryTimers.delete(key);
  }, ttlSeconds * 1000);
  memoryTimers.set(key, timer);
}

async function cacheInvalidate(key: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  }
  memoryCache.delete(key);
  const t = memoryTimers.get(key);
  if (t) {
    clearTimeout(t);
    memoryTimers.delete(key);
  }
}

async function cacheInvalidatePattern(pattern: string): Promise<void> {
  if (redis) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // ignore
    }
  }
  // Memory pattern invalidation
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
      const t = memoryTimers.get(key);
      if (t) {
        clearTimeout(t);
        memoryTimers.delete(key);
      }
    }
  }
}

async function cachePing(): Promise<boolean> {
  if (!redis) return false;
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export { initRedis, closeRedis, cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePattern, cachePing };
