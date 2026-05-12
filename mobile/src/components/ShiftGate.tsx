import { ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { Clock, LogOut, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getOpenShifts, getMyShift } from '../api/client';
import { api } from '../api/client';
import { showInfo } from '../lib/toast';
import Button from './ui/Button';

// Política:
// - admin: pasa siempre.
// - waiter (mesero): NO abre turno propio. Solo verifica que haya UNO abierto
//   en el sistema. Si no, muestra "Esperando apertura" con boton refresh.
// - manager/cashier: abre su propio turno (manejan efectivo) — fallback a la
//   pantalla forzada con form (sin cambios respecto a antes).
export default function ShiftGate({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isWaiter = user?.role === 'waiter';

  const [loading, setLoading] = useState(true);
  const [hasGlobalShift, setHasGlobalShift] = useState<boolean | null>(null);
  const [openByName, setOpenByName] = useState<string | null>(null);
  const pollRef = useRef<any>(null);

  const refresh = useCallback(async () => {
    if (!user || isAdmin) { setLoading(false); return; }
    try {
      if (isWaiter) {
        const shifts = await getOpenShifts();
        setHasGlobalShift(shifts.length > 0);
        setOpenByName(shifts[0]?.display_name || null);
      } else {
        // cashier/manager: chequea su propio turno
        const mine = await getMyShift();
        setHasGlobalShift(!!mine);
      }
    } catch {
      // server unreachable — no rompemos, dejamos pasar a la pantalla
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, isWaiter]);

  useEffect(() => { refresh(); }, [refresh]);

  // Si está esperando turno, polea cada 10s
  useEffect(() => {
    if (isAdmin || hasGlobalShift !== false) return;
    pollRef.current = setInterval(refresh, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [hasGlobalShift, isAdmin, refresh]);

  // Interceptor: detecta 403 SHIFT_REQUIRED_GLOBAL (mesero) o SHIFT_REQUIRED
  // (cajero) y vuelve a chequear el estado.
  useEffect(() => {
    if (!user || isAdmin) return;
    const id = api.interceptors.response.use(
      (r) => r,
      (err) => {
        const code = err?.response?.data?.code;
        if (err?.response?.status === 403 && (code === 'SHIFT_REQUIRED' || code === 'SHIFT_REQUIRED_GLOBAL')) {
          refresh();
        }
        return Promise.reject(err);
      }
    );
    return () => { api.interceptors.response.eject(id); };
  }, [user, isAdmin, refresh]);

  if (!user || isAdmin) return <>{children}</>;
  if (loading) {
    return (
      <View className="flex-1 bg-bg-base items-center justify-center">
        <Clock size={48} color="#64748B" />
        <Text className="text-ink-muted mt-3">Verificando turno...</Text>
      </View>
    );
  }

  if (hasGlobalShift) return <>{children}</>;

  // No hay turno: mesero ve "esperando", cajero/manager ven "abre tu turno"
  // pero en el comandero no debería tocar — se asume que abren desde desktop.
  return (
    <WaitingShiftView
      isWaiter={isWaiter}
      onRefresh={() => { showInfo('Verificando...'); refresh(); }}
      onLogout={logout}
    />
  );
}

function WaitingShiftView({ isWaiter, onRefresh, onLogout }: { isWaiter: boolean; onRefresh: () => void; onLogout: () => void }) {
  return (
    <View className="flex-1 bg-bg-base px-6 pt-16 pb-8 justify-center">
      <View className="items-center mb-8">
        <View className="w-24 h-24 rounded-full bg-amber-500/15 items-center justify-center mb-4">
          <AlertCircle size={56} color="#F59E0B" />
        </View>
        <Text className="text-ink-primary text-2xl font-bold text-center">
          {isWaiter ? 'Esperando apertura de turno' : 'No hay turno abierto'}
        </Text>
        <Text className="text-ink-secondary text-center mt-3 px-4">
          {isWaiter
            ? 'Pide al cajero o admin que abra turno desde la app de RestPOS en la caja. Una vez abierto, podrás tomar pedidos.'
            : 'Abre tu turno desde la app de escritorio en la caja antes de operar desde el comandero.'}
        </Text>
      </View>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onPress={onRefresh}
        leftIcon={<RefreshCw size={20} color="#fff" />}
      >
        Verificar otra vez
      </Button>

      <Text className="text-ink-muted text-xs text-center mt-3">
        Se verifica automáticamente cada 10 segundos.
      </Text>

      <Pressable onPress={onLogout} className="items-center mt-6 py-2">
        <View className="flex-row items-center gap-1.5">
          <LogOut size={14} color="#94A3B8" />
          <Text className="text-ink-secondary text-sm">Cerrar sesión</Text>
        </View>
      </Pressable>
    </View>
  );
}
