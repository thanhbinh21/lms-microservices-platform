import { createClient, type RedisClientType } from 'redis';

// Redis client dung rieng cho cache (tach biet voi session Redis cua auth-service).
// Key prefix 'cache:' ngan tranh xung dot voi session keys ('session:').
let cacheClient: RedisClientType | null = null;
let isConnected = false;

/** Khoi tao ket noi Redis cho cache layer */
export async function initCache(redisUrl: string): Promise<void> {
  if (cacheClient) return;

  // Upstash dung rediss:// (TLS) — bat TLS tu dong theo URL scheme
  cacheClient = createClient({
    url: redisUrl,
    socket: {
      tls: redisUrl.startsWith('rediss://'),
      rejectUnauthorized: false,
    },
  }) as RedisClientType;

  cacheClient.on('error', (err: Error) => {
    // Log loi nhung khong throw — cache loi khong duoc crash service
    console.error('[Cache] Redis error:', err.message);
    isConnected = false;
  });

  cacheClient.on('connect', () => {
    console.info('[Cache] Redis connected');
    isConnected = true;
  });

  cacheClient.on('reconnecting', () => {
    console.warn('[Cache] Redis reconnecting...');
  });

  cacheClient.on('ready', () => {
    isConnected = true;
  });

  await cacheClient.connect();
}

/**
 * Cache-aside pattern:
 *  1. Doc tu Redis (key)
 *  2. HIT → tra ve data tu cache
 *  3. MISS → goi fn(), luu ket qua vao cache, tra ve
 *  4. Redis loi → fallback goi fn() truc tiep (graceful degradation)
 */
export async function cacheGet<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds = 300,
): Promise<T> {
  // Graceful degradation: neu Redis chua init hoac mat ket noi
  if (!cacheClient || !isConnected) {
    return fn();
  }

  try {
    const cached = await cacheClient.get(key);
    if (cached !== null) {
      console.log(`[Cache] HIT: ${key}`);
      return JSON.parse(cached) as T;
    }
  } catch {
    // Cache read loi → fallback ve DB, khong block
  }

  // Cache miss → goi source function
  console.log(`[Cache] MISS: ${key}`);
  const result = await fn();

  // Ghi cache non-blocking de khong lam cham response
  if (result !== null && result !== undefined) {
    cacheClient.setEx(key, ttlSeconds, JSON.stringify(result)).catch(() => {
      // Ghi cache loi → bo qua, request van thanh cong
    });
  }

  return result;
}

/**
 * Xoa cache theo danh sach key cu the.
 * Dung sau write operations (update/publish/delete).
 */
export async function cacheInvalidate(...keys: string[]): Promise<void> {
  if (!cacheClient || !isConnected || keys.length === 0) return;
  try {
    await cacheClient.del(keys);
  } catch {
    // Xoa cache loi → bo qua, TTL tu xu ly sau
  }
}

/**
 * Xoa cache theo pattern (vi du: "cache:courses:list:*").
 * Dung SCAN thay vi KEYS de tranh block Redis tren keyspace lon.
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  if (!cacheClient || !isConnected) return;
  try {
    const keys: string[] = [];
    for await (const key of cacheClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }
    if (keys.length > 0) {
      await cacheClient.del(keys);
    }
  } catch {
    // Pattern delete loi → bo qua
  }
}

/** Ping Redis de kiem tra ket noi (dung cho health check) */
export async function cachePing(): Promise<boolean> {
  if (!cacheClient || !isConnected) return false;
  try {
    const result = await cacheClient.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/** Dong ket noi Redis khi shutdown service */
export async function closeCache(): Promise<void> {
  if (cacheClient) {
    try {
      await cacheClient.quit();
    } catch {
      // Quit co the fail neu da mat ket noi
    }
    cacheClient = null;
    isConnected = false;
  }
}
