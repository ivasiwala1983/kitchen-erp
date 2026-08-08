'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { UserPublic } from '@kitchen-erp/types';
import { api } from '../lib/api';
import { setTokens, clearTokens } from '@kitchen-erp/api-client';

interface AuthContextType {
  user: UserPublic | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
          if (res.data) setUser(res.data);
        })
        .catch(() => {
          clearTokens();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    if (res.data) {
      setTokens(res.data.tokens);
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
