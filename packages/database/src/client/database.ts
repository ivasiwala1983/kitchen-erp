/**
 * Enterprise DatabaseClient Wrapper
 * Manages connections, connection pools, graceful shutdown, and retry operations.
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

export class DatabaseClient {
  private static instance: DatabaseClient;
  public readonly client: PrismaClient;

  private constructor() {
    this.client = prisma;
  }

  public static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  /**
   * Connect to PostgreSQL database
   */
  public async connect(): Promise<void> {
    await this.client.$connect();
  }

  /**
   * Disconnect gracefully
   */
  public async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }

  /**
   * Execute raw SQL query for ping/health check
   */
  public async ping(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run transaction callback
   */
  public async transaction<T>(
    fn: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<T>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<T> {
    return this.client.$transaction(fn, options);
  }
}

export const db = DatabaseClient.getInstance();
export default db;
