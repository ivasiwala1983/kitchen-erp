/**
 * Tenant Module — Repository Adapter
 * Delegates to enterprise @kitchen-erp/database TenantRepository.
 */

import { tenantRepository as dbTenantRepository, Tenant, TenantPlan } from '@kitchen-erp/database';
import type { CreateTenantInput } from './tenant.validation';

export class TenantRepository {
  async findAll(params: { skip: number; take: number; search?: string }) {
    const { items, total } = await dbTenantRepository.findAll(params);
    return { tenants: items, total };
  }

  async findById(id: string): Promise<Tenant | null> {
    return dbTenantRepository.findById(id);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return dbTenantRepository.findBySlug(slug);
  }

  async findActivePublic() {
    return dbTenantRepository.findActivePublic();
  }

  async create(
    data: Omit<CreateTenantInput, 'adminEmail' | 'adminName' | 'adminPassword'> & {
      createdBy: string;
    }
  ): Promise<Tenant> {
    return dbTenantRepository.create({
      name: data.name,
      slug: data.slug,
      domain: data.domain,
      plan: data.plan as TenantPlan,
      currency: data.currency || 'INR',
      createdBy: data.createdBy,
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
    return dbTenantRepository.update(id, data);
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await dbTenantRepository.softDelete(id, deletedBy);
  }
}
