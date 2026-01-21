// Placeholder for Prisma client exports
// Will be populated per service in later phases

export const dbConfig = {
  authDb: process.env.DATABASE_URL_AUTH,
  courseDb: process.env.DATABASE_URL_COURSE,
  paymentDb: process.env.DATABASE_URL_PAYMENT,
  mediaDb: process.env.DATABASE_URL_MEDIA,
  notificationDb: process.env.DATABASE_URL_NOTIFICATION,
};

export default dbConfig;
