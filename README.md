# Kitchen ERP — Multi-Tenant Enterprise Solution

Production-quality, enterprise-grade multi-tenant Kitchen ERP system built from scratch with Next.js, Express, PostgreSQL, Prisma ORM, JWT authentication, and local file storage.

---

## 🏗 Key Architectural Principles

- **Unified Category Master**: Consolidated single category master (`Category`) referenced directly by both `Vendor` and `Product` tables.
- **Tenant Isolation**: Every database table uses UUID PKs, `tenantId`, audit timestamps (`createdAt`, `updatedAt`, `deletedAt`), and user tracking (`createdBy`, `updatedBy`). All queries automatically filter by `tenantId`.
- **Role & Permission Controls**: 
  - `SUPER_ADMIN`: Tenant management (Create, Update, Delete, Activate, Deactivate, create first Tenant Admin).
  - `TENANT_ADMIN`: Manages Users, Category Master, Vendor Master, Product Master, Purchases, Reports, Invoices. *(Tenant Admins created by Super Admin cannot be deleted by another Tenant Admin).*
  - `INVENTORY_MANAGER`: Mobile PWA access for purchase entry & invoice uploads.
- **Clean Architecture & DDD**: Monorepo split into clear modules (`Controller → Service → Repository → DTO → Validation → Routes`).

---

## 📂 Project Structure

```
kitchen-erp/
├── apps/
│   ├── api/          # Node + Express REST API       (port 4000)
│   ├── admin/        # Next.js Admin Portal          (port 3000)
│   └── pwa/          # Next.js PWA Mobile App        (port 3002)
├── packages/
│   ├── types/        # Shared TypeScript types & DTOs
│   ├── utils/        # Shared utilities & helpers
│   ├── api-client/   # Typed Axios API client
│   └── ui/           # Shared React UI components
├── prisma/           # Schema, migrations, seed script
└── docs/             # REST API, DB Schema & Setup docs
```

---

## 🔐 Default Credentials (after seed)

| Role | Email | Password | Deletion Restriction |
|---|---|---|---|
| Super Admin | `super@kitchenerp.com` | `SuperAdmin@123` | N/A |
| Tenant Admin (Primary) | `admin@demo.kitchenerp.com` | `TenantAdmin@123` | **Only Super Admin can delete** |
| Tenant Admin (Secondary) | `subadmin@demo.kitchenerp.com` | `TenantAdmin@123` | Can be managed by Tenant Admin |
| Inventory Manager | `manager@demo.kitchenerp.com` | `Manager@123` | Can be managed by Tenant Admin |

---

## ⚡ Complete 17-Step Local Setup & Execution Guide

Follow these steps to run everything end-to-end locally without Docker:

1. **Install PostgreSQL** (v14+).
2. **Create Database**:
   ```bash
   createdb -U postgres kitchen_erp
   ```
3. **Configure `.env`**:
   ```bash
   cp .env.example .env
   ```
4. **Run Prisma Migration**:
   ```bash
   npx prisma db push --schema=prisma/schema.prisma
   ```
5. **Seed Database**:
   ```bash
   npx ts-node prisma/seed.ts
   ```
6. **Start API**:
   ```bash
   npm run dev --workspace=@kitchen-erp/api
   ```
7. **Start Admin Portal**:
   ```bash
   npm run dev --workspace=@kitchen-erp/admin
   ```
8. **Start PWA**:
   ```bash
   npm run dev --workspace=@kitchen-erp/pwa
   ```
9. **Login as Super Admin** at `http://localhost:3000`.
10. **Create Tenant** in Admin Portal (**Tenants** section).
11. **Create Tenant Admin** in Admin Portal (**Users** section).
12. **Create Categories** in **Category Master** (`http://localhost:3000/dashboard/categories`).
13. **Create Vendors** in **Vendor Master** linked to Category Master.
14. **Create Products** in **Product Master** linked to Category Master with default unit.
15. **Login Inventory Manager** at `http://localhost:3002` (PWA).
16. **Create Purchase** in PWA: select category tile, select vendor, select product from searchable dropdown, enter Qty & Rate for auto calculation (`Qty × Rate`).
17. **Upload Invoice & Save Purchase**: attach receipt image/PDF and tap sticky grand total ticket bar to submit.

---

## 📖 Documentation

- [API Specification](./docs/API.md)
- [Database Schema](./docs/DATABASE.md)
- [Detailed Setup Guide](./docs/SETUP.md)
