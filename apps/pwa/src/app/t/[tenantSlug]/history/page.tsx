'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatDate, formatCurrency } from '@kitchen-erp/utils';
import type { Vendor, Category, PurchasePublic } from '@kitchen-erp/types';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

type FilterType = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS' | 'ALL' | 'CUSTOM';

export default function TenantHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = (params?.tenantSlug as string) || '';
  const tenantSlug = rawSlug.toLowerCase().trim();

  const api = useMemo(
    () =>
      new KitchenErpApi({
        baseURL: API_URL,
        tenantSlug,
        onUnauthorized: () => {
          clearTokens();
          router.replace(`/t/${tenantSlug}/login`);
        },
      }),
    [tenantSlug, router]
  );

  const [purchases, setPurchases] = useState<PurchasePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'WITH_INVOICE' | 'NO_INVOICE'>('ALL');

  // Master Data State for Filters
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tenantName, setTenantName] = useState<string>('');
  const [tenantCurrency, setTenantCurrency] = useState<string>('INR');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Load User & Tenant details and Master Data for filters
  useEffect(() => {
    api.auth
      .me()
      .then((res) => {
        if (res.data?.tenant?.currency) {
          setTenantCurrency(res.data.tenant.currency);
        }
        if (res.data?.tenant?.name) {
          setTenantName(res.data.tenant.name);
        }
      })
      .catch(() => null);

    api.vendors
      .list({ limit: 100 })
      .then((res) => setVendors(res.data?.data || []))
      .catch(() => null);

    api.categories
      .list({ limit: 100 })
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => null);
  }, [api]);

  // Custom date picker inputs
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Calculate Date Ranges dynamically based on filterType
  const dateRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (filterType === 'THIS_MONTH') {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (filterType === 'LAST_MONTH') {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (filterType === 'LAST_3_MONTHS') {
      const start = new Date(year, month - 2, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    if (filterType === 'CUSTOM') {
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : undefined;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : undefined;
      return {
        startDate: start ? start.toISOString() : undefined,
        endDate: end ? end.toISOString() : undefined,
      };
    }

    return { startDate: undefined, endDate: undefined };
  }, [filterType, customStartDate, customEndDate]);

  // Fetch Purchases from API
  const fetchPurchases = () => {
    let isMounted = true;
    setLoading(true);
    setError('');

    const invoiceAvailableParam =
      invoiceFilter === 'WITH_INVOICE' ? true : invoiceFilter === 'NO_INVOICE' ? false : undefined;

    api.purchases
      .list({
        page,
        limit: 15,
        search: debouncedSearch || undefined,
        vendorId: selectedVendorId || undefined,
        categoryId: selectedCategoryId || undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        invoiceAvailable: invoiceAvailableParam,
      })
      .then((res) => {
        if (isMounted) {
          const resObj = res as { data?: unknown; total?: number; totalPages?: number };
          const dataObj = res.data as
            { data?: PurchasePublic[]; total?: number; totalPages?: number } | undefined;
          const list = Array.isArray(res.data)
            ? (res.data as PurchasePublic[])
            : dataObj?.data || [];
          const count = resObj.total ?? dataObj?.total ?? list.length;
          const pages = resObj.totalPages ?? dataObj?.totalPages ?? Math.ceil(count / 15);

          setPurchases(list);
          setTotal(count);
          setTotalPages(pages || 1);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.response?.data?.message || 'Unable to load purchase history.');
          setPurchases([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  };

  useEffect(() => {
    return fetchPurchases();
  }, [api, page, debouncedSearch, selectedVendorId, selectedCategoryId, invoiceFilter, dateRange]);

  function getInvoiceUrl(url?: string | null): string | null {
    if (!url) return null;
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('kitchen_erp_access_token') : null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (token && url.includes('/api/purchases/') && !url.includes('token=')) {
        const joiner = url.includes('?') ? '&' : '?';
        return `${url}${joiner}token=${encodeURIComponent(token)}&redirect=true`;
      }
      return url;
    }
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const origin = apiBase.replace(/\/api\/?$/, '');
    const fullUrl = `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
    if (token && !fullUrl.includes('token=')) {
      const joiner = fullUrl.includes('?') ? '&' : '?';
      return `${fullUrl}${joiner}token=${encodeURIComponent(token)}&redirect=true`;
    }
    return fullUrl;
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="app-shell">
      {/* ── Scrollable Mobile Content ─────────────────────────────────── */}
      <div className="pwa-content">
        {/* Header */}
        <div className="mock-header" style={{ alignItems: 'center' }}>
          <div>
            <div className="mock-title">Purchase History</div>
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 800,
                color: 'var(--forest-green)',
                marginTop: 2,
              }}
            >
              {tenantName || tenantSlug.toUpperCase()}
            </div>
          </div>
          <Link
            href={`/t/${tenantSlug}/assistant?source=purchases`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: 999,
              background: 'var(--mint-light)',
              color: 'var(--forest-green)',
              textDecoration: 'none',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span>🤖</span>
            <span>Ask ArgusOne</span>
          </Link>
        </div>

        {/* Purchase Sub-Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 1rem 0.5rem' }}>
          <Link
            href={`/t/${tenantSlug}/purchase`}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '0.5rem',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.8125rem',
              background: '#f1f5f9',
              color: 'var(--text-main)',
              textDecoration: 'none',
            }}
          >
            ➕ New Purchase
          </Link>
          <Link
            href={`/t/${tenantSlug}/purchase/history`}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '0.5rem',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.8125rem',
              background: 'var(--forest-green)',
              color: '#ffffff',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            📋 Purchase History
          </Link>
        </div>

        {/* Search Bar & Filters Card */}
        <div className="pwa-card" style={{ margin: '0.5rem 1rem 0.75rem', padding: '0.875rem' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input
              type="text"
              id="purchase-search-input"
              className="pwa-input"
              placeholder="🔍 Search vendor, invoice #, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                fontSize: '0.8125rem',
                borderRadius: 10,
                border: '1.5px solid var(--border)',
                outline: 'none',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Date Range Filter */}
          <div
            style={{
              fontWeight: 700,
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginBottom: '0.375rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Date Filter
          </div>
          <div
            style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}
          >
            <button
              className={`pwa-btn ${filterType === 'THIS_MONTH' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              onClick={() => {
                setFilterType('THIS_MONTH');
                setPage(1);
              }}
            >
              This Month
            </button>
            <button
              className={`pwa-btn ${filterType === 'LAST_MONTH' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              onClick={() => {
                setFilterType('LAST_MONTH');
                setPage(1);
              }}
            >
              Last Month
            </button>
            <button
              className={`pwa-btn ${filterType === 'LAST_3_MONTHS' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              onClick={() => {
                setFilterType('LAST_3_MONTHS');
                setPage(1);
              }}
            >
              Last 3 Months
            </button>
            <button
              className={`pwa-btn ${filterType === 'ALL' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              onClick={() => {
                setFilterType('ALL');
                setPage(1);
              }}
            >
              All Time
            </button>
            <button
              className={`pwa-btn ${filterType === 'CUSTOM' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              onClick={() => {
                setFilterType('CUSTOM');
                setPage(1);
              }}
            >
              Custom
            </button>
          </div>

          {filterType === 'CUSTOM' && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                alignItems: 'center',
              }}
            >
              <input
                type="date"
                className="pwa-input"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setPage(1);
                }}
                style={{ fontSize: '0.75rem', padding: '0.35rem', flex: 1 }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="pwa-input"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setPage(1);
                }}
                style={{ fontSize: '0.75rem', padding: '0.35rem', flex: 1 }}
              />
            </div>
          )}

          {/* Master Filters Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '0.25rem',
                  textTransform: 'uppercase',
                }}
              >
                Vendor
              </label>
              <select
                id="vendor-filter-select"
                className="pwa-select"
                value={selectedVendorId}
                onChange={(e) => {
                  setSelectedVendorId(e.target.value);
                  setPage(1);
                }}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.5rem',
                  width: '100%',
                  borderRadius: 8,
                }}
              >
                <option value="">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  marginBottom: '0.25rem',
                  textTransform: 'uppercase',
                }}
              >
                Category
              </label>
              <select
                id="category-filter-select"
                className="pwa-select"
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setPage(1);
                }}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.5rem',
                  width: '100%',
                  borderRadius: 8,
                }}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Invoice Filter */}
          <div style={{ marginTop: '0.5rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
              }}
            >
              Invoice Status
            </label>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button
                type="button"
                className={`pwa-btn ${invoiceFilter === 'ALL' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
                style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', flex: 1 }}
                onClick={() => {
                  setInvoiceFilter('ALL');
                  setPage(1);
                }}
              >
                All
              </button>
              <button
                type="button"
                className={`pwa-btn ${invoiceFilter === 'WITH_INVOICE' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
                style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', flex: 1 }}
                onClick={() => {
                  setInvoiceFilter('WITH_INVOICE');
                  setPage(1);
                }}
              >
                📄 With Invoice
              </button>
              <button
                type="button"
                className={`pwa-btn ${invoiceFilter === 'NO_INVOICE' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
                style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem', flex: 1 }}
                onClick={() => {
                  setInvoiceFilter('NO_INVOICE');
                  setPage(1);
                }}
              >
                No Invoice
              </button>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            className="pwa-card"
            style={{
              margin: '0 1rem 1rem',
              padding: '0.875rem',
              background: '#fef2f2',
              borderLeft: '4px solid #ef4444',
              color: '#991b1b',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
              ⚠️ Unable to load purchase history
            </div>
            <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>{error}</div>
            <button
              type="button"
              className="pwa-btn pwa-btn-secondary"
              onClick={() => fetchPurchases()}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
            >
              🔄 Try Again
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '3rem 0',
            }}
          >
            <div
              className="pwa-spinner"
              style={{ width: 32, height: 32, borderColor: 'var(--forest-green)' }}
            />
            <span
              style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}
            >
              Loading purchase records...
            </span>
          </div>
        ) : purchases.length === 0 ? (
          <div className="empty-state" style={{ margin: '1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ fontWeight: 800, fontSize: '1.0625rem', color: 'var(--text-main)' }}>
              No purchases yet
            </div>
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
                marginTop: '0.25rem',
                marginBottom: '1rem',
              }}
            >
              You can create your first purchase from the Purchase screen.
            </div>
            <Link
              href={`/t/${tenantSlug}/purchase`}
              className="pwa-btn pwa-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.875rem',
                padding: '0.5rem 1.25rem',
                textDecoration: 'none',
              }}
            >
              ➕ New Purchase
            </Link>
          </div>
        ) : (
          <div
            style={{
              padding: '0 1rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {purchases.map((p) => {
              const id = String(p.id);
              const vendor = p.vendor;
              const items = p.items || [];
              const grandTotal = Number(p.grandTotal || 0);
              const isExpanded = expandedId === id;
              const purchaseDateStr = p.purchaseDate ? formatDate(String(p.purchaseDate)) : '-';
              const hasInvoice = Boolean(p.invoiceStoragePath || p.invoiceUrl);
              const invoiceName = p.invoiceFileName || (p.invoiceUrl ? 'INV-Attached' : null);

              return (
                <div
                  key={id}
                  className="pwa-card"
                  style={{
                    padding: '1rem',
                    borderLeft: '4px solid var(--forest-green)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '0.9375rem',
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>🏢</span> {vendor?.name || 'Supplier / Vendor'}
                        {vendor?.category?.name && (
                          <span
                            className="pwa-badge pwa-badge-blue"
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                            }}
                          >
                            📁 {vendor.category.name}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          📅 {purchaseDateStr} ·{' '}
                          {p.purchaseType === 'UTILITY_BILL' ||
                          (vendor?.category as { type?: string })?.type === 'UTILITY_BILL' ? (
                            <strong style={{ color: '#b45309' }}>
                              ⚡ Bill: {p.billMonth || 'Utility'}
                            </strong>
                          ) : (
                            `${items.length} item${items.length === 1 ? '' : 's'}`
                          )}
                        </span>
                        {hasInvoice ? (
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              color: 'var(--forest-green)',
                              background: 'rgba(22, 101, 52, 0.1)',
                              padding: '0.1rem 0.4rem',
                              borderRadius: 4,
                            }}
                          >
                            📄 Invoice: {invoiceName || 'Attached'}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              color: 'var(--text-muted)',
                              background: '#f1f5f9',
                              padding: '0.1rem 0.4rem',
                              borderRadius: 4,
                            }}
                          >
                            No Invoice
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '1.0625rem',
                          color: 'var(--forest-green)',
                        }}
                      >
                        {formatCurrency(grandTotal, tenantCurrency)}
                      </div>

                      <div
                        style={{
                          marginTop: '0.375rem',
                          display: 'flex',
                          gap: '0.375rem',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleExpand(id)}
                          style={{
                            background: '#f1f5f9',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          {isExpanded
                            ? '▲ Hide'
                            : p.purchaseType === 'UTILITY_BILL' ||
                                (vendor?.category as { type?: string })?.type === 'UTILITY_BILL'
                              ? '▼ Details'
                              : '▼ Items'}
                        </button>
                        <Link
                          href={`/t/${tenantSlug}/purchase/${id}`}
                          className="pwa-btn pwa-btn-primary"
                          style={{
                            fontSize: '0.6875rem',
                            padding: '0.25rem 0.625rem',
                            textDecoration: 'none',
                            borderRadius: 6,
                            fontWeight: 700,
                          }}
                        >
                          [ View ]
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Inline Expandable Items / Utility Bill Preview */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '0.875rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px dashed #e2e8f0',
                      }}
                    >
                      {p.purchaseType === 'UTILITY_BILL' ||
                      (vendor?.category as { type?: string })?.type === 'UTILITY_BILL' ? (
                        <>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              marginBottom: '0.375rem',
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                            }}
                          >
                            ⚡ Utility Bill Breakdown
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.8125rem',
                              padding: '0.3rem 0',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                Bill Month: {p.billMonth || '—'}
                              </div>
                            </div>
                            <div style={{ fontWeight: 800, color: 'var(--forest-green)' }}>
                              {formatCurrency(p.billAmount || grandTotal, tenantCurrency)}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              marginBottom: '0.375rem',
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                            }}
                          >
                            Line Items Breakdown
                          </div>
                          {items.map((item, idx) => {
                            const product = item.product;
                            const qty = Number(item.qty || 0);
                            const rate = Number(item.rate || 0);
                            const lineTotal = Number(item.total || 0);

                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.8125rem',
                                  padding: '0.3rem 0',
                                  borderBottom:
                                    idx < items.length - 1 ? '1px solid #f1f5f9' : 'none',
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                    {product?.name || 'Item'}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {qty} {product?.unit || 'unit'} ×{' '}
                                    {formatCurrency(rate, tenantCurrency)}
                                  </div>
                                </div>
                                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                  {formatCurrency(lineTotal, tenantCurrency)}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {hasInvoice && getInvoiceUrl(p.invoiceUrl || undefined) && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <a
                            href={getInvoiceUrl(p.invoiceUrl || undefined)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pwa-btn pwa-btn-secondary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              fontSize: '0.75rem',
                              padding: '0.35rem 0.65rem',
                            }}
                          >
                            📄 View Attached Invoice
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: '#ffffff',
                  borderRadius: 12,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <button
                  type="button"
                  className="pwa-btn pwa-btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ fontSize: '0.75rem', opacity: page <= 1 ? 0.5 : 1 }}
                >
                  ◀ Previous
                </button>

                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  className="pwa-btn pwa-btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{ fontSize: '0.75rem', opacity: page >= totalPages ? 0.5 : 1 }}
                >
                  Next ▶
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Navigation Bar ──────────────────────────────── */}
      <nav className="bottom-nav">
        <Link href={`/t/${tenantSlug}/purchase`} className="bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          Buy
        </Link>

        <Link href={`/t/${tenantSlug}/purchase/history`} className="bottom-nav-item active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          History
        </Link>

        <Link href={`/t/${tenantSlug}/ledger`} className="bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          Ledger
        </Link>

        <button
          className="bottom-nav-item"
          onClick={() => {
            clearTokens();
            router.push(`/t/${tenantSlug}/login`);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </nav>
    </div>
  );
}
