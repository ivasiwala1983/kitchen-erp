-- ============================================================
-- Migration: Add Centralized Tenant Feature Entitlements System
-- Date: 2026-08-10
-- ============================================================

-- CreateTable: features
CREATE TABLE IF NOT EXISTS "features" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tenant_features
CREATE TABLE IF NOT EXISTS "tenant_features" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "featureId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: features_code_key
CREATE UNIQUE INDEX IF NOT EXISTS "features_code_key" ON "features"("code");

-- CreateIndex: tenant_features_tenantId_idx
CREATE INDEX IF NOT EXISTS "tenant_features_tenantId_idx" ON "tenant_features"("tenantId");

-- CreateIndex: tenant_features_featureId_idx
CREATE INDEX IF NOT EXISTS "tenant_features_featureId_idx" ON "tenant_features"("featureId");

-- CreateIndex: tenant_features_tenantId_featureId_key
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_features_tenantId_featureId_key" ON "tenant_features"("tenantId", "featureId");

-- AddForeignKey: tenant_features -> tenants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_features_tenantId_fkey'
    ) THEN
        ALTER TABLE "tenant_features" 
        ADD CONSTRAINT "tenant_features_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: tenant_features -> features
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_features_featureId_fkey'
    ) THEN
        ALTER TABLE "tenant_features" 
        ADD CONSTRAINT "tenant_features_featureId_fkey" 
        FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================
-- Data Seed: Insert Default Platform Features
-- 9 Business Features default to ON (true), AI Assistant defaults to OFF (false)
-- ============================================================

INSERT INTO "features" ("id", "code", "name", "description", "category", "defaultEnabled", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid(), 'FEATURE_DASHBOARD', 'Dashboard', 'Main tenant dashboard & summary analytics', 'CORE', true, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'FEATURE_PURCHASES', 'Purchases', 'Procurement entry and purchase order management', 'PROCUREMENT', true, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'FEATURE_PURCHASE_HISTORY', 'Purchase History', 'Historical purchase records and receipts', 'PROCUREMENT', true, true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'FEATURE_VENDORS', 'Vendors', 'Supplier directory and vendor management', 'DIRECTORY', true, true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'FEATURE_PRODUCTS', 'Products', 'Master product catalog and units', 'DIRECTORY', true, true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'FEATURE_INVENTORY', 'Inventory', 'Stock tracking and inventory insights', 'INVENTORY', true, true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'FEATURE_LEDGER', 'Ledger', 'Vendor financial accounts and payment history', 'FINANCE', true, true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'FEATURE_REPORTS', 'Reports', 'Operational reports and financial summaries', 'ANALYTICS', true, true, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'FEATURE_INVOICE_UPLOAD', 'Invoice Upload', 'Attach and manage vendor invoice files', 'DOCUMENTATION', true, true, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'FEATURE_AI_ASSISTANT', 'ArgusOne Assistant', 'AI business operations assistant (Ask ArgusOne)', 'INTELLIGENCE', false, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "category" = EXCLUDED."category",
    "defaultEnabled" = EXCLUDED."defaultEnabled",
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = CURRENT_TIMESTAMP;
