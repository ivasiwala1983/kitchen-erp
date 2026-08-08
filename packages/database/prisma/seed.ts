/**
 * Kitchen ERP — Database Seed
 * Shared seed script for local development and initial deployment.
 */

import { PrismaClient, Role, TenantPlan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱  Starting seed...\n');

  // ── Super Admin ─────────────────────────────────────────────
  const superAdminEmail = 'super@kitchenerp.com';
  const superAdminPassword = 'SuperAdmin@123';

  let superAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash: await hashPassword(superAdminPassword),
        name: 'Super Administrator',
        role: Role.SUPER_ADMIN,
        isActive: true,
        isSuperAdminCreated: true,
      },
    });
    console.log(`✅  Super Admin created: ${superAdminEmail}`);
  } else {
    console.log(`ℹ️   Super Admin already exists: ${superAdminEmail}`);
  }

  // ── Sample Tenant ────────────────────────────────────────────
  const tenantSlug = 'demo';

  let tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Grand Kitchen',
        slug: tenantSlug,
        isActive: true,
        plan: TenantPlan.PREMIUM,
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    });
    console.log(`✅  Tenant created: ${tenant.name} (slug: ${tenant.slug})`);
  } else {
    console.log(`ℹ️   Tenant already exists: ${tenant.name}`);
  }

  // ── Primary Tenant Admin (Created by Super Admin) ────────────
  const primaryAdminEmail = 'admin@demo.kitchenerp.com';

  let primaryAdmin = await prisma.user.findUnique({ where: { email: primaryAdminEmail } });

  if (!primaryAdmin) {
    primaryAdmin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: primaryAdminEmail,
        passwordHash: await hashPassword('TenantAdmin@123'),
        name: 'Grand Admin (Super Created)',
        role: Role.TENANT_ADMIN,
        isActive: true,
        isSuperAdminCreated: true,
        createdBy: superAdmin.id,
        updatedBy: superAdmin.id,
      },
    });
    console.log(`✅  Primary Tenant Admin created (Super-Admin created): ${primaryAdminEmail}`);
  } else {
    console.log(`ℹ️   Primary Tenant Admin already exists: ${primaryAdminEmail}`);
  }

  // ── Secondary Tenant Admin ────────────────────────────────────
  const secondaryAdminEmail = 'subadmin@demo.kitchenerp.com';

  let secondaryAdmin = await prisma.user.findUnique({ where: { email: secondaryAdminEmail } });

  if (!secondaryAdmin) {
    secondaryAdmin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: secondaryAdminEmail,
        passwordHash: await hashPassword('TenantAdmin@123'),
        name: 'Assistant Admin',
        role: Role.TENANT_ADMIN,
        isActive: true,
        isSuperAdminCreated: false,
        createdBy: primaryAdmin.id,
        updatedBy: primaryAdmin.id,
      },
    });
    console.log(`✅  Secondary Tenant Admin created: ${secondaryAdminEmail}`);
  } else {
    console.log(`ℹ️   Secondary Tenant Admin already exists: ${secondaryAdminEmail}`);
  }

  // ── Inventory Manager ─────────────────────────────────────────
  const managerEmail = 'manager@demo.kitchenerp.com';

  let manager = await prisma.user.findUnique({ where: { email: managerEmail } });

  if (!manager) {
    manager = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: managerEmail,
        passwordHash: await hashPassword('Manager@123'),
        name: 'Ravi Kumar',
        role: Role.INVENTORY_MANAGER,
        isActive: true,
        createdBy: primaryAdmin.id,
        updatedBy: primaryAdmin.id,
      },
    });
    console.log(`✅  Inventory Manager created: ${managerEmail}`);
  } else {
    console.log(`ℹ️   Inventory Manager already exists: ${managerEmail}`);
  }

  // ── Unified Category Master ──────────────────────────────────
  const categoriesList = [
    {
      name: 'Vegetable',
      displayOrder: 1,
      icon: '🥕',
      color: '#22c55e',
      description: 'Fresh vegetables and leafy greens',
    },
    {
      name: 'Fruit',
      displayOrder: 2,
      icon: '🍎',
      color: '#ef4444',
      description: 'Fresh seasonal fruits',
    },
    {
      name: 'Dairy',
      displayOrder: 3,
      icon: '🥛',
      color: '#3b82f6',
      description: 'Milk, ghee, paneer, and butter',
    },
    {
      name: 'Grocery',
      displayOrder: 4,
      icon: '🌾',
      color: '#f59e0b',
      description: 'Rice, pulses, spices, and oil',
    },
    {
      name: 'Gas',
      displayOrder: 5,
      icon: '🔥',
      color: '#ec4899',
      description: 'LPG cylinders and commercial gas',
    },
    {
      name: 'Bakery',
      displayOrder: 6,
      icon: '🍞',
      color: '#8b5cf6',
      description: 'Bread, buns, and baking items',
    },
    {
      name: 'Cleaning',
      displayOrder: 7,
      icon: '🧹',
      color: '#06b6d4',
      description: 'Detergents, hygiene, and supplies',
    },
    {
      name: 'Frozen',
      displayOrder: 8,
      icon: '❄️',
      color: '#64748b',
      description: 'Frozen meat, vegetables, and prepped items',
    },
    {
      name: 'Beverages',
      displayOrder: 9,
      icon: '🥤',
      color: '#10b981',
      description: 'Juices, cold drinks, and syrup',
    },
  ];

  const categoryMap: Record<string, string> = {};

  for (const cat of categoriesList) {
    const existing = await prisma.category.findFirst({
      where: { tenantId: tenant.id, name: cat.name, deletedAt: null },
    });

    if (!existing) {
      const created = await prisma.category.create({
        data: {
          tenantId: tenant.id,
          name: cat.name,
          displayOrder: cat.displayOrder,
          icon: cat.icon,
          color: cat.color,
          description: cat.description,
          isActive: true,
          createdBy: primaryAdmin.id,
          updatedBy: primaryAdmin.id,
        },
      });
      categoryMap[cat.name] = created.id;
      console.log(`✅  Category Master: ${cat.icon} ${cat.name}`);
    } else {
      categoryMap[cat.name] = existing.id;
    }
  }

  // ── Sample Vendors ────────────────────────────────────────────
  const vendorsList = [
    {
      name: 'Ramu Organic Vegetables',
      categoryKey: 'Vegetable',
      phone: '9876543210',
      gst: '27AAAAA0000A1Z5',
      address: 'Market Yard Gate 1',
    },
    {
      name: 'Green Produce Supplies',
      categoryKey: 'Vegetable',
      phone: '9876543215',
      gst: '27BBBBB1111B1Z2',
      address: 'Subzi Mandi Stall 12',
    },
    {
      name: 'Fresh Orchard Fruits',
      categoryKey: 'Fruit',
      phone: '9876543211',
      gst: '27CCCCC2222C1Z9',
      address: 'Fruit Wholesale Hub',
    },
    {
      name: 'Amul Dairy Distro',
      categoryKey: 'Dairy',
      phone: '9876543212',
      gst: '27DDDDD3333D1Z6',
      address: 'Dairy Complex Plot 4',
    },
    {
      name: 'Shree Ji Wholesale Grocery',
      categoryKey: 'Grocery',
      phone: '9876543213',
      gst: '27EEEEE4444E1Z3',
      address: 'Grain Market Shop 88',
    },
    {
      name: 'Bharat Petroleum Commercial Gas',
      categoryKey: 'Gas',
      phone: '9876543214',
      gst: '27FFFFF5555F1Z0',
      address: 'Industrial Area Depot',
    },
    {
      name: 'Sunrise Bakery & Flour',
      categoryKey: 'Bakery',
      phone: '9876543216',
      gst: '27GGGGG6666G1Z7',
      address: 'Bakers Lane 5',
    },
    {
      name: 'CleanTech Hygiene Supplies',
      categoryKey: 'Cleaning',
      phone: '9876543217',
      gst: '27HHHHH7777H1Z4',
      address: 'Chemical Market B-12',
    },
    {
      name: 'Frosty Foods Ltd',
      categoryKey: 'Frozen',
      phone: '9876543218',
      gst: '27IIIII8888I1Z1',
      address: 'Cold Storage Road 2',
    },
    {
      name: 'Cool Wave Drinks',
      categoryKey: 'Beverages',
      phone: '9876543219',
      gst: '27JJJJJ9999J1Z8',
      address: 'Bottling Plant Sector 3',
    },
  ];

  for (const v of vendorsList) {
    const categoryId = categoryMap[v.categoryKey];
    if (!categoryId) continue;

    const existing = await prisma.vendor.findFirst({
      where: { tenantId: tenant.id, name: v.name, deletedAt: null },
    });

    if (!existing) {
      await prisma.vendor.create({
        data: {
          tenantId: tenant.id,
          categoryId,
          name: v.name,
          phone: v.phone,
          gst: v.gst,
          address: v.address,
          isActive: true,
          createdBy: primaryAdmin.id,
          updatedBy: primaryAdmin.id,
        },
      });
      console.log(`✅  Vendor: ${v.name} (${v.categoryKey})`);
    }
  }

  // ── Sample Products ───────────────────────────────────────────
  const productsList = [
    { name: 'Fresh Tomato', categoryKey: 'Vegetable', unit: 'kg' },
    { name: 'Red Onion', categoryKey: 'Vegetable', unit: 'kg' },
    { name: 'Potato (Special)', categoryKey: 'Vegetable', unit: 'kg' },
    { name: 'Green Chilli', categoryKey: 'Vegetable', unit: 'kg' },
    { name: 'Ginger & Garlic Paste Base', categoryKey: 'Vegetable', unit: 'kg' },
    { name: 'Coriander Leaves', categoryKey: 'Vegetable', unit: 'bunch' },
    { name: 'Banana (Robusta)', categoryKey: 'Fruit', unit: 'dozen' },
    { name: 'Apple (Kashmir)', categoryKey: 'Fruit', unit: 'kg' },
    { name: 'Orange', categoryKey: 'Fruit', unit: 'kg' },
    { name: 'Full Cream Milk', categoryKey: 'Dairy', unit: 'litre' },
    { name: 'Pure Cow Ghee', categoryKey: 'Dairy', unit: 'kg' },
    { name: 'Fresh Paneer', categoryKey: 'Dairy', unit: 'kg' },
    { name: 'Butter Block', categoryKey: 'Dairy', unit: 'kg' },
    { name: 'Basmati Rice (Extra Long)', categoryKey: 'Grocery', unit: 'kg' },
    { name: 'Toor Dal Premium', categoryKey: 'Grocery', unit: 'kg' },
    { name: 'Refined Sunflower Oil', categoryKey: 'Grocery', unit: 'litre' },
    { name: 'Turmeric Powder', categoryKey: 'Grocery', unit: 'kg' },
    { name: 'Red Chilli Powder', categoryKey: 'Grocery', unit: 'kg' },
    { name: 'Iodized Salt', categoryKey: 'Grocery', unit: 'packet' },
    { name: 'Commercial LPG Cylinder 19kg', categoryKey: 'Gas', unit: 'cylinder' },
    { name: 'White Sandwich Bread', categoryKey: 'Bakery', unit: 'packet' },
    { name: 'Burger Buns', categoryKey: 'Bakery', unit: 'packet' },
    { name: 'Dishwashing Liquid Soap', categoryKey: 'Cleaning', unit: 'litre' },
    { name: 'Surface Disinfectant', categoryKey: 'Cleaning', unit: 'can' },
    { name: 'Frozen Green Peas', categoryKey: 'Frozen', unit: 'packet' },
    { name: 'Frozen French Fries', categoryKey: 'Frozen', unit: 'packet' },
    { name: 'Soda Water 750ml', categoryKey: 'Beverages', unit: 'bottle' },
    { name: 'Mango Pulp Can 1kg', categoryKey: 'Beverages', unit: 'can' },
  ];

  for (const p of productsList) {
    const categoryId = categoryMap[p.categoryKey];
    if (!categoryId) continue;

    const existing = await prisma.product.findFirst({
      where: { tenantId: tenant.id, name: p.name, deletedAt: null },
    });

    if (!existing) {
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          categoryId,
          name: p.name,
          unit: p.unit,
          isActive: true,
          createdBy: primaryAdmin.id,
          updatedBy: primaryAdmin.id,
        },
      });
      console.log(`✅  Product: ${p.name} [${p.categoryKey}] (${p.unit})`);
    }
  }

  console.log('\n🎉  Seed completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
