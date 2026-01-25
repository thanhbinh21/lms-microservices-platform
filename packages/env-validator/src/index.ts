import { z } from 'zod';

/**
 * Environment Variable Validator using Zod
 * Reference: T3 Env pattern for runtime validation
 * Prevents app from starting with missing/invalid env vars
 */

// Base schema for all services
const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

// Kafka schema
const kafkaEnvSchema = z.object({
  KAFKA_BROKER: z.string().min(1, 'KAFKA_BROKER is required'),
});

// Redis schema
const redisEnvSchema = z.object({
  REDIS_URL: z.string().url('REDIS_URL must be valid URL'),
});

// Database schema (for services using Neon)
const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be valid PostgreSQL URL'),
});

// JWT schema (for auth service)
const jwtEnvSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
});

// VNPay schema (for payment service - Phase 10)
const vnpayEnvSchema = z.object({
  VNPAY_TMN_CODE: z.string().min(1, 'VNPAY_TMN_CODE is required'),
  VNPAY_HASH_SECRET: z.string().min(1, 'VNPAY_HASH_SECRET is required'),
  VNPAY_URL: z.string().url('VNPAY_URL must be valid URL'),
  VNPAY_RETURN_URL: z.string().url('VNPAY_RETURN_URL must be valid URL'),
});

/**
 * Validate environment variables
 * @param schemas - Array of Zod schemas to merge and validate
 * @throws {Error} If validation fails with detailed error messages
 */
export function validateEnv<T extends z.ZodRawShape>(
  ...schemas: z.ZodObject<any>[]
): z.infer<z.ZodObject<T>> {
  const mergedSchema = schemas.reduce((acc, schema) => acc.merge(schema), z.object({}));

  const parsed = mergedSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Environment validation failed:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Invalid environment variables. Check logs above.');
  }

  return parsed.data as z.infer<z.ZodObject<T>>;
}

// Export schemas for reuse
export const envSchemas = {
  base: baseEnvSchema,
  kafka: kafkaEnvSchema,
  redis: redisEnvSchema,
  database: databaseEnvSchema,
  jwt: jwtEnvSchema,
  vnpay: vnpayEnvSchema,
};

// Helper functions for common service patterns
export const validateAuthServiceEnv = () =>
  validateEnv(baseEnvSchema, databaseEnvSchema, redisEnvSchema, jwtEnvSchema);

export const validateCourseServiceEnv = () =>
  validateEnv(baseEnvSchema, databaseEnvSchema, kafkaEnvSchema);

export const validatePaymentServiceEnv = () =>
  validateEnv(baseEnvSchema, databaseEnvSchema, kafkaEnvSchema, vnpayEnvSchema);

export const validateMediaServiceEnv = () =>
  validateEnv(baseEnvSchema, databaseEnvSchema);

export const validateNotificationServiceEnv = () =>
  validateEnv(baseEnvSchema, databaseEnvSchema, kafkaEnvSchema);
