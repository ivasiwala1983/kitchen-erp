/**
 * Centralized TransactionService Helper
 * Standardized wrapper for executing atomic Prisma transactions.
 */

import { PrismaClient } from '../generated/client';
import { prisma } from '../client/prisma';

export class TransactionService {
  /**
   * Run an atomic callback inside a Prisma transaction
   */
  public static async runTransaction<T>(
    fn: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<T>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<T> {
    return prisma.$transaction(fn, {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
    });
  }
}
