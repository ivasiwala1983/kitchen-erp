'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { UserPublic } from '@kitchen-erp/types';
import { Role } from '@kitchen-erp/types';
import { api } from '../lib/api';
import { setTokens, clearTokens } from '@kitchen-erp/api-client';

interface AuthContextType {
  user: UserPublic | null;
  isLoading: boolean;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to restore session from localStorage
    const token = localStorage.getItem('kitchen_erp_access_token');
    if (token) {
      api.auth
        .me()
        .then((res) => {
          if (res.data) {
            if (res.data.role === Role.INVENTORY_MANAGER) {
              clearTokens();
              setUser(null);
            } else {
              setUser(res.data);
            }
          }
        })
        .catch(() => {
          clearTokens();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string, tenantSlug?: string) => {
    const res = await api.auth.login({ email, password, tenantSlug });
    if (res.data) {
      if (res.data.user.role === Role.INVENTORY_MANAGER) {
        clearTokens();
        throw new Error(
          "👋 Hello! You don't have access to the Admin Portal. Please use the ArgusOne Mobile App to manage daily purchases."
        );
      }
      setTokens(res.data.tokens);
      if (typeof window !== 'undefined' && tenantSlug) {
        localStorage.setItem('kitchen_erp_tenant_slug', tenantSlug);
      }
      setUser(res.data.user);
    }
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
