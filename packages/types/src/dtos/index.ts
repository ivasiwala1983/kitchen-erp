import { Role, TenantPlan, PurchaseStatus, PaymentMethod, LedgerTransactionType } from '../enums';

export interface LoginDto {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  tokens: TokenPair;
  user: any;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

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

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role: Role;
}

export interface UpdateUserDto {
  email?: string;
  name?: string;
  role?: Role;
  isActive?: boolean;
}

export interface CreateCategoryDto {
  name: string;
  displayOrder?: number;
  icon?: string;
  color?: string;
  description?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  displayOrder?: number;
  icon?: string;
  color?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateVendorDto {
  categoryId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gst?: string;
}

export interface QuickAddVendorDto {
  name: string;
  categoryId: string;
}

export interface QuickAddVendorResult {
  created: boolean;
  existing?: boolean;
  vendor: {
    id: string;
    tenantId: string;
    categoryId: string;
    name: string;
    isActive: boolean;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    gst?: string | null;
  };
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

export interface CreateProductDto {
  categoryId: string;
  name: string;
  unit?: string;
}

export interface UpdateProductDto {
  categoryId?: string;
  name?: string;
  unit?: string;
  isActive?: boolean;
}

export interface CreatePurchaseItemDto {
  productId: string;
  qty: number;
  rate: number;
}

export interface CreatePurchaseDto {
  vendorId: string;
  notes?: string;
  invoiceUrl?: string;
  purchaseDate?: string;
  items: CreatePurchaseItemDto[];
}

export interface UpdatePurchaseDto {
  vendorId?: string;
  notes?: string;
  status?: PurchaseStatus;
}

export interface InvoiceUploadResponse {
  purchaseId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string | Date;
  signedUrl: string;
  invoiceUrl: string;
}

export interface InvoiceMetadataResponse {
  purchaseId: string;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  uploadedAt: string | Date | null;
  signedUrl: string;
  invoiceUrl: string;
}

export interface CreatePaymentDto {
  vendorId: string;
  amount: number;
  paymentDate?: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  note?: string;
}

export interface LedgerQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  vendorId?: string;
  categoryId?: string;
  type?: LedgerTransactionType;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
}
