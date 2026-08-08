/**
 * Auth Module — Repository Adapter
 * Delegates to enterprise @kitchen-erp/database UserRepository.
 */

import { userRepository } from '@kitchen-erp/database';

export class AuthRepository {
  async findByEmail(email: string): Promise<any> {
    return userRepository.findByEmail(email);
  }

  async findById(id: string): Promise<any> {
    return userRepository.findById(id);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await userRepository.update(userId, { passwordHash, updatedBy: userId });
  }
}
