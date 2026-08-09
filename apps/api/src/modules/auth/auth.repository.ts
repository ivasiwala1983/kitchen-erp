/**
 * Auth Module — Repository Adapter
 * Delegates to enterprise @kitchen-erp/database UserRepository.
 */

import { userRepository } from '@kitchen-erp/database';

export class AuthRepository {
  async findByEmail(email: string): Promise<ReturnType<typeof userRepository.findByEmail>> {
    return userRepository.findByEmail(email);
  }

  async findById(id: string): Promise<ReturnType<typeof userRepository.findById>> {
    return userRepository.findById(id);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await userRepository.update(userId, { passwordHash, updatedBy: userId });
  }
}
