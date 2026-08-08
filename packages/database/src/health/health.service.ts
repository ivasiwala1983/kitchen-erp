/**
 * Enterprise DatabaseHealthService
 * Diagnostics for Prisma Client, PostgreSQL connection, latency, database version, and uptime.
 */

import { prisma } from '../client/prisma';

export interface DatabaseHealthResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  connected: boolean;
  latencyMs: number;
  databaseVersion?: string;
  prismaVersion: string;
  error?: string;
}

export class DatabaseHealthService {
  public static async checkHealth(): Promise<DatabaseHealthResult> {
    const startTime = Date.now();
    try {
      const result: Array<{ version?: string }> = await prisma.$queryRaw`SELECT version()`;
      const latencyMs = Date.now() - startTime;
      const databaseVersion = result?.[0]?.version || 'PostgreSQL';

      return {
        status: latencyMs > 1000 ? 'degraded' : 'healthy',
        connected: true,
        latencyMs,
        databaseVersion,
        prismaVersion: '5.22.0',
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        status: 'unhealthy',
        connected: false,
        latencyMs,
        prismaVersion: '5.22.0',
        error: errorMessage,
      };
    }
  }
}
