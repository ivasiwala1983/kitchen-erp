'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KitchenErpApi, setTokens } from '@kitchen-erp/api-client';

const api = new KitchenErpApi({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  onUnauthorized: () => (window.location.href = '/'),
});

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.login({ email, password });
      if (res.data) {
        setTokens(res.data.tokens);
        router.replace('/purchase');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Login failed. Check email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'var(--bg-page)',
      }}
    >
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
          Mobile Purchase Portal
        </p>
      </div>

      {/* Login Card */}
      <div className="pwa-card" style={{ width: '100%', maxWidth: 380, padding: '1.75rem' }}>
        <h2
          style={{
            fontSize: '1.125rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            marginBottom: '1.25rem',
          }}
        >
          Sign in
        </h2>

        {error && <div className="pwa-alert pwa-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
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
            Manager Login Credentials:
          </div>
          <div>
            Email: <code>manager@demo.kitchenerp.com</code>
          </div>
          <div>
            Password: <code>Manager@123</code>
          </div>
        </div>
      </div>

      <p
        style={{
          marginTop: '1.5rem',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        Admins →{' '}
        <a
          href="http://localhost:3000"
          style={{ color: 'var(--forest-green)', fontWeight: 700, textDecoration: 'underline' }}
        >
          Admin Portal
        </a>
      </p>
    </div>
  );
}
