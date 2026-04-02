import { PrismaClient } from '../generated/prisma';

const globalForPrisma = globalThis as typeof globalThis & {
  prismaInstructor?: PrismaClient;
};

export const prisma =
  globalForPrisma.prismaInstructor ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaInstructor = prisma;
}
