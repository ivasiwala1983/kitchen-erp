-- ============================================================
-- Migration: Add CategoryType Enum and Utility Bill Purchase Support
-- Date: 2026-08-11
-- Description:
--   1. Creates CategoryType enum ('PRODUCT', 'UTILITY_BILL')
--   2. Adds type column to categories table (defaults to 'PRODUCT')
--   3. Adds purchaseType, categoryId, billMonth, and billAmount columns to purchases table
--   4. Adds foreign key relation between purchases and categories
-- ============================================================

-- 1. Create CategoryType Enum (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'CategoryType'
    ) THEN
        CREATE TYPE "CategoryType" AS ENUM ('PRODUCT', 'UTILITY_BILL');
    END IF;
END $$;

-- 2. Alter Table: categories (Add type column defaulting to PRODUCT)
ALTER TABLE "categories"
ADD COLUMN IF NOT EXISTS "type" "CategoryType" NOT NULL DEFAULT 'PRODUCT';

-- 3. Alter Table: purchases (Add purchaseType, categoryId, billMonth, billAmount)
ALTER TABLE "purchases"
ADD COLUMN IF NOT EXISTS "purchaseType" "CategoryType" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN IF NOT EXISTS "categoryId" UUID,
ADD COLUMN IF NOT EXISTS "billMonth" TEXT,
ADD COLUMN IF NOT EXISTS "billAmount" DECIMAL(12, 2);

-- 4. Create Index: purchases_categoryId_idx
CREATE INDEX IF NOT EXISTS "purchases_categoryId_idx" ON "purchases"("categoryId");

-- 5. Add ForeignKey: purchases -> categories
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'purchases_categoryId_fkey'
    ) THEN
        ALTER TABLE "purchases"
        ADD CONSTRAINT "purchases_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
