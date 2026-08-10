'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTenant } from '../../../../contexts/TenantContext';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatCurrency } from '@kitchen-erp/utils';
import type { LedgerAccountPublic, LedgerSummary, CategoryPublic } from '@kitchen-erp/types';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export default function PwaLedgerListPage() {
  const router = useRouter();
  const { tenant, tenantSlug, user, isLoading } = useTenant();

  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [vendors, setVendors] = useState<LedgerAccountPublic[]>([]);
  const [categories, setCategories] = useState<CategoryPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/t/${tenantSlug}/login`);
    }
  }, [user, isLoading, tenantSlug, router]);

  useEffect(() => {
    if (!tenantSlug) return;
    const api = new KitchenErpApi({ baseURL: API_URL, tenantSlug });

    // Fetch category master for filters
    api.categories
      .list({ limit: 100 })
      .then((res) => {
        const r = res as { data?: unknown };
        const items = Array.isArray(r?.data)
          ? r.data
          : (r?.data as { data?: unknown[] })?.data || [];
        setCategories(items as CategoryPublic[]);
      })
      .catch(() => {});

    // Fetch ledger summary
    api.ledger
      .summary()
      .then((res) => {
        if (res.data) setSummary(res.data);
      })
      .catch(() => {});
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;
    setLoading(true);
    const api = new KitchenErpApi({ baseURL: API_URL, tenantSlug });

    api.ledger
      .vendors({
        search: search || undefined,
        categoryId: selectedCategory || undefined,
        limit: 100,
      })
      .then((res) => {
        const r = res as { data?: unknown };
        const items = Array.isArray(r?.data)
          ? r.data
          : (r?.data as { data?: unknown[] })?.data || [];
        setVendors(items as LedgerAccountPublic[]);
      })
      .catch(() => {
        setVendors([]);
      })
      .finally(() => setLoading(false));
  }, [tenantSlug, search, selectedCategory]);

  const currency = tenant?.currency || 'INR';

  if (isLoading || !user) {
    return null;
  }

  return (
    <div style={{ padding: '1.25rem', maxWidth: 600, margin: '0 auto' }}>
      {/* Top Bar Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <button
            onClick={() => router.push(`/t/${tenantSlug}`)}
            style={{
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 10,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            ←
          </button>
          <div>
            <h1
              style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}
            >
              Vendor Ledger
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Track outstanding balances & payments
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            href={`/t/${tenantSlug}/assistant?source=ledger`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
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

          <Link href={`/t/${tenantSlug}/ledger/pay`}>
            <button
              className="pwa-btn pwa-btn-primary pwa-btn-sm"
              style={{
                padding: '0.5rem 0.875rem',
                fontSize: '0.8125rem',
                fontWeight: 800,
                borderRadius: 10,
              }}
            >
              + Pay Vendor
            </button>
          </Link>
        </div>
      </div>

      {/* Financial Summary Card */}
      {summary && (
        <div
          className="pwa-card"
          style={{
            background: 'linear-gradient(135deg, var(--forest-green), #14532d)',
            color: 'white',
            padding: '1.25rem',
            borderRadius: 16,
            marginBottom: '1.25rem',
            boxShadow: '0 8px 24px rgba(31, 78, 56, 0.2)',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              opacity: 0.85,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Total Vendor Payable
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              margin: '0.25rem 0 0.75rem 0',
              color: '#ffffff',
            }}
          >
            {formatCurrency(summary.totalPayable, currency)}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.6875rem', opacity: 0.8, fontWeight: 600 }}>
                Vendor Credit / Advance
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#a7f3d0' }}>
                {formatCurrency(summary.totalCredit, currency)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', opacity: 0.8, fontWeight: 600 }}>
                Active Vendors
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                {summary.vendorCount} Vendors
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search vendor name, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pwa-input"
          style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.84375rem' }}
        />
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="pwa-input"
            style={{ width: 140, padding: '0.5rem', fontSize: '0.8125rem' }}
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

      {/* Vendor Ledger List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <span className="pwa-spinner" style={{ borderTopColor: 'var(--forest-green)' }} />
        </div>
      ) : vendors.length === 0 ? (
        <div
          className="pwa-empty"
          style={{ background: '#ffffff', borderRadius: 16, padding: '2rem 1rem' }}
        >
          <div className="pwa-empty-icon">📖</div>
          <h3>No vendor accounts found</h3>
          <p>No vendors matched your search query or tenant configuration.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {vendors.map((acc) => {
            const vendorName = acc.vendor?.name || 'Unknown Vendor';
            const categoryName = acc.vendor?.category?.name;
            const balance = acc.currentBalance;
            const isCredit = acc.isVendorCredit;

            return (
              <div
                key={acc.id}
                className="pwa-card"
                style={{
                  padding: '1rem 1.125rem',
                  borderRadius: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                  borderLeft: isCredit
                    ? '4px solid #166534'
                    : balance > 0
                      ? '4px solid #d9381e'
                      : '4px solid #9ca3af',
                }}
              >
                {/* Header: Vendor Name & Category */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                      🏢 {vendorName}
                    </div>
                    {categoryName && (
                      <div
                        style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}
                      >
                        📁 {categoryName}
                      </div>
                    )}
                  </div>

                  <span
                    className={`pwa-badge pwa-badge-${isCredit ? 'green' : balance > 0 ? 'red' : 'gray'}`}
                    style={{ fontWeight: 800 }}
                  >
                    {isCredit ? 'Credit / Advance' : balance > 0 ? 'Payable' : 'Settled'}
                  </span>
                </div>

                {/* Balance Row */}
                <div
                  style={{
                    background: 'var(--bg-page)',
                    padding: '0.625rem 0.875rem',
                    borderRadius: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}
                  >
                    {isCredit ? 'Vendor Credit / Advance' : 'Current Balance (Payable)'}
                  </span>
                  <span
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 900,
                      color: isCredit ? '#166534' : balance > 0 ? '#d9381e' : 'var(--text-main)',
                    }}
                  >
                    {isCredit
                      ? `- ${formatCurrency(acc.absBalance, currency)}`
                      : formatCurrency(balance, currency)}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 2 }}>
                  <Link
                    href={`/t/${tenantSlug}/ledger/${acc.vendorId}`}
                    style={{ flex: 1, textDecoration: 'none' }}
                  >
                    <button
                      type="button"
                      className="pwa-btn pwa-btn-secondary pwa-btn-sm"
                      style={{ width: '100%', fontWeight: 700 }}
                    >
                      📜 View Statement
                    </button>
                  </Link>

                  <Link
                    href={`/t/${tenantSlug}/ledger/pay?vendorId=${acc.vendorId}`}
                    style={{ flex: 1, textDecoration: 'none' }}
                  >
                    <button
                      type="button"
                      className="pwa-btn pwa-btn-primary pwa-btn-sm"
                      style={{ width: '100%', fontWeight: 700 }}
                    >
                      💳 Pay Vendor
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="bottom-nav">
        <Link href={`/t/${tenantSlug}/purchase`} className="bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          Buy
        </Link>

        <Link href={`/t/${tenantSlug}/history`} className="bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          History
        </Link>

        <Link href={`/t/${tenantSlug}/ledger`} className="bottom-nav-item active">
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
