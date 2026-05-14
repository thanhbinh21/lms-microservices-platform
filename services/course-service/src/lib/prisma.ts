import { PrismaClient } from '../generated/prisma';

// Prisma Singleton — prevents "too many connections" during HMR
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const prisma: PrismaClient =
  global.prismaGlobal ??
  new PrismaClient({
    // Chỉ log query và warn từ Prisma engine.
    // Error sẽ được catch và log bởi @lms/logger trong ứng dụng.
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn'] : [],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

// Neon cold-start: khoi dong truoc de giam latency request dau tien.
// Khong await — neu Neon dang sleep, service van khoi dong binh thuong.
prisma.$connect().catch((err: Error) => {
  console.warn('[Prisma] Initial connect failed, will retry on first query:', err.message);
});

export default prisma;
