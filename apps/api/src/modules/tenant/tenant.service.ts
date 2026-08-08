/**
 * Tenant Module — Service
 * Business logic for tenant management (SUPER_ADMIN only).
 * Automatically seeds default Category Master records on tenant creation.
 */

import bcrypt from 'bcryptjs';
import { TenantRepository } from './tenant.repository';
import { userRepository, prisma } from '@kitchen-erp/database';
import { ConflictError, NotFoundError } from '../../shared/errors';
import type { CreateTenantInput, UpdateTenantInput } from './tenant.validation';
import { parsePagination } from '@kitchen-erp/utils';
import { Role } from '@kitchen-erp/types';

const DEFAULT_CATEGORIES = [
  { name: 'Vegetable', displayOrder: 1, icon: '🥕', color: '#22c55e' },
  { name: 'Fruit', displayOrder: 2, icon: '🍎', color: '#ef4444' },
  { name: 'Dairy', displayOrder: 3, icon: '🥛', color: '#3b82f6' },
  { name: 'Grocery', displayOrder: 4, icon: '🌾', color: '#f59e0b' },
  { name: 'Gas', displayOrder: 5, icon: '🔥', color: '#ec4899' },
  { name: 'Bakery', displayOrder: 6, icon: '🍞', color: '#8b5cf6' },
  { name: 'Cleaning', displayOrder: 7, icon: '🧹', color: '#06b6d4' },
  { name: 'Frozen', displayOrder: 8, icon: '❄️', color: '#64748b' },
  { name: 'Beverages', displayOrder: 9, icon: '🥤', color: '#10b981' },
];

export class TenantService {
  private repo = new TenantRepository();

  async list(page?: number, limit?: number, search?: string) {
    const { page: p, limit: l, skip } = parsePagination(page, limit);
    const { tenants, total } = await this.repo.findAll({ skip, take: l, search });
    return { data: tenants, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async getById(id: string) {
    const tenant = await this.repo.findById(id);
    if (!tenant) throw new NotFoundError('Tenant not found');
    return tenant;
  }

  async getBySlug(slug: string) {
    const tenant = await this.repo.findBySlug(slug.toLowerCase().trim());
    if (!tenant || !tenant.isActive) {
      throw new NotFoundError(`Tenant with slug '${slug}' not found`);
    }
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      isActive: tenant.isActive,
      plan: tenant.plan,
      currency: tenant.currency,
      logoUrl: (tenant as any).logoUrl || null,
      theme: (tenant as any).theme || null,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async getPublicList() {
    return this.repo.findActivePublic();
  }

  async create(dto: CreateTenantInput, createdBy: string) {
    const existing = await this.repo.findBySlug(dto.slug);
    if (existing) throw new ConflictError(`Tenant slug '${dto.slug}' is already taken`);

    const existingEmail = await userRepository.findByEmail(dto.adminEmail);
    if (existingEmail) throw new ConflictError(`Email '${dto.adminEmail}' is already registered`);

    const tenant = await this.repo.create({
      name: dto.name,
      slug: dto.slug,
      domain: dto.domain,
      plan: dto.plan,
      currency: dto.currency,
      createdBy,
    });

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
    const adminUser = await userRepository.create({
      tenantId: tenant.id,
      email: dto.adminEmail,
      passwordHash,
      name: dto.adminName,
      role: Role.TENANT_ADMIN,
      isSuperAdminCreated: true,
      createdBy,
    });

    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        tenantId: tenant.id,
        name: cat.name,
        displayOrder: cat.displayOrder,
        icon: cat.icon,
        color: cat.color,
        isActive: true,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      })),
      skipDuplicates: true,
    });

    return tenant;
  }

  async update(id: string, dto: UpdateTenantInput, updatedBy: string) {
    await this.getById(id);
    return this.repo.update(id, { ...dto, updatedBy });
  }

  async activate(id: string, updatedBy: string) {
    await this.getById(id);
    return this.repo.update(id, { isActive: true, updatedBy });
  }

  async deactivate(id: string, updatedBy: string) {
    await this.getById(id);
    return this.repo.update(id, { isActive: false, updatedBy });
  }

  async delete(id: string, deletedBy: string) {
    await this.getById(id);
    await this.repo.softDelete(id, deletedBy);
  }
}
