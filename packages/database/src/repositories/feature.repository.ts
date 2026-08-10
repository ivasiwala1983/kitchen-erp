/**
 * FeatureRepository
 * Centralized data access queries for Feature Registry and Tenant Feature Entitlements.
 */

import { prisma } from '../client/prisma';
import type { Feature, TenantFeature } from '@prisma/client';

export interface TenantFeatureState {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  defaultEnabled: boolean;
  isActive: boolean;
  sortOrder: number;
  overrideEnabled: boolean | null; // null if inheriting default
  effectiveEnabled: boolean;
  state: 'DEFAULT' | 'ENABLED' | 'DISABLED';
  createdAt: Date;
  updatedAt: Date;
}

export class FeatureRepository {
  /**
   * Fetches all feature definitions registered in the platform ordered by sortOrder.
   */
  async findAllFeatures(): Promise<Feature[]> {
    return prisma.feature.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Fetches feature definition by code.
   */
  async findByCode(code: string): Promise<Feature | null> {
    return prisma.feature.findUnique({
      where: { code },
    });
  }

  /**
   * Resolves feature entitlements for a specific tenant.
   * Returns array of feature states detailing default, override, and effective status.
   */
  async getTenantFeatureStates(tenantId: string): Promise<TenantFeatureState[]> {
    const features = await prisma.feature.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        tenantFeatures: {
          where: { tenantId },
        },
      },
    });

    return features.map((f) => {
      const override = f.tenantFeatures.length > 0 ? f.tenantFeatures[0] : null;
      const overrideEnabled = override ? override.enabled : null;
      const effectiveEnabled = overrideEnabled !== null ? overrideEnabled : f.defaultEnabled;

      let state: 'DEFAULT' | 'ENABLED' | 'DISABLED' = 'DEFAULT';
      if (overrideEnabled !== null) {
        state = overrideEnabled ? 'ENABLED' : 'DISABLED';
      }

      return {
        id: f.id,
        code: f.code,
        name: f.name,
        description: f.description,
        category: f.category,
        defaultEnabled: f.defaultEnabled,
        isActive: f.isActive,
        sortOrder: f.sortOrder,
        overrideEnabled,
        effectiveEnabled,
        state,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      };
    });
  }

  /**
   * Returns a map of featureCode -> effective boolean state for a tenant.
   */
  async getEffectiveFeaturesMap(tenantId: string): Promise<Record<string, boolean>> {
    const states = await this.getTenantFeatureStates(tenantId);
    const map: Record<string, boolean> = {};
    for (const s of states) {
      map[s.code] = s.effectiveEnabled;
    }
    return map;
  }

  /**
   * Resolves whether a single feature is enabled for a given tenant.
   * Algorithm:
   * 1. Check feature existence & global isActive. If inactive/missing, return false.
   * 2. Check explicit TenantFeature override for (tenantId, featureId).
   * 3. If override exists, return override.enabled.
   * 4. Else, return feature.defaultEnabled.
   */
  async isFeatureEnabled(tenantId: string, featureCode: string): Promise<boolean> {
    const feature = await prisma.feature.findUnique({
      where: { code: featureCode },
      include: {
        tenantFeatures: {
          where: { tenantId },
        },
      },
    });

    if (!feature || !feature.isActive) {
      return false;
    }

    if (feature.tenantFeatures.length > 0) {
      return feature.tenantFeatures[0].enabled;
    }

    return feature.defaultEnabled;
  }

  /**
   * Sets or clears a tenant feature override.
   * - If enabled is boolean: upserts TenantFeature row.
   * - If enabled is null (Reset to Default): deletes TenantFeature row if exists.
   */
  async setTenantFeatureOverride(
    tenantId: string,
    featureCode: string,
    enabled: boolean | null
  ): Promise<{
    previousState: boolean | null;
    newState: boolean | null;
    effectiveEnabled: boolean;
  }> {
    const feature = await prisma.feature.findUnique({
      where: { code: featureCode },
      include: {
        tenantFeatures: {
          where: { tenantId },
        },
      },
    });

    if (!feature) {
      throw new Error(`Feature with code '${featureCode}' not found`);
    }

    const previousOverride = feature.tenantFeatures.length > 0 ? feature.tenantFeatures[0] : null;
    const previousState = previousOverride ? previousOverride.enabled : null;

    if (enabled === null) {
      // Reset to Default: delete TenantFeature row if exists
      if (previousOverride) {
        await prisma.tenantFeature.delete({
          where: { id: previousOverride.id },
        });
      }
      return {
        previousState,
        newState: null,
        effectiveEnabled: feature.defaultEnabled,
      };
    }

    // Upsert explicit override
    const updated = await prisma.tenantFeature.upsert({
      where: {
        tenantId_featureId: {
          tenantId,
          featureId: feature.id,
        },
      },
      update: { enabled },
      create: {
        tenantId,
        featureId: feature.id,
        enabled,
      },
    });

    return {
      previousState,
      newState: updated.enabled,
      effectiveEnabled: updated.enabled,
    };
  }
}

export const featureRepository = new FeatureRepository();
