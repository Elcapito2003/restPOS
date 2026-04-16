import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { setOfflineStatus } from '../offline/offlineInterceptor';

interface ConnectivityState {
  isOnline: boolean;
  pendingSyncs: number;
  isSyncing: boolean;
}

const ConnectivityContext = createContext<ConnectivityState>({
  isOnline: true, pendingSyncs: 0, isSyncing: false,
});

export function useConnectivity() {
  return useContext(ConnectivityContext);
}

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncs] = useState(0);
  const [isSyncing] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const baseUrl = (window as any).restpos?.getServerUrl?.() || '';
      const healthUrl = baseUrl.startsWith('file') || !baseUrl
        ? 'http://165.227.121.235/api/health'
        : `${baseUrl}/api/health`;
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('not ok');
      if (!isOnline) {
        setIsOnline(true);
        setOfflineStatus(false);
      }
    } catch {
      if (isOnline) {
        setIsOnline(false);
        setOfflineStatus(true);
      }
    }
  }, [isOnline]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    window.addEventListener('online', checkHealth);
    window.addEventListener('offline', () => { setIsOnline(false); setOfflineStatus(true); });
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', checkHealth);
    };
  }, []);

  return (
    <ConnectivityContext.Provider value={{ isOnline, pendingSyncs, isSyncing }}>
      {children}
    </ConnectivityContext.Provider>
  );
}
