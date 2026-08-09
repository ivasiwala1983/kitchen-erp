# Kitchen ERP — Database Schema & Architecture

## Overview

The database is built on **PostgreSQL** using **Prisma ORM** with **UUID primary keys** and strict **multi-tenant isolation**. Every entity (except system-wide models like `Tenant` and `AuditLog`) includes a mandatory `tenantId` field and soft delete field (`deletedAt`).

---

## Entity Relationship Diagram (ERD)

```
+------------------+         +-----------------------+         +------------------------+
|      Tenant      |1       *|         User          |1       *|         Vendor         |
|------------------|---------|-----------------------|---------|------------------------|
| id (UUID) PK     |         | id (UUID) PK          |         | id (UUID) PK           |
| name             |         | tenantId (UUID) FK    |         | tenantId (UUID) FK     |
| slug (UNIQUE)    |         | email (UNIQUE)        |         | categoryId (UUID) FK   |
| domain           |         | role (ENUM)           |         | name                   |
| plan (ENUM)      |         | passwordHash          |         | phone, email, address  |
| isActive         |         | isActive              |         +------------------------+
+------------------+         +-----------------------+                      |
                                         |                                  |
                                         | 1                                | 1
                                         |                                  |
                                         | *                                | *
                             +------------------------+         +------------------------+
                             |        Purchase        |*       1|      PurchaseItem      |
                             |------------------------|---------|------------------------|
                             | id (UUID) PK           |         | id (UUID) PK           |
                             | tenantId (UUID) FK     |         | purchaseId (UUID) FK   |
                             | vendorId (UUID) FK     |         | productId (UUID) FK    |
                             | userId (UUID) FK       |         | qty (DECIMAL 12,3)     |
                             | grandTotal (DECIMAL)   |         | rate (DECIMAL 12,2)    |
                             | status (ENUM)          |         | total (DECIMAL 12,2)   |
                             | invoiceUrl, invoiceFid |         +------------------------+
                             +------------------------+
```

---

## Models & Tables

### 1. `Tenant` (`tenants`)

Represents an isolated kitchen organization.

| Field      | Type          | Constraints                                                     | Description                                      |
| ---------- | ------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `id`       | String (UUID) | PK, default `uuid()`                                            | Primary Key                                      |
| `name`     | String        | Required                                                        | Tenant organization name                         |
| `slug`     | String        | Unique                                                          | Subdomain/Slug identifier (e.g. `badri-kitchen`) |
| `domain`   | String?       | Unique, Optional                                                | Custom domain                                    |
| `plan`     | TenantPlan    | Enum (`BASIC`, `STANDARD`, `PREMIUM`)                           | Subscription tier                                |
| `isActive` | Boolean       | Default `true`                                                  | Activation status                                |
| Audit      | DateTime/UUID | `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt` | Audit trail                                      |

---

### 2. `User` (`users`)

Represents platform and tenant users.

| Field          | Type           | Constraints                                               | Description            |
| -------------- | -------------- | --------------------------------------------------------- | ---------------------- |
| `id`           | String (UUID)  | PK                                                        | Primary Key            |
| `tenantId`     | String? (UUID) | FK -> `Tenant.id`                                         | Null for Super Admin   |
| `email`        | String         | Unique                                                    | Login email            |
| `passwordHash` | String         | Required                                                  | bcrypt hashed password |
| `name`         | String         | Required                                                  | Display name           |
| `role`         | Role           | Enum (`SUPER_ADMIN`, `TENANT_ADMIN`, `INVENTORY_MANAGER`) | Access role            |
| `isActive`     | Boolean        | Default `true`                                            | Active status          |

---

### 3. `VendorCategory` (`vendor_categories`)

Categories for grouping suppliers (e.g., Vegetable, Dairy, Grocery, Gas, Fish, Meat, Bakery).

| Field      | Type          | Constraints       | Description        |
| ---------- | ------------- | ----------------- | ------------------ |
| `id`       | String (UUID) | PK                | Primary Key        |
| `tenantId` | String (UUID) | FK -> `Tenant.id` | Multi-tenant scope |
| `name`     | String        | Required          | Category name      |
| `isActive` | Boolean       | Default `true`    | Status             |

---

### 4. `Vendor` (`vendors`)

Suppliers providing raw materials.

| Field        | Type          | Constraints               | Description        |
| ------------ | ------------- | ------------------------- | ------------------ |
| `id`         | String (UUID) | PK                        | Primary Key        |
| `tenantId`   | String (UUID) | FK -> `Tenant.id`         | Multi-tenant scope |
| `categoryId` | String (UUID) | FK -> `VendorCategory.id` | Category           |
| `name`       | String        | Required                  | Vendor name        |
| `phone`      | String?       | Optional                  | Phone number       |
| `email`      | String?       | Optional                  | Email              |
| `address`    | String?       | Optional                  | Physical address   |
| `isActive`   | Boolean       | Default `true`            | Status             |

---

### 5. `ProductCategory` (`product_categories`)

Categories for raw kitchen products (e.g., Rice & Grains, Spices, Oil & Ghee).

