import { Role, TenantPlan, PurchaseStatus } from '../enums';

export interface JwtPayload {
  userId?: string;
  sub: string;
  email: string;
  role: Role;
  tenantId?: string | null;
  tenantSlug?: string | null;
}

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

export interface TenantPublic {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  isActive: boolean;
  plan: TenantPlan;
  currency: string;
  logoUrl?: string | null;
  theme?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface UserPublic {
  id: string;
  tenantId?: string | null;
  tenant?: TenantPublic | any | null;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  isSuperAdminCreated?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CategoryPublic {
  id: string;
  tenantId: string;
  name: string;
  displayOrder: number;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count?: {
    vendors?: number;
    products?: number;
  };
}

export interface VendorPublic {
  id: string;
  tenantId: string;
  categoryId: string;
  category?: CategoryPublic;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gst?: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ProductPublic {
  id: string;
  tenantId: string;
  categoryId: string;
  category?: CategoryPublic;
  name: string;
  unit: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PurchaseItemPublic {
  id: string;
  purchaseId: string;
  productId: string;
  product?: ProductPublic;
  qty: number;
  rate: number;
  total: number;
}

export interface PurchasePublic {
  id: string;
  tenantId: string;
  vendorId: string;
  vendor?: VendorPublic;
  userId: string;
  user?: UserPublic;
  grandTotal: number;
  invoiceUrl?: string | null;
  invoiceFid?: string | null;
  notes?: string | null;
  status: PurchaseStatus;
  purchaseDate: string | Date;
  items?: PurchaseItemPublic[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface AuditLog {
  id: string;
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: any;
  newValues?: any;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
  tenant?: TenantPublic | null;
  user?: UserPublic | null;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  tenantId?: string;
  vendorId?: string;
  categoryId?: string;
  userId?: string;
}

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
  totalQty: number;
  totalAmount: number;
}

export interface ManagerReportItem {
  userId: string;
  userName: string;
  totalPurchases: number;
  totalAmount: number;
}

// Convenient type aliases
export type Category = CategoryPublic;
export type Vendor = VendorPublic;
export type Product = ProductPublic;
export type Tenant = TenantPublic;
export type User = UserPublic;
export type Purchase = PurchasePublic;
export type PurchaseItem = PurchaseItemPublic;
