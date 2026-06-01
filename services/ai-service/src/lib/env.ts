import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

function loadLocalEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Giu bien moi truong tu shell neu da duoc set de dev/prod co the override .env.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

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

  // LLM Providers
  AI_PROVIDER_ORDER: z.string().optional(),

  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().optional(),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().optional(),
  OPENROUTER_APP_URL: z.string().optional(),
  OPENROUTER_APP_NAME: z.string().optional(),

  AI_STRICT_CONTEXT_GATE: z.string().default('false'),
  AI_DEMO_FALLBACK_QUIZ: z.string().default('false'),

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
