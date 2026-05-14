import { PrismaClient } from '../generated/prisma';

// Prisma Singleton — tranh "too many connections" khi dev HMR.
declare global {
  // eslint-disable-next-line no-var
  var paymentPrismaGlobal: PrismaClient | undefined;
}

const prisma: PrismaClient =
  global.paymentPrismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.paymentPrismaGlobal = prisma;
}

export default prisma;
