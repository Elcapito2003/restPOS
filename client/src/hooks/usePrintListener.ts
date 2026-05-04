import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

// Dedupe: si recibimos el mismo printRequestId en <10s, lo ignoramos.
// Esto cubre el caso donde múltiples instancias Electron del mismo tenant
// reciban el evento simultáneamente (sólo una imprime).
const recentPrintRequests = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10000;

function shouldSkip(printRequestId: string | undefined): boolean {
  if (!printRequestId) return false;
  const now = Date.now();
  // Limpia entradas viejas
  for (const [k, ts] of recentPrintRequests) {
    if (now - ts > DEDUPE_WINDOW_MS) recentPrintRequests.delete(k);
  }
  if (recentPrintRequests.has(printRequestId)) {
    return true;
  }
  recentPrintRequests.set(printRequestId, now);
  return false;
}

/**
 * Escucha eventos de impresión emitidos por el server y los delega al
 * proceso Electron local que SÍ tiene acceso a las impresoras LAN/USB.
 *
 * Solo activa en Electron — en navegador normal, ignora el evento (otra
 * instancia de Electron del mismo restaurante se encarga de imprimir).
 */
export function usePrintListener() {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const electronPrint = (window as any).electronPrint;
    if (!electronPrint?.isElectron) return; // solo en Electron

    const onComanda = async (payload: any) => {
      if (shouldSkip(payload?.printRequestId)) {
        console.log('[print:comanda] duplicado ignorado', payload?.printRequestId);
        return;
      }
      try {
        const result = await electronPrint.printComanda(payload);
        console.log('[print:comanda] result:', result);
      } catch (err: any) {
        console.error('[print:comanda] error:', err?.message || err);
      }
    };

    const onReceipt = async (payload: any) => {
      if (shouldSkip(payload?.printRequestId)) {
        console.log('[print:receipt] duplicado ignorado', payload?.printRequestId);
        return;
      }
      try {
        const result = await electronPrint.printReceipt(payload);
        console.log('[print:receipt] result:', result);
      } catch (err: any) {
        console.error('[print:receipt] error:', err?.message || err);
      }
    };

    socket.on('print:comanda', onComanda);
    socket.on('print:receipt', onReceipt);

    return () => {
      socket.off('print:comanda', onComanda);
      socket.off('print:receipt', onReceipt);
    };
  }, [socket]);
}
