import { Role, TenantPlan, PurchaseStatus } from '../enums';

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
