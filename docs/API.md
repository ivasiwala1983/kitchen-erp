# Kitchen ERP — REST API Documentation

**Base URL:** `http://localhost:4000/api`  
**Authentication:** Bearer JWT (all routes except `/auth/login` and `/auth/refresh`)  
**Tenant:** `X-Tenant-Slug` header for development (e.g. `demo`)

---

## Authentication

### POST /auth/login
Login and receive JWT tokens.

**Body:**
```json
{
  "email": "admin@demo.kitchenerp.com",
  "password": "TenantAdmin@123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGci...",
      "refreshToken": "eyJhbGci..."
    },
    "user": {
      "id": "uuid",
      "email": "admin@demo.kitchenerp.com",
      "name": "Grand Admin",
      "role": "TENANT_ADMIN",
      "tenantId": "uuid",
      "isActive": true
    }
  }
}
```

---

### POST /auth/refresh
Refresh access token using refresh token.

**Body:** `{ "refreshToken": "eyJhbGci..." }`

---

### GET /auth/me
Get current user profile.  
**Auth:** Required

---

### POST /auth/change-password
Change own password.  
**Auth:** Required  
**Body:** `{ "currentPassword": "...", "newPassword": "..." }`

---

### POST /auth/logout
Logout (client-side token deletion).  
**Auth:** Required

---

## Tenants
**Role:** SUPER_ADMIN only

### GET /tenants
List all tenants.  
**Query:** `page`, `limit`, `search`

### GET /tenants/:id
Get tenant by ID.

### POST /tenants
Create tenant + first admin.

**Body:**
```json
{
  "name": "Grand Kitchen",
  "slug": "grand-kitchen",
  "plan": "PREMIUM",
  "adminEmail": "admin@grand.com",
  "adminName": "Owner Name",
  "adminPassword": "Admin@123"
}
```

### PATCH /tenants/:id
Update tenant.  
**Body:** `{ "name", "domain", "plan", "isActive" }`

### PATCH /tenants/:id/activate
Activate a deactivated tenant.

### PATCH /tenants/:id/deactivate
Deactivate a tenant.

### DELETE /tenants/:id
Soft delete a tenant.

---

## Users
**Role:** SUPER_ADMIN, TENANT_ADMIN

### GET /users
List users in current tenant.  
**Query:** `page`, `limit`, `search`

### GET /users/:id
Get user by ID.

### POST /users
Create a new user.

**Body:**
```json
{
  "email": "manager@demo.kitchenerp.com",
  "password": "Manager@123",
  "name": "Ravi Kumar",
  "role": "INVENTORY_MANAGER"
}
```

### PATCH /users/:id
Update user.  
**Body:** `{ "name", "isActive", "role" }`

### DELETE /users/:id
Soft delete user.  
*Note: Tenant Admins created by Super Admin cannot be deleted by another Tenant Admin (returns 403 Forbidden). Only Super Admin can delete.*

---

## Category Master (Unified)
**Role:** SUPER_ADMIN, TENANT_ADMIN (write); INVENTORY_MANAGER (read active categories)

### GET /categories
List categories sorted by `displayOrder`.  
**Query:** `page`, `limit`, `search`, `isActive` (set `isActive=true` for PWA)

**Sample Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "name": "Vegetable",
      "displayOrder": 1,
      "icon": "🥕",
      "color": "#22c55e",
      "description": "Fresh vegetables",
      "isActive": true,
      "_count": { "vendors": 2, "products": 6 }
    }
  ],
  "total": 9,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

### POST /categories
Create category in Category Master.  
**Body:**
```json
{
  "name": "Vegetable",
  "displayOrder": 1,
  "icon": "🥕",
  "color": "#22c55e",
  "description": "Fresh vegetables and greens",
  "isActive": true
}
```

### PATCH /categories/:id
Update category name, display order, icon, color, description, active status.

### DELETE /categories/:id
Soft delete category.

---

## Vendor Master
**Role:** SUPER_ADMIN, TENANT_ADMIN (write); INVENTORY_MANAGER (read)

