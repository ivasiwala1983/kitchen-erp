'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '@kitchen-erp/utils';

interface Stats {
  totalPurchases: number;
  totalAmount: number;
  totalVendors: number;
  totalProducts: number;
  totalUsers: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<Record<string, unknown>[]>([]);
  const [platformData, setPlatformData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      loadPlatformDashboard();
    } else {
      loadDashboard();
    }
  }, [user?.role]);

  async function loadPlatformDashboard() {
    try {
      const res = (await api.reports.platform()) as { data?: Record<string, unknown> };
      if (res?.data) {
        setPlatformData(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard() {
    try {
      const [purchasesRes, vendorsRes, productsRes, usersRes] = await Promise.allSettled([
        api.purchases.list({ limit: 5 }),
        api.vendors.list({ limit: 1 }),
        api.products.list({ limit: 1 }),
        api.users.list({ limit: 1 }),
      ]);

      const pData = (purchasesRes.status === 'fulfilled' ? purchasesRes.value : null) as {
        data?: unknown;
        total?: number;
      } | null;
      const vData = (vendorsRes.status === 'fulfilled' ? vendorsRes.value : null) as {
        data?: unknown;
        total?: number;
      } | null;
      const prData = (productsRes.status === 'fulfilled' ? productsRes.value : null) as {
        data?: unknown;
        total?: number;
      } | null;
      const uData = ((uRes) => (uRes.status === 'fulfilled' ? uRes.value : null))(usersRes) as {
        data?: unknown;
        total?: number;
      } | null;

      const pItems = Array.isArray(pData?.data)
        ? (pData.data as Record<string, unknown>[])
        : (pData as { data?: { data?: Record<string, unknown>[] } })?.data?.data || [];
      const pTotal =
        typeof pData?.total === 'number'
          ? pData.total
          : (pData as { data?: { total?: number } })?.data?.total || pItems.length;

      const vTotal =
        typeof vData?.total === 'number'
          ? vData.total
          : (vData as { data?: { total?: number } })?.data?.total || 0;
      const prTotal =
        typeof prData?.total === 'number'
          ? prData.total
          : (prData as { data?: { total?: number } })?.data?.total || 0;
      const uTotal =
        typeof uData?.total === 'number'
          ? uData.total
          : (uData as { data?: { total?: number } })?.data?.total || 0;

      setRecentPurchases(pItems);
      const totalAmount = pItems.reduce(
        (sum: number, p: Record<string, unknown>) =>
          sum + parseFloat((p.grandTotal as string) || '0'),
        0
      );
      setStats({
        totalPurchases: pTotal,
        totalAmount,
        totalVendors: vTotal,
        totalProducts: prTotal,
        totalUsers: uTotal,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  // ── SUPER ADMIN DASHBOARD VIEW ─────────────────────────────────────────────
  if (user?.role === 'SUPER_ADMIN') {
    const p = (platformData || {}) as {
      activeTenants?: number;
      totalTenants?: number;
      totalPlatformSpend?: number;
      totalPurchases?: number;
      totalProducts?: number;
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
      [key: string]: unknown;
    };
    const tenants = p.tenantsBreakdown || [];

    return (
      <>
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Super Admin Platform Overview</h1>
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              Welcome back, {user?.name} · Platform Control & Analytics
            </p>
          </div>
          <div className="badge badge-purple">Super Admin</div>
        </div>

        <div className="page-body">
          {/* Stats Grid */}
          <div className="grid-4" style={{ marginBottom: '2rem' }}>
            <StatCard
              title="Total Tenants"
              value={p.totalTenants?.toString() || '0'}
              subtitle={`${p.activeTenants || 0} active tenants`}
              color="#6366f1"
              icon={
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9,22 9,12 15,12 15,22" />
                </svg>
              }
            />
            <StatCard
              title="Total Invoices"
              value={p.totalPurchases?.toString() || '0'}
              subtitle="Across all tenants"
              color="#10b981"
              icon={
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                </svg>
              }
            />
            <StatCard
              title="Platform Users"
              value={p.totalUsers?.toString() || '0'}
              subtitle="Registered user accounts"
              color="#3b82f6"
              icon={
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              }
            />
            <StatCard
              title="Total Suppliers"
              value={p.totalVendors?.toString() || '0'}
              subtitle={`${p.totalProducts || 0} inventory items`}
              color="#f59e0b"
              icon={
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                </svg>
              }
            />
          </div>

          {/* Tenants Platform Summary Table */}
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
                <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Tenant Organizations Overview</h2>
                <p
                  style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}
                >
                  Summary of all tenant accounts, users, suppliers, and transaction spend
                </p>
              </div>
              <a href="/dashboard/tenants" className="btn btn-secondary btn-sm">
                + Manage Tenants
              </a>
            </div>

            {tenants.length === 0 ? (
              <div className="empty-state">
                <h3>No tenants created yet</h3>
                <p>Use the Tenants section to onboard new restaurant organizations.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Tenant Name</th>
                      <th>Slug</th>
                      <th>Currency</th>
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
                          <span className="badge badge-blue">{t.currency || 'INR'}</span>
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

  // ── TENANT ADMIN DASHBOARD VIEW ────────────────────────────────────────────
  const safePurchases = recentPurchases || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dashboard</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Welcome back, {user?.name}
          </p>
        </div>
        <div className="badge badge-green">
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'currentColor',
              display: 'inline-block',
            }}
          />
          Live
        </div>
      </div>

      <div className="page-body">
        {/* Stats Grid */}
        <div className="grid-4" style={{ marginBottom: '2rem' }}>
          <StatCard
            title="Total Purchases"
            value={stats?.totalPurchases.toLocaleString() || '0'}
            subtitle="All time"
            color="#6366f1"
            icon={
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
              </svg>
            }
          />
          <StatCard
            title="Total Spent"
            value={formatCurrency(stats?.totalAmount || 0, user?.tenant?.currency || 'INR')}
            subtitle="Across recent purchases"
            color="#10b981"
            icon={
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            }
          />
          <StatCard
            title="Vendors"
            value={stats?.totalVendors.toString() || '0'}
            subtitle="Active suppliers"
            color="#f59e0b"
            icon={
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
              </svg>
            }
          />
          <StatCard
            title="Products"
            value={stats?.totalProducts.toString() || '0'}
            subtitle="Inventory items"
            color="#3b82f6"
            icon={
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
              </svg>
            }
          />
        </div>

        {/* Recent Purchases */}
        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}
          >
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Recent Purchases</h2>
            <a href="/dashboard/purchases" className="btn btn-secondary btn-sm">
              View all
            </a>
          </div>

          {safePurchases.length === 0 ? (
            <div className="empty-state">
              <h3>No purchases yet</h3>
              <p>Purchases created by inventory managers will appear here.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created by</th>
                  </tr>
                </thead>
                <tbody>
                  {safePurchases.map((purchase: Record<string, unknown>) => {
                    const vendorInfo = purchase.vendor as { name?: string } | undefined;
                    const userInfo = purchase.user as { name?: string } | undefined;
                    const itemsArr = purchase.items as unknown[] | undefined;
                    const statusStr = purchase.status as string;
                    return (
                      <tr key={purchase.id as string}>
                        <td>{formatDate(purchase.purchaseDate as string)}</td>
                        <td style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {vendorInfo?.name || '—'}
                        </td>
                        <td>{itemsArr?.length || 0} items</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-accent-green)' }}>
                          {formatCurrency(
                            purchase.grandTotal as number,
                            user?.tenant?.currency || 'INR'
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge badge-${statusStr === 'CONFIRMED' ? 'green' : statusStr === 'DRAFT' ? 'amber' : 'red'}`}
                          >
                            {statusStr}
                          </span>
                        </td>
                        <td>{userInfo?.name || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          {title}
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          {icon}
        </div>
      </div>
      <div
        style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
        {subtitle}
      </div>
    </div>
  );
}
