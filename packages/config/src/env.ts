import { z } from 'zod';

export const RootEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  APP_DOMAIN: z.string().default('localhost'),
  SEAWEED_URL: z.string().url('SEAWEED_URL must be a valid URL').optional().or(z.literal('')),
  TENANT_MODE: z.enum(['path', 'subdomain']).default('path'),
  PWA_BASE_URL: z.string().default('http://localhost:3002'),
  ADMIN_BASE_URL: z.string().default('http://localhost:3001'),
  API_BASE_URL: z.string().default('http://localhost:4000'),
});

export const ApiEnvSchema = z.object({
  PORT: z.string().transform(Number).default('4000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const WebAppEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Kitchen ERP'),
});

export type RootEnv = z.infer<typeof RootEnvSchema>;
export type ApiEnv = z.infer<typeof ApiEnvSchema>;
export type WebAppEnv = z.infer<typeof WebAppEnvSchema>;

export function validateRootEnv(env: Record<string, string | undefined> = process.env): RootEnv {
  const result = RootEnvSchema.safeParse(env);
  if (!result.success) {
    console.error('❌ Invalid Root Environment Variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid Root Environment Configuration');
  }
  return result.data;
}

export function validateApiEnv(env: Record<string, string | undefined> = process.env): ApiEnv {
  const result = ApiEnvSchema.safeParse(env);
  if (!result.success) {
    console.error('❌ Invalid API Environment Variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid API Environment Configuration');
  }
  return result.data;
}

export function validateWebAppEnv(
  env: Record<string, string | undefined> = process.env
): WebAppEnv {
  const result = WebAppEnvSchema.safeParse(env);
  if (!result.success) {
    console.error('❌ Invalid Web App Environment Variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid Web App Environment Configuration');
  }
  return result.data;
}
