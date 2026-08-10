'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatDate, formatCurrency } from '@kitchen-erp/utils';
import type { PurchasePublic, LedgerAccountPublic } from '@kitchen-erp/types';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = (params?.tenantSlug as string) || '';
  const tenantSlug = rawSlug.toLowerCase().trim();
  const purchaseId = (params?.purchaseId as string) || '';

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

  const [purchase, setPurchase] = useState<PurchasePublic | null>(null);
  const [ledgerAccount, setLedgerAccount] = useState<LedgerAccountPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  useEffect(() => {
    if (!purchaseId) return;

    let isMounted = true;
    setLoading(true);
    setError('');

    api.purchases
      .get(purchaseId)
      .then((res) => {
        if (!isMounted) return;
        const data = res.data as PurchasePublic;
        setPurchase(data);

        // Fetch vendor ledger summary if vendor ID exists
        if (data?.vendorId) {
          api.ledger
            .getVendorDetail(data.vendorId)
            .then((ledgerRes) => {
              if (isMounted && ledgerRes.data) {
                setLedgerAccount(ledgerRes.data as LedgerAccountPublic);
              }
            })
            .catch(() => null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.response?.data?.message || 'Unable to load purchase details.');
        setPurchase(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [api, purchaseId]);

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

  return (
    <div className="app-shell">
      {/* ── Scrollable Mobile Content ─────────────────────────────────── */}
      <div className="pwa-content">
        {/* Top Bar with Back Link */}
        <div className="mock-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link
              href={`/t/${tenantSlug}/purchase/history`}
              style={{
                textDecoration: 'none',
                fontSize: '1.25rem',
                color: 'var(--forest-green)',
                fontWeight: 800,
              }}
            >
              ←
            </Link>
            <div>
              <div className="mock-title">Purchase Details</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                #{purchaseId.slice(0, 8)}
              </div>
            </div>
          </div>
          <Link
            href={`/t/${tenantSlug}/purchase/history`}
            className="pwa-btn pwa-btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
          >
            History List
          </Link>
        </div>

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
              Loading purchase details...
            </span>
          </div>
        ) : error || !purchase ? (
          <div
            className="pwa-card"
            style={{
              margin: '1rem',
              padding: '1rem',
              background: '#fef2f2',
              borderLeft: '4px solid #ef4444',
              color: '#991b1b',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
              ⚠️ Purchase Not Found
            </div>
            <div style={{ fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
              {error || 'The requested purchase record could not be found or access was denied.'}
            </div>
            <Link
              href={`/t/${tenantSlug}/purchase/history`}
              className="pwa-btn pwa-btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
            >
              Back to History
            </Link>
          </div>
        ) : (
          <div
            style={{
              padding: '0.75rem 1rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.875rem',
            }}
          >
            {/* Vendor Summary Card */}
            <div className="pwa-card" style={{ padding: '1rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '0.375rem',
                }}
              >
                Supplier / Vendor Info
              </div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '1.125rem',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                🏢 {purchase.vendor?.name || 'Vendor'}
              </div>

              {purchase.vendor?.category?.name && (
                <div style={{ marginTop: '0.375rem' }}>
                  <span
                    className="pwa-badge pwa-badge-blue"
                    style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem' }}
                  >
                    📁 {purchase.vendor.category.name}
                  </span>
                </div>
              )}

              {(purchase.vendor?.phone || purchase.vendor?.address || purchase.vendor?.gst) && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.15rem',
                  }}
                >
                  {purchase.vendor.phone && <div>📞 Phone: {purchase.vendor.phone}</div>}
                  {purchase.vendor.address && <div>📍 Address: {purchase.vendor.address}</div>}
                  {purchase.vendor.gst && <div>📄 GSTIN: {purchase.vendor.gst}</div>}
                </div>
              )}
            </div>

            {/* Purchase Overview Metadata Card */}
            <div className="pwa-card" style={{ padding: '1rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '0.5rem',
                }}
              >
                Purchase Information
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  fontSize: '0.8125rem',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Purchase Date
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    📅 {purchase.purchaseDate ? formatDate(String(purchase.purchaseDate)) : '-'}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Status</div>
                  <div style={{ marginTop: 2 }}>
                    <span
                      style={{
                        background: '#dcfce7',
                        color: '#166534',
                        fontWeight: 800,
                        fontSize: '0.6875rem',
                        padding: '0.15rem 0.45rem',
                        borderRadius: 6,
                      }}
                    >
                      {purchase.status || 'CONFIRMED'}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Created By</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    👤 {purchase.user?.name || 'Inventory Manager'}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Invoice Reference
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    {purchase.invoiceFileName || (purchase.invoiceUrl ? 'Attached' : 'None')}
                  </div>
                </div>
              </div>

              {purchase.notes && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
                    Notes
                  </div>
                  <div style={{ color: 'var(--text-main)', marginTop: 2, fontStyle: 'italic' }}>
                    "{purchase.notes}"
                  </div>
                </div>
              )}
            </div>

            {/* Purchase Line Items Table Card */}
            <div className="pwa-card" style={{ padding: '1rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '0.625rem',
                }}
              >
                Purchase Line Items ({purchase.items?.length || 0})
              </div>

              {purchase.items && purchase.items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {purchase.items.map((item, idx) => {
                    const product = item.product;
                    const qty = Number(item.qty || 0);
                    const rate = Number(item.rate || 0);
                    const lineTotal = Number(item.total || 0);

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '0.5rem 0',
                          borderBottom:
                            idx < (purchase.items?.length || 0) - 1 ? '1px solid #f1f5f9' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '0.875rem',
                              color: 'var(--text-main)',
                            }}
                          >
                            {product?.name || 'Product Item'}
                          </div>
                          {product?.category?.name && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              Category: {product.category.name}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              marginTop: 2,
                            }}
                          >
                            {qty} {product?.unit || 'kg'} × {formatCurrency(rate, tenantCurrency)} /{' '}
                            {product?.unit || 'kg'}
                          </div>
                        </div>

                        <div
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            fontSize: '0.9375rem',
                            color: 'var(--text-main)',
                          }}
                        >
                          {formatCurrency(lineTotal, tenantCurrency)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}
                >
                  No items listed for this purchase.
                </div>
              )}

              {/* Grand Total Footer */}
              <div
                style={{
                  marginTop: '0.875rem',
                  paddingTop: '0.75rem',
                  borderTop: '2px solid var(--forest-green)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                  Purchase Total
                </div>
                <div style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--forest-green)' }}>
                  {formatCurrency(Number(purchase.grandTotal || 0), tenantCurrency)}
                </div>
              </div>
            </div>

            {/* Invoice Card */}
            <div className="pwa-card" style={{ padding: '1rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '0.5rem',
                }}
              >
                Invoice Document
              </div>

              {purchase.invoiceStoragePath || purchase.invoiceUrl ? (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: 'var(--forest-green)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <span>📄</span>
                    <span>{purchase.invoiceFileName || 'Invoice Document Attached'}</span>
                  </div>

                  {purchase.invoiceUploadedAt && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginBottom: '0.75rem',
                      }}
                    >
                      Uploaded: {formatDate(String(purchase.invoiceUploadedAt))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {getInvoiceUrl(purchase.invoiceUrl || undefined) && (
                      <a
                        href={getInvoiceUrl(purchase.invoiceUrl || undefined)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pwa-btn pwa-btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          fontSize: '0.75rem',
                          padding: '0.45rem 0.875rem',
                          textDecoration: 'none',
                        }}
                      >
                        📄 View Invoice
                      </a>
                    )}
                    {getInvoiceUrl(purchase.invoiceUrl || undefined) && (
                      <a
                        href={getInvoiceUrl(purchase.invoiceUrl || undefined)!}
                        download={purchase.invoiceFileName || 'invoice.pdf'}
                        className="pwa-btn pwa-btn-secondary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          fontSize: '0.75rem',
                          padding: '0.45rem 0.875rem',
                          textDecoration: 'none',
                        }}
                      >
                        ⬇ Download Invoice
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}
                >
                  No invoice attached to this purchase.
                </div>
              )}
            </div>

            {/* Vendor Financial / Ledger Summary Section */}
            {ledgerAccount && (
              <div className="pwa-card" style={{ padding: '1rem' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '0.5rem',
                  }}
                >
                  Vendor Financial Status (Ledger)
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      Current Vendor Account Balance
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {ledgerAccount.isVendorCredit
                        ? 'Vendor has advance payment / credit'
                        : ledgerAccount.currentBalance > 0
                          ? 'Total outstanding balance owed to vendor'
                          : 'All vendor dues fully settled'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: '1.0625rem',
                        color: ledgerAccount.isVendorCredit
                          ? '#2563eb'
                          : ledgerAccount.currentBalance > 0
                            ? '#dc2626'
                            : 'var(--forest-green)',
                      }}
                    >
                      {ledgerAccount.isVendorCredit
                        ? `${formatCurrency(ledgerAccount.absBalance, tenantCurrency)} (Credit)`
                        : ledgerAccount.currentBalance > 0
                          ? `${formatCurrency(ledgerAccount.currentBalance, tenantCurrency)} (Due)`
                          : formatCurrency(0, tenantCurrency)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px dashed #e2e8f0',
                  }}
                >
                  <Link
                    href={`/t/${tenantSlug}/ledger/${purchase.vendorId}`}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--forest-green)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    View Vendor Ledger Details →
                  </Link>
                </div>
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
