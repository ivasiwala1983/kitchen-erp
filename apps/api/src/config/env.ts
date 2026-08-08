/**
 * Environment configuration
 * Validates and exports all required environment variables.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    console.warn(`⚠️ Warning: Missing required environment variable: ${key}`);
    return '';
  }
  return value;
}

export const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'APP_DOMAIN',
  'NODE_ENV',
] as const;

export function getMissingEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter((key) => !process.env[key] || process.env[key]?.trim() === '');
}

export const config = {
  // Server
  port: parseInt(process.env.PORT || process.env.API_PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),
  directUrl: process.env.DIRECT_URL || '',

  // Domain & Auth
  appDomain: process.env.APP_DOMAIN || 'localhost',
  jwtSecret: requireEnv('JWT_SECRET', 'dev-secret-change-in-production'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // CORS
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001').split(','),

  // SeaweedFS
  seaweedMasterUrl: process.env.SEAWEEDFS_MASTER_URL || 'http://localhost:9333',
  seaweedPublicUrl: process.env.SEAWEEDFS_PUBLIC_URL || 'http://localhost:8080',
  seaweedFallbackLocal: process.env.SEAWEEDFS_FALLBACK_LOCAL === 'true',
  uploadsDir: process.env.UPLOADS_DIR || './uploads',

  // API
  apiPrefix: '/api',
};
