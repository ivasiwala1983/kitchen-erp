/**
 * Users Module — Repository Adapter
 * Delegates to enterprise @kitchen-erp/database UserRepository.
 */

import { userRepository as dbUserRepository, User, Role } from '@kitchen-erp/database';

export class UsersRepository {
  async findAll(tenantId: string, params: { skip: number; take: number; search?: string }) {
    const { items, total } = await dbUserRepository.findAll({
      tenantId,
      skip: params.skip,
      take: params.take,
      search: params.search,
    });
    return { users: items, total };
  }

  async findById(id: string, tenantId: string): Promise<User | null> {
    const user = await dbUserRepository.findById(id);
    if (!user || (tenantId && user.tenantId !== tenantId)) return null;
    return user;
  }

  async create(data: {
    tenantId: string;
    email: string;
    passwordHash: string;
    name: string;
    role: string;
    isSuperAdminCreated?: boolean;
    createdBy: string;
  }): Promise<User> {
    return dbUserRepository.create({
      tenantId: data.tenantId,
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role as Role,
      isSuperAdminCreated: data.isSuperAdminCreated,
      createdBy: data.createdBy,
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: { name?: string; isActive?: boolean; role?: string; updatedBy: string }
  ): Promise<User> {
    return dbUserRepository.update(id, {
      ...(data.name && { name: data.name }),
      ...(data.role && { role: data.role as Role }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedBy: data.updatedBy,
    });
  }

  async softDelete(id: string, tenantId: string, deletedBy: string): Promise<void> {
    await dbUserRepository.softDelete(id, deletedBy);
  }
}
