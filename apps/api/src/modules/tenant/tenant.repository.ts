/**
 * Tenant Module — Repository
 */

import prisma from '../../config/database';
import type { Tenant, TenantPlan } from '@prisma/client';
import type { CreateTenantInput } from './tenant.validation';

export class TenantRepository {
  async findAll(params: { skip: number; take: number; search?: string }) {
    const where = {
      deletedAt: null,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { slug: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, purchases: true } } },
      }),
      prisma.tenant.count({ where }),
    ]);

    return { tenants, total };
  }

  async findById(id: string): Promise<Tenant | null> {
    return prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return prisma.tenant.findFirst({
      where: { slug, deletedAt: null },
    });
  }

  async findActivePublic() {
    return prisma.tenant.findMany({
      where: { deletedAt: null, isActive: true },
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

  async create(
    data: Omit<CreateTenantInput, 'adminEmail' | 'adminName' | 'adminPassword'> & {
      createdBy: string;
    }
  ): Promise<Tenant> {
    return prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        plan: data.plan as TenantPlan,
        currency: data.currency || 'INR',
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      },
    });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      domain: string | null;
      plan: TenantPlan;
      currency: string;
      isActive: boolean;
      updatedBy: string;
    }>
  ): Promise<Tenant> {
    return prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
  }
}
