/**
 * End-to-End Test Suite for Vendor Ledger
 * Verifies Acceptance Flow (Purchase -> Payment -> Balance -> Advance)
 * and Tenant Isolation.
 */

import {
  prisma,
  tenantRepository,
  userRepository,
  vendorRepository,
  categoryRepository,
  productRepository,
  purchaseRepository,
  paymentRepository,
  ledgerRepository,
  Role,
  PurchaseStatus,
  PaymentMethod,
  LedgerTransactionType,
} from '@kitchen-erp/database';

async function runE2eTest() {
  console.log('🧪 Starting Vendor Ledger End-to-End Tests...\n');

  // Clean up any previous test tenants
  for (const slug of ['badri-ledger-test', 'tenant-b-isolation-test']) {
    const existing = await tenantRepository.findBySlug(slug);
    if (existing) {
      await prisma.vendorPayment.deleteMany({ where: { tenantId: existing.id } });
      await prisma.ledgerTransaction.deleteMany({ where: { tenantId: existing.id } });
      await prisma.ledgerAccount.deleteMany({ where: { tenantId: existing.id } });
      await prisma.purchaseItem.deleteMany({ where: { purchase: { tenantId: existing.id } } });
      await prisma.purchase.deleteMany({ where: { tenantId: existing.id } });
      await prisma.product.deleteMany({ where: { tenantId: existing.id } });
      await prisma.vendor.deleteMany({ where: { tenantId: existing.id } });
      await prisma.category.deleteMany({ where: { tenantId: existing.id } });
      await prisma.user.deleteMany({ where: { tenantId: existing.id } });
      await prisma.tenant.delete({ where: { id: existing.id } });
    }
  }

  // ── 1. Setup Tenant A (Badri Kitchen) ─────────────────────────
  console.log('1️⃣ Setting up Tenant A (Badri Kitchen)...');
  const tenantA = await tenantRepository.create({
    name: 'Badri Kitchen Test',
    slug: 'badri-ledger-test',
  });

  const categoryA = await categoryRepository.create({
    tenantId: tenantA.id,
    name: 'Vegetables',
  });

  const vendorA = await vendorRepository.create({
    tenantId: tenantA.id,
    categoryId: categoryA.id,
    name: 'ABC Vegetable Vendor',
    phone: '9876543210',
  });

  const potato = await productRepository.create({
    tenantId: tenantA.id,
    categoryId: categoryA.id,
    name: 'Potato',
    unit: 'kg',
  });

  const tomato = await productRepository.create({
    tenantId: tenantA.id,
    categoryId: categoryA.id,
    name: 'Tomato',
    unit: 'kg',
  });

  const userA = await userRepository.create({
    email: 'manager-a@badri-test.com',
    passwordHash: '$2b$10$YourHashedPasswordHereForTesting',
    name: 'Inventory Manager A',
    role: Role.INVENTORY_MANAGER,
    tenantId: tenantA.id,
  });

  console.log('   ✅ Tenant A created:', tenantA.name);

  // ── 2. Acceptance Test: Create Purchase 1 (₹164) ─────────────
  console.log('\n2️⃣ Creating Purchase 1: Potato 5kg @ ₹20 + Tomato 4kg @ ₹16 = ₹164...');
  const purchase1 = await purchaseRepository.create({
    tenantId: tenantA.id,
    vendorId: vendorA.id,
    userId: userA.id,
    items: [
      { productId: potato.id, qty: 5, rate: 20 }, // 100
      { productId: tomato.id, qty: 4, rate: 16 }, // 64
    ],
    notes: 'Invoice #123',
  });

  console.log('   ✅ Purchase 1 created. Total:', Number(purchase1.grandTotal));
  if (Number(purchase1.grandTotal) !== 164) {
    throw new Error(`Expected grandTotal 164, got ${purchase1.grandTotal}`);
  }

  // Verify Ledger Account & Balance
  const accountA = await ledgerRepository.findAccountByVendor(tenantA.id, vendorA.id);
  console.log('   📊 Current Balance after Purchase 1:', accountA?.currentBalance);
  if (accountA?.currentBalance !== 164) {
    throw new Error(`Expected balance 164, got ${accountA?.currentBalance}`);
  }

  // ── 3. Acceptance Test: Create Payment 1 (₹100) ─────────────
  console.log('\n3️⃣ Recording Payment 1 of ₹100...');
  const payment1Result = await paymentRepository.createPayment({
    tenantId: tenantA.id,
    vendorId: vendorA.id,
    amount: 100,
    paymentMethod: PaymentMethod.CASH,
    note: 'Cash payment',
    createdBy: userA.id,
  });

  console.log('   ✅ Payment 1 recorded. Updated balance:', payment1Result.currentBalance);
  if (payment1Result.currentBalance !== 64) {
    throw new Error(`Expected balance 64, got ${payment1Result.currentBalance}`);
  }

  // ── 4. Acceptance Test: Create Purchase 2 (₹500) ─────────────
  console.log('\n4️⃣ Creating Purchase 2 of ₹500...');
  const purchase2 = await purchaseRepository.create({
    tenantId: tenantA.id,
    vendorId: vendorA.id,
    userId: userA.id,
    items: [{ productId: potato.id, qty: 25, rate: 20 }], // 500
    notes: 'Invoice #145',
  });

  const accountAAfterP2 = await ledgerRepository.findAccountByVendor(tenantA.id, vendorA.id);
  console.log('   📊 Current Balance after Purchase 2:', accountAAfterP2?.currentBalance);
  if (accountAAfterP2?.currentBalance !== 564) {
    throw new Error(`Expected balance 564, got ${accountAAfterP2?.currentBalance}`);
  }

  // ── 5. Acceptance Test: Advance Payment (₹700) ───────────────
  console.log('\n5️⃣ Recording Advance Payment of ₹700 (greater than outstanding ₹564)...');
  const payment2Result = await paymentRepository.createPayment({
    tenantId: tenantA.id,
    vendorId: vendorA.id,
    amount: 700,
    paymentMethod: PaymentMethod.UPI,
    reference: 'UPI-REF-999',
    note: 'Advance payment',
    createdBy: userA.id,
  });

  console.log('   ✅ Payment 2 recorded. Balance:', payment2Result.currentBalance);
  const accountAAfterAdvance = await ledgerRepository.findAccountByVendor(tenantA.id, vendorA.id);
  console.log(
    '   💳 Vendor Credit / Advance Amount:',
    accountAAfterAdvance?.absBalance,
    'isCredit:',
    accountAAfterAdvance?.isVendorCredit
  );

  if (accountAAfterAdvance?.currentBalance !== -136) {
    throw new Error(`Expected balance -136, got ${accountAAfterAdvance?.currentBalance}`);
  }
  if (!accountAAfterAdvance?.isVendorCredit || accountAAfterAdvance?.absBalance !== 136) {
    throw new Error(`Expected Vendor Credit 136, got ${accountAAfterAdvance?.absBalance}`);
  }

  // ── 6. Tenant Isolation Test ──────────────────────────────────
  console.log('\n6️⃣ Verifying Tenant Isolation (Tenant A vs Tenant B)...');
  let tenantB = await tenantRepository.findBySlug('tenant-b-isolation-test');
  if (!tenantB) {
    tenantB = await tenantRepository.create({
      name: 'Tenant B Kitchen',
      slug: 'tenant-b-isolation-test',
    });
  }

  const categoryB = await categoryRepository.create({
    tenantId: tenantB.id,
    name: 'Dairy',
  });

  const vendorB = await vendorRepository.create({
    tenantId: tenantB.id,
    categoryId: categoryB.id,
    name: 'Fresh Dairy Vendor B',
  });

  // Verify Tenant A querying Tenant B vendor yields null
  const crossVendorAccess = await vendorRepository.findById(vendorB.id, tenantA.id);
  if (crossVendorAccess !== null) {
    throw new Error('SECURITY VIOLATION: Tenant A accessed Tenant B vendor!');
  }
  console.log('   🔒 Tenant A cannot access Tenant B vendor: Confirmed (null)');

  // Verify Tenant A querying Tenant B transactions yields empty
  const tenantBLedger = await ledgerRepository.findAllAccounts(tenantA.id, {
    skip: 0,
    take: 10,
    search: 'Fresh Dairy',
  });
  if (tenantBLedger.items.length > 0) {
    throw new Error('SECURITY VIOLATION: Tenant A sees Tenant B ledger account!');
  }
  console.log('   🔒 Tenant A cannot see Tenant B ledger accounts: Confirmed (0 items)');

  console.log('\n🎉 ALL VENDOR LEDGER END-TO-END TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runE2eTest()
  .catch((err) => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
