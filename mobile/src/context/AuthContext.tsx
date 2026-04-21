import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type User = {
  id: number;
  username: string;
  display_name: string;
  role: string;
  avatar_color: string;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
  currency: string;
};

interface AuthState {
  ready: boolean;
  tenant: Tenant | null;
  user: User | null;
  token: string | null;
  saveTenant: (t: Tenant) => Promise<void>;
  clearTenant: () => Promise<void>;
  saveSession: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [t, u, tk] = await Promise.all([
        AsyncStorage.getItem('tenant'),
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('token'),
      ]);
      if (t) setTenant(JSON.parse(t));
      if (u) setUser(JSON.parse(u));
      if (tk) setToken(tk);
      setReady(true);
    })();
  }, []);

  const saveTenant = async (t: Tenant) => {
    setTenant(t);
    await AsyncStorage.multiSet([
      ['tenant', JSON.stringify(t)],
      ['tenantId', t.id],
    ]);
  };

  const clearTenant = async () => {
    setTenant(null);
    setUser(null);
    setToken(null);
    await AsyncStorage.multiRemove(['tenant', 'tenantId', 'user', 'token']);
  };

  const saveSession = async (tk: string, u: User) => {
    setToken(tk);
    setUser(u);
    await AsyncStorage.multiSet([
      ['token', tk],
      ['user', JSON.stringify(u)],
    ]);
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove(['token', 'user']);
  };

  const value = useMemo(
    () => ({ ready, tenant, user, token, saveTenant, clearTenant, saveSession, logout }),
    [ready, tenant, user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
