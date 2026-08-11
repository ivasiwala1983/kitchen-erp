import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, categoryRepository } from '@kitchen-erp/database';
import { productService } from '../product.routes';
import { SIMPLE_LIST_THRESHOLD, MIN_SEARCH_CHARACTERS } from '@kitchen-erp/utils';

describe('Smart Selector & Search UX Test Suite', () => {
  let tenantAId: string;
  let tenantBId: string;
  let categoryAId: string;
  let userAId: string;

  before(async () => {
    // 1. Create test tenants
    const tenantA = await prisma.tenant.create({
      data: { name: 'Smart Select Tenant A', slug: `smart-tenant-a-${Date.now()}` },
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: { name: 'Smart Select Tenant B', slug: `smart-tenant-b-${Date.now()}` },
    });
    tenantBId = tenantB.id;

    // 2. Create test user
    const userA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: `smart-user-${Date.now()}@badri.com`,
        passwordHash: 'hashed',
        name: 'Smart Select User A',
        role: 'INVENTORY_MANAGER',
      },
    });
    userAId = userA.id;

    // 3. Create test category
    const catA = await categoryRepository.create({
      tenantId: tenantAId,
      name: 'Groceries',
      createdBy: userAId,
    });
    categoryAId = catA.id;

    // 4. Create Tenant A products (Potato, Potato Premium, Potato 5kg, Onion, Tomato, Cooking Oil)
    const productNames = [
      'Potato',
      'Potato Premium',
      'Potato 5kg',
      'Onion',
      'Tomato',
      'Cooking Oil',
      'Basmati Rice',
    ];
    for (const name of productNames) {
      await productService.create(
        tenantAId,
        { categoryId: categoryAId, name, unit: 'kg' },
        userAId
      );
    }

    // 5. Create Tenant B product with matching name for isolation test
    const catB = await categoryRepository.create({
      tenantId: tenantBId,
      name: 'Tenant B Cat',
      createdBy: userAId,
    });
    await productService.create(
      tenantBId,
      {
        categoryId: catB.id,
        name: 'Potato Secret Tenant B',
        unit: 'kg',
      },
      userAId
    );
  });

  after(async () => {
    if (tenantAId) {
      await prisma.product.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.category.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.user.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.tenant.deleteMany({ where: { id: tenantAId } });
    }
    if (tenantBId) {
      await prisma.product.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.category.deleteMany({ where: { tenantId: tenantBId } });
      await prisma.tenant.deleteMany({ where: { id: tenantBId } });
    }
  });

  it('1. should verify centralized Smart Selector thresholds and rules', () => {
    assert.strictEqual(SIMPLE_LIST_THRESHOLD, 5);
    assert.strictEqual(MIN_SEARCH_CHARACTERS, 2);
  });

  it('2. should return product list with search parameter matching >= 2 characters', async () => {
    const res = await productService.list(tenantAId, 1, 20, 'po');
    assert.ok(res.data);
    assert.strictEqual(res.data.length, 3);
    const names = res.data.map((p) => p.name);
    assert.ok(names.includes('Potato'));
    assert.ok(names.includes('Potato Premium'));
    assert.ok(names.includes('Potato 5kg'));
  });

  it('3. should support case-insensitive and partial search matching', async () => {
    const res = await productService.list(tenantAId, 1, 20, 'TATO');
    assert.ok(res.data);
    assert.strictEqual(res.data.length, 3);
  });

  it('4. should enforce strict Tenant Isolation during server-side search', async () => {
    const resA = await productService.list(tenantAId, 1, 20, 'Potato');
    assert.ok(resA.data);
    assert.ok(resA.data.every((p) => p.tenantId === tenantAId));
    assert.ok(!resA.data.some((p) => p.name.includes('Tenant B')));

    const resB = await productService.list(tenantBId, 1, 20, 'Potato');
    assert.ok(resB.data);
    assert.strictEqual(resB.data.length, 1);
    assert.strictEqual(resB.data[0].name, 'Potato Secret Tenant B');
  });

  it('5. should handle empty search results gracefully', async () => {
    const res = await productService.list(tenantAId, 1, 20, 'nonexistentxyz');
    assert.ok(res.data);
    assert.strictEqual(res.data.length, 0);
  });
});
