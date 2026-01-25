import { createClient } from 'redis';
import { logger } from '@lms/logger';

let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Initialize Redis client for session storage
 * Session TTL: 7 days (matches refresh token expiry)
 */
export async function initRedis(redisUrl: string) {
  if (redisClient) {
    return redisClient;
  }

  redisClient = createClient({
    url: redisUrl,
  });

  redisClient.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  await redisClient.connect();
  return redisClient;
}

/**
 * Store session in Redis
 * @param userId - User ID
 * @param sessionData - Session payload (JWT claims)
 * @param ttlSeconds - Time to live in seconds (default: 7 days)
 */
export async function setSession(
  userId: string,
  sessionData: Record<string, any>,
  ttlSeconds: number = 7 * 24 * 60 * 60
) {
  if (!redisClient) throw new Error('Redis not initialized');

  const key = `session:${userId}`;
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(sessionData));
  logger.debug({ userId }, 'Session stored in Redis');
}

/**
 * Get session from Redis
 * @param userId - User ID
 * @returns Session data or null if not found
 */
export async function getSession(userId: string): Promise<Record<string, any> | null> {
  if (!redisClient) throw new Error('Redis not initialized');

  const key = `session:${userId}`;
  const data = await redisClient.get(key);

  if (!data) {
    logger.debug({ userId }, 'Session not found in Redis');
    return null;
  }

  return JSON.parse(data);
}

/**
 * Delete session from Redis (logout)
 * @param userId - User ID
 */
export async function deleteSession(userId: string) {
  if (!redisClient) throw new Error('Redis not initialized');

  const key = `session:${userId}`;
  await redisClient.del(key);
  logger.debug({ userId }, 'Session deleted from Redis');
}

/**
 * Close Redis connection
 */
export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}
