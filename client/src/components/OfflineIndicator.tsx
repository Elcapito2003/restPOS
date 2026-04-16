import { WifiOff, RefreshCw } from 'lucide-react';
import { useConnectivity } from '../context/ConnectivityContext';

export default function OfflineIndicator() {
  const { isOnline, pendingSyncs, isSyncing } = useConnectivity();

  if (isOnline && !isSyncing) return null;

  if (isSyncing) {
    return (
      <div className="bg-blue-600 text-white text-xs px-3 py-1 flex items-center gap-2">
        <RefreshCw size={12} className="animate-spin" />
        Sincronizando... {pendingSyncs > 0 && `(${pendingSyncs} pendientes)`}
      </div>
    );
  }

  return (
    <div className="bg-amber-500 text-white text-xs px-3 py-1 flex items-center gap-2">
      <WifiOff size={12} />
      Sin conexión — Modo Offline
      {pendingSyncs > 0 && <span className="bg-amber-700 rounded-full px-1.5">{pendingSyncs}</span>}
    </div>
  );
}
