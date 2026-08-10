import {
  Role,
  TenantPlan,
  PurchaseStatus,
  LedgerTransactionType,
  PaymentMethod,
  LedgerAccountStatus,
} from '../enums';

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

export interface PurchaseQueryParams extends PaginationParams {
  vendorId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  invoiceAvailable?: boolean | string;
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

export interface InvoiceMetadata {
  purchaseId: string;
  storagePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  uploadedAt: string | Date | null;
  uploadedBy?: string | null;
  signedUrl?: string | null;
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
  invoiceStoragePath?: string | null;
  invoiceFileName?: string | null;
  invoiceMimeType?: string | null;
  invoiceSize?: number | null;
  invoiceUploadedAt?: string | Date | null;
  invoiceUploadedBy?: string | null;
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

export interface LedgerAccountPublic {
  id: string;
  tenantId: string;
  vendorId: string;
  vendor?: VendorPublic;
  openingBalance: number;
  status: LedgerAccountStatus;
  currentBalance: number;
  isVendorCredit: boolean;
  absBalance: number;
  lastTransactionDate?: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface LedgerTransactionPublic {
  id: string;
  tenantId: string;
  ledgerAccountId: string;
  vendorId: string;
  type: LedgerTransactionType;
  amount: number;
  referenceType?: string | null;
  referenceId?: string | null;
  transactionDate: string | Date;
  paymentMethod?: PaymentMethod | null;
  note?: string | null;
  createdBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface VendorPaymentPublic {
  id: string;
  tenantId: string;
  vendorId: string;
  vendor?: VendorPublic;
  ledgerAccountId: string;
  amount: number;
  paymentDate: string | Date;
  paymentMethod: PaymentMethod;
  reference?: string | null;
  note?: string | null;
  createdBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface LedgerSummary {
  totalPayable: number;
  totalCredit: number;
  vendorCount: number;
  netBalance: number;
}

// Convenient type aliases
export type Category = CategoryPublic;
export type Vendor = VendorPublic;
export type Product = ProductPublic;
export type Tenant = TenantPublic;
export type User = UserPublic;
export type Purchase = PurchasePublic;
export type PurchaseItem = PurchaseItemPublic;
export type LedgerAccount = LedgerAccountPublic;
export type LedgerTransaction = LedgerTransactionPublic;
export type VendorPayment = VendorPaymentPublic;
