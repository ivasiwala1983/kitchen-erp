'use client';

import React, { useEffect, useState, createContext, useContext } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import type { TenantPublic, UserPublic } from '@kitchen-erp/types';
import Link from 'next/link';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export interface TenantContextType {
  tenant: TenantPublic | null;
  user: UserPublic | null;
  tenantSlug: string;
  isLoading: boolean;
  logout: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return ctx;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawSlug = (params?.tenantSlug as string) || '';
  const tenantSlug = rawSlug.toLowerCase().trim();

  const [tenant, setTenant] = useState<TenantPublic | null>(null);
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const api = new KitchenErpApi({
    baseURL: API_URL,
    tenantSlug,
    onUnauthorized: () => {
      clearTokens();
      if (!pathname.includes('/login')) {
        router.replace(`/t/${tenantSlug}/login`);
      }
    },
  });

  useEffect(() => {
    if (!tenantSlug) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('kitchen_erp_tenant_slug', tenantSlug);
    }

    let isMounted = true;

    async function loadTenantData() {
      setIsLoading(true);
      setNotFound(false);
      try {
        const res = await api.tenants.getBySlug(tenantSlug);
        if (isMounted) {
          if (res.data) {
            setTenant(res.data);
          } else {
            setNotFound(true);
          }
        }
      } catch {
        if (isMounted) {
          setNotFound(true);
        }
      }

      const token =
        typeof window !== 'undefined' ? localStorage.getItem('kitchen_erp_access_token') : null;
      if (token) {
        try {
          const userRes = await api.auth.me();
          if (isMounted && userRes.data) {
            setUser(userRes.data);
          }
        } catch {
          clearTokens();
          if (isMounted) setUser(null);
        }
      }

      if (isMounted) setIsLoading(false);
    }

    loadTenantData();

    return () => {
      isMounted = false;
    };
  }, [tenantSlug]);

  const logout = () => {
    clearTokens();
    setUser(null);
    router.push(`/t/${tenantSlug}/login`);
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-page)',
        }}
      >
        <div
          className="pwa-spinner"
          style={{ width: 36, height: 36, borderColor: 'var(--forest-green)' }}
        />
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Loading kitchen platform...
        </p>
      </div>
    );
  }

  if (notFound) {
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
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            background: '#fee2e2',
            color: '#ef4444',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            marginBottom: '1rem',
          }}
        >
          ⚠️
        </div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            marginBottom: '0.5rem',
          }}
        >
          Tenant Not Found
        </h1>
        <p
          style={{
            color: 'var(--text-muted)',
            maxWidth: 360,
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
          }}
        >
          No active kitchen tenant found for slug <code>"{tenantSlug}"</code>. Please verify the URL
          or enter a valid kitchen identifier.
        </p>
        <button
          onClick={() => router.push('/')}
          className="pwa-btn pwa-btn-primary"
          style={{ maxWidth: 220 }}
        >
          Select Another Tenant
        </button>
      </div>
    );
  }

  const isLoginPage = pathname.includes('/login');

  return (
    <TenantContext.Provider value={{ tenant, user, tenantSlug, isLoading, logout }}>
      {!isLoginPage && (
        <header
          style={{
            background: 'var(--forest-green)',
            color: 'white',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link
              href={`/t/${tenantSlug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'white',
                textDecoration: 'none',
                fontWeight: 800,
                fontSize: '1.125rem',
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🍳</span>
              <span>{tenant?.name || tenantSlug}</span>
            </Link>
          </div>

          <nav
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}
          >
            <Link
              href={`/t/${tenantSlug}/purchase`}
              style={{
                color:
                  pathname.includes('/purchase') && !pathname.includes('/history')
                    ? '#a7f3d0'
                    : 'white',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Purchase
            </Link>
            <Link
              href={`/t/${tenantSlug}/history`}
              style={{
                color: pathname.includes('/history') ? '#a7f3d0' : 'white',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              History
            </Link>
            <Link
              href={`/t/${tenantSlug}/profile`}
              style={{
                color: pathname.includes('/profile') ? '#a7f3d0' : 'white',
                textDecoration: 'none',
                fontWeight: 700,
              }}
            >
              Profile
            </Link>
          </nav>
        </header>
      )}

      <main>{children}</main>
    </TenantContext.Provider>
  );
}
