import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';

/**
 * Notifica al main de Electron si hay algún turno abierto en el tenant.
 * El main usa esa señal para bloquear el cierre de la ventana con un dialog
 * de confirmación, evitando que se cierre la app accidentalmente con la caja
 * todavía abierta.
 */
export function useShiftStatusBridge() {
  const { isAuthenticated } = useAuth();
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
    restpos.setShiftStatus(hasOpen);
  }, [openShifts, restpos]);
}
