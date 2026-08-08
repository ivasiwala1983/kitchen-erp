/**
 * Enterprise Health Check Controller
 * Verifies Node runtime, server uptime, environment variables, Prisma Client initialization,
 * and PostgreSQL database connectivity via DatabaseHealthService.
 */

import { Request, Response } from 'express';
import { config, getMissingEnvVars } from '../../config/env';
import { DatabaseHealthService, DatabaseHealthResult } from '@kitchen-erp/database';

export interface HealthStatusResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
  nodeVersion: string;
  database: DatabaseHealthResult;
  missingEnv: string[];
}

export async function getHealthStatus(req: Request, res: Response): Promise<void> {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';

  console.log(`[HEALTH CHECK] Health Check Invoked from ${clientIp} - ${userAgent}`);

  // 1. Check required environment variables
  const missingEnv = getMissingEnvVars();

  // 2. Execute Database Health Check
  const dbHealth = await DatabaseHealthService.checkHealth();

  if (dbHealth.connected) {
    console.log(`[HEALTH CHECK] Database Connected (${dbHealth.latencyMs}ms)`);
  } else {
    console.error(`[HEALTH CHECK] Database Failure: ${dbHealth.error || 'Connection failed'}`);
  }

  // 3. Determine overall health status
  const isHealthy = dbHealth.connected && missingEnv.length === 0;
  const statusCode = isHealthy ? 200 : 503;

  const responsePayload: HealthStatusResponse = {
    status: isHealthy ? dbHealth.status : 'unhealthy',
    service: 'Kitchen ERP API',
    version: '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    nodeVersion: process.version,
    database: dbHealth,
    missingEnv,
  };

  res.status(statusCode).json(responsePayload);
}
