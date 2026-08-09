# Kitchen ERP — Complete End-to-End Setup Guide

This guide walks through setting up and running the multi-tenant Kitchen ERP system locally without Docker.

---

## 1. Install PostgreSQL

Ensure PostgreSQL (v14+) is installed locally on your system.

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql@15
brew services start postgresql@15
```

---

## 2. Create Database

Create the `kitchen_erp` PostgreSQL database:

```bash
# Using createdb command
createdb -U postgres kitchen_erp

# Or using psql CLI
PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE kitchen_erp;"
```

---

## 3. Configure .env

Copy the sample environment file and adjust your database connection credentials:

```bash
cp .env.example .env
```

Verify your `.env` settings:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/kitchen_erp?schema=public"
JWT_SECRET="kitchen-erp-super-secret-jwt-key-2026-change-in-prod"
JWT_REFRESH_SECRET="kitchen-erp-super-secret-refresh-key-2026-change-in-prod"
API_PORT=4000
SUPABASE_URL="https://[YOUR_SUPABASE_PROJECT_REF].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
SUPABASE_STORAGE_BUCKET="kitchen-erp-invoices"
```

---

## 4. Run Prisma Migration

Sync the database schema with PostgreSQL:

```bash
npx prisma db push --schema=prisma/schema.prisma
```

---

## 5. Seed Database

Populate initial Super Admin, sample tenant, Category Master records, vendors, and products:

```bash
npx ts-node prisma/seed.ts
```

---

## 6. Start API

Start the Express API server (Port 4000):

```bash
npm run dev --workspace=@kitchen-erp/api
```

Verify health check:
`curl http://localhost:4000/health`

---

## 7. Start Admin Portal

Start the Next.js Admin portal (Port 3000):

```bash
npm run dev --workspace=@kitchen-erp/admin
```

---

## 8. Start PWA

Start the Next.js Inventory Manager PWA (Port 3002):

```bash
npm run dev --workspace=@kitchen-erp/pwa
```

Or start all apps concurrently:

```bash
npm run dev
```

---

## 9. Login as Super Admin

1. Open `http://localhost:3000` (Admin Portal).
2. Login with Super Admin credentials:
   - **Email:** `super@kitchenerp.com`
   - **Password:** `SuperAdmin@123`

---

## 10. Create Tenant

1. Navigate to **Tenants** (`http://localhost:3000/dashboard/tenants`).
2. Click **+ New Tenant**.
3. Fill in Tenant Name (e.g. `Royal Kitchen`), Slug (`royal-kitchen`), Plan (`PREMIUM`), and Initial Tenant Admin credentials.
4. Click **Create Tenant**.

---

## 11. Create Tenant Admin

1. Log out or switch to Tenant Admin (`admin@demo.kitchenerp.com` / `TenantAdmin@123`).
2. Navigate to **Users** (`http://localhost:3000/dashboard/users`).
3. Click **+ New User**, select Role **Tenant Admin**, enter details, and save.
4. _Note: Tenant Admins created by Super Admin cannot be deleted by another Tenant Admin._

---

## 12. Create Categories (Category Master)

1. Navigate to **Category Master** (`http://localhost:3000/dashboard/categories`).
2. Click **+ Add Category**.
3. Enter Name (e.g., `Vegetable`, `Dairy`), Display Order, Icon (`🥕`), Color (`#22c55e`), and Active status.
4. Save the Category.

---

## 13. Create Vendors

1. Navigate to **Vendor Master** (`http://localhost:3000/dashboard/vendors`).
2. Click **+ New Vendor**.
3. Select Category from Category Master (e.g., `Vegetable`).
4. Enter Vendor Name, Phone, Address, and GST number.
5. Save Vendor.

---

## 14. Create Products

1. Navigate to **Product Master** (`http://localhost:3000/dashboard/products`).
2. Click **+ New Product**.
3. Select Category from Category Master (e.g., `Vegetable`).
4. Enter Product Name (e.g., `Fresh Tomato`) and Default Unit (`kg`).
5. Save Product.

---

## 15. Login Inventory Manager

1. Open `http://localhost:3002` (PWA).
2. Sign in with Inventory Manager credentials:
   - **Email:** `manager@demo.kitchenerp.com`
   - **Password:** `Manager@123`

---

## 16. Create Purchase

1. On the PWA Dashboard, select a Category tile/chip (e.g., `🥕 Vegetable`).
2. Select a Vendor from the dropdown menu (filtered by selected category).
3. Select a Product from the searchable dropdown menu (filtered by selected category). Notice the default unit (e.g. `kg`) is auto-filled.
4. Enter Quantity (e.g., `5.0`) and Rate (e.g., `40.00`).
5. Observe instant subtotal calculation (`5.0 × 40.00 = 200.00`) and tap `+` to add item.
6. Repeat for multiple items. Check running Grand Total in the bottom ticket bar.

---

## 17. Upload Invoice & Save Purchase

1. In the **TODAY'S RECEIPTS** section, tap **Upload Invoice** and select a receipt image or PDF file.
2. Tap the bottom sticky ticket bar to submit the purchase.
3. Verify that the purchase and invoice are saved and visible in the Admin Portal under **Purchases** and **Reports**.
