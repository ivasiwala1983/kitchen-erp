/**
 * Comprehensive Test Suite for Purchase History Feature
 * Validates requirements 1-42 including Tenant Isolation, Filtering, Pagination,
 * Search, Invoice integration, Ledger integration, and Quick Add Vendor compatibility.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  prisma,
  purchaseRepository,
  vendorRepository,
  ledgerRepository,
} from '@kitchen-erp/database';
import { Role, PurchaseStatus } from '@kitchen-erp/types';
import { purchaseService } from '../purchase.routes';

describe('Purchase History Feature Test Suite', () => {
  let tenantAId: string;
  let tenantBId: string;
  let categoryA1Id: string;
  let categoryA2Id: string;
  let vendorA1Id: string;
  let vendorA2Id: string;
  let vendorB1Id: string;
  let productA1Id: string;
  let productA2Id: string;
  let managerUserAId: string;
  let managerUserBId: string;
  let purchaseA1Id: string;
  let purchaseA2Id: string;
  let purchaseB1Id: string;

  before(async () => {
    // 1. Setup isolated test tenants
    const tenantA = await prisma.tenant.create({
      data: {
        name: 'Badri Kitchen Tenant',
        slug: `badri-kitchen-${Date.now()}`,
      },
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: {
        name: 'Other Kitchen Tenant',
        slug: `other-kitchen-${Date.now()}`,
      },
    });
    tenantBId = tenantB.id;

    // 2. Setup users for Tenant A & B
    const managerA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: `manager-a-${Date.now()}@badri.com`,
        passwordHash: 'hashed_pw',
        name: 'Badri Inventory Manager',
        role: 'INVENTORY_MANAGER',
      },
    });
    managerUserAId = managerA.id;

    const managerB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: `manager-b-${Date.now()}@other.com`,
        passwordHash: 'hashed_pw',
        name: 'Other Inventory Manager',
        role: 'INVENTORY_MANAGER',
      },
    });
    managerUserBId = managerB.id;

    // 3. Setup categories for Tenant A
    const cat1 = await prisma.category.create({
      data: {
        tenantId: tenantAId,
        name: `Vegetables-${Date.now()}`,
        createdBy: managerUserAId,
      },
    });
    categoryA1Id = cat1.id;

    const cat2 = await prisma.category.create({
      data: {
        tenantId: tenantAId,
        name: `Dairy-${Date.now()}`,
        createdBy: managerUserAId,
      },
    });
    categoryA2Id = cat2.id;

    // 4. Setup Vendors for Tenant A & B
    const vendorA1 = await prisma.vendor.create({
      data: {
        tenantId: tenantAId,
        categoryId: categoryA1Id,
        name: `Patel Vegetables-${Date.now()}`,
        phone: '9876543210',
        createdBy: managerUserAId,
      },
    });
    vendorA1Id = vendorA1.id;

    const vendorA2 = await prisma.vendor.create({
      data: {
        tenantId: tenantAId,
        categoryId: categoryA2Id,
        name: `Fresh Dairy-${Date.now()}`,
        createdBy: managerUserAId,
      },
    });
    vendorA2Id = vendorA2.id;

    const vendorB1 = await prisma.vendor.create({
      data: {
        tenantId: tenantBId,
        categoryId: categoryA1Id, // same category ID schema if needed, but tenant B
        name: `Tenant B Supplier-${Date.now()}`,
        createdBy: managerUserBId,
      },
    });
    vendorB1Id = vendorB1.id;

    // 5. Setup Products for Tenant A
    const prod1 = await prisma.product.create({
      data: {
        tenantId: tenantAId,
        categoryId: categoryA1Id,
        name: 'Potato',
        unit: 'KG',
        createdBy: managerUserAId,
      },
    });
    productA1Id = prod1.id;

    const prod2 = await prisma.product.create({
      data: {
        tenantId: tenantAId,
        categoryId: categoryA1Id,
        name: 'Tomato',
        unit: 'KG',
        createdBy: managerUserAId,
      },
    });
    productA2Id = prod2.id;

    // 6. Create Purchase 1 for Tenant A (Critical End-to-End Test Data)
    // Date: 10 Aug 2026, Potato 5 KG x 20 = 100, Tomato 4 KG x 16 = 64. Total = 164. Attach invoice.
    const date1 = new Date('2026-08-10T10:00:00Z');
    const purchaseA1 = await purchaseRepository.create({
      tenantId: tenantAId,
      vendorId: vendorA1Id,
      userId: managerUserAId,
      purchaseDate: date1,
      notes: 'INV-102 Patel Veggies Order',
      status: PurchaseStatus.CONFIRMED,
      items: [
        { productId: productA1Id, qty: 5, rate: 20 },
        { productId: productA2Id, qty: 4, rate: 16 },
      ],
    });
    purchaseA1Id = purchaseA1.id;

    // Attach invoice metadata to Purchase A1
    await prisma.purchase.update({
      where: { id: purchaseA1Id },
      data: {
        invoiceFileName: 'invoice-inv102.pdf',
        invoiceMimeType: 'application/pdf',
        invoiceSize: 10240,
        invoiceStoragePath: `invoices/${tenantAId}/${purchaseA1Id}/invoice.pdf`,
        invoiceUrl: `/api/purchases/${purchaseA1Id}/invoice`,
        invoiceUploadedAt: new Date('2026-08-10T10:05:00Z'),
        invoiceUploadedBy: managerUserAId,
      },
    });

    // 7. Create Purchase 2 for Tenant A
    // Date: 09 Aug 2026, Dairy purchase total = 850
    const date2 = new Date('2026-08-09T10:00:00Z');
    const purchaseA2 = await purchaseRepository.create({
      tenantId: tenantAId,
      vendorId: vendorA2Id,
      userId: managerUserAId,
      purchaseDate: date2,
      notes: 'INV-101 Fresh Dairy Order',
      status: PurchaseStatus.CONFIRMED,
      items: [{ productId: productA1Id, qty: 10, rate: 85 }],
    });
    purchaseA2Id = purchaseA2.id;

    // 8. Create Purchase 1 for Tenant B (Total = 500)
    const purchaseB1 = await purchaseRepository.create({
      tenantId: tenantBId,
      vendorId: vendorB1Id,
      userId: managerUserBId,
      purchaseDate: new Date('2026-08-10T12:00:00Z'),
      notes: 'Tenant B secret purchase',
      status: PurchaseStatus.CONFIRMED,
      items: [{ productId: productA1Id, qty: 5, rate: 100 }],
    });
    purchaseB1Id = purchaseB1.id;
  });

  after(async () => {
    // Cleanup test records
    try {
      await prisma.purchaseItem.deleteMany({
        where: { purchaseId: { in: [purchaseA1Id, purchaseA2Id, purchaseB1Id] } },
      });
      await prisma.ledgerTransaction.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await prisma.ledgerAccount.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await prisma.purchase.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await prisma.product.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await prisma.vendor.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await prisma.category.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await prisma.user.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantAId, tenantBId] } },
      });
    } catch {
      // ignore cleanup errors
    }
  });

  it('1. Inventory Manager can view own tenant Purchase History', async () => {
    const res = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      20
    );

    assert.equal(res.total, 2);
    assert.equal(res.data.length, 2);
  });

  it('2. Tenant Isolation: Tenant A Inventory Manager cannot view Tenant B purchase in list or by ID', async () => {
    // List check
    const listRes = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      20
    );
    const tenantBPurchases = listRes.data.filter((p) => p.id === purchaseB1Id);
    assert.equal(tenantBPurchases.length, 0);

    // Direct ID request check: must throw NotFoundError (404)
    await assert.rejects(
      async () => {
        await purchaseService.getById(
          purchaseB1Id,
          tenantAId,
          managerUserAId,
          Role.INVENTORY_MANAGER
        );
      },
      (err: any) => err.message === 'Purchase not found'
    );
  });

  it('3. Purchase History is paginated (page and limit)', async () => {
    const page1 = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      1
    );

    assert.equal(page1.data.length, 1);
    assert.equal(page1.total, 2);
    assert.equal(page1.totalPages, 2);

    const page2 = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      2,
      1
    );

    assert.equal(page2.data.length, 1);
    assert.notEqual(page1.data[0].id, page2.data[0].id);
  });

  it('4. Default Sorting: Newest purchases appear first (purchaseDate DESC)', async () => {
    const res = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      20
    );

    assert.equal(res.data[0].id, purchaseA1Id); // 10 Aug
    assert.equal(res.data[1].id, purchaseA2Id); // 09 Aug
  });

  it('5. Vendor filter works correctly', async () => {
    const res = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      20,
      { vendorId: vendorA1Id }
    );

    assert.equal(res.total, 1);
    assert.equal(res.data[0].id, purchaseA1Id);
    assert.equal(res.data[0].vendorId, vendorA1Id);
  });

  it('6. Category filter works correctly', async () => {
    const res = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      20,
      { categoryId: categoryA1Id }
    );

    assert.equal(res.total, 1);
    assert.equal(res.data[0].id, purchaseA1Id);
  });

  it('7. Date filter works correctly', async () => {
    const res = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      20,
      {
        startDate: '2026-08-10T00:00:00Z',
        endDate: '2026-08-10T23:59:59Z',
      }
    );

    assert.equal(res.total, 1);
    assert.equal(res.data[0].id, purchaseA1Id);
  });

  it('8. Server-side search by vendor name or invoice/notes works', async () => {
    const searchRes = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      20,
      { search: 'Patel' }
    );

    assert.equal(searchRes.total, 1);
    assert.equal(searchRes.data[0].id, purchaseA1Id);

    const notesSearchRes = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      20,
      { search: 'INV-101' }
    );

    assert.equal(notesSearchRes.total, 1);
    assert.equal(notesSearchRes.data[0].id, purchaseA2Id);
  });

  it('9. Critical End-to-End Test: Purchase Detail & Line Items accuracy', async () => {
    const p1 = await purchaseService.getById(
      purchaseA1Id,
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER
    );

    assert.equal(p1.id, purchaseA1Id);
    assert.equal(p1.vendorId, vendorA1Id);
    assert.equal(p1.vendor?.name?.startsWith('Patel Vegetables'), true);
    assert.equal(Number(p1.grandTotal), 164); // 5*20 + 4*16 = 164
    assert.equal(p1.items?.length, 2);

    const potatoItem = p1.items?.find((i) => i.product?.name === 'Potato');
    assert.ok(potatoItem);
    assert.equal(Number(potatoItem.qty), 5);
    assert.equal(Number(potatoItem.rate), 20);
    assert.equal(Number(potatoItem.total), 100);

    const tomatoItem = p1.items?.find((i) => i.product?.name === 'Tomato');
    assert.ok(tomatoItem);
    assert.equal(Number(tomatoItem.qty), 4);
    assert.equal(Number(tomatoItem.rate), 16);
    assert.equal(Number(tomatoItem.total), 64);
  });

  it('10. Attached invoice metadata displays correctly', async () => {
    const p1 = await purchaseService.getById(
      purchaseA1Id,
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER
    );

    assert.equal(p1.invoiceFileName, 'invoice-inv102.pdf');
    assert.ok(p1.invoiceStoragePath);
    assert.ok(p1.invoiceUrl);
  });

  it('11. Ledger account balance and purchase transaction integration', async () => {
    const ledgerAccount = await ledgerRepository.findAccountByVendor(tenantAId, vendorA1Id);
    assert.ok(ledgerAccount);
    // Purchase A1 was 164, so vendor balance owed = 164
    assert.equal(ledgerAccount.currentBalance, 164);
  });

  it('12. Quick Add Vendor compatibility: newly quick-added vendor purchase appears in history', async () => {
    // Create new quick vendor
    const quickVendor = await vendorRepository.create({
      tenantId: tenantAId,
      categoryId: categoryA1Id,
      name: `Quick Add Vendor-${Date.now()}`,
      createdBy: managerUserAId,
    });

    // Create purchase for quick vendor
    const quickPurchase = await purchaseService.create(
      tenantAId,
      {
        vendorId: quickVendor.id,
        items: [{ productId: productA1Id, qty: 2, rate: 50 }],
        notes: 'Quick vendor test purchase',
      },
      managerUserAId
    );

    // Verify it immediately appears in purchase history
    const historyRes = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      20,
      { vendorId: quickVendor.id }
    );

    assert.equal(historyRes.total, 1);
    assert.equal(historyRes.data[0].id, quickPurchase.id);
    assert.equal(Number(historyRes.data[0].grandTotal), 100);

    // Clean up quick vendor purchase and account
    await prisma.purchaseItem.deleteMany({ where: { purchaseId: quickPurchase.id } });
    await prisma.ledgerTransaction.deleteMany({ where: { referenceId: quickPurchase.id } });
    await prisma.purchase.delete({ where: { id: quickPurchase.id } });
    await prisma.ledgerAccount.deleteMany({ where: { vendorId: quickVendor.id } });
    await prisma.vendor.delete({ where: { id: quickVendor.id } });
  });

  it('13. Inactive vendor historical purchase displays correctly in history', async () => {
    // Soft deactivate vendorA2
    await vendorRepository.update(vendorA2Id, tenantAId, { isActive: false });

    // Historical purchase should still display
    const res = await purchaseService.list(
      tenantAId,
      managerUserAId,
      Role.INVENTORY_MANAGER,
      1,
      20,
      { vendorId: vendorA2Id }
    );

    assert.equal(res.total, 1);
    assert.equal(res.data[0].id, purchaseA2Id);
    assert.equal(res.data[0].vendor?.isActive, false);

    // Re-activate vendorA2
    await vendorRepository.update(vendorA2Id, tenantAId, { isActive: true });
  });
});
