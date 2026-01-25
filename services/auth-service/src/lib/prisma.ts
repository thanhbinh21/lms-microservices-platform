import { createPrismaClient } from '@lms/db-prisma';

// Initialize Prisma Client with singleton pattern
// Prevents "too many connections" in development (HMR)
export const prisma = createPrismaClient(process.env.DATABASE_URL!);

export default prisma;
