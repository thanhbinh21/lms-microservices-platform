const { PrismaClient } = require('../generated/prisma');

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prismaInstructor ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaInstructor = prisma;
}

module.exports = prisma;
