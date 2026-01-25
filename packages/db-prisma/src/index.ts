import { PrismaClient } from '@prisma/client';

// Prisma Client Singleton Pattern (prevents "too many connections" in development)
// Reference: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management#prevent-hot-reloading-from-creating-new-instances-of-prismaclient

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const createPrismaClient = (databaseUrl: string) => {
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: ['error'],
    });
  }

  // Development: use global variable to prevent HMR creating multiple instances
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: ['query', 'error', 'warn'],
    });
  }

  return global.prismaGlobal;
};

// Database URLs configuration
export const dbConfig = {
  authDb: process.env.DATABASE_URL_AUTH,
  courseDb: process.env.DATABASE_URL_COURSE,
  paymentDb: process.env.DATABASE_URL_PAYMENT,
  mediaDb: process.env.DATABASE_URL_MEDIA,
  notificationDb: process.env.DATABASE_URL_NOTIFICATION,
};

export default dbConfig;
