/**
 * Enterprise Single-Source PrismaClient Singleton
 * Prevents connection pool exhaustion in serverless / hot-reloading environments.
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../generated/client';

const globalForPrisma = globalThis as unknown as {
  prismaClientSingleton?: PrismaClient;
};

export function createPrismaClient(): PrismaClient {
  try {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      const candidates = [
        path.join(
          process.cwd(),
          'packages/database/src/generated/client/libquery_engine-rhel-openssl-3.0.x.so.node'
        ),
        path.join(process.cwd(), 'src/generated/client/libquery_engine-rhel-openssl-3.0.x.so.node'),
        path.join(__dirname, '../generated/client/libquery_engine-rhel-openssl-3.0.x.so.node'),
        path.join(__dirname, 'libquery_engine-rhel-openssl-3.0.x.so.node'),
        path.join(process.cwd(), 'libquery_engine-rhel-openssl-3.0.x.so.node'),
      ];

      for (const enginePath of candidates) {
        if (fs.existsSync(enginePath)) {
          console.log(`[PRISMA INIT] Found query engine at: ${enginePath}`);
          process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath;
          break;
        }
      }
    }

    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  } catch (error) {
    console.error('[PRISMA INIT ERROR] Failed to instantiate PrismaClient:', error);
    return new PrismaClient();
  }
}

export const prisma: PrismaClient = globalForPrisma.prismaClientSingleton ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaClientSingleton = prisma;
}

export default prisma;
