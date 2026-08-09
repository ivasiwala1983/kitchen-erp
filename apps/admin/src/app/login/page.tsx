'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import type { TenantPublic } from '@kitchen-erp/types';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTenantSlug, setSelectedTenantSlug] = useState<string>('');
  const [tenants, setTenants] = useState<TenantPublic[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load public active tenants list for the login dropdown
    api.tenants
      .listPublic()
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          setTenants(res.data);
          // Pre-select stored tenant slug or default to first tenant if available
          const stored =
            typeof window !== 'undefined' ? localStorage.getItem('kitchen_erp_tenant_slug') : null;
          if (stored && res.data.some((t) => t.slug === stored)) {
            setSelectedTenantSlug(stored);
          } else if (res.data.length > 0) {
            setSelectedTenantSlug(res.data[0].slug);
          }
        }
      })
      .catch(() => null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, selectedTenantSlug || undefined);
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('kitchen_erp_access_token') : null;
      if (token) {
        router.replace('/dashboard');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(
        errorObj?.response?.data?.message ||
          'Login failed. Check email, password, or tenant selection.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 2h18M3 22h18M6 2v20M18 2v20M3 12h18" />
            </svg>
          </div>
          <span className="logo-text">Kitchen ERP</span>
        </div>

        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Sign in to your admin portal</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {/* Dynamic Tenant Dropdown */}
          <div className="form-group">
            <label
              className="form-label"
              style={{ fontWeight: 600, color: 'var(--color-brand-light)' }}
            >
              Select Kitchen / Organization
            </label>
            <select
              id="tenant-select"
              className="input"
              value={selectedTenantSlug}
              onChange={(e) => setSelectedTenantSlug(e.target.value)}
              style={{
                fontWeight: 600,
                background: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-brand)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              <option
                value=""
                style={{ color: 'var(--color-text-primary)', background: 'var(--color-bg-card)' }}
              >
                👑 Global Super Admin (All Tenants)
              </option>
              {tenants.map((t) => (
                <option
                  key={t.id}
                  value={t.slug}
                  style={{ color: 'var(--color-text-primary)', background: 'var(--color-bg-card)' }}
                >
                  🍳 {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="admin@demo.kitchenerp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18 }} />
                Signing in...
              </>
            ) : (
              'Sign in →'
            )}
          </button>
        </form>

        {/* Powered by Argusoft Footer */}
        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            flexWrap: 'wrap',
          }}
        >
          <span>© {new Date().getFullYear()} Kitchen ERP · Powered by</span>
          <a
            href="https://www.argusoft.com"
            target="_blank"
            rel="noreferrer"
            style={{
              fontWeight: 700,
              color: 'var(--color-brand-light, #6366f1)',
              textDecoration: 'none',
            }}
          >
            Argusoft India Ltd. ↗
          </a>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(
            ellipse at top,
            rgba(99, 102, 241, 0.1) 0%,
            var(--color-bg-primary) 60%
          );
          padding: 1rem;
        }
        .login-card {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 2.5rem;
          width: 100%;
          max-width: 420px;
          box-shadow:
            var(--shadow-lg),
            0 0 60px rgba(99, 102, 241, 0.08);
        }
        .login-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
        }
        .logo-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, var(--color-brand), var(--color-brand-dark));
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .logo-text {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .login-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }
        .login-subtitle {
          color: var(--color-text-muted);
          font-size: 0.875rem;
          margin-bottom: 2rem;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .login-hint {
          margin-top: 1.5rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
