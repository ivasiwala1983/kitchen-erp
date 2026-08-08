/**
 * VendorRepository
 * Encapsulates all Vendor data access queries.
 */

import { Prisma, Vendor } from '@prisma/client';
import { prisma } from '../client/prisma';

export interface CreateVendorDto {
  tenantId: string;
  categoryId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gst?: string;
  createdBy?: string;
}

export interface UpdateVendorDto {
  categoryId?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gst?: string | null;
  isActive?: boolean;
  updatedBy?: string;
}

export class VendorRepository {
  async findById(
    id: string,
    tenantId: string
  ): Promise<(Vendor & { category?: { id: string; name: string } }) | null> {
    return prisma.vendor.findFirst({
      where: { id, tenantId, deletedAt: null },
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
  ): Promise<{ items: (Vendor & { category: { id: string; name: string } })[]; total: number }> {
    const where: Prisma.VendorWhereInput = {
      tenantId,
      deletedAt: null,
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.isActive !== undefined && { isActive: params.isActive }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { phone: { contains: params.search, mode: 'insensitive' } },
          { gst: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      prisma.vendor.count({ where }),
    ]);

    return { items, total };
  }

  async create(dto: CreateVendorDto): Promise<Vendor> {
    return prisma.vendor.create({
      data: {
        tenantId: dto.tenantId,
        categoryId: dto.categoryId,
        name: dto.name,
        phone: dto.phone || null,
        email: dto.email || null,
        address: dto.address || null,
        gst: dto.gst || null,
        createdBy: dto.createdBy,
        updatedBy: dto.createdBy,
      },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateVendorDto): Promise<Vendor> {
    return prisma.vendor.update({
      where: { id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.name && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.gst !== undefined && { gst: dto.gst }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.updatedBy && { updatedBy: dto.updatedBy }),
      },
    });
  }

  async softDelete(id: string, tenantId: string, deletedBy?: string): Promise<Vendor> {
    return prisma.vendor.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: deletedBy,
      },
    });
  }
}

export const vendorRepository = new VendorRepository();
