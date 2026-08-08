/**
 * Enterprise Single-Source PrismaClient Singleton
 * Prevents connection pool exhaustion in serverless / hot-reloading environments.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prismaClientSingleton?: PrismaClient;
};

export function createPrismaClient(): PrismaClient {
  let dbUrl = process.env.DATABASE_URL;

  // When connecting via PgBouncer / Supabase pooler, prepared statements cause
  // Postgres error 42P05 ("prepared statement 's2' already exists").
  // Appending pgbouncer=true disables statement caching in Prisma Client.
  if (dbUrl && !dbUrl.includes('pgbouncer=true')) {
    const separator = dbUrl.includes('?') ? '&' : '?';
    dbUrl = `${dbUrl}${separator}pgbouncer=true`;
  }

  return new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.prismaClientSingleton ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaClientSingleton = prisma;
}

export default prisma;
