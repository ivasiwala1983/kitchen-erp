/**
 * @kitchen-erp/types
 * Shared TypeScript types, enums, interfaces, and DTOs
 * used across API, Admin, and PWA applications.
 */

// ── Enums ─────────────────────────────────────────────────────

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
}

export enum PurchaseStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum TenantPlan {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
}

// ── Common ────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

// ── Auth DTOs ─────────────────────────────────────────────────

export interface LoginDto {
  email: string;
  password: string;
  tenantSlug?: string; // optional for super-admin login
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  tokens: TokenPair;
  user: UserPublic;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

// ── Tenant DTOs ───────────────────────────────────────────────

export interface CreateTenantDto {
  name: string;
  slug: string;
  domain?: string;
  plan?: TenantPlan;
  currency?: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export interface UpdateTenantDto {
  name?: string;
  domain?: string;
  plan?: TenantPlan;
  currency?: string;
  isActive?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  isActive: boolean;
  plan: TenantPlan;
  currency?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number; purchases: number; categories: number };
}

// ── User DTOs ─────────────────────────────────────────────────

export interface UserPublic {
  id: string;
  tenantId?: string | null;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  isSuperAdminCreated?: boolean;
  createdAt: string;
  tenant?: Partial<Tenant> | null;
}

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role: Role;
}

export interface UpdateUserDto {
  name?: string;
  isActive?: boolean;
  role?: Role;
}

// ── Category Master DTOs ──────────────────────────────────────

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  displayOrder: number;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { vendors: number; products: number };
}

export interface CreateCategoryDto {
  name: string;
  displayOrder?: number;
  icon?: string;
  color?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  displayOrder?: number;
  icon?: string;
  color?: string;
  description?: string;
  isActive?: boolean;
}

// ── Vendor DTOs ───────────────────────────────────────────────

export interface Vendor {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gst?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface CreateVendorDto {
  categoryId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gst?: string;
  isActive?: boolean;
}

export interface UpdateVendorDto {
  categoryId?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  gst?: string;
  isActive?: boolean;
}

// ── Product DTOs ──────────────────────────────────────────────

export interface Product {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface CreateProductDto {
  categoryId: string;
  name: string;
  unit: string;
  isActive?: boolean;
}

export interface UpdateProductDto {
  categoryId?: string;
  name?: string;
  unit?: string;
  isActive?: boolean;
}

// ── Purchase DTOs ─────────────────────────────────────────────

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  qty: number;
  rate: number;
  total: number;
  product?: Product;
}

export interface Purchase {
  id: string;
  tenantId: string;
  vendorId: string;
  userId: string;
  grandTotal: number;
  invoiceUrl?: string | null;
  notes?: string | null;
  status: PurchaseStatus;
  purchaseDate: string;
  createdAt: string;
  updatedAt: string;
  vendor?: Vendor;
  user?: UserPublic;
  items?: PurchaseItem[];
}

export interface CreatePurchaseItemDto {
  productId: string;
  qty: number;
  rate: number;
}

export interface CreatePurchaseDto {
  vendorId: string;
  items: CreatePurchaseItemDto[];
  notes?: string;
  purchaseDate?: string;
  status?: PurchaseStatus;
  invoiceUrl?: string;
}

export interface UpdatePurchaseDto {
  vendorId?: string;
  items?: CreatePurchaseItemDto[];
  notes?: string;
  status?: PurchaseStatus;
  invoiceUrl?: string;
}

// ── Report Types ──────────────────────────────────────────────

export interface DailyReportItem {
  date: string;
  totalPurchases: number;
  totalAmount: number;
}

export interface MonthlyReportItem {
  month: string;
  totalPurchases: number;
  totalAmount: number;
}

export interface VendorReportItem {
  vendorId: string;
  vendorName: string;
  totalPurchases: number;
  totalAmount: number;
}

export interface CategoryReportItem {
  categoryId: string;
  categoryName: string;
  totalPurchases: number;
  totalAmount: number;
}

export interface ProductReportItem {
  productId: string;
  productName: string;
  unit: string;
  totalQty: number;
  totalAmount: number;
}

export interface ManagerReportItem {
  userId: string;
  userName: string;
  totalPurchases: number;
  totalAmount: number;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  vendorId?: string;
  categoryId?: string;
  productId?: string;
  userId?: string;
}

// ── Audit Log Types ───────────────────────────────────────────

export interface AuditLog {
  id: string;
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: UserPublic;
}

// ── JWT Payload ───────────────────────────────────────────────

export interface JwtPayload {
  sub: string; // userId
  tenantId?: string | null;
  role: Role;
  email: string;
  iat?: number;
  exp?: number;
}
