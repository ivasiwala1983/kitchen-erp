'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import { formatDate, formatCurrency } from '@kitchen-erp/utils';

import { useAuth } from '../../../contexts/AuthContext';

export default function ReportsPage() {
  const { user } = useAuth();
  const [platformData, setPlatformData] = useState<Record<string, unknown> | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterTenantId, setFilterTenantId] = useState('');
  const [filterVendorId, setFilterVendorId] = useState('');

  const [tab, setTab] = useState<'daily' | 'vendor' | 'category' | 'product' | 'manager'>('daily');
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPlatform = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(filterTenantId ? { tenantId: filterTenantId } : {}),
        ...(filterVendorId ? { vendorId: filterVendorId } : {}),
      };
      const res = (await api.reports.platform(filters)) as { data?: Record<string, unknown> };
      if (res?.data) {
        setPlatformData(res.data);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load platform report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterTenantId, filterVendorId]);

  const loadTenantReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = { startDate, endDate };
      let res;
      if (tab === 'daily') res = await api.reports.daily(filters);
      else if (tab === 'vendor') res = await api.reports.byVendor(filters);
      else if (tab === 'category') res = await api.reports.byCategory(filters);
      else if (tab === 'product') res = await api.reports.byProduct(filters);
      else res = await api.reports.byManager(filters);
      const resObj = res as { data?: Record<string, unknown>[] };
      if (resObj?.data) setData(resObj.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      loadPlatform();
    } else {
      loadTenantReport();
    }
  }, [user?.role, loadPlatform, loadTenantReport]);

  const downloadCSV = () => {
    const invoices = (platformData?.invoices as Record<string, unknown>[]) || [];
    if (invoices.length === 0) return;

    const headers = [
      'Invoice ID',
      'Date',
      'Tenant',
      'Vendor',
      'Category',
      'Created By',
      'User Email',
      'Item Count',
      'Grand Total',
      'Currency',
      'Status',
    ];
    const rows = invoices.map((inv) => [
      inv.id,
      formatDate(inv.purchaseDate as string),
      `"${String(inv.tenantName).replace(/"/g, '""')}"`,
      `"${String(inv.vendorName).replace(/"/g, '""')}"`,
      `"${String(inv.categoryName).replace(/"/g, '""')}"`,
      `"${String(inv.userName).replace(/"/g, '""')}"`,
      inv.userEmail,
      inv.itemCount,
      inv.grandTotal,
      inv.currency,
      inv.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `platform_invoices_report_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = [
    { key: 'daily', label: 'Daily' },
    { key: 'vendor', label: 'By Vendor' },
    { key: 'category', label: 'By Category' },
    { key: 'product', label: 'By Product' },
    { key: 'manager', label: 'By Manager' },
  ] as const;

  // ── SUPER ADMIN REPORTING VIEW ─────────────────────────────────────────────
  if (user?.role === 'SUPER_ADMIN') {
    const p = (platformData || {}) as {
      activeTenants?: number;
      totalTenants?: number;
      totalPlatformSpend?: number;
      totalUsers?: number;
      totalVendors?: number;
      tenantsBreakdown?: Array<{
        id: string;
        name: string;
        slug: string;
        plan: string;
        userCount: number;
        vendorCount: number;
        productCount: number;
        purchaseCount: number;
        totalSpend: number;
        currency?: string;
      }>;
      tenantsList?: Array<{ id: string; name: string }>;
      vendorsList?: Array<{ id: string; name: string }>;
      invoices?: Array<{
        id: string;
        purchaseDate: string;
        tenantName: string;
        vendorName: string;
        categoryName?: string;
        itemCount: number;
        userName: string;
        userEmail?: string;
        status: string;
        totalAmount: number;
        grandTotal?: number;
        currency?: string;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };
    const tenants = p.tenantsBreakdown || [];
    const tenantsList = p.tenantsList || [];
    const vendorsList = p.vendorsList || [];
    const invoices = p.invoices || [];

    return (
      <>
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Super Admin Platform Reports</h1>
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              Cross-tenant analytics, vendor breakdown, and invoice downloads
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={downloadCSV}
              disabled={invoices.length === 0}
            >
              📥 Download Invoices CSV ({invoices.length})
            </button>
            <button className="btn btn-primary btn-sm" onClick={loadPlatform}>
              ↻ Apply Filters
            </button>
          </div>
        </div>

        <div className="page-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {/* Super Admin Filters Bar */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: '0.8125rem',
                color: 'var(--color-text-secondary)',
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              🔍 Report Filters & Vendor Selector
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                alignItems: 'center',
              }}
            >
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
                  Date Range Start
                </label>
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
                  Date Range End
                </label>
                <input
                  type="date"
                  className="input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
                  Filter by Tenant
                </label>
                <select
                  className="input"
                  value={filterTenantId}
                  onChange={(e) => setFilterTenantId(e.target.value)}
                >
                  <option value="">All Tenants ({tenantsList.length})</option>
                  {tenantsList.map((t: Record<string, unknown>) => (
                    <option key={t.id as string} value={t.id as string}>
                      {t.name as string} ({t.slug as string})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>
                  Filter Vendor Wise
                </label>
                <select
                  className="input"
                  value={filterVendorId}
                  onChange={(e) => setFilterVendorId(e.target.value)}
                >
                  <option value="">All Vendors ({vendorsList.length})</option>
                  {vendorsList.map((v: Record<string, unknown>) => (
                    <option key={v.id as string} value={v.id as string}>
                      {v.name as string} {v.categoryName ? `(${v.categoryName as string})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Platform Summary Stats Cards */}
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-muted)',
                  marginBottom: '0.25rem',
                }}
              >
                Active Tenants
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800 }}>
                {p.activeTenants || 0} / {p.totalTenants || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Registered Tenant Organizations
              </div>
            </div>

            <div className="stat-card">
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-muted)',
                  marginBottom: '0.25rem',
                }}
              >
                Filtered Invoices Spend
              </div>
              <div
                style={{
                  fontSize: '1.875rem',
                  fontWeight: 800,
                  color: 'var(--color-accent-green)',
                }}
              >
                {formatCurrency(p.totalPlatformSpend || 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                {invoices.length} invoices matching filters
              </div>
            </div>

            <div className="stat-card">
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-muted)',
                  marginBottom: '0.25rem',
                }}
              >
                Platform Users & Vendors
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#3b82f6' }}>
                {p.totalUsers || 0}{' '}
                <span
                  style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--color-text-muted)' }}
                >
                  users
                </span>{' '}
                · {p.totalVendors || 0}{' '}
                <span
                  style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--color-text-muted)' }}
                >
                  vendors
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                Total accounts across platform
              </div>
            </div>
          </div>

          {/* Filtered Invoices Table Section */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Vendor & Tenant Invoices ({invoices.length})
                </h2>
                <p
                  style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}
                >
                  Detailed list of invoices based on date range, tenant, and vendor filters
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={downloadCSV}
                disabled={invoices.length === 0}
              >
                📥 Export CSV
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="empty-state">
                <h3>No invoices match filters</h3>
                <p>Try adjusting date range, tenant, or vendor selector.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Tenant</th>
                      <th>Vendor</th>
                      <th>Category</th>
                      <th>Items</th>
                      <th>Created By</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id as string}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(inv.purchaseDate)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {inv.tenantName}
                        </td>
                        <td>{inv.vendorName}</td>
                        <td>
                          <span className="badge badge-purple">{inv.categoryName}</span>
                        </td>
                        <td>{inv.itemCount} items</td>
                        <td>
                          {inv.userName}
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {inv.userEmail}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge badge-${inv.status === 'CONFIRMED' ? 'green' : 'amber'}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: 'var(--color-accent-green)',
                          }}
                        >
                          {formatCurrency(inv.grandTotal || 0, inv.currency || 'INR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tenants Breakdown Table */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Tenant Usage Breakdown</h2>
                <p
                  style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}
                >
                  Summary per tenant organization
                </p>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="empty-state">
                <h3>No tenant report data</h3>
                <p>No tenant accounts found in the database.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Tenant Name</th>
                      <th>Slug</th>
                      <th>Plan</th>
                      <th>Users</th>
                      <th>Vendors</th>
                      <th>Products</th>
                      <th>Invoices</th>
                      <th style={{ textAlign: 'right' }}>Total Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id as string}>
                        <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {t.name}
                        </td>
                        <td>
                          <code
                            style={{
                              background: 'var(--color-bg-tertiary)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: '0.8125rem',
                            }}
                          >
                            {t.slug}
                          </code>
                        </td>
                        <td>
                          <span className="badge badge-purple">{t.plan}</span>
                        </td>
                        <td>{t.userCount} users</td>
                        <td>{t.vendorCount} vendors</td>
                        <td>{t.productCount} products</td>
                        <td>{t.purchaseCount} invoices</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: 'var(--color-accent-green)',
                          }}
                        >
                          {formatCurrency(t.totalSpend, t.currency || 'INR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  const totalAmount = data.reduce(
    (s: number, d: Record<string, unknown>) => s + (Number(d.totalAmount) || 0),
    0
  );
  const totalPurchases = data.reduce(
    (s: number, d: Record<string, unknown>) => s + (Number(d.totalPurchases) || 0),
    0
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Reports</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Purchase analytics and insights
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="date"
            className="input"
            style={{ width: 'auto' }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            className="input"
            style={{ width: 'auto' }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <button className="btn btn-primary" onClick={loadTenantReport}>
            Load
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary Cards */}
        <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--color-text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              Total Purchases
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>
              {totalPurchases.toLocaleString()}
            </div>
          </div>
          <div className="stat-card">
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--color-text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              Total Amount
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent-green)' }}>
              {formatCurrency(totalAmount)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

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
          ) : data.length === 0 ? (
            <div className="empty-state">
              <h3>No data</h3>
              <p>No purchases found in this date range.</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>
                      {tab === 'daily'
                        ? 'Date'
                        : tab === 'vendor'
                          ? 'Vendor'
                          : tab === 'category'
                            ? 'Category'
                            : tab === 'product'
                              ? 'Product'
                              : 'Manager'}
                    </th>
                    {tab === 'product' && <th>Unit</th>}
                    {tab === 'product' && <th>Total Qty</th>}
                    {tab !== 'product' && <th>Purchases</th>}
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: Record<string, unknown>, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {String(
                          row.date ||
                            row.vendorName ||
                            row.categoryName ||
                            row.productName ||
                            row.userName ||
                            '—'
                        )}
                      </td>
                      {tab === 'product' && <td>{String(row.unit || '')}</td>}
                      {tab === 'product' && <td>{Number(row.totalQty || 0)}</td>}
                      {tab !== 'product' && <td>{Number(row.totalPurchases || 0)}</td>}
                      <td style={{ fontWeight: 700, color: 'var(--color-accent-green)' }}>
                        {formatCurrency(Number(row.totalAmount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
