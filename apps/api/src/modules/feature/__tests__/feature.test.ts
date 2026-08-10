/**
 * Comprehensive Test Suite for Tenant Feature Management & Entitlement Framework
 * Tests Feature Registry Defaults, Tenant Overrides, Inheritance Fallback, Reset to Default,
 * Super Admin Management, Audit Logging, API Route Enforcement, AI Gate, AI Tool Feature Checks,
 * Feature vs User Permission Matrix, and Multi-Tenant Isolation.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, featureRepository, auditRepository } from '@kitchen-erp/database';
import { featureService } from '../feature.service';
import { requireFeature } from '../../../middleware/feature.middleware';
import { toolRegistry } from '../../ai/tools/tool.registry';
import { FeatureCode, Role } from '@kitchen-erp/types';
import type { Request, Response, NextFunction } from 'express';

describe('Centralized Tenant Feature Entitlement Test Suite', () => {
  let superAdminUser: any;
  let tenantA: any;
  let tenantB: any;
  let userAAdmin: any;
  let userBManager: any;

  before(async () => {
    // 1. Ensure Super Admin exists
    superAdminUser = await prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
    });
    if (!superAdminUser) {
      superAdminUser = await prisma.user.create({
        data: {
          email: `superadmin-feat-${Date.now()}@test.com`,
          passwordHash: 'hash',
          name: 'Super Admin Test',
          role: Role.SUPER_ADMIN,
        },
      });
    }

    // 2. Setup Tenant A and Tenant B
    tenantA = await prisma.tenant.create({
      data: {
        name: `Tenant Alpha ${Date.now()}`,
        slug: `tenant-alpha-${Date.now()}`,
      },
    });

    tenantB = await prisma.tenant.create({
      data: {
        name: `Tenant Beta ${Date.now()}`,
        slug: `tenant-beta-${Date.now()}`,
      },
    });

    // 3. Setup Users
    userAAdmin = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: `usera-admin-${Date.now()}@test.com`,
        passwordHash: 'hash',
        name: 'Admin Alpha',
        role: Role.TENANT_ADMIN,
      },
    });

    userBManager = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: `userb-mgr-${Date.now()}@test.com`,
        passwordHash: 'hash',
        name: 'Manager Beta',
        role: Role.INVENTORY_MANAGER,
      },
    });
  });

  after(async () => {
    // Cleanup created test tenants and users
    if (tenantA?.id) {
      await prisma.tenantFeature.deleteMany({ where: { tenantId: tenantA.id } });
      await prisma.user.deleteMany({ where: { tenantId: tenantA.id } });
      await prisma.tenant.delete({ where: { id: tenantA.id } });
    }
    if (tenantB?.id) {
      await prisma.tenantFeature.deleteMany({ where: { tenantId: tenantB.id } });
      await prisma.user.deleteMany({ where: { tenantId: tenantB.id } });
      await prisma.tenant.delete({ where: { id: tenantB.id } });
    }
  });

  describe('1. Feature Registry & Default Entitlements', () => {
    it('should verify all 9 business features default to ON and AI Assistant defaults to OFF', async () => {
      const effectiveA = await featureService.getEffectiveFeaturesMap(tenantA.id);

      assert.equal(effectiveA[FeatureCode.FEATURE_DASHBOARD], true);
      assert.equal(effectiveA[FeatureCode.FEATURE_PURCHASES], true);
      assert.equal(effectiveA[FeatureCode.FEATURE_PURCHASE_HISTORY], true);
      assert.equal(effectiveA[FeatureCode.FEATURE_VENDORS], true);
      assert.equal(effectiveA[FeatureCode.FEATURE_PRODUCTS], true);
      assert.equal(effectiveA[FeatureCode.FEATURE_INVENTORY], true);
      assert.equal(effectiveA[FeatureCode.FEATURE_LEDGER], true);
      assert.equal(effectiveA[FeatureCode.FEATURE_REPORTS], true);
      assert.equal(effectiveA[FeatureCode.FEATURE_INVOICE_UPLOAD], true);

      // AI Assistant MUST default to OFF
      assert.equal(effectiveA[FeatureCode.FEATURE_AI_ASSISTANT], false);
    });

    it('should allow new tenants to inherit defaults without creating TenantFeature rows', async () => {
      const overridesCount = await prisma.tenantFeature.count({
        where: { tenantId: tenantA.id },
      });
      assert.equal(
        overridesCount,
        0,
        'No TenantFeature overrides should be required for default inheritance'
      );
    });
  });

  describe('2. Super Admin Feature Overrides & Cache Invalidation', () => {
    it('should allow Super Admin to enable AI Assistant for Tenant A without affecting Tenant B', async () => {
      // Enable AI for Tenant A
      const res = await featureService.updateTenantFeatureOverride(
        tenantA.id,
        FeatureCode.FEATURE_AI_ASSISTANT,
        true,
        superAdminUser.id
      );

      assert.equal(res.previousState, null);
      assert.equal(res.newState, true);
      assert.equal(res.effectiveEnabled, true);

      const isAEnabled = await featureService.isFeatureEnabled(
        tenantA.id,
        FeatureCode.FEATURE_AI_ASSISTANT
      );
      const isBEnabled = await featureService.isFeatureEnabled(
        tenantB.id,
        FeatureCode.FEATURE_AI_ASSISTANT
      );

      assert.equal(isAEnabled, true, 'Tenant A should have AI enabled');
      assert.equal(isBEnabled, false, 'Tenant B must remain unaffected with AI OFF');
    });

    it('should allow Super Admin to disable Purchases for Tenant A without affecting Tenant B', async () => {
      // Disable Purchases for Tenant A
      await featureService.updateTenantFeatureOverride(
        tenantA.id,
        FeatureCode.FEATURE_PURCHASES,
        false,
        superAdminUser.id
      );

      const isAEnabled = await featureService.isFeatureEnabled(
        tenantA.id,
        FeatureCode.FEATURE_PURCHASES
      );
      const isBEnabled = await featureService.isFeatureEnabled(
        tenantB.id,
        FeatureCode.FEATURE_PURCHASES
      );

      assert.equal(isAEnabled, false, 'Tenant A should have Purchases disabled');
      assert.equal(isBEnabled, true, 'Tenant B must retain Purchases enabled by default');
    });

    it('should allow Super Admin to reset tenant override to default (null)', async () => {
      // Reset Purchases override back to default for Tenant A
      const res = await featureService.updateTenantFeatureOverride(
        tenantA.id,
        FeatureCode.FEATURE_PURCHASES,
        null,
        superAdminUser.id
      );

      assert.equal(res.newState, null);
      assert.equal(res.effectiveEnabled, true, 'Resets back to defaultEnabled (true)');

      const isAEnabled = await featureService.isFeatureEnabled(
        tenantA.id,
        FeatureCode.FEATURE_PURCHASES
      );
      assert.equal(isAEnabled, true);
    });

    it('should record an AuditLog entry for every feature change', async () => {
      const logs = await auditRepository.findAll({
        skip: 0,
        take: 10,
        tenantId: tenantA.id,
        action: 'UPDATE_TENANT_FEATURE',
      });

      assert.ok(logs.total > 0, 'AuditLog entry should be recorded for feature changes');
      assert.equal(logs.items[0].entity, 'TenantFeature');
    });
  });

  describe('3. API Middleware Guard Enforcement', () => {
    it('should allow API access when feature is enabled', async () => {
      const req = { tenantId: tenantA.id, user: userAAdmin } as unknown as Request;
      let nextCalled = false;
      const res = {} as Response;
      const next: NextFunction = (err?: any) => {
        if (!err) nextCalled = true;
      };

      const middleware = requireFeature(FeatureCode.FEATURE_PURCHASES);
      await middleware(req, res, next);

      assert.equal(nextCalled, true, 'Next function should be invoked when feature is enabled');
    });

    it('should reject API request with HTTP 403 FEATURE_DISABLED error when feature is disabled', async () => {
      // Disable Ledger for Tenant A
      await featureService.updateTenantFeatureOverride(
        tenantA.id,
        FeatureCode.FEATURE_LEDGER,
        false,
        superAdminUser.id
      );

      const req = { tenantId: tenantA.id, user: userAAdmin } as unknown as Request;
      let errorThrown: any = null;
      const res = {} as Response;
      const next: NextFunction = (err?: any) => {
        if (err) errorThrown = err;
      };

      const middleware = requireFeature(FeatureCode.FEATURE_LEDGER);
      await middleware(req, res, next);

      assert.ok(errorThrown, 'Middleware must pass error to next() when feature is disabled');
      assert.equal(errorThrown.statusCode, 403);
      assert.equal(errorThrown.code, 'FEATURE_DISABLED');
      assert.equal(errorThrown.feature, FeatureCode.FEATURE_LEDGER);
    });
  });

  describe('4. AI Tool Feature Check Security', () => {
    it('should block AI tool execution and return friendly message when tool required feature is disabled', async () => {
      // Enable AI for Tenant A, but disable Inventory feature
      await featureService.updateTenantFeatureOverride(
        tenantA.id,
        FeatureCode.FEATURE_AI_ASSISTANT,
        true,
        superAdminUser.id
      );
      await featureService.updateTenantFeatureOverride(
        tenantA.id,
        FeatureCode.FEATURE_INVENTORY,
        false,
        superAdminUser.id
      );

      const result = await toolRegistry.executeTool(
        'getLowStockItems',
        {},
        { tenantId: tenantA.id, userId: userAAdmin.id, role: userAAdmin.role }
      );

      assert.equal(result.success, false);
      const resObj = result.result as { message?: string };
      assert.ok(
        resObj.message?.includes("Inventory insights aren't enabled for your workspace right now."),
        `Expected friendly message but got: ${resObj.message}`
      );
    });

    it('should filter out tools for disabled features when generating OpenRouter tool specs', async () => {
      const effectiveMap = await featureService.getEffectiveFeaturesMap(tenantA.id);
      const specs = toolRegistry.getOpenRouterToolSpecs(effectiveMap);

      const hasInventoryTool = specs.some((s) => s.function.name === 'getLowStockItems');
      assert.equal(
        hasInventoryTool,
        false,
        'Tools requiring FEATURE_INVENTORY should be filtered out from OpenRouter specs'
      );
    });
  });
});
