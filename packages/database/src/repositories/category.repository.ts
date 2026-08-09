/**
 * CategoryRepository
 * Encapsulates all Category Master data access queries.
 */

import { Prisma, Category } from '@prisma/client';
import { prisma } from '../client/prisma';

export interface CreateCategoryDto {
  tenantId: string;
  name: string;
  displayOrder?: number;
  icon?: string;
  color?: string;
  description?: string;
  createdBy?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  displayOrder?: number;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  isActive?: boolean;
  updatedBy?: string;
}

export class CategoryRepository {
  async findById(id: string, tenantId: string): Promise<Category | null> {
    return prisma.category.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  }

  async findByName(name: string, tenantId: string): Promise<Category | null> {
    return prisma.category.findFirst({
      where: { tenantId, name: name.trim(), deletedAt: null },
    });
  }

  async findAll(
    tenantId: string,
    params: {
      skip: number;
      take: number;
      search?: string;
      isActive?: boolean;
    }
  ): Promise<{ items: Category[]; total: number }> {
    const where: Prisma.CategoryWhereInput = {
      tenantId,
      deletedAt: null,
      ...(params.isActive !== undefined && { isActive: params.isActive }),
      ...(params.search && {
        name: { contains: params.search, mode: 'insensitive' },
      }),
    };

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ name: 'asc' }],
      }),
      prisma.category.count({ where }),
    ]);

    return { items, total };
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    return prisma.category.create({
      data: {
        tenantId: dto.tenantId,
        name: dto.name.trim(),
        displayOrder: dto.displayOrder ?? 0,
        icon: dto.icon || null,
        color: dto.color || null,
        description: dto.description || null,
        createdBy: dto.createdBy,
        updatedBy: dto.createdBy,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateCategoryDto): Promise<Category> {
    return prisma.category.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.updatedBy && { updatedBy: dto.updatedBy }),
      },
    });
  }

  async softDelete(id: string, tenantId: string, deletedBy?: string): Promise<Category> {
    return prisma.category.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: deletedBy,
      },
    });
  }
}

export const categoryRepository = new CategoryRepository();
