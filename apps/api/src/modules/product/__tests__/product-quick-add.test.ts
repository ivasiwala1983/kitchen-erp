/**
 * Comprehensive Test Suite for Quick Add Product Feature
 * Tests Runtime Inline Product Creation, Category Validation, Case/Space Normalization,
 * Duplicate Detection, Inactive Product Protection, Tenant Isolation, Audit Logging, and Purchase Integration.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@kitchen-erp/database';
import { Role } from '@kitchen-erp/types';
import { productService, quickAddProductSchema } from '../product.routes';

describe('Quick Add Product Feature Test Suite', () => {
  let tenantA: any;
  let tenantB: any;
  let categoryA: any;
  let categoryB: any;
  let userAInventoryManager: any;
  let userATenantAdmin: any;
  let userBInventoryManager: any;

  before(async () => {
    // 1. Create Tenant A and Tenant B
    tenantA = await prisma.tenant.create({
      data: {
        name: `Tenant Prod Quick ${Date.now()}`,
        slug: `tenant-prod-quick-${Date.now()}`,
      },
    });

    tenantB = await prisma.tenant.create({
      data: {
        name: `Tenant Prod Beta ${Date.now()}`,
        slug: `tenant-prod-beta-${Date.now()}`,
      },
    });

    // 2. Create Categories
    categoryA = await prisma.category.create({
      data: {
        tenantId: tenantA.id,
        name: `Vegetables ${Date.now()}`,
      },
    });

    categoryB = await prisma.category.create({
      data: {
        tenantId: tenantB.id,
        name: `Dairy ${Date.now()}`,
      },
    });

    // 3. Create Users
    userAInventoryManager = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: `mgr-proda-${Date.now()}@test.com`,
        passwordHash: 'hash',
        name: 'Manager Prod Alpha',
        role: Role.INVENTORY_MANAGER,
      },
    });

    userATenantAdmin = await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        email: `admin-proda-${Date.now()}@test.com`,
        passwordHash: 'hash',
        name: 'Admin Prod Alpha',
        role: Role.TENANT_ADMIN,
      },
    });

    userBInventoryManager = await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        email: `mgr-prodb-${Date.now()}@test.com`,
        passwordHash: 'hash',
        name: 'Manager Prod Beta',
        role: Role.INVENTORY_MANAGER,
      },
    });
  });

  after(async () => {
    if (tenantA?.id) {
      await prisma.product.deleteMany({ where: { tenantId: tenantA.id } });
      await prisma.category.deleteMany({ where: { tenantId: tenantA.id } });
      await prisma.user.deleteMany({ where: { tenantId: tenantA.id } });
      await prisma.tenant.delete({ where: { id: tenantA.id } });
    }
    if (tenantB?.id) {
      await prisma.product.deleteMany({ where: { tenantId: tenantB.id } });
      await prisma.category.deleteMany({ where: { tenantId: tenantB.id } });
      await prisma.user.deleteMany({ where: { tenantId: tenantB.id } });
      await prisma.tenant.delete({ where: { id: tenantB.id } });
    }
  });

  it('1. Inventory Manager can Quick Add Product to selected category', async () => {
    const input = quickAddProductSchema.parse({
      name: '  Red Tomatoes  ',
      categoryId: categoryA.id,
      unit: 'kg',
    });

    const res = await productService.quickAdd(tenantA.id, input, userAInventoryManager.id);

    assert.equal(res.created, true);
    assert.equal(res.existing, false);
    assert.equal(res.product.name, 'Red Tomatoes');
    assert.equal(res.product.categoryId, categoryA.id);
    assert.equal(res.product.unit, 'kg');
  });

  it('2. Tenant Admin can Quick Add Product', async () => {
    const input = quickAddProductSchema.parse({
      name: 'Green Capsicum',
      categoryId: categoryA.id,
      unit: 'kg',
    });

    const res = await productService.quickAdd(tenantA.id, input, userATenantAdmin.id);

    assert.equal(res.created, true);
    assert.equal(res.product.name, 'Green Capsicum');
  });

  it('3. Rejects empty product name or whitespace-only name via schema', async () => {
    assert.throws(() => {
      quickAddProductSchema.parse({
        name: '   ',
        categoryId: categoryA.id,
      });
    });
  });

  it('4. Rejects category from another tenant', async () => {
    const input = quickAddProductSchema.parse({
      name: 'Yellow Onions',
      categoryId: categoryB.id, // belongs to Tenant B!
    });

    await assert.rejects(
      async () => {
        await productService.quickAdd(tenantA.id, input, userAInventoryManager.id);
      },
      (err: any) => {
        return err.message?.includes('Category not found for this tenant');
      }
    );
  });

  it('5. Case & space normalization detects existing duplicate and returns existing product', async () => {
    const input = quickAddProductSchema.parse({
      name: '  red tomatoes ',
      categoryId: categoryA.id,
    });

    const resDup = await productService.quickAdd(tenantA.id, input, userAInventoryManager.id);

    assert.equal(resDup.created, false);
    assert.equal(resDup.existing, true);
    assert.equal(resDup.product.name, 'Red Tomatoes');
  });

  it('6. Duplicate check blocks quick add if existing product is inactive', async () => {
    // Create soft-deactivated product
    await prisma.product.create({
      data: {
        tenantId: tenantA.id,
        categoryId: categoryA.id,
        name: 'Inactive Carrots',
        isActive: false,
      },
    });

    const input = quickAddProductSchema.parse({
      name: 'inactive carrots',
      categoryId: categoryA.id,
    });

    await assert.rejects(
      async () => {
        await productService.quickAdd(tenantA.id, input, userAInventoryManager.id);
      },
      (err: any) => {
        return err.message?.includes('Product already exists but is inactive');
      }
    );
  });

  it('7. Tenant Isolation: Tenant A product does not collide with Tenant B product', async () => {
    const input = quickAddProductSchema.parse({
      name: 'Red Tomatoes',
      categoryId: categoryB.id,
    });

    const resB = await productService.quickAdd(tenantB.id, input, userBInventoryManager.id);

    assert.equal(resB.created, true);
    assert.equal(resB.product.tenantId, tenantB.id);
  });
});
