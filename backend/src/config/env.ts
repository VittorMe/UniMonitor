import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

/// Aceita "15m", "7d", "3600s", "12h" ou um numero puro de segundos.
const durationPattern = /^\d+(ms|s|m|h|d)?$/;

const csvToArray = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatoria'),

  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174').transform(csvToArray),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET precisa de ao menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET precisa de ao menos 32 caracteres'),
  JWT_ACCESS_TTL: z.string().regex(durationPattern).default('15m'),
  JWT_REFRESH_TTL: z.string().regex(durationPattern).default('7d'),

  COOKIE_ACCESS_NAME: z.string().min(1).default('unimonitor_at'),
  COOKIE_REFRESH_NAME: z.string().min(1).default('unimonitor_rt'),
  COOKIE_DOMAIN: z.string().optional(),

  SEED_ADMIN_NAME: z.string().default('Administrador'),
  SEED_ADMIN_EMAIL: z.string().default('admin@unimonitor.local'),
  SEED_ADMIN_PASSWORD: z.string().default('Admin@123456'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
    .join('\n');

  throw new Error(`Variaveis de ambiente invalidas:\n${details}`);
}

export const env = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
});

export type Env = typeof env;
