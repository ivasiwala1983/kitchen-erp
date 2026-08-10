'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTenant } from '../../../contexts/TenantContext';

export default function TenantDashboardPage() {
  const router = useRouter();
  const { tenant, user, tenantSlug, isLoading, logout } = useTenant();

  useEffect(() => {
    if (!isLoading && !user) {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('kitchen_erp_access_token') : null;
      if (!token) {
        router.replace(`/t/${tenantSlug}/login`);
      }
    }
  }, [user, isLoading, tenantSlug, router]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <div style={{ padding: '1.25rem', maxWidth: 600, margin: '0 auto' }}>
      {/* Welcome Card */}
      <div
        className="pwa-card"
        style={{
          background: 'linear-gradient(135deg, var(--forest-green), #14532d)',
          color: 'white',
          padding: '1.25rem 1.5rem',
          borderRadius: 16,
          marginBottom: '1.25rem',
          boxShadow: '0 8px 24px rgba(31, 78, 56, 0.2)',
        }}
      >
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            margin: 0,
            color: 'white',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={`Welcome back, ${user.name} 👋`}
        >
          Welcome back, {user.name} 👋
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            opacity: 0.9,
            marginTop: '0.35rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          🍳 {tenant?.name || tenantSlug}
        </p>
      </div>

      {/* 🤖 Ask ArgusOne AI Assistant Entry Card */}
      <div
        className="pwa-card"
        style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          color: 'white',
          padding: '1.25rem 1.5rem',
          borderRadius: 16,
          marginBottom: '1.5rem',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🤖</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Ask ArgusOne
            </h2>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: 999,
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            AI Assistant
          </span>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
          Ask about purchases, vendors, inventory attention items, or ledger balances.
        </p>
        <Link
          href={`/t/${tenantSlug}/assistant`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#f8fafc',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            transition: 'all 0.2s ease',
          }}
        >
          <span>Ask ArgusOne...</span>
          <span style={{ fontSize: '1rem', color: '#38bdf8', fontWeight: 700 }}>→</span>
        </Link>
      </div>

      {/* Quick Action Grid */}
      <h2
        style={{
          fontSize: '1rem',
          fontWeight: 800,
          color: 'var(--text-main)',
          marginBottom: '0.75rem',
        }}
      >
        Kitchen Actions
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.875rem',
          marginBottom: '1.5rem',
        }}
      >
        <Link
          href={`/t/${tenantSlug}/purchase`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div
            className="pwa-card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              height: '100%',
            }}
          >
            <div style={{ fontSize: '1.75rem' }}>🛒</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--forest-green)' }}>
              New Purchase
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Record daily ingredient purchases
            </div>
          </div>
        </Link>

        <Link
          href={`/t/${tenantSlug}/history`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div
            className="pwa-card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              height: '100%',
            }}
          >
            <div style={{ fontSize: '1.75rem' }}>📋</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--forest-green)' }}>
              Purchase History
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              View logs & upload invoices
            </div>
          </div>
        </Link>

        <Link href={`/t/${tenantSlug}/ledger`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div
            className="pwa-card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              height: '100%',
            }}
          >
            <div style={{ fontSize: '1.75rem' }}>📖</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--forest-green)' }}>
              Vendor Ledger
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Payables, credit & vendor payments
            </div>
          </div>
        </Link>

        <Link
          href={`/t/${tenantSlug}/profile`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div
            className="pwa-card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              height: '100%',
            }}
          >
            <div style={{ fontSize: '1.75rem' }}>👤</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
              My Profile
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Account details & password
            </div>
          </div>
        </Link>
      </div>

      {/* Tenant Meta Summary & Sign Out */}
      <div
        className="pwa-card"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#f0f4e8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.125rem',
              flexShrink: 0,
            }}
          >
            🍳
          </div>
          <div>
            <div
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Active Kitchen
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
              {tenant?.name || tenantSlug}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          type="button"
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            border: 'none',
            padding: '0.5rem 1.125rem',
            fontSize: '0.8125rem',
            fontWeight: 800,
            borderRadius: 10,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Powered by Argusoft Footer */}
      <div
        style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.78125rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          flexWrap: 'wrap',
        }}
      >
        <span>© {new Date().getFullYear()} ArgusOne · Powered by</span>
        <a
          href="https://www.argusoft.com"
          target="_blank"
          rel="noreferrer"
          style={{
            fontWeight: 800,
            color: 'var(--forest-green)',
            textDecoration: 'none',
          }}
        >
          Argusoft India Ltd. ↗
        </a>
      </div>
    </div>
  );
}
