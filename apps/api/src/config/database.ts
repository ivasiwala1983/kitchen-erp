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

export default prisma;
