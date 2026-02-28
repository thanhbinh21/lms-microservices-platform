import { PrismaClient } from '../generated/prisma';

// Singleton Prisma Client — tranh tao nhieu instance khi hot-reload
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const prisma: PrismaClient =
  global.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Trong dev, luu vao global de tranh tao moi moi lan reload
if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

export default prisma;
