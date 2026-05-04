import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';

/**
 * Notifica al main de Electron si hay turnos abiertos del tenant para bloquear
 * cierre accidental. El admin queda exento — siempre puede cerrar la app sin
 * el dialog de confirmación (puede ser dueño que necesita reiniciar PC, etc.).
 */
export function useShiftStatusBridge() {
  const { isAuthenticated, user } = useAuth();
  const restpos = (window as any).restpos;

  const { data: openShifts } = useQuery<any[]>({
    queryKey: ['shifts', 'open'],
    queryFn: () => api.get('/shifts').then(r => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  useEffect(() => {
    if (!restpos?.setShiftStatus) return;
    const hasOpen = Array.isArray(openShifts) && openShifts.length > 0;
    const isAdmin = user?.role === 'admin';
    // Admin siempre puede cerrar; los demás roles ven el dialog si hay turno abierto
    restpos.setShiftStatus(hasOpen && !isAdmin);
  }, [openShifts, restpos, user]);
}
