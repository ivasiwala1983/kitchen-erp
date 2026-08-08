'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import type { Purchase } from '@kitchen-erp/types';
import { formatCurrency, formatDate } from '@kitchen-erp/utils';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.purchases.list({ page, limit: LIMIT })) as {
        data?: unknown;
        total?: number;
      };
      const resObj = res as { data?: unknown[]; total?: number };
      const items = Array.isArray(res.data) ? res.data : resObj.data || [];
      const count = typeof res.total === 'number' ? res.total : resObj.total || items.length;
      setPurchases(items as Purchase[]);
      setTotal(count);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  function getInvoiceUrl(url?: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const origin = apiBase.replace(/\/api\/?$/, '');
    return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  const safePurchases = purchases || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Purchases</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            View purchase orders, items breakdown, and invoices
          </p>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          ) : safePurchases.length === 0 ? (
            <div className="empty-state">
              <h3>No purchases yet</h3>
              <p>Purchases created via the PWA will appear here.</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Items</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {safePurchases.map((pRecord) => {
                    const p = pRecord as unknown as Record<string, unknown>;
                    const vendorObj = p.vendor as
                      { name?: string; category?: { name?: string } } | undefined;
                    const userObj = p.user as { name?: string } | undefined;
                    const itemsList = p.items as unknown[] | undefined;
                    const statusStr = p.status as string;
                    return (
                      <tr
                        key={p.id as string}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelected(p as unknown as Purchase)}
                      >
                        <td>{formatDate(p.purchaseDate as string)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {vendorObj?.name || '—'}
                        </td>
                        <td>
                          <span className="badge badge-purple">
                            {vendorObj?.category?.name || '—'}
                          </span>
                        </td>
                        <td>{itemsList?.length || 0} items</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-accent-green)' }}>
                          {formatCurrency(p.grandTotal as number)}
                        </td>
                        <td>
                          <span
                            className={`badge badge-${statusStr === 'CONFIRMED' ? 'green' : statusStr === 'DRAFT' ? 'amber' : 'red'}`}
                          >
                            {statusStr}
                          </span>
                        </td>
                        <td>{userObj?.name || '—'}</td>
                        <td>
                          <div
                            style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}
                          >
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(p as unknown as Purchase);
                              }}
                            >
                              View Order
                            </button>
                            {getInvoiceUrl(p.invoiceUrl as string) && (
                              <a
                                href={getInvoiceUrl(p.invoiceUrl as string)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-secondary"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Invoice
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {total > LIMIT && (
            <div className="pagination" style={{ padding: '1rem' }}>
              <span>
                {total} total · Page {page} of {Math.ceil(total / LIMIT)}
              </span>
              <button
                className="page-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ←
              </button>
              <button
                className="page-btn"
                disabled={page >= Math.ceil(total / LIMIT)}
                onClick={() => setPage((p) => p + 1)}
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PURCHASE ORDER DETAIL MODAL ─────────────────────────────────────── */}
      {selected && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="modal" style={{ maxWidth: 720 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Purchase Order Details</h2>
                  <span
                    className={`badge badge-${(selected as unknown as Record<string, unknown>).status === 'CONFIRMED' ? 'green' : 'amber'}`}
                  >
                    {String((selected as unknown as Record<string, unknown>).status)}
                  </span>
                </div>
                <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
                  ID: <code style={{ fontSize: '0.75rem' }}>{selected.id}</code>
                </p>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>

            {/* Info Cards */}
            <div className="grid-2" style={{ marginBottom: '1.25rem', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.875rem',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    marginBottom: '0.25rem',
                  }}
                >
                  Vendor Details
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {
                    ((selected as unknown as Record<string, unknown>).vendor as { name?: string })
                      ?.name
                  }
                </div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-muted)',
                    marginTop: '0.25rem',
                  }}
                >
                  Category:{' '}
                  {(
                    (selected as unknown as Record<string, unknown>).vendor as {
                      category?: { name?: string };
                    }
                  )?.category?.name || '—'}
                  {((selected as unknown as Record<string, unknown>).vendor as { phone?: string })
                    ?.phone &&
                    ` · Phone: ${((selected as unknown as Record<string, unknown>).vendor as { phone?: string })?.phone}`}
                </div>
              </div>

              <div
                style={{
                  padding: '0.875rem',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    marginBottom: '0.25rem',
                  }}
                >
                  Order Meta
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Date:{' '}
                  {formatDate(
                    (selected as unknown as Record<string, unknown>).purchaseDate as string
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-muted)',
                    marginTop: '0.25rem',
                  }}
                >
                  Entered By:{' '}
                  {((selected as unknown as Record<string, unknown>).user as { name?: string })
                    ?.name || 'Manager'}{' '}
                  (
                  {((selected as unknown as Record<string, unknown>).user as { role?: string })
                    ?.role || 'INVENTORY_MANAGER'}
                  )
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Items Breakdown
            </div>
            <div className="table-container" style={{ marginBottom: '1.25rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    ((selected as unknown as Record<string, unknown>).items as Record<
                      string,
                      unknown
                    >[]) || []
                  ).map((item, idx: number) => {
                    const prodObj = item.product as { name?: string; unit?: string } | undefined;
                    return (
                      <tr key={(item.id as string) || idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {prodObj?.name}
                        </td>
                        <td>
                          <span className="badge badge-purple">{prodObj?.unit || 'kg'}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{item.qty as number}</td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(item.rate as number)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: 'var(--color-accent-green)',
                          }}
                        >
                          {formatCurrency(item.total as number)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Grand Total Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  TOTAL ORDER VALUE
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {
                    (((selected as unknown as Record<string, unknown>).items as unknown[]) || [])
                      .length
                  }{' '}
                  items
                </div>
              </div>
              <span
                style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-accent-green)' }}
              >
                {formatCurrency(
                  (selected as unknown as Record<string, unknown>).grandTotal as number
                )}
              </span>
            </div>

            {/* Notes */}
            {Boolean((selected as unknown as Record<string, unknown>).notes) && (
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '0.875rem',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Remarks / Notes:
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                  {String((selected as unknown as Record<string, unknown>).notes)}
                </span>
              </div>
            )}

            {/* Action Bar */}
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              {getInvoiceUrl(
                (selected as unknown as Record<string, unknown>).invoiceUrl as string
              ) && (
                <a
                  href={getInvoiceUrl(
                    (selected as unknown as Record<string, unknown>).invoiceUrl as string
                  )!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  📎 Open Invoice File
                </a>
              )}
              <button className="btn btn-secondary" onClick={() => window.print()}>
                🖨️ Print Order
              </button>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
