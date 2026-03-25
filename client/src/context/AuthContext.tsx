import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../config/api';

interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
  avatar_color: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userId: number, pin: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  const login = async (userId: number, pin: string) => {
    const res = await api.post('/auth/pin-login', { userId, pin });
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('user', JSON.stringify(res.data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
