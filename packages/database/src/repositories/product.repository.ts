/**
 * ProductRepository
 * Encapsulates all Product Master data access queries.
 */

import { Prisma, Product } from '@prisma/client';
import { prisma } from '../client/prisma';

export interface CreateProductDto {
  tenantId: string;
  categoryId: string;
  name: string;
  unit?: string;
  createdBy?: string;
}

export interface UpdateProductDto {
  categoryId?: string;
  name?: string;
  unit?: string;
  isActive?: boolean;
  updatedBy?: string;
}

export class ProductRepository {
  async findById(
    id: string,
    tenantId: string
  ): Promise<(Product & { category?: { id: string; name: string } }) | null> {
    return prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { category: true },
    });
  }

  async findByName(
    tenantId: string,
    name: string
  ): Promise<(Product & { category?: { id: string; name: string } }) | null> {
    const cleanName = name.trim();
    return prisma.product.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        name: { equals: cleanName, mode: 'insensitive' },
      },
      include: { category: true },
    });
  }

  async findAll(
    tenantId: string,
    params: {
      skip: number;
      take: number;
      search?: string;
      categoryId?: string;
      isActive?: boolean;
    }
  ): Promise<{ items: (Product & { category: { id: string; name: string } })[]; total: number }> {
    const where: Prisma.ProductWhereInput = {
      tenantId,
      deletedAt: null,
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.isActive !== undefined && { isActive: params.isActive }),
      ...(params.search && {
        name: { contains: params.search, mode: 'insensitive' },
      }),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  async create(dto: CreateProductDto): Promise<Product> {
    return prisma.product.create({
      data: {
        tenantId: dto.tenantId,
        categoryId: dto.categoryId,
        name: dto.name,
        unit: dto.unit || 'kg',
        createdBy: dto.createdBy,
        updatedBy: dto.createdBy,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateProductDto): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.name && { name: dto.name }),
        ...(dto.unit && { unit: dto.unit }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.updatedBy && { updatedBy: dto.updatedBy }),
      },
    });
  }

  async softDelete(id: string, tenantId: string, deletedBy?: string): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: deletedBy,
      },
    });
  }
}

export const productRepository = new ProductRepository();
