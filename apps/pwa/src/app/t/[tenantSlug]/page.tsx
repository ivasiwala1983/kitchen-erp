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
          padding: '1.5rem',
          borderRadius: 16,
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            opacity: 0.9,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Welcome back
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0' }}>{user.name}</h1>
        <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
          Role: <strong>{user.role}</strong> · {tenant?.name || tenantSlug}
        </p>
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

        <Link
          href={`/t/${tenantSlug}/settings`}
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
            <div style={{ fontSize: '1.75rem' }}>⚙️</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
              Settings
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Tenant info & configuration
            </div>
          </div>
        </Link>
      </div>

      {/* Tenant Meta Summary */}
      <div
        className="pwa-card"
        style={{
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Active Kitchen
          </div>
          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
            {tenant?.name || tenantSlug}
          </div>
        </div>
        <button
          onClick={logout}
          className="pwa-btn"
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            border: 'none',
            padding: '0.5rem 1rem',
            fontSize: '0.8125rem',
            fontWeight: 700,
            borderRadius: 8,
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
