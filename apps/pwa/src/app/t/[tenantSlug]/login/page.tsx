'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { KitchenErpApi, setTokens } from '@kitchen-erp/api-client';
import type { TenantPublic } from '@kitchen-erp/types';
import { useTenant } from '../../../../contexts/TenantContext';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export default function TenantLoginPage() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = (params?.tenantSlug as string) || '';
  const tenantSlug = rawSlug.toLowerCase().trim();
  const { tenant } = useTenant();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantsList, setTenantsList] = useState<TenantPublic[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const api = new KitchenErpApi({
    baseURL: API_URL,
    tenantSlug,
  });

  useEffect(() => {
    // Load public active kitchen list for dropdown
    api.tenants
      .listPublic()
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          setTenantsList(res.data);
        }
      })
      .catch(() => null);
  }, []);

  const handleTenantChange = (newSlug: string) => {
    if (newSlug && newSlug !== tenantSlug) {
      router.push(`/t/${newSlug}/login`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.auth.login({
        email,
        password,
        tenantSlug,
      });

      if (res.data) {
        setTokens(res.data.tokens);
        if (typeof window !== 'undefined') {
          localStorage.setItem('kitchen_erp_tenant_slug', tenantSlug);
        }
        router.replace(`/t/${tenantSlug}`);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Login failed. Check email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell" style={{ justifyContent: 'center', padding: '1.5rem 1rem' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div
          style={{
            width: 60,
            height: 60,
            background: 'var(--forest-green)',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.75rem',
            boxShadow: '0 8px 24px rgba(31, 78, 56, 0.25)',
          }}
        >
          <svg
            width="30"
            height="30"
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
            fontSize: '1.5rem',
            fontWeight: 900,
            color: 'var(--text-main)',
            letterSpacing: '-0.5px',
            marginBottom: '0.25rem',
          }}
        >
          {tenant?.name || tenantSlug.toUpperCase()}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
          Kitchen ERP Mobile Portal
        </p>
      </div>

      {/* Login Card */}
      <div className="pwa-card" style={{ width: '100%', maxWidth: 380, padding: '1.5rem' }}>
        {error && <div className="pwa-alert pwa-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Kitchen Selector Dropdown */}
          <div className="pwa-field">
            <label className="pwa-label" style={{ fontWeight: 700, color: 'var(--forest-green)' }}>
              Select Kitchen / Branch
            </label>
            <select
              className="pwa-input"
              value={tenantSlug}
              onChange={(e) => handleTenantChange(e.target.value)}
              style={{
                fontWeight: 700,
                borderColor: 'var(--forest-green)',
                cursor: 'pointer',
              }}
            >
              {tenantsList.length > 0 ? (
                tenantsList.map((t) => (
                  <option key={t.id} value={t.slug}>
                    🍳 {t.name} ({t.slug})
                  </option>
                ))
              ) : (
                <option value={tenantSlug}>🍳 {tenant?.name || tenantSlug}</option>
              )}
            </select>
          </div>

          <div className="pwa-field">
            <label className="pwa-label">Email Address</label>
            <input
              id="pwa-email"
              type="email"
              className="pwa-input"
              placeholder="manager@demo.kitchenerp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="pwa-field">
            <label className="pwa-label">Password</label>
            <input
              id="pwa-password"
              type="password"
              className="pwa-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            id="pwa-login-btn"
            type="submit"
            className="pwa-btn pwa-btn-primary"
            style={{ marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? <span className="pwa-spinner" /> : 'Sign in →'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.25rem',
            background: '#f8fafc',
            padding: '0.75rem',
            borderRadius: 10,
            fontSize: '0.75rem',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 2 }}>
            Default Credentials:
          </div>
          <div>
            Test Manager: <code>inventory@test.com</code> / <code>Manager@123</code>
          </div>
          <div>
            Demo Manager: <code>manager@demo.kitchenerp.com</code> / <code>Manager@123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
