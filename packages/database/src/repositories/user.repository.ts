/**
 * UserRepository
 * Encapsulates all User & authentication data access queries.
 */

import { Prisma, User, Role } from '@prisma/client';
import { prisma } from '../client/prisma';

export interface CreateUserDto {
  tenantId?: string | null;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  isSuperAdminCreated?: boolean;
  createdBy?: string;
}

export interface UpdateUserDto {
  name?: string;
  passwordHash?: string;
  role?: Role;
  isActive?: boolean;
  updatedBy?: string;
}

export class UserRepository {
  async findById(
    id: string
  ): Promise<
    | (User & {
        tenant?: { id: string; name: string; slug: string; plan: string; currency: string } | null;
      })
    | null
  > {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            currency: true,
          },
        },
      },
    });
  }

  async findByEmail(
    email: string
  ): Promise<
    | (User & {
        tenant?: { id: string; name: string; slug: string; plan: string; currency: string } | null;
      })
    | null
  > {
    return prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            currency: true,
          },
        },
      },
    });
  }

  async findAll(params: {
    skip: number;
    take: number;
    tenantId?: string | null;
    search?: string;
    role?: Role;
    isActive?: boolean;
  }): Promise<{ items: User[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(params.tenantId !== undefined && { tenantId: params.tenantId }),
      ...(params.role && { role: params.role }),
      ...(params.isActive !== undefined && { isActive: params.isActive }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  async create(dto: CreateUserDto): Promise<User> {
    return prisma.user.create({
      data: {
        tenantId: dto.tenantId || null,
        email: dto.email.toLowerCase().trim(),
        passwordHash: dto.passwordHash,
        name: dto.name,
        role: dto.role,
        isSuperAdminCreated: dto.isSuperAdminCreated || false,
        createdBy: dto.createdBy,
        updatedBy: dto.createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.passwordHash && { passwordHash: dto.passwordHash }),
        ...(dto.role && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.updatedBy && { updatedBy: dto.updatedBy }),
      },
    });
  }

  async softDelete(id: string, deletedBy?: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: deletedBy,
      },
    });
  }
}

export const userRepository = new UserRepository();
