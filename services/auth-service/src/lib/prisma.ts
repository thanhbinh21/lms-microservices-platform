import { PrismaClient } from '../generated/prisma';

// Prisma Singleton - tranh loi "too many connections" khi HMR
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.prismaGlobal ??
  new PrismaClient({
    // Chỉ log query và warn từ Prisma engine.
    // Error sẽ được catch và log bởi @lms/logger trong ứng dụng.
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn'] : [],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

export default prisma;
