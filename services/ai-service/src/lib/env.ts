import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3008'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().optional(),
  CACHE_REDIS_URL: z.string().optional(),

  // Gemini
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  GEMINI_FALLBACK_MODEL: z.string().default('gemini-2.0-flash-lite'),

  // Internal auth
  INTERNAL_SERVICE_SECRET: z.string().min(1),

  // Service URLs
  COURSE_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  LEARNING_SERVICE_URL: z.string().url().default('http://localhost:3006'),
  AUTH_SERVICE_URL: z.string().url().default('http://localhost:3101'),
});

export function validateAiServiceEnv(): void {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    console.error(`[AI-SERVICE] Missing required environment variables:\n${missing}`);
    process.exit(1);
  }
}

export const AI_SERVICE_ENV = envSchema.parse(process.env);
