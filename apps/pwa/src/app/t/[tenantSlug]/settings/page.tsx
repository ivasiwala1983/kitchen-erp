'use client';

import { useTenant } from '../../../../contexts/TenantContext';

import Link from 'next/link';

export default function TenantSettingsPage() {
  const { tenant, tenantSlug } = useTenant();

  return (
    <div style={{ padding: '1.25rem', maxWidth: 500, margin: '0 auto' }}>
      <h1
        style={{
          fontSize: '1.25rem',
          fontWeight: 800,
          color: 'var(--text-main)',
          marginBottom: '1rem',
        }}
      >
        Kitchen Settings
      </h1>

      <div className="pwa-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            marginBottom: '0.75rem',
          }}
        >
          {tenant?.name || tenantSlug} Configuration
        </h2>

        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Tenant Plan</span>
            <span style={{ fontWeight: 700, color: 'var(--forest-green)' }}>
              {tenant?.plan || 'STANDARD'}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Currency</span>
            <span style={{ fontWeight: 700 }}>{tenant?.currency || 'INR'}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Tenant Status</span>
            <span
              style={{ fontWeight: 700, color: tenant?.isActive !== false ? '#16a34a' : '#dc2626' }}
            >
              {tenant?.isActive !== false ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
            <span style={{ color: 'var(--text-muted)' }}>Routing Mode</span>
            <span style={{ fontWeight: 700 }}>Path-Based (/t/{tenantSlug})</span>
          </div>
        </div>
      </div>

      <Link
        href={`/t/${tenantSlug}`}
        className="pwa-btn pwa-btn-secondary"
        style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
