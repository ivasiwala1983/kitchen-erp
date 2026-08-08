/**
 * Auth Module — Repository
 * Data access layer for authentication-related queries.
 */

import prisma from '../../config/database';
import type { User } from '@prisma/client';

export class AuthRepository {
  /**
   * Find a user by email (case-insensitive).
   * Loads soft-deleted check as well.
   */
  async findByEmail(email: string): Promise<any> {
    return prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
      },
      include: { tenant: true },
    });
  }

  /**
   * Find an active user by ID.
   */
  async findById(id: string): Promise<any> {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { tenant: true },
    });
  }

  /**
   * Update the user's password hash.
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, updatedBy: userId },
    });
  }
}
