'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { KitchenErpApi, setTokens, clearTokens } from '@kitchen-erp/api-client';
import { Role, type TenantPublic } from '@kitchen-erp/types';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export default function RootPwaPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantsList, setTenantsList] = useState<TenantPublic[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [rememberMe, setRememberMe] = useState(true);

  const [deferredPrompt, setDeferredPrompt] = useState<unknown>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(Boolean(standalone));

      const userAgent = window.navigator.userAgent.toLowerCase();
      const iosDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIos(iosDevice);

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }
  }, []);

  useEffect(() => {
    const api = new KitchenErpApi({ baseURL: API_URL });
    api.tenants
      .listPublic()
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          setTenantsList(res.data);
          const stored =
            typeof window !== 'undefined' ? localStorage.getItem('kitchen_erp_tenant_slug') : null;
          const rememberPref =
            typeof window !== 'undefined' ? localStorage.getItem('kitchen_erp_remember_me') : null;

          if (rememberPref !== null) {
            setRememberMe(rememberPref === 'true');
          }

          if (stored && res.data.some((t) => t.slug === stored)) {
            setTenantSlug(stored);
            const token =
              typeof window !== 'undefined'
                ? localStorage.getItem('kitchen_erp_access_token')
                : null;
            if (token && rememberPref !== 'false') {
              router.replace(`/t/${stored}`);
            }
          } else if (res.data.length > 0) {
            setTenantSlug(res.data[0].slug);
          }
        }
      })
      .catch(() => null);
  }, [router]);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      const promptEvent = deferredPrompt as {
        prompt: () => void;
        userChoice: Promise<{ outcome: string }>;
      };
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const slug = tenantSlug.toLowerCase().trim();

    if (!slug) {
      setError('Please select or enter a kitchen identifier.');
      return;
    }

    setLoading(true);

    try {
      const api = new KitchenErpApi({
        baseURL: API_URL,
        tenantSlug: slug,
      });

      const res = await api.auth.login({
        email,
        password,
        tenantSlug: slug,
      });

      if (res.data) {
        if (res.data.user.role !== Role.INVENTORY_MANAGER) {
          clearTokens();
          setError(
            "👋 Welcome! As an Administrator, you don't have access to the Mobile Kitchen app. Please sign in to the Admin Portal."
          );
          return;
        }
        setTokens(res.data.tokens);
        if (typeof window !== 'undefined') {
          if (rememberMe) {
            localStorage.setItem('kitchen_erp_tenant_slug', slug);
            localStorage.setItem('kitchen_erp_remember_me', 'true');
          } else {
            localStorage.setItem('kitchen_erp_remember_me', 'false');
          }
        }
        router.replace(`/t/${slug}`);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Login failed. Check kitchen, email, and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script id="microsoft-clarity" strategy="afterInteractive">
        {`
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "y03c3912cp");
      `}
      </Script>
      <div
        className="app-shell"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: '2rem 1.25rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 390,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', width: '100%' }}>
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
              Kitchen ERP
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
              Mobile Kitchen Portal
            </p>
          </div>

          {/* Unified Login Card */}
          <div className="pwa-card" style={{ width: '100%', maxWidth: 380, padding: '1.5rem' }}>
            {error && (
              <div className="pwa-alert pwa-alert-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Kitchen Selector Dropdown */}
              <div className="pwa-field">
                <label
                  className="pwa-label"
                  style={{ fontWeight: 700, color: 'var(--forest-green)' }}
                >
                  Select Kitchen / Branch
                </label>
                <select
                  id="pwa-tenant-select"
                  className="pwa-input"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
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
                    <option value={tenantSlug || 'demo'}>
                      🍳 Default Kitchen ({tenantSlug || 'demo'})
                    </option>
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

              {/* Remember Kitchen Checkbox */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  margin: '0.75rem 0 0.875rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  id="pwa-remember-check"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: 'var(--forest-green)',
                    cursor: 'pointer',
                  }}
                />
                <label
                  htmlFor="pwa-remember-check"
                  style={{
                    fontSize: '0.84375rem',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  Remember this Kitchen on this device
                </label>
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
          </div>

          {/* PWA Install Prompt Banner for Android & iOS */}
          {!isStandalone && (
            <div
              style={{ marginTop: '1.25rem', width: '100%', maxWidth: 380, textAlign: 'center' }}
            >
              {deferredPrompt ? (
                <button
                  onClick={handleInstallApp}
                  className="pwa-btn pwa-btn-secondary"
                  style={{
                    background: 'var(--mint-light)',
                    color: 'var(--forest-green)',
                    border: '1px solid var(--forest-green)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: 12,
                    cursor: 'pointer',
                  }}
                >
                  📲 Install Kitchen ERP App
                </button>
              ) : isIos ? (
                <div
                  style={{
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: 12,
                    padding: '0.75rem 1rem',
                    fontSize: '0.8125rem',
                    color: '#065f46',
                    lineHeight: 1.4,
                  }}
                ></div>
              ) : null}
            </div>
          )}

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
            <span>© {new Date().getFullYear()} Kitchen ERP · Powered by</span>
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
      </div>
    </>
  );
}