| Field      | Type          | Constraints       | Description        |
| ---------- | ------------- | ----------------- | ------------------ |
| `id`       | String (UUID) | PK                | Primary Key        |
| `tenantId` | String (UUID) | FK -> `Tenant.id` | Multi-tenant scope |
| `name`     | String        | Required          | Category name      |
| `isActive` | Boolean       | Default `true`    | Status             |

---

### 6. `Product` (`products`)

Raw kitchen materials (e.g., Basmati Rice, Milk, Sunflower Oil).

| Field        | Type          | Constraints                             | Description        |
| ------------ | ------------- | --------------------------------------- | ------------------ |
| `id`         | String (UUID) | PK                                      | Primary Key        |
| `tenantId`   | String (UUID) | FK -> `Tenant.id`                       | Multi-tenant scope |
| `categoryId` | String (UUID) | FK -> `ProductCategory.id`              | Category           |
| `name`       | String        | Required                                | Product name       |
| `unit`       | String        | Required (e.g., `kg`, `litre`, `piece`) | Unit of measure    |
| `isActive`   | Boolean       | Default `true`                          | Status             |

---

### 7. `Purchase` (`purchases`)

Purchase order header.

| Field                | Type           | Constraints                              | Description                                  |
| -------------------- | -------------- | ---------------------------------------- | -------------------------------------------- |
| `id`                 | String (UUID)  | PK                                       | Primary Key                                  |
| `tenantId`           | String (UUID)  | FK -> `Tenant.id`                        | Multi-tenant scope                           |
| `vendorId`           | String (UUID)  | FK -> `Vendor.id`                        | Supplier                                     |
| `userId`             | String (UUID)  | FK -> `User.id`                          | Creator (Inventory Manager)                  |
| `grandTotal`         | Decimal(12,2)  | Required                                 | Auto-computed sum of item totals             |
| `status`             | PurchaseStatus | Enum (`DRAFT`, `CONFIRMED`, `CANCELLED`) | Order status                                 |
| `invoiceUrl`         | String?        | Optional                                 | API Proxy URL (`/api/purchases/:id/invoice`) |
| `invoiceStoragePath` | String?        | Optional                                 | Supabase Storage object path                 |
| `invoiceFileName`    | String?        | Optional                                 | Original filename                            |
| `invoiceMimeType`    | String?        | Optional                                 | File MIME type (e.g. `application/pdf`)      |
| `invoiceSize`        | Int?           | Optional                                 | File size in bytes                           |
| `invoiceUploadedAt`  | DateTime?      | Optional                                 | Upload timestamp                             |
| `invoiceUploadedBy`  | String (UUID)? | FK -> `User.id`                          | User who uploaded the invoice                |
| `notes`              | String?        | Optional                                 | Remarks                                      |
| `purchaseDate`       | DateTime       | Default `now()`                          | Transaction date                             |

---

### 8. `PurchaseItem` (`purchase_items`)

Line items for each purchase.

| Field        | Type          | Constraints                             | Description                                |
| ------------ | ------------- | --------------------------------------- | ------------------------------------------ |
| `id`         | String (UUID) | PK                                      | Primary Key                                |
| `purchaseId` | String (UUID) | FK -> `Purchase.id` (ON DELETE CASCADE) | Parent purchase                            |
| `productId`  | String (UUID) | FK -> `Product.id`                      | Item purchased                             |
| `qty`        | Decimal(12,3) | Required                                | Quantity (supports fractional like 2.5 kg) |
| `rate`       | Decimal(12,2) | Required                                | Rate per unit                              |
| `total`      | Decimal(12,2) | Required                                | Auto-computed `qty * rate`                 |

---

### 9. `AuditLog` (`audit_logs`)

Immutable log of system actions.

| Field       | Type           | Constraints                                           | Description                    |
| ----------- | -------------- | ----------------------------------------------------- | ------------------------------ |
| `id`        | String (UUID)  | PK                                                    | Primary Key                    |
| `tenantId`  | String? (UUID) | FK -> `Tenant.id`                                     | Tenant context (if applicable) |
| `userId`    | String? (UUID) | FK -> `User.id`                                       | User performing action         |
| `action`    | String         | Required (e.g. `CREATE`, `UPDATE`, `DELETE`, `LOGIN`) | Action type                    |
| `entity`    | String         | Required (e.g. `Vendor`, `Purchase`)                  | Entity affected                |
| `entityId`  | String?        | Optional                                              | ID of entity affected          |
| `oldValues` | Json?          | Optional                                              | Previous state                 |
| `newValues` | Json?          | Optional                                              | New state                      |
| `ip`        | String?        | Optional                                              | IP address                     |
| `userAgent` | String?        | Optional                                              | User Agent                     |
| `createdAt` | DateTime       | Default `now()`                                       | Timestamp                      |

---

## Performance Indexes

```prisma
@@index([tenantId, deletedAt])
@@index([tenantId, vendorId])
@@index([tenantId, userId])
@@index([tenantId, purchaseDate])
```
