/**
 * Database TenantResolverService
 * Resolves tenant records from database by ID, slug, or domain.
 */

import { Tenant } from '@prisma/client';
import { tenantRepository } from '../repositories/tenant.repository';

export class TenantResolverService {
  public static async resolveBySlug(slug: string): Promise<Tenant | null> {
    if (!slug) return null;
    return tenantRepository.findBySlug(slug);
  }

  public static async resolveByDomain(domain: string): Promise<Tenant | null> {
    if (!domain) return null;
    return tenantRepository.findByDomain(domain);
  }

  public static async resolveById(id: string): Promise<Tenant | null> {
    if (!id) return null;
    return tenantRepository.findById(id);
  }
}
