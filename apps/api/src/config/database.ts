/**
 * Prisma database client singleton.
 * Reuses a single PrismaClient instance across the application.
 */

import { PrismaClient } from '@prisma/client';
import { config } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isDev ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

globalForPrisma.prisma = prisma;

/**
 * Sanitizes connection strings, passwords, and sensitive info from error messages.
 */
export function sanitizeDatabaseError(error: unknown): string {
  if (!error) return 'Unknown database error';
  const rawMessage = error instanceof Error ? error.message : String(error);

  // Replace postgresql:// or postgres:// connection strings containing passwords
  return rawMessage
    .replace(/postgres(?:ql)?:\/\/[^@]+@/gi, 'postgresql://*****:*****@')
    .replace(/password=[\w-]+/gi, 'password=*****')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * Executes `SELECT 1` via Prisma to test PostgreSQL connectivity.
 */
export async function testDatabaseConnection(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    // Execute simple query to verify database round-trip
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;
    return {
      connected: true,
      latencyMs,
    };
  } catch (error) {
    const sanitizedMsg = sanitizeDatabaseError(error);
    return {
      connected: false,
      error: sanitizedMsg,
    };
  }
}

export default prisma;
