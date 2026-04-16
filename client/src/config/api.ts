import axios from 'axios';

// When running in Electron (loaded from file://), use absolute server URL
// When running in browser (loaded from server), use relative /api
const isElectron = !!(window as any).restpos?.isElectron;
const isFileProtocol = window.location.protocol === 'file:';
const serverUrl = isElectron || isFileProtocol
  ? ((window as any).restpos?.getServerUrl?.() || 'http://165.227.121.235')
  : '';

const api = axios.create({
  baseURL: `${serverUrl}/api`,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/health')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.href.includes('/login') && !window.location.href.includes('#/login')) {
        window.location.href = isElectron ? '#/login' : '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { serverUrl, isElectron };
