'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KitchenErpApi } from '@kitchen-erp/api-client';
import type { TenantPublic } from '@kitchen-erp/types';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export default function RootPwaPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantsList, setTenantsList] = useState<TenantPublic[]>([]);

  useEffect(() => {
    const api = new KitchenErpApi({ baseURL: API_URL });
    api.tenants
      .listPublic()
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          setTenantsList(res.data);
          const stored =
            typeof window !== 'undefined' ? localStorage.getItem('kitchen_erp_tenant_slug') : null;
          if (stored && res.data.some((t) => t.slug === stored)) {
            setTenantSlug(stored);
          } else if (res.data.length > 0) {
            setTenantSlug(res.data[0].slug);
          }
        }
      })
      .catch(() => null);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = tenantSlug.toLowerCase().trim();
    if (slug) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('kitchen_erp_tenant_slug', slug);
      }
      router.push(`/t/${slug}`);
    }
  };

  return (
    <div className="app-shell" style={{ justifyContent: 'center', padding: '1.5rem 1rem' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div
          style={{
            width: 64,
            height: 64,
            background: 'var(--forest-green)',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 24px rgba(31, 78, 56, 0.25)',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
          >
            <path d="M3 2h18M3 22h18M6 2v20M18 2v20M3 12h18" />
          </svg>
        </div>
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 900,
            color: 'var(--text-main)',
            letterSpacing: '-0.5px',
            marginBottom: '0.25rem',
          }}
        >
          Kitchen ERP
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
          Mobile Kitchen Portal
        </p>
      </div>

      {/* Tenant Selector Card */}
      <div className="pwa-card" style={{ width: '100%', maxWidth: 380, padding: '1.75rem' }}>
        <h2
          style={{
            fontSize: '1.125rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            marginBottom: '0.5rem',
          }}
        >
          Select Kitchen / Branch
        </h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Choose your kitchen from the list or enter custom tenant slug below
        </p>

        <form onSubmit={handleSubmit}>
          {tenantsList.length > 0 && (
            <div className="pwa-field">
              <label
                className="pwa-label"
                style={{ fontWeight: 700, color: 'var(--forest-green)' }}
              >
                Available Kitchens
              </label>
              <select
                className="pwa-input"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                style={{
                  fontWeight: 700,
                  borderColor: 'var(--forest-green)',
                  cursor: 'pointer',
                }}
              >
                {tenantsList.map((t) => (
                  <option key={t.id} value={t.slug}>
                    🍳 {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pwa-field">
            <label className="pwa-label">Or Custom Kitchen Identifier</label>
            <input
              id="tenant-slug-input"
              type="text"
              className="pwa-input"
              placeholder="e.g. demo, test, badri"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="pwa-btn pwa-btn-primary" style={{ marginTop: '0.5rem' }}>
            Continue to Kitchen →
          </button>
        </form>
      </div>
    </div>
  );
}
