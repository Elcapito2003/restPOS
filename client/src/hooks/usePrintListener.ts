import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

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
      try {
        const result = await electronPrint.printComanda(payload);
        console.log('[print:comanda] result:', result);
      } catch (err: any) {
        console.error('[print:comanda] error:', err?.message || err);
      }
    };

    const onReceipt = async (payload: any) => {
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
