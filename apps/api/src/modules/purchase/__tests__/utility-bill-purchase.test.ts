/**
 * Comprehensive Test Suite for Utility Bill Category Type Feature
 * Tests:
 * 1. Default CategoryType (PRODUCT) and explicit UTILITY_BILL category creation
 * 2. Mandatory field validation for UTILITY_BILL (billMonth, billAmount) vs PRODUCT (items)
 * 3. Successful UTILITY_BILL purchase creation, grandTotal calculation, and Ledger posting
 * 4. Purchase repository query filtering & details include purchaseType, category, billMonth, billAmount
 * 5. AI Purchase Tools output validation for UTILITY_BILL records
 * 6. Tenant isolation for UTILITY_BILL records
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, purchaseRepository, categoryRepository } from '@kitchen-erp/database';
import { CategoryType, Role } from '@kitchen-erp/types';
import { purchaseService } from '../purchase.routes';
import { purchaseTools } from '../../ai/tools/purchase.tools';

describe('Utility Bill Purchase Feature Test Suite', () => {
  let tenantAId: string;
  let tenantBId: string;
  let managerUserAId: string;
  let productCategoryId: string;
  let utilityCategoryId: string;
  let productVendorId: string;
  let utilityVendorId: string;
  let productId: string;

  before(async () => {
    // 1. Setup isolated test tenants
    const tenantA = await prisma.tenant.create({
      data: {
        name: 'Utility Test Tenant A',
        slug: `utility-tenant-a-${Date.now()}`,
      },
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: {
        name: 'Utility Test Tenant B',
        slug: `utility-tenant-b-${Date.now()}`,
      },
    });
    tenantBId = tenantB.id;

    // 2. Setup user for Tenant A
    const managerA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: `manager-util-${Date.now()}@badri.com`,
        passwordHash: 'hashed_pw',
        name: 'Utility Manager A',
        role: 'INVENTORY_MANAGER',
      },
    });
    managerUserAId = managerA.id;

    // 3. Create PRODUCT Category (default type check)
    const productCat = await categoryRepository.create({
      tenantId: tenantAId,
      name: `Vegetables-${Date.now()}`,
      createdBy: managerUserAId,
    });
    productCategoryId = productCat.id;

    // 4. Create UTILITY_BILL Category
    const utilityCat = await categoryRepository.create({
      tenantId: tenantAId,
      name: `Electricity & Power-${Date.now()}`,
      type: CategoryType.UTILITY_BILL,
      createdBy: managerUserAId,
    });
    utilityCategoryId = utilityCat.id;

    // 5. Setup Vendors for Tenant A
    const prodVendor = await prisma.vendor.create({
      data: {
        tenantId: tenantAId,
        categoryId: productCategoryId,
        name: `Vegetable Vendor-${Date.now()}`,
        phone: '9876543210',
      },
    });
    productVendorId = prodVendor.id;

    const utilVendor = await prisma.vendor.create({
      data: {
        tenantId: tenantAId,
        categoryId: utilityCategoryId,
        name: `State Electricity Board-${Date.now()}`,
        phone: '9123456789',
      },
    });
    utilityVendorId = utilVendor.id;

    // 6. Setup Product for PRODUCT Category
    const prod = await prisma.product.create({
      data: {
        tenantId: tenantAId,
        categoryId: productCategoryId,
        name: `Fresh Tomatoes-${Date.now()}`,
        unit: 'kg',
      },
    });
    productId = prod.id;
  });

  after(async () => {
    // Cleanup test data
    if (tenantAId) {
      await prisma.ledgerTransaction.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.ledgerAccount.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.purchaseItem.deleteMany({ where: { purchase: { tenantId: tenantAId } } });
      await prisma.purchase.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.product.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.vendor.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.category.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.user.deleteMany({ where: { tenantId: tenantAId } });
      await prisma.tenant.deleteMany({ where: { id: tenantAId } });
    }
    if (tenantBId) {
      await prisma.tenant.deleteMany({ where: { id: tenantBId } });
    }
  });

  it('1. should create Category with default CategoryType PRODUCT', async () => {
    const cat = await categoryRepository.findById(productCategoryId, tenantAId);
    assert.ok(cat);
    assert.strictEqual(cat.type, CategoryType.PRODUCT);
  });

  it('2. should create Category with explicit CategoryType UTILITY_BILL', async () => {
    const cat = await categoryRepository.findById(utilityCategoryId, tenantAId);
    assert.ok(cat);
    assert.strictEqual(cat.type, CategoryType.UTILITY_BILL);
  });

  it('3. should throw error when UTILITY_BILL purchase is missing billMonth or billAmount', async () => {
    await assert.rejects(
      async () => {
        await purchaseService.create(
          tenantAId,
          {
            vendorId: utilityVendorId,
            categoryId: utilityCategoryId,
            // missing billMonth & billAmount
          },
          managerUserAId
        );
      },
      (err: { name?: string; statusCode?: number; message?: string }) => {
        return (
          err.name === 'BadRequestError' ||
          (err.statusCode === 400 && err.message?.includes('Bill Month'))
        );
      }
    );
  });

  it('4. should throw error when PRODUCT purchase is missing items', async () => {
    await assert.rejects(
      async () => {
        await purchaseService.create(
          tenantAId,
          {
            vendorId: productVendorId,
            categoryId: productCategoryId,
            // missing items
          },
          managerUserAId
        );
      },
      (err: { name?: string; statusCode?: number; message?: string }) => {
        return (
          err.name === 'BadRequestError' ||
          (err.statusCode === 400 && err.message?.includes('item'))
        );
      }
    );
  });

  it('4b. should successfully create PRODUCT purchase with line items', async () => {
    const prodPurchase = await purchaseService.create(
      tenantAId,
      {
        vendorId: productVendorId,
        categoryId: productCategoryId,
        items: [{ productId, qty: 10, rate: 25 }],
      },
      managerUserAId
    );

    assert.ok(prodPurchase);
    assert.strictEqual(prodPurchase.purchaseType, CategoryType.PRODUCT);
    assert.strictEqual(Number(prodPurchase.grandTotal), 250);
  });

  let createdUtilityPurchaseId: string;

  it('5. should successfully create UTILITY_BILL purchase with billMonth and billAmount', async () => {
    const purchase = await purchaseService.create(
      tenantAId,
      {
        vendorId: utilityVendorId,
        categoryId: utilityCategoryId,
        billMonth: '2026-08',
        billAmount: 14500.5,
        notes: 'August 2026 Electricity Bill Payment',
      },
      managerUserAId
    );

    assert.ok(purchase);
    assert.ok(purchase.id);
    createdUtilityPurchaseId = purchase.id;
    assert.strictEqual(purchase.purchaseType, CategoryType.UTILITY_BILL);
    assert.strictEqual(purchase.billMonth, '2026-08');
    assert.strictEqual(Number(purchase.billAmount), 14500.5);
    assert.strictEqual(Number(purchase.grandTotal), 14500.5);
  });

  it('6. should post Ledger transaction for UTILITY_BILL purchase equal to grandTotal', async () => {
    const ledgerTx = await prisma.ledgerTransaction.findFirst({
      where: {
        tenantId: tenantAId,
        referenceId: createdUtilityPurchaseId,
        referenceType: 'PURCHASE',
      },
    });

    assert.ok(ledgerTx);
    assert.strictEqual(Number(ledgerTx.amount), 14500.5);
    assert.strictEqual(ledgerTx.vendorId, utilityVendorId);
  });

  it('7. should retrieve UTILITY_BILL purchase details from purchaseRepository.findById', async () => {
    const p = await purchaseRepository.findById(createdUtilityPurchaseId, tenantAId);
    assert.ok(p);
    assert.strictEqual(p.purchaseType, CategoryType.UTILITY_BILL);
    assert.strictEqual(p.billMonth, '2026-08');
    assert.strictEqual(Number(p.billAmount), 14500.5);
    assert.strictEqual(p.category?.id, utilityCategoryId);
    assert.strictEqual(p.category?.type, CategoryType.UTILITY_BILL);
  });

  it('8. should filter UTILITY_BILL purchases by categoryId in purchaseRepository.findAll', async () => {
    const { items, total } = await purchaseRepository.findAll(tenantAId, {
      skip: 0,
      take: 10,
      categoryId: utilityCategoryId,
    });

    assert.strictEqual(total, 1);
    assert.strictEqual(items[0].id, createdUtilityPurchaseId);
    assert.strictEqual(items[0].purchaseType, CategoryType.UTILITY_BILL);
    assert.strictEqual(items[0].billMonth, '2026-08');
  });

  it('9. should search UTILITY_BILL purchases by billMonth string in purchaseRepository.findAll', async () => {
    const { items, total } = await purchaseRepository.findAll(tenantAId, {
      skip: 0,
      take: 10,
      search: '2026-08',
    });

    assert.strictEqual(total, 1);
    assert.strictEqual(items[0].id, createdUtilityPurchaseId);
  });

  it('10. should return UTILITY_BILL metadata in searchPurchases AI Tool', async () => {
    const searchTool = purchaseTools.find((t) => t.name === 'searchPurchases');
    assert.ok(searchTool);

    const result = (await searchTool.handler(
      { search: 'Electricity' },
      { tenantId: tenantAId, userId: managerUserAId, role: Role.INVENTORY_MANAGER }
    )) as {
      purchases: Array<{ id: string; purchaseType: string; billMonth: string; billAmount: number }>;
    };

    assert.ok(result.purchases.length > 0);
    const p = result.purchases.find((x) => x.id === createdUtilityPurchaseId);
    assert.ok(p);
    assert.strictEqual(p.purchaseType, CategoryType.UTILITY_BILL);
    assert.strictEqual(p.billMonth, '2026-08');
    assert.strictEqual(p.billAmount, 14500.5);
  });

  it('11. should return UTILITY_BILL metadata in getPurchaseDetails AI Tool', async () => {
    const detailsTool = purchaseTools.find((t) => t.name === 'getPurchaseDetails');
    assert.ok(detailsTool);

    const result = (await detailsTool.handler(
      { purchaseId: createdUtilityPurchaseId },
      { tenantId: tenantAId, userId: managerUserAId, role: Role.INVENTORY_MANAGER }
    )) as {
      found: boolean;
      purchase: { purchaseType: string; billMonth: string; billAmount: number };
    };

    assert.strictEqual(result.found, true);
    assert.strictEqual(result.purchase.purchaseType, CategoryType.UTILITY_BILL);
    assert.strictEqual(result.purchase.billMonth, '2026-08');
    assert.strictEqual(result.purchase.billAmount, 14500.5);
  });

  it('12. should enforce Tenant Isolation (Tenant B cannot access Tenant A utility purchase)', async () => {
    const pB = await purchaseRepository.findById(createdUtilityPurchaseId, tenantBId);
    assert.strictEqual(pB, null);

    const listB = await purchaseRepository.findAll(tenantBId, {
      skip: 0,
      take: 10,
      categoryId: utilityCategoryId,
    });
    assert.strictEqual(listB.total, 0);
  });
});
