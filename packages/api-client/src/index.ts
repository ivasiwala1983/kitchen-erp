/**
 * @kitchen-erp/api-client
 * Typed Axios-based API client for the Kitchen ERP API.
 * Used by both Admin and PWA applications.
 */

import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import type {
  ApiResponse,
  PaginatedResponse,
  LoginDto,
  LoginResponse,
  RefreshTokenDto,
  ChangePasswordDto,
  TenantPublic,
  CreateTenantDto,
  UpdateTenantDto,
  UserPublic,
  CreateUserDto,
  UpdateUserDto,
  CategoryPublic,
  CreateCategoryDto,
  UpdateCategoryDto,
  VendorPublic,
  CreateVendorDto,
  UpdateVendorDto,
  ProductPublic,
  CreateProductDto,
  UpdateProductDto,
  PurchasePublic,
  CreatePurchaseDto,
  UpdatePurchaseDto,
  PaginationParams,
  TokenPair,
  LedgerAccountPublic,
  LedgerTransactionPublic,
  VendorPaymentPublic,
  LedgerSummary,
  CreatePaymentDto,
  LedgerQueryParams,
  InvoiceUploadResponse,
  InvoiceMetadataResponse,
} from '@kitchen-erp/types';

// ── Token Storage ─────────────────────────────────────────────

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(input: any) {
  if (!input) return;
  const tokens = input.tokens ? input.tokens : input;
  if (!tokens || !tokens.accessToken || tokens.accessToken === 'undefined') return;

  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken || null;

  if (typeof window !== 'undefined') {
    localStorage.setItem('kitchen_erp_access_token', tokens.accessToken);
    if (tokens.refreshToken) {
      localStorage.setItem('kitchen_erp_refresh_token', tokens.refreshToken);
    }
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('kitchen_erp_access_token');
  }
  return null;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kitchen_erp_access_token');
    localStorage.removeItem('kitchen_erp_refresh_token');
  }
}

export function loadTokensFromStorage() {
  if (typeof window !== 'undefined') {
    const at = localStorage.getItem('kitchen_erp_access_token');
    const rt = localStorage.getItem('kitchen_erp_refresh_token');
    accessToken = at && at !== 'undefined' && at !== 'null' ? at : null;
    refreshToken = rt && rt !== 'undefined' && rt !== 'null' ? rt : null;
  }
}

// ── Client Factory ────────────────────────────────────────────

export interface ApiClientConfig {
  baseURL: string;
  tenantSlug?: string;
  onUnauthorized?: () => void;
}

const NON_TENANT_PREFIXES = [
  'localhost',
  'lvh',
  'www',
  '127',
  '0',
  'vercel',
  'kitchen-erp-admin',
  'kitchen-erp-pwa',
  'kitchen-erp-api',
];

