import { createClient, RedisClientType } from 'redis';
import { logger } from '@lms/logger';

let redisClient: RedisClientType | null = null;

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 ngay

/** Khoi tao ket noi Redis cho session storage */
export async function initRedis(redisUrl: string): Promise<RedisClientType> {
  if (redisClient) return redisClient;

  redisClient = createClient({
    url: redisUrl,
  });

  redisClient.on('error', (err) => {
    logger.error({ err }, 'Loi ket noi Redis');
  });

  redisClient.on('connect', () => {
    logger.info('Redis da ket noi thanh cong');
  });

  await redisClient.connect();
  return redisClient;
}

/**
 * Luu session nguoi dung vao Redis
 * TTL mac dinh 7 ngay (trung voi refresh token)
 */
export async function setSession(
  userId: string,
  sessionData: Record<string, any>,
  ttlSeconds: number = SESSION_TTL_SECONDS,
) {
  if (!redisClient) throw new Error('Redis not initialized');

  const key = `session:${userId}`;
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(sessionData));
  logger.debug({ userId }, 'Session da luu vao Redis');
}

/** Lay session tu Redis */
export async function getSession(userId: string): Promise<Record<string, any> | null> {
  if (!redisClient) throw new Error('Redis not initialized');

  const key = `session:${userId}`;
  const data = await redisClient.get(key);

  if (!data) {
    logger.debug({ userId }, 'Session khong tim thay');
    return null;
  }

  return JSON.parse(data);
}

/** Xoa session (logout) */
export async function deleteSession(userId: string) {
  if (!redisClient) throw new Error('Redis not initialized');

  const key = `session:${userId}`;
  await redisClient.del(key);
  logger.debug({ userId }, 'Session da xoa');
}

/** Dong ket noi Redis */
export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis da dong ket noi');
  }
}
