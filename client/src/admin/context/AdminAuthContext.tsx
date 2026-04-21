import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { serverUrl } from '../../config/api';

interface Admin {
  id: number;
  email: string;
  display_name: string;
  totp_enabled: boolean;
}

interface AdminAuthState {
  admin: Admin | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ requires2FA?: boolean; tempToken?: string }>;
  verify2FA: (tempToken: string, code: string) => Promise<void>;
  logout: () => void;
  adminFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

const AdminAuthContext = createContext<AdminAuthState>({} as AdminAuthState);

export function useAdminAuth() { return useContext(AdminAuthContext); }

const BASE = `${serverUrl}/api/super-admin`;

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('sa_token'));

  useEffect(() => {
    const saved = localStorage.getItem('sa_admin');
    if (saved && token) setAdmin(JSON.parse(saved));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.requires2FA) return { requires2FA: true, tempToken: data.tempToken };

    setToken(data.token);
    setAdmin(data.admin);
    localStorage.setItem('sa_token', data.token);
    localStorage.setItem('sa_admin', JSON.stringify(data.admin));
    return {};
  };

  const verify2FA = async (tempToken: string, code: string) => {
    const res = await fetch(`${BASE}/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setToken(data.token);
    setAdmin(data.admin);
    localStorage.setItem('sa_token', data.token);
    localStorage.setItem('sa_admin', JSON.stringify(data.admin));
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_admin');
  };

  const adminFetch = (path: string, options: RequestInit = {}) => {
    return fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
  };

  return (
    <AdminAuthContext.Provider value={{
      admin, token, isAuthenticated: !!token && !!admin, login, verify2FA, logout, adminFetch,
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
