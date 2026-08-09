'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatDate, formatCurrency } from '@kitchen-erp/utils';

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

  const [purchases, setPurchases] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Smart Date Selector Filter State (Default: ALL)
  const [filterType, setFilterType] = useState<FilterType>('ALL');

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

    // ALL
    return { startDate: undefined, endDate: undefined };
  }, [filterType, customStartDate, customEndDate]);

  // Tenant Currency State
  const [tenantCurrency, setTenantCurrency] = useState<string>('INR');

  useEffect(() => {
    api.auth
      .me()
      .then((res) => {
        if (res.data?.tenant?.currency) {
          setTenantCurrency(res.data.tenant.currency);
        }
      })
      .catch(() => null);
  }, [api]);

  // Fetch Purchases from API
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.purchases
      .list({
        page,
        limit: 20,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })
      .then((res) => {
        if (isMounted) {
          const resObj = res as { data?: unknown; total?: number };
          const dataObj = res.data as { data?: unknown[]; total?: number } | undefined;
          const list = Array.isArray(res.data) ? res.data : dataObj?.data || [];
          const count = resObj.total ?? dataObj?.total ?? list.length;
          setPurchases(list as unknown as Record<string, unknown>[]);
          setTotal(count);
        }
      })
      .catch(() => {
        if (isMounted) setPurchases([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [api, page, dateRange]);

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
        <div className="mock-header">
          <div className="mock-title">Purchase History</div>
          <div className="mock-date">{total} total orders</div>
        </div>

        {/* ── Date Filter Bar ────────────────────────────────────────── */}
        <div className="pwa-card" style={{ margin: '0.75rem 1rem', padding: '0.75rem' }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            FILTER BY DATE RANGE
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            <button
              className={`pwa-btn ${filterType === 'THIS_MONTH' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => {
                setFilterType('THIS_MONTH');
                setPage(1);
              }}
            >
              This Month
            </button>
            <button
              className={`pwa-btn ${filterType === 'LAST_MONTH' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => {
                setFilterType('LAST_MONTH');
                setPage(1);
              }}
            >
              Last Month
            </button>
            <button
              className={`pwa-btn ${filterType === 'LAST_3_MONTHS' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => {
                setFilterType('LAST_3_MONTHS');
                setPage(1);
              }}
            >
              Last 3 Months
            </button>
            <button
              className={`pwa-btn ${filterType === 'ALL' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              onClick={() => {
                setFilterType('ALL');
                setPage(1);
              }}
            >
              All Time
            </button>
            <button
              className={`pwa-btn ${filterType === 'CUSTOM' ? 'pwa-btn-primary' : 'pwa-btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
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
              style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center' }}
            >
              <input
                type="date"
                className="pwa-input"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ fontSize: '0.75rem', padding: '0.35rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="pwa-input"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ fontSize: '0.75rem', padding: '0.35rem' }}
              />
            </div>
          )}
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <div
              className="pwa-spinner"
              style={{ width: 32, height: 32, borderColor: 'var(--forest-green)' }}
            />
          </div>
        ) : purchases.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ fontWeight: 700 }}>No purchase records found</div>
            <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              Try selecting a different date range
            </div>
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
              const vendor = p.vendor as
                { name?: string; category?: { name?: string } } | undefined;
              const items = (p.items as Array<Record<string, unknown>>) || [];
              const grandTotal = Number(p.grandTotal || 0);
              const isExpanded = expandedId === id;
              const purchaseDateStr = p.purchaseDate ? formatDate(String(p.purchaseDate)) : '-';

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
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleExpand(id)}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '1rem',
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
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
                              padding: '0.15rem 0.5rem',
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
                        }}
                      >
                        <span>
                          📅 {purchaseDateStr} · {items.length} item{items.length === 1 ? '' : 's'}
                        </span>
                        {Boolean(p.invoiceUrl) && (
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
                            📄 Invoice Attached
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
                          fontSize: '0.75rem',
                          color: 'var(--forest-green)',
                          fontWeight: 700,
                          marginTop: 2,
                        }}
                      >
                        {isExpanded ? '▲ Hide Details' : '▼ View Items'}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '0.875rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px dashed #e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          marginBottom: '0.5rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        LINE ITEMS
                      </div>
                      {items.map((item, idx) => {
                        const product = item.product as
                          { name?: string; unit?: string } | undefined;
                        const qty = Number(item.qty || 0);
                        const rate = Number(item.rate || 0);
                        const total = Number(item.total || 0);

                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.8125rem',
                              padding: '0.35rem 0',
                              borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none',
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
                              {formatCurrency(total, tenantCurrency)}
                            </div>
                          </div>
                        );
                      })}

                      {p.invoiceUrl && getInvoiceUrl(p.invoiceUrl as string) ? (
                        <div style={{ marginTop: '0.75rem' }}>
                          <a
                            href={getInvoiceUrl(p.invoiceUrl as string)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pwa-btn pwa-btn-secondary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              fontSize: '0.75rem',
                              padding: '0.4rem 0.75rem',
                            }}
                          >
                            📄 View Attached Invoice
                          </a>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
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

        <Link href={`/t/${tenantSlug}/history`} className="bottom-nav-item active">
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
