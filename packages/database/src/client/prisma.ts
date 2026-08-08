/**
 * Enterprise Single-Source PrismaClient Singleton
 * Prevents connection pool exhaustion in serverless / hot-reloading environments.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prismaClientSingleton?: PrismaClient;
};

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.prismaClientSingleton ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaClientSingleton = prisma;
}

export default prisma;
