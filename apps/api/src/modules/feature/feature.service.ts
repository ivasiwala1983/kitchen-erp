/**
 * FeatureService
 * Centralized feature resolution logic, in-memory caching, and audit-logged feature administration.
 */

import { featureRepository, auditRepository } from '@kitchen-erp/database';
import type { TenantFeatureState } from '@kitchen-erp/database';

interface CacheEntry {
  map: Record<string, boolean>;
  expiresAt: number;
}

const CACHE_TTL_MS = 10_000; // 10 seconds cache TTL

export class FeatureService {
  private cache = new Map<string, CacheEntry>();

  /**
   * Clears the feature cache for a specific tenant or all tenants.
   */
  public invalidateCache(tenantId?: string): void {
    if (tenantId) {
      this.cache.delete(tenantId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Resolves whether a feature is enabled for a given tenant.
   */
  public async isFeatureEnabled(tenantId: string, featureCode: string): Promise<boolean> {
    if (!tenantId) return false;

    // Check cached feature map
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() < cached.expiresAt) {
      if (featureCode in cached.map) {
        return cached.map[featureCode];
      }
    }

    // Fallback to database resolution
    const enabled = await featureRepository.isFeatureEnabled(tenantId, featureCode);

    // Warm cache map
    const map = await this.getEffectiveFeaturesMap(tenantId);
    this.cache.set(tenantId, { map, expiresAt: Date.now() + CACHE_TTL_MS });

    return enabled;
  }

  /**
   * Returns effective features map for tenant context.
   */
  public async getEffectiveFeaturesMap(tenantId: string): Promise<Record<string, boolean>> {
    if (!tenantId) return {};

    const cached = this.cache.get(tenantId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.map;
    }

    const map = await featureRepository.getEffectiveFeaturesMap(tenantId);
    this.cache.set(tenantId, { map, expiresAt: Date.now() + CACHE_TTL_MS });

    return map;
  }

  /**
   * Returns detailed feature entitlement states (default, override, effective) for Super Admin UI.
   */
  public async getTenantFeatureStates(tenantId: string): Promise<TenantFeatureState[]> {
    return featureRepository.getTenantFeatureStates(tenantId);
  }

  /**
   * Updates tenant feature entitlement override or resets to default.
   * Invalidates cache and creates an AuditLog record.
   */
  public async updateTenantFeatureOverride(
    tenantId: string,
    featureCode: string,
    enabled: boolean | null,
    superAdminUserId: string
  ): Promise<{
    previousState: boolean | null;
    newState: boolean | null;
    effectiveEnabled: boolean;
  }> {
    const result = await featureRepository.setTenantFeatureOverride(tenantId, featureCode, enabled);

    // Invalidate tenant cache immediately
    this.invalidateCache(tenantId);

    // Audit log entry
    const previousLabel =
      result.previousState === null ? 'DEFAULT' : result.previousState ? 'ON' : 'OFF';
    const newLabel = result.newState === null ? 'DEFAULT' : result.newState ? 'ON' : 'OFF';

    await auditRepository.log({
      tenantId,
      userId: superAdminUserId,
      action: 'UPDATE_TENANT_FEATURE',
      entity: 'TenantFeature',
      entityId: tenantId,
      oldValues: { featureCode, override: result.previousState, stateLabel: previousLabel },
      newValues: {
        featureCode,
        override: result.newState,
        stateLabel: newLabel,
        effectiveEnabled: result.effectiveEnabled,
      },
    });

    return result;
  }
}

export const featureService = new FeatureService();
