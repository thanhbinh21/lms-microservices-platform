import { z } from 'zod';

/**
 * Xac thuc bien moi truong bang Zod.
 * Ngan ung dung khoi dong voi env thieu hoac sai.
 */

// Schema chung cho moi service
const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

// Kafka (Phase 11-12)
const kafkaEnvSchema = z.object({
  KAFKA_BROKER: z.string().min(1, 'KAFKA_BROKER is required'),
});

// Redis
const redisEnvSchema = z.object({
  REDIS_URL: z.string().url('REDIS_URL must be valid URL'),
});

// Database (Neon PostgreSQL)
const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be valid PostgreSQL URL'),
});

// JWT (chi auth-service)
const jwtEnvSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
});

// VNPay (Phase 10 - payment-service)
const vnpayEnvSchema = z.object({
  VNPAY_TMN_CODE: z.string().min(1, 'VNPAY_TMN_CODE is required'),
  VNPAY_HASH_SECRET: z.string().min(1, 'VNPAY_HASH_SECRET is required'),
  VNPAY_URL: z.string().url('VNPAY_URL must be valid URL'),
  VNPAY_RETURN_URL: z.string().url('VNPAY_RETURN_URL must be valid URL'),
});

// Storage (Phase 6 - media-service)
const storageEnvSchema = z.object({
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
});

/**
 * Xac thuc env vars voi cac schema Zod da merge
 * @throws {Error} Neu xac thuc that bai
 */
export function validateEnv<T extends z.ZodRawShape>(
  ...schemas: z.ZodObject<any>[]
): z.infer<z.ZodObject<T>> {
  const mergedSchema = schemas.reduce((acc, schema) => acc.merge(schema), z.object({}));

  const parsed = mergedSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Xac thuc bien moi truong that bai:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Bien moi truong khong hop le. Kiem tra log phia tren.');
  }

  return parsed.data as z.infer<z.ZodObject<T>>;
}

// Export schemas de tai su dung
export const envSchemas = {
  base: baseEnvSchema,
  kafka: kafkaEnvSchema,
  redis: redisEnvSchema,
  database: databaseEnvSchema,
  jwt: jwtEnvSchema,
  vnpay: vnpayEnvSchema,
  storage: storageEnvSchema,
};

// Helper functions for common service patterns
export const validateAuthServiceEnv = () =>
  validateEnv(baseEnvSchema, databaseEnvSchema, redisEnvSchema, jwtEnvSchema);

// Kafka se duoc them lai khi Phase 11-12 tich hop
export const validateCourseServiceEnv = () =>
  validateEnv(baseEnvSchema, databaseEnvSchema);

export const validatePaymentServiceEnv = () =>
  validateEnv(baseEnvSchema, databaseEnvSchema, kafkaEnvSchema, vnpayEnvSchema);

export const validateMediaServiceEnv = () =>
  validateEnv(baseEnvSchema, databaseEnvSchema, storageEnvSchema);

export const validateNotificationServiceEnv = () =>
  validateEnv(baseEnvSchema, databaseEnvSchema, kafkaEnvSchema);
