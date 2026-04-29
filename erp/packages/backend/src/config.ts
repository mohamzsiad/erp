import { z } from 'zod';

/**
 * Centralised environment configuration with Zod validation.
 * All required vars are validated at startup — the process exits immediately
 * with a clear error if any required variable is missing or malformed.
 */
const envSchema = z.object({
  // ── Runtime ─────────────────────────────────────────────────────────────────
  NODE_ENV:   z.enum(['development', 'test', 'production']).default('development'),
  PORT:       z.coerce.number().min(1).max(65535).default(3000),
  APP_URL:    z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL:  z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // ── Build metadata (injected by Docker/CI, optional) ────────────────────────
  BUILD_SHA:     z.string().optional(),
  BUILD_VERSION: z.string().optional(),

  // ── Database ─────────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Redis ─────────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // ── JWT ───────────────────────────────────────────────────────────────────────
  JWT_SECRET:         z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN:  z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // ── SMTP (optional — notifications disabled if not set) ────────────────────
  SMTP_HOST:     z.string().optional(),
  SMTP_PORT:     z.coerce.number().min(1).max(65535).optional(),
  SMTP_USER:     z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM:     z.string().email().optional(),

  // ── Azure Storage (optional — file uploads disabled if not set) ────────────
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
  AZURE_BLOB_CONTAINER:            z.string().default('erp-attachments'),

  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

  // ── Azure Application Insights (optional — telemetry disabled if not set) ──
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),

  // ── Rate limiting (per-IP req/min) ───────────────────────────────────────────
  RATE_LIMIT_PUBLIC:  z.coerce.number().default(100),   // unauthenticated
  RATE_LIMIT_AUTH:    z.coerce.number().default(1000),  // authenticated
  REQUEST_SIZE_LIMIT: z.string().default('10mb'),

  // ── Security ─────────────────────────────────────────────────────────────────
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(14).default(12),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    console.error('');
    console.error('❌  Invalid / missing environment variables:');
    Object.entries(errors).forEach(([key, msgs]) => {
      console.error(`   • ${key}: ${msgs?.join(', ')}`);
    });
    console.error('');
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
export type Config  = typeof config;
