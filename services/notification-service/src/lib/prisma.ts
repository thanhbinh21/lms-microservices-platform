import { PrismaClient } from '../generated/prisma';

// Prisma Singleton — tranh "too many connections" khi dev HMR.
declare global {
  // eslint-disable-next-line no-var
  var notificationPrismaGlobal: PrismaClient | undefined;
}

const prisma: PrismaClient =
  global.notificationPrismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.notificationPrismaGlobal = prisma;
}

export default prisma;
