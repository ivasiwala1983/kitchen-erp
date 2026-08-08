/**
 * Users Module — Service
 */

import bcrypt from 'bcryptjs';
import { UsersRepository } from './users.repository';
import { ConflictError, NotFoundError, ForbiddenError } from '../../shared/errors';
import type { CreateUserInput, UpdateUserInput } from './users.validation';
import { parsePagination } from '@kitchen-erp/utils';
import { Role } from '@kitchen-erp/types';
import prisma from '../../config/database';

export class UsersService {
  private repo = new UsersRepository();

  async list(tenantId: string, page?: number, limit?: number, search?: string) {
    const { page: p, limit: l, skip } = parsePagination(page, limit);
    const { users, total } = await this.repo.findAll(tenantId, { skip, take: l, search });
    return { data: users, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async getById(id: string, tenantId: string) {
    const user = await this.repo.findById(id, tenantId);
    if (!user) throw new NotFoundError('User not found');
    const { passwordHash, ...safe } = user;
    void passwordHash;
    return safe;
  }

  async create(tenantId: string, dto: CreateUserInput, createdBy: string, creatorRole: Role) {
    // Tenant admins can create TENANT_ADMIN or INVENTORY_MANAGER
    if (creatorRole === Role.TENANT_ADMIN && dto.role === Role.SUPER_ADMIN) {
      throw new ForbiddenError('Tenant admins cannot create super admins');
    }

    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictError(`Email '${dto.email}' is already registered`);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const isSuperAdminCreated = creatorRole === Role.SUPER_ADMIN;

    const user = await this.repo.create({
      tenantId,
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
      isSuperAdminCreated,
      createdBy,
    });

    const { passwordHash: _, ...safe } = user;
    void _;
    return safe;
  }

  async update(id: string, tenantId: string, dto: UpdateUserInput, updatedBy: string) {
    await this.getById(id, tenantId);
    return this.repo.update(id, tenantId, { ...dto, updatedBy });
  }

  async delete(id: string, tenantId: string, deletedBy: string, deleterRole: Role) {
    const target = await this.repo.findById(id, tenantId);
    if (!target) throw new NotFoundError('User not found');

    if (deleterRole !== Role.SUPER_ADMIN && target.isSuperAdminCreated) {
      throw new ForbiddenError(
        'Tenant Admins created by Super Admin can only be deleted by Super Admin'
      );
    }

    await this.repo.softDelete(id, tenantId, deletedBy);
  }
}
