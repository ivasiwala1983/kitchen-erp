'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatDate, formatCurrency } from '@kitchen-erp/utils';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

const api = new KitchenErpApi({
  baseURL: API_URL,
  onUnauthorized: () => {
    clearTokens();
    window.location.href = '/';
  },
});

type FilterType = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS' | 'ALL' | 'CUSTOM';

export default function HistoryPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Smart Date Selector Filter State (Default: THIS_MONTH)
  const [filterType, setFilterType] = useState<FilterType>('THIS_MONTH');

  // Custom date picker inputs
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const LIMIT = 20;

  // Calculate Date Ranges dynamically based on filterType
  const dateParams = useMemo(() => {
    const now = new Date();
    if (filterType === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    if (filterType === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    if (filterType === 'LAST_3_MONTHS') {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: start.toISOString(), endDate: end.toISOString() };
    }
    if (filterType === 'CUSTOM') {
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00.000Z`) : undefined;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999Z`) : undefined;
      return {
        startDate: start ? start.toISOString() : undefined,
        endDate: end ? end.toISOString() : undefined,
      };
    }
    return { startDate: undefined, endDate: undefined };
  }, [filterType, customStartDate, customEndDate]);

  // Tenant Currency State
  const [tenantCurrency, setTenantCurrency] = useState<string>('INR');

  useEffect(() => {
    api.auth
      .me()
      .then((res) => {
        const resObj = res as { data?: { tenant?: { currency?: string } } };
        if (resObj?.data?.tenant?.currency) {
          setTenantCurrency(resObj.data.tenant.currency);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Purchases from API whenever filter or page changes
  useEffect(() => {
    setLoading(true);
    const queryParams: Record<string, unknown> = {
      page,
      limit: LIMIT,
      ...(dateParams.startDate ? { startDate: dateParams.startDate } : {}),
      ...(dateParams.endDate ? { endDate: dateParams.endDate } : {}),
    };

    api.purchases
      .list(queryParams)
      .then((res) => {
        const resObj = res as { data?: unknown[]; total?: number };
        const items = Array.isArray(resObj.data) ? (resObj.data as Record<string, unknown>[]) : [];
        const count = typeof resObj.total === 'number' ? resObj.total : items.length;
        setPurchases(items);
        setTotal(count);
      })
      .catch(() => {
        setPurchases([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, dateParams]);

  // Ensure purchases are always sorted in Descending Order (latest / newest invoice first)
  const sortedPurchases = useMemo(() => {
    const list = Array.isArray(purchases) ? [...purchases] : [];
    return list.sort((a, b) => {
      const dateA = new Date((a.purchaseDate as string) || (a.createdAt as string)).getTime();
      const dateB = new Date((b.purchaseDate as string) || (b.createdAt as string)).getTime();
      return dateB - dateA; // Latest first
    });
  }, [purchases]);

  // Total spending sum for current view
  const currentTotalAmount = useMemo(() => {
    return sortedPurchases.reduce((sum, item) => sum + (Number(item.grandTotal) || 0), 0);
  }, [sortedPurchases]);

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

  const handleFilterChange = (type: FilterType) => {
    setFilterType(type);
    setPage(1);
  };

  return (
    <div className="app-shell">
      {/* 1. Top Header Bar */}
      <header className="pwa-header">
        <button
          className="pwa-header-back"
          onClick={() => router.back()}
          title="Back"
          aria-label="Back"
        >
          <svg
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
        <span className="pwa-header-title">Purchase History</span>
        <div style={{ width: 36 }} />
      </header>

      {/* 2. Scrollable Content */}
      <div className="pwa-content">
        {/* Smart Date Filter Header & Options */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
            padding: '0 0.125rem',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            FILTER PERIOD:
          </span>

          <select
            style={{
              background: '#ffffff',
              border: '1.5px solid var(--border)',
              borderRadius: 10,
              padding: '0.375rem 0.625rem',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--forest-green)',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
            value={filterType}
            onChange={(e) => handleFilterChange(e.target.value as FilterType)}
          >
            <option value="THIS_MONTH">📅 This Month</option>
            <option value="LAST_MONTH">📅 Last Month</option>
            <option value="LAST_3_MONTHS">📅 Last 3 Months</option>
            <option value="ALL">📅 All Time</option>
            <option value="CUSTOM">⚙️ Custom Range</option>
          </select>
        </div>

        {/* Visible Wrapping Filter Chips */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.875rem',
          }}
        >
          <button
            type="button"
            className={`chip-btn ${filterType === 'THIS_MONTH' ? 'active' : 'inactive'}`}
            onClick={() => handleFilterChange('THIS_MONTH')}
            style={{ flex: '1 1 calc(50% - 0.25rem)', textAlign: 'center', minWidth: '130px' }}
          >
            📅 This Month
          </button>
          <button
            type="button"
            className={`chip-btn ${filterType === 'LAST_MONTH' ? 'active' : 'inactive'}`}
            onClick={() => handleFilterChange('LAST_MONTH')}
            style={{ flex: '1 1 calc(50% - 0.25rem)', textAlign: 'center', minWidth: '130px' }}
          >
            📅 Last Month
          </button>
          <button
            type="button"
            className={`chip-btn ${filterType === 'LAST_3_MONTHS' ? 'active' : 'inactive'}`}
            onClick={() => handleFilterChange('LAST_3_MONTHS')}
            style={{ flex: '1 1 calc(50% - 0.25rem)', textAlign: 'center', minWidth: '130px' }}
          >
            📅 Last 3 Months
          </button>
          <button
            type="button"
            className={`chip-btn ${filterType === 'ALL' ? 'active' : 'inactive'}`}
            onClick={() => handleFilterChange('ALL')}
            style={{ flex: '1 1 calc(25% - 0.25rem)', textAlign: 'center', minWidth: '90px' }}
          >
            📅 All Time
          </button>
          <button
            type="button"
            className={`chip-btn ${filterType === 'CUSTOM' ? 'active' : 'inactive'}`}
            onClick={() => handleFilterChange('CUSTOM')}
            style={{ flex: '1 1 calc(25% - 0.25rem)', textAlign: 'center', minWidth: '90px' }}
          >
            ⚙️ Custom Range
          </button>
        </div>

        {/* Custom Date Inputs if CUSTOM selected */}
        {filterType === 'CUSTOM' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.625rem',
              background: '#ffffff',
              padding: '0.75rem',
              borderRadius: 12,
              border: '1px solid var(--border)',
              marginBottom: '0.875rem',
            }}
          >
            <div>
              <label
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: 2,
                }}
              >
                From Date
              </label>
              <input
                type="date"
                className="pwa-input"
                style={{ padding: '0.4rem 0.5rem', fontSize: '0.8125rem' }}
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  display: 'block',
                  marginBottom: 2,
                }}
              >
                To Date
              </label>
              <input
                type="date"
                className="pwa-input"
                style={{ padding: '0.4rem 0.5rem', fontSize: '0.8125rem' }}
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        )}

        {/* Period & Total Spending Summary Header */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 14,
            padding: '0.75rem 1rem',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border)',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              PERIOD TOTAL ({total} INVOICES)
            </div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                color: 'var(--forest-green)',
                marginTop: 2,
              }}
            >
              {formatCurrency(currentTotalAmount, tenantCurrency)}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className="pill-status-green" style={{ fontSize: '0.6875rem' }}>
              ⬇ Latest First
            </span>
          </div>
        </div>

        {/* List of Purchase Invoices */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <span className="pwa-spinner" style={{ borderTopColor: 'var(--forest-green)' }} />
          </div>
        ) : sortedPurchases.length === 0 ? (
          <div className="pwa-empty">
            <div className="pwa-empty-icon">📋</div>
            <h3>No purchases found</h3>
            <p>No purchase records found for the selected date range.</p>
          </div>
        ) : (
          <>
            {sortedPurchases.map((pRecord) => {
              const p = pRecord as Record<string, unknown>;
              const pId = p.id as string;
              const isExpanded = expandedId === pId;
              const itemsArray = p.items as Record<string, unknown>[] | undefined;
              const itemCount = itemsArray?.length || 0;
              const invoiceLink = getInvoiceUrl(p.invoiceUrl as string);
              const vendorObj = p.vendor as
                { name?: string; category?: { name?: string } } | undefined;
              const statusStr = p.status as string;
              const purchaseDateStr = p.purchaseDate as string;
              const grandTotalVal = p.grandTotal as number;

              return (
                <div
                  key={pId}
                  className="pwa-card"
                  style={{ padding: '1rem', marginBottom: '0.875rem' }}
                >
                  {/* Top Row: Vendor & Status */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>🏢</span> {vendorObj?.name || 'Unknown Vendor'}
                        {vendorObj?.category?.name && (
                          <span
                            className="pwa-badge pwa-badge-blue"
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                            }}
                          >
                            📁 {vendorObj.category.name}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          marginTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span>📅 {formatDate(purchaseDateStr)}</span>
                        {invoiceLink && (
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
                      <span
                        className={`pwa-badge pwa-badge-${statusStr === 'CONFIRMED' ? 'green' : 'amber'}`}
                      >
                        {statusStr}
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Amount & Actions */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--bg-page)',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 12,
                      margin: '0.625rem 0 0.5rem 0',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          display: 'block',
                        }}
                      >
                        GRAND TOTAL
                      </span>
                      <span
                        style={{
                          fontSize: '1.125rem',
                          fontWeight: 900,
                          color: 'var(--forest-green)',
                        }}
                      >
                        {formatCurrency(grandTotalVal, tenantCurrency)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {invoiceLink && (
                        <a
                          href={invoiceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pwa-btn pwa-btn-secondary pwa-btn-sm"
                          style={{
                            textDecoration: 'none',
                            background: '#ffffff',
                            color: 'var(--forest-green)',
                            fontWeight: 700,
                          }}
                        >
                          📎 Invoice
                        </a>
                      )}

                      {itemCount > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(pId)}
                          className="pwa-btn pwa-btn-secondary pwa-btn-sm"
                          style={{
                            background: '#ffffff',
                            color: 'var(--text-main)',
                            fontWeight: 700,
                          }}
                        >
                          {isExpanded ? 'Hide' : `${itemCount} item${itemCount > 1 ? 's' : ''}`}{' '}
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Items Breakdown */}
                  {isExpanded && itemsArray && itemsArray.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px dashed var(--border)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          color: 'var(--text-muted)',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        Purchase Items Breakdown
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {((p.items as Record<string, unknown>[]) || []).map((item, idx: number) => {
                          const prodObj = item.product as
                            { name?: string; unit?: string } | undefined;
                          const qty = item.qty as number;
                          const rate = item.rate as number;
                          const totalVal = (item.total as number) || qty * rate;
                          return (
                            <div
                              key={(item.id as string) || idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.8125rem',
                                padding: '0.375rem 0.625rem',
                                background: '#ffffff',
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                  {prodObj?.name || (item.name as string) || `Item #${idx + 1}`}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    marginLeft: '0.375rem',
                                  }}
                                >
                                  ({qty} {prodObj?.unit || (item.unit as string) || 'units'} @{' '}
                                  {formatCurrency(rate, tenantCurrency)})
                                </span>
                              </div>
                              <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                                {formatCurrency(totalVal, tenantCurrency)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination Controls */}
            {total > LIMIT && (
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '1rem 0',
                }}
              >
                <button
                  className="pwa-btn pwa-btn-secondary pwa-btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  style={{ opacity: page === 1 ? 0.5 : 1, width: 80 }}
                >
                  ← Prev
                </button>
                <span
                  style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}
                >
                  Page {page} / {Math.ceil(total / LIMIT)}
                </span>
                <button
                  className="pwa-btn pwa-btn-secondary pwa-btn-sm"
                  disabled={page >= Math.ceil(total / LIMIT)}
                  onClick={() => setPage((p) => p + 1)}
                  style={{ opacity: page >= Math.ceil(total / LIMIT) ? 0.5 : 1, width: 80 }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Bottom Nav Bar */}
      <nav className="bottom-nav">
        <Link href="/purchase" className="bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          Buy
        </Link>
        <Link href="/purchase/history" className="bottom-nav-item active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          History
        </Link>

        <Link href="/ledger" className="bottom-nav-item">
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
            window.location.href = '/';
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