import { TenantResolver } from '@kitchen-erp/utils';

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  let normalizedBase = (config.baseURL || 'http://localhost:4000/api').trim().replace(/\/+$/, '');
  if (normalizedBase && !normalizedBase.endsWith('/api')) {
    normalizedBase = `${normalizedBase}/api`;
  }

  const client = axios.create({
    baseURL: normalizedBase,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  // Request interceptor — attach JWT + tenant header
  client.interceptors.request.use((req: InternalAxiosRequestConfig) => {
    loadTokensFromStorage();
    const token = accessToken;
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }

    let tenantSlug = config.tenantSlug;

    if (!tenantSlug && typeof window !== 'undefined') {
      const storedSlug = localStorage.getItem('kitchen_erp_tenant_slug');
      tenantSlug = TenantResolver.resolveTenantSlug({
        path: window.location.pathname,
        host: window.location.host,
        headerSlug: storedSlug || undefined,
      });
    }

    if (tenantSlug) {
      req.headers['X-Tenant-Slug'] = tenantSlug;
    }
    return req;
  });

  // Response interceptor — handle 401 + token refresh
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        const storedRefresh =
          refreshToken ||
          (typeof window !== 'undefined'
            ? localStorage.getItem('kitchen_erp_refresh_token')
            : null);

        if (storedRefresh && storedRefresh !== 'undefined') {
          try {
            const res = await axios.post<ApiResponse<TokenPair>>(`${config.baseURL}/auth/refresh`, {
              refreshToken: storedRefresh,
            });
            if (res.data?.data) {
              setTokens(res.data.data);
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
              }
              return client(originalRequest);
            }
          } catch {
            clearTokens();
            config.onUnauthorized?.();
          }
        } else {
          clearTokens();
          config.onUnauthorized?.();
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

// ── API Modules Class ──────────────────────────────────────────

export class KitchenErpApi {
  private client: AxiosInstance;

  constructor(config: ApiClientConfig) {
    loadTokensFromStorage();
    this.client = createApiClient(config);
  }

  auth = {
    login: (dto: LoginDto) =>
      this.client.post<ApiResponse<LoginResponse>>('/auth/login', dto).then((r) => r.data),

    refresh: (dto: RefreshTokenDto) =>
      this.client.post<ApiResponse<LoginResponse>>('/auth/refresh', dto).then((r) => r.data),

    me: () => this.client.get<ApiResponse<UserPublic>>('/auth/me').then((r) => r.data),

    changePassword: (dto: ChangePasswordDto) =>
      this.client.post<ApiResponse<void>>('/auth/change-password', dto).then((r) => r.data),

    logout: () => this.client.post<ApiResponse<void>>('/auth/logout').then((r) => r.data),
  };

  tenants = {
    list: (params?: PaginationParams) =>
      this.client
        .get<ApiResponse<PaginatedResponse<TenantPublic>>>('/tenants', { params })
        .then((r) => r.data),

    get: (id: string) =>
      this.client.get<ApiResponse<TenantPublic>>(`/tenants/${id}`).then((r) => r.data),

    getDetails: (id: string) =>
      this.client.get<ApiResponse<unknown>>(`/tenants/${id}/details`).then((r) => r.data),

    getBySlug: (slug: string) =>
      this.client.get<ApiResponse<TenantPublic>>(`/tenant/by-slug/${slug}`).then((r) => r.data),

    listPublic: () =>
      this.client.get<ApiResponse<TenantPublic[]>>('/tenant/public-list').then((r) => r.data),

    create: (dto: CreateTenantDto) =>
      this.client.post<ApiResponse<TenantPublic>>('/tenants', dto).then((r) => r.data),

    update: (id: string, dto: UpdateTenantDto) =>
      this.client.patch<ApiResponse<TenantPublic>>(`/tenants/${id}`, dto).then((r) => r.data),

    activate: (id: string) =>
      this.client.patch<ApiResponse<TenantPublic>>(`/tenants/${id}/activate`).then((r) => r.data),

    deactivate: (id: string) =>
      this.client.patch<ApiResponse<TenantPublic>>(`/tenants/${id}/deactivate`).then((r) => r.data),

    delete: (id: string) =>
      this.client.delete<ApiResponse<void>>(`/tenants/${id}`).then((r) => r.data),
  };

  users = {
    list: (params?: PaginationParams) =>
      this.client
        .get<ApiResponse<PaginatedResponse<UserPublic>>>('/users', { params })
        .then((r) => r.data),

    get: (id: string) =>
      this.client.get<ApiResponse<UserPublic>>(`/users/${id}`).then((r) => r.data),

    create: (dto: CreateUserDto) =>
      this.client.post<ApiResponse<UserPublic>>('/users', dto).then((r) => r.data),

    update: (id: string, dto: UpdateUserDto) =>
      this.client.patch<ApiResponse<UserPublic>>(`/users/${id}`, dto).then((r) => r.data),

    delete: (id: string) =>
      this.client.delete<ApiResponse<void>>(`/users/${id}`).then((r) => r.data),
  };

  categories = {
    list: (params?: PaginationParams & { isActive?: boolean }) =>
      this.client
        .get<ApiResponse<PaginatedResponse<CategoryPublic>>>('/categories', { params })
        .then((r) => r.data),

    get: (id: string) =>
      this.client.get<ApiResponse<CategoryPublic>>(`/categories/${id}`).then((r) => r.data),

    create: (dto: CreateCategoryDto) =>
      this.client.post<ApiResponse<CategoryPublic>>('/categories', dto).then((r) => r.data),

    update: (id: string, dto: UpdateCategoryDto) =>
      this.client.patch<ApiResponse<CategoryPublic>>(`/categories/${id}`, dto).then((r) => r.data),

    delete: (id: string) =>
      this.client.delete<ApiResponse<void>>(`/categories/${id}`).then((r) => r.data),
  };

  vendors = {
    list: (params?: PaginationParams & { categoryId?: string; isActive?: boolean }) =>
      this.client
        .get<ApiResponse<PaginatedResponse<VendorPublic>>>('/vendors', { params })
        .then((r) => r.data),

    get: (id: string) =>
      this.client.get<ApiResponse<VendorPublic>>(`/vendors/${id}`).then((r) => r.data),

    create: (dto: CreateVendorDto) =>
      this.client.post<ApiResponse<VendorPublic>>('/vendors', dto).then((r) => r.data),

    update: (id: string, dto: UpdateVendorDto) =>
      this.client.patch<ApiResponse<VendorPublic>>(`/vendors/${id}`, dto).then((r) => r.data),

    delete: (id: string) =>
      this.client.delete<ApiResponse<void>>(`/vendors/${id}`).then((r) => r.data),
  };

  products = {
    list: (params?: PaginationParams & { categoryId?: string; isActive?: boolean }) =>
      this.client
        .get<ApiResponse<PaginatedResponse<ProductPublic>>>('/products', { params })
        .then((r) => r.data),

    get: (id: string) =>
      this.client.get<ApiResponse<ProductPublic>>(`/products/${id}`).then((r) => r.data),

    create: (dto: CreateProductDto) =>
      this.client.post<ApiResponse<ProductPublic>>('/products', dto).then((r) => r.data),

    update: (id: string, dto: UpdateProductDto) =>
      this.client.patch<ApiResponse<ProductPublic>>(`/products/${id}`, dto).then((r) => r.data),

    delete: (id: string) =>
      this.client.delete<ApiResponse<void>>(`/products/${id}`).then((r) => r.data),
  };

  purchases = {
    list: (
      params?: PaginationParams & {
        vendorId?: string;
        startDate?: string;
        endDate?: string;
        status?: string;
      }
    ) =>
      this.client
        .get<ApiResponse<PaginatedResponse<PurchasePublic>>>('/purchases', { params })
        .then((r) => r.data),

    get: (id: string) =>
      this.client.get<ApiResponse<PurchasePublic>>(`/purchases/${id}`).then((r) => r.data),

    create: (dto: CreatePurchaseDto) =>
      this.client.post<ApiResponse<PurchasePublic>>('/purchases', dto).then((r) => r.data),

    update: (id: string, dto: UpdatePurchaseDto) =>
      this.client.patch<ApiResponse<PurchasePublic>>(`/purchases/${id}`, dto).then((r) => r.data),

    delete: (id: string) =>
      this.client.delete<ApiResponse<void>>(`/purchases/${id}`).then((r) => r.data),

    uploadInvoice: (id: string, file: File) => {
      const formData = new FormData();
      formData.append('invoice', file);
      return this.client
        .post<ApiResponse<InvoiceUploadResponse>>(`/purchases/${id}/invoice`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    },

    getInvoice: (id: string) =>
      this.client
        .get<ApiResponse<InvoiceMetadataResponse>>(`/purchases/${id}/invoice`)
        .then((r) => r.data),

    deleteInvoice: (id: string) =>
      this.client.delete<ApiResponse<void>>(`/purchases/${id}/invoice`).then((r) => r.data),
  };

  reports = {
    daily: (filters?: any) =>
      this.client.get<ApiResponse<any>>('/reports/daily', { params: filters }).then((r) => r.data),

    monthly: (filters?: any) =>
      this.client
        .get<ApiResponse<any>>('/reports/monthly', { params: filters })
        .then((r) => r.data),

    byVendor: (filters?: any) =>
      this.client.get<ApiResponse<any>>('/reports/vendor', { params: filters }).then((r) => r.data),

    byCategory: (filters?: any) =>
      this.client
        .get<ApiResponse<any>>('/reports/category', { params: filters })
        .then((r) => r.data),

    byProduct: (filters?: any) =>
      this.client
        .get<ApiResponse<any>>('/reports/product', { params: filters })
        .then((r) => r.data),

    byManager: (filters?: any) =>
      this.client
        .get<ApiResponse<any>>('/reports/manager', { params: filters })
        .then((r) => r.data),

    platform: (filters?: any) =>
      this.client
        .get<ApiResponse<any>>('/reports/platform', { params: filters })
        .then((r) => r.data),
  };

  auditLogs = {
    list: (params?: any) =>
      this.client
        .get<ApiResponse<PaginatedResponse<any>>>('/audit-logs', { params })
        .then((r) => r.data),
  };

  ledger = {
    summary: () =>
      this.client.get<ApiResponse<LedgerSummary>>('/ledger/summary').then((r) => r.data),

    vendors: (params?: LedgerQueryParams) =>
      this.client
        .get<ApiResponse<PaginatedResponse<LedgerAccountPublic>>>('/ledger/vendors', { params })
        .then((r) => r.data),

    getVendorDetail: (vendorId: string) =>
      this.client
        .get<ApiResponse<LedgerAccountPublic>>(`/ledger/vendors/${vendorId}`)
        .then((r) => r.data),

    getVendorTransactions: (vendorId: string, params?: LedgerQueryParams) =>
      this.client
        .get<ApiResponse<PaginatedResponse<LedgerTransactionPublic>>>(
          `/ledger/vendors/${vendorId}/transactions`,
          { params }
        )
        .then((r) => r.data),

    payments: (params?: LedgerQueryParams) =>
      this.client
        .get<ApiResponse<PaginatedResponse<VendorPaymentPublic>>>('/ledger/payments', { params })
        .then((r) => r.data),

    createPayment: (dto: CreatePaymentDto) =>
      this.client
        .post<ApiResponse<{ payment: VendorPaymentPublic; currentBalance: number }>>(
          '/ledger/payments',
          dto
        )
        .then((r) => r.data),

    getPayment: (id: string) =>
      this.client
        .get<ApiResponse<VendorPaymentPublic>>(`/ledger/payments/${id}`)
        .then((r) => r.data),
  };
}

export { type ApiResponse, type PaginatedResponse };
