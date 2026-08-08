/**
 * TenantRepository
 * Encapsulates all tenant data access queries.
 */

import { Prisma, Tenant, TenantPlan } from '@prisma/client';
import { prisma } from '../client/prisma';

export interface CreateTenantDto {
  name: string;
  slug: string;
  domain?: string;
  plan?: TenantPlan;
  currency?: string;
  createdBy?: string;
}

export interface UpdateTenantDto {
  name?: string;
  slug?: string;
  domain?: string | null;
  isActive?: boolean;
  plan?: TenantPlan;
  currency?: string;
  updatedBy?: string;
}

export class TenantRepository {
  async findById(id: string): Promise<Tenant | null> {
    return prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return prisma.tenant.findFirst({
      where: { slug: slug.toLowerCase().trim(), deletedAt: null },
    });
  }

  async findByDomain(domain: string): Promise<Tenant | null> {
    return prisma.tenant.findFirst({
      where: { domain: domain.toLowerCase().trim(), deletedAt: null },
    });
  }

  async findActivePublic(): Promise<Pick<Tenant, 'id' | 'name' | 'slug' | 'currency' | 'plan'>[]> {
    return prisma.tenant.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        currency: true,
        plan: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findAll(params: {
    skip: number;
    take: number;
    search?: string;
    isActive?: boolean;
    plan?: TenantPlan;
  }): Promise<{ items: Tenant[]; total: number }> {
    const where: Prisma.TenantWhereInput = {
      deletedAt: null,
      ...(params.isActive !== undefined && { isActive: params.isActive }),
      ...(params.plan && { plan: params.plan }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { slug: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tenant.count({ where }),
    ]);

    return { items, total };
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    return prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug.toLowerCase().trim(),
        domain: dto.domain ? dto.domain.toLowerCase().trim() : null,
        plan: dto.plan || TenantPlan.BASIC,
        currency: dto.currency || 'INR',
        createdBy: dto.createdBy,
        updatedBy: dto.createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    return prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug.toLowerCase().trim() }),
        ...(dto.domain !== undefined && {
          domain: dto.domain ? dto.domain.toLowerCase().trim() : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.plan && { plan: dto.plan }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.updatedBy && { updatedBy: dto.updatedBy }),
      },
    });
  }

  async softDelete(id: string, deletedBy?: string): Promise<Tenant> {
    return prisma.tenant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: deletedBy,
      },
    });
  }
}

export const tenantRepository = new TenantRepository();
