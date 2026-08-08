/**
 * Health Check Controller
 * Verifies Node runtime, server uptime, environment variables, Prisma Client initialization,
 * and Supabase PostgreSQL database connectivity via SELECT 1.
 */

import { Request, Response } from 'express';
import { config, getMissingEnvVars } from '../../config/env';
import { testDatabaseConnection, prisma } from '../../config/database';

export interface HealthStatusResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
  nodeVersion: string;
  database: {
    connected: boolean;
    latencyMs?: number;
    error?: string;
  };
  prisma: {
    initialized: boolean;
    error?: string;
  };
  missingEnv: string[];
}

export async function getHealthStatus(req: Request, res: Response): Promise<void> {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';

  console.log(`[HEALTH CHECK] Health Check Invoked from ${clientIp} - ${userAgent}`);

  // 1. Check required environment variables
  const missingEnv = getMissingEnvVars();
  if (missingEnv.length > 0) {
    console.warn(
      `[HEALTH CHECK] Environment Validation Failed - Missing variables: ${missingEnv.join(', ')}`
    );
  } else {
    console.log('[HEALTH CHECK] Environment Validation Passed');
  }

  // 2. Check Prisma Client initialization
  let prismaInitialized = false;
  let prismaError: string | undefined;
  try {
    if (prisma) {
      prismaInitialized = true;
      console.log('[HEALTH CHECK] Prisma Connected');
    }
  } catch (err) {
    prismaInitialized = false;
    prismaError = err instanceof Error ? err.message : String(err);
    console.error('[HEALTH CHECK] Prisma Initialization Failure:', prismaError);
  }

  // 3. Test Database Connectivity via SELECT 1
  let dbResult = { connected: false } as Awaited<ReturnType<typeof testDatabaseConnection>>;
  if (prismaInitialized) {
    dbResult = await testDatabaseConnection();
    if (dbResult.connected) {
      console.log(`[HEALTH CHECK] Database Connected (${dbResult.latencyMs ?? 0}ms)`);
    } else {
      console.error(`[HEALTH CHECK] Database Failure: ${dbResult.error || 'Connection failed'}`);
    }
  }

  // 4. Determine overall health status
  const isHealthy = dbResult.connected && missingEnv.length === 0 && prismaInitialized;
  const statusCode = isHealthy ? 200 : 503;

  const responsePayload: HealthStatusResponse = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    service: 'Kitchen ERP API',
    version: '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    nodeVersion: process.version,
    database: dbResult,
    prisma: {
      initialized: prismaInitialized,
      ...(prismaError ? { error: prismaError } : {}),
    },
    missingEnv,
  };

  res.status(statusCode).json(responsePayload);
}