### GET /vendors
List vendors referencing Category Master.  
**Query:** `page`, `limit`, `search`, `categoryId`, `isActive`

### POST /vendors
Create vendor.
```json
{
  "categoryId": "uuid",
  "name": "Ramu Organic Vegetables",
  "phone": "9876543210",
  "email": "ramu@veg.com",
  "address": "Market Yard Gate 1",
  "gst": "27AAAAA0000A1Z5"
}
```

### PATCH /vendors/:id
Update vendor.  
**Body:** Any vendor fields + `isActive`

### DELETE /vendors/:id
Soft delete vendor.

---

## Product Master
**Role:** SUPER_ADMIN, TENANT_ADMIN (write); INVENTORY_MANAGER (read)

### GET /products
List products referencing Category Master.  
**Query:** `page`, `limit`, `search`, `categoryId`, `isActive`

### POST /products
```json
{
  "categoryId": "uuid",
  "name": "Fresh Tomato",
  "unit": "kg"
}
```

### PATCH /products/:id
Update product fields.

### DELETE /products/:id
Soft delete product.

---

## Purchases
**Role:** All authenticated users  
Note: Inventory Managers can only see/edit their own purchases.

### GET /purchases
List purchases.  
**Query:** `page`, `limit`, `vendorId`, `startDate`, `endDate`, `status`

### GET /purchases/:id
Get purchase with items, vendor, category, and user.

### POST /purchases
Create a purchase (full mobile/admin workflow).
```json
{
  "vendorId": "uuid",
  "items": [
    { "productId": "uuid", "qty": 5.0, "rate": 40.00 },
    { "productId": "uuid", "qty": 2.5, "rate": 120.00 }
  ],
  "notes": "Fresh stock",
  "purchaseDate": "2026-08-07T10:00:00.000Z",
  "status": "CONFIRMED"
}
```

Response includes auto-calculated `total` per item and `grandTotal`.

### PATCH /purchases/:id
Update purchase (items, vendor, notes, status).

### DELETE /purchases/:id
Soft delete. Role: TENANT_ADMIN+

### POST /purchases/:id/invoice
Upload invoice file.  
**Content-Type:** `multipart/form-data`  
**Field:** `invoice` (File: JPG/PNG/PDF, max 10MB)

**Response:**
```json
{ "success": true, "data": { "invoiceUrl": "/uploads/uuid.pdf" } }
```

### GET /purchases/:id/invoice
Redirects to the invoice file URL.

---

## Reports
**Role:** SUPER_ADMIN, TENANT_ADMIN  
**Query:** All report endpoints accept `startDate` and `endDate` (YYYY-MM-DD), plus `categoryId`, `vendorId`, `productId`, `userId`.

### GET /reports/daily
Daily purchase totals.
```json
[{ "date": "2026-08-07", "totalPurchases": 3, "totalAmount": 1250.50 }]
```

### GET /reports/monthly
Monthly purchase totals (grouped by YYYY-MM).

### GET /reports/vendor
Purchases grouped by vendor.
```json
[{ "vendorId": "uuid", "vendorName": "Ramu Organic Vegetables", "totalPurchases": 12, "totalAmount": 5600 }]
```

### GET /reports/category
Purchases grouped by Category Master.

### GET /reports/product
Products purchased with quantities.
```json
[{ "productId": "uuid", "productName": "Fresh Tomato", "unit": "kg", "totalQty": 45.5, "totalAmount": 1820 }]
```

### GET /reports/manager
Purchases grouped by inventory manager.

---

## Audit Logs
**Role:** SUPER_ADMIN, TENANT_ADMIN

### GET /audit-logs
List audit log entries.  
**Query:** `page`, `limit`, `entity`, `userId`

---

## Error Responses

All errors return:
```json
{
  "success": false,
  "message": "Error description",
  "errors": { "field": ["Validation message"] }
}
```

| Status | Meaning |
|---|---|
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient role / deletion restricted) |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 500 | Internal server error |

---

## Rate Limiting

- General: 200 requests per 15 minutes
- Auth endpoints: 20 requests per 15 minutes
