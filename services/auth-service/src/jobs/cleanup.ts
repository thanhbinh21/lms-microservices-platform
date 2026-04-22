import cron from 'node-cron';
import { logger } from '@lms/logger';
import prisma from '../lib/prisma.js';

/**
 * Cleanup expired RefreshTokens periodically.
 */
export function startCleanupJobs() {
  // Chạy lúc 03:00 AM mỗi ngày
  cron.schedule('0 3 * * *', async () => {
    const startTime = Date.now();
    try {
      logger.info('Bắt đầu cron job: Dọn dẹp refresh token hết hạn');
      
      const result = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      const duration = Date.now() - startTime;
      logger.info(
        { recordsDeleted: result.count, durationMs: duration },
        'Hoàn thành cron job dọn dẹp',
      );
    } catch (error) {
      logger.error({ error, durationMs: Date.now() - startTime }, 'Lỗi khi chạy cron job dọn dẹp');
    }
  });

  logger.info('Đã lên lịch các cron jobs (cleanup)');
}
