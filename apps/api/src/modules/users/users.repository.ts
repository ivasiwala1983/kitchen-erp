/**
 * Users Module — Repository
 */

import prisma from '../../config/database';
import type { User } from '@prisma/client';

export class UsersRepository {
  async findAll(tenantId: string, params: { skip: number; take: number; search?: string }) {
    const where = {
      tenantId,
      deletedAt: null,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          tenantId: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          isSuperAdminCreated: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, total };
  }

  async findById(id: string, tenantId: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
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
    return prisma.user.create({
      data: {
        tenantId: data.tenantId,
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        role: data.role as any,
        isActive: true,
        isSuperAdminCreated: data.isSuperAdminCreated ?? false,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: { name?: string; isActive?: boolean; role?: string; updatedBy: string }
  ): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { ...data, role: data.role as any },
    });
  }

  async softDelete(id: string, tenantId: string, deletedBy: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
  }
}
