import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  const tenantId = await AsyncStorage.getItem('tenantId');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) config.headers['X-Tenant-Id'] = tenantId;
  return config;
});

export async function redeemLicense(code: string) {
  const res = await axios.post(`${API_URL}/super-admin/license/redeem`, { license_code: code });
  return res.data as {
    tenant: { id: string; name: string; slug: string; logo_url: string | null; timezone: string; currency: string };
    license: { plan: string; expires_at: string };
  };
}

export async function fetchActiveUsers() {
  const res = await api.get('/auth/users');
  return res.data as Array<{
    id: number;
    username: string;
    display_name: string;
    role: string;
    avatar_color: string;
  }>;
}

export async function pinLogin(userId: number, pin: string) {
  const res = await api.post('/auth/pin-login', { userId, pin });
  return res.data as {
    token: string;
    user: { id: number; username: string; display_name: string; role: string; avatar_color: string };
  };
}
