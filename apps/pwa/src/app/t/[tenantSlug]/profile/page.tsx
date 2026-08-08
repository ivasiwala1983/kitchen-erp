'use client';

import { useTenant } from '../../../../contexts/TenantContext';
import Link from 'next/link';

export default function TenantProfilePage() {
  const { user, tenant, tenantSlug, logout } = useTenant();

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
        User Profile
      </h1>

      <div className="pwa-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--forest-green)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
            }}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--text-main)' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
        </div>

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
            <span style={{ color: 'var(--text-muted)' }}>Role</span>
            <span style={{ fontWeight: 700, color: 'var(--forest-green)' }}>{user?.role}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Assigned Kitchen</span>
            <span style={{ fontWeight: 700 }}>{tenant?.name || tenantSlug}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
            <span style={{ color: 'var(--text-muted)' }}>Tenant Slug</span>
            <span style={{ fontWeight: 700 }}>
              <code>{tenantSlug}</code>
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Link
          href={`/t/${tenantSlug}`}
          className="pwa-btn pwa-btn-secondary"
          style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
        >
          ← Back to Dashboard
        </Link>
        <button
          onClick={logout}
          className="pwa-btn"
          style={{
            flex: 1,
            background: '#fee2e2',
            color: '#dc2626',
            border: 'none',
            fontWeight: 700,
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
