'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import type { LedgerAccountPublic, LedgerSummary, CategoryPublic } from '@kitchen-erp/types';
import { formatCurrency, formatDate } from '@kitchen-erp/utils';

export default function AdminLedgerDashboardPage() {
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [vendors, setVendors] = useState<LedgerAccountPublic[]>([]);
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const LIMIT = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [sumRes, catRes, vendRes] = await Promise.all([
        api.ledger.summary(),
        api.categories.list({ limit: 100 }),
        api.ledger.vendors({
          page,
          limit: LIMIT,
          search: search || undefined,
          categoryId: selectedCategory || undefined,
        }),
      ]);

      if (sumRes.data) setSummary(sumRes.data);
      const catPayload = catRes as unknown as { data?: CategoryPublic[] };
      const catItems: CategoryPublic[] = Array.isArray(catRes?.data)
        ? catRes.data
        : catPayload?.data || [];
      setCategories(catItems);

      const vendPayload = vendRes as unknown as { data?: LedgerAccountPublic[]; total?: number };
      const vendItems: LedgerAccountPublic[] = Array.isArray(vendRes?.data)
        ? vendRes.data
        : vendPayload?.data || [];
      const count = typeof vendPayload?.total === 'number' ? vendPayload.total : vendItems.length;
      setVendors(vendItems);
      setTotal(count);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Vendor Ledger</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Manage vendor financial accounts, payables, credits, and transaction statements
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Overview Stat Cards */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
            <div
              className="text-muted"
              style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}
            >
              Total Outstanding Payable
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
              {formatCurrency(summary.totalPayable, 'INR')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Amount owed to suppliers
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
            <div
              className="text-muted"
              style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}
            >
              Total Vendor Credit / Advance
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
              {formatCurrency(summary.totalCredit, 'INR')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Prepaid / advance payments
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #6366f1' }}>
            <div
              className="text-muted"
              style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}
            >
              Active Vendors
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                marginTop: 4,
              }}
            >
              {summary.vendorCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Total registered vendors
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
            <div
              className="text-muted"
              style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}
            >
              Net Platform Payable
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: summary.netBalance >= 0 ? '#dc2626' : '#059669',
                marginTop: 4,
              }}
            >
              {formatCurrency(summary.netBalance, 'INR')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Payables minus advances
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search vendor name, phone, GST..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 300 }}
          />

          {categories.length > 0 && (
            <select
              className="form-control"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              style={{ maxWidth: 220 }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Vendors Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Category</th>
                <th>Opening Balance</th>
                <th>Current Balance</th>
                <th>Status</th>
                <th>Last Activity</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: 'center',
                      padding: '2.5rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    No vendor ledger records found.
                  </td>
                </tr>
              ) : (
                vendors.map((acc) => {
                  const vendorName = acc.vendor?.name || 'Unknown';
                  const categoryName = acc.vendor?.category?.name || '—';
                  const balance = acc.currentBalance;
                  const isCredit = acc.isVendorCredit;

                  return (
                    <tr key={acc.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div>{vendorName}</div>
                        {acc.vendor?.phone && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            📞 {acc.vendor.phone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-gray">{categoryName}</span>
                      </td>
                      <td>{formatCurrency(acc.openingBalance, 'INR')}</td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: isCredit ? '#059669' : balance > 0 ? '#dc2626' : 'inherit',
                        }}
                      >
                        {isCredit
                          ? `- ${formatCurrency(acc.absBalance, 'INR')}`
                          : formatCurrency(balance, 'INR')}
                      </td>
                      <td>
                        <span
                          className={`badge ${isCredit ? 'badge-green' : balance > 0 ? 'badge-red' : 'badge-gray'}`}
                        >
                          {isCredit
                            ? 'Credit / Advance'
                            : balance > 0
                              ? 'Outstanding Payable'
                              : 'Settled'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {acc.lastTransactionDate ? formatDate(acc.lastTransactionDate) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/dashboard/ledger/${acc.vendorId}`}>
                          <button className="btn btn-sm btn-secondary">📜 View Statement</button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div
            style={{
              padding: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Showing {vendors.length} of {total} vendors
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-sm btn-secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn-sm btn-secondary"
                disabled={page >= Math.ceil(total / LIMIT)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
