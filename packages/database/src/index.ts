/**
 * @kitchen-erp/database
 * Enterprise Database Access Layer for Kitchen ERP Monorepo.
 * Centralized Prisma ORM, Repositories, Services, Health Diagnostics, and Transactions.
 */

// Prisma Client & Wrapper
export * from './client/prisma';
export * from './client/database';

// Health & Diagnostics
export * from './health/health.service';

// Transaction Service
export * from './transactions/transaction.service';

// Domain Repositories
export * from './repositories/tenant.repository';
export * from './repositories/user.repository';
export * from './repositories/vendor.repository';
export * from './repositories/category.repository';
export * from './repositories/product.repository';
export * from './repositories/purchase.repository';
export * from './repositories/invoice.repository';
export * from './repositories/audit.repository';
export * from './repositories/report.repository';

// Database Services
export * from './services/tenantResolver.service';
export * from './services/auditLogger.service';

// Re-export Prisma Client types & enums directly from @prisma/client
export { Role, PurchaseStatus, TenantPlan, Prisma } from '@prisma/client';

export type {
  Tenant,
  User,
  Category,
  Vendor,
  Product,
  Purchase,
  PurchaseItem,
  AuditLog,
} from '@prisma/client';
