import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

/**
 * Escucha eventos de impresión emitidos por el server y los delega al
 * proceso Electron local que SÍ tiene acceso a las impresoras LAN/USB.
 *
 * Solo se activa en Electron. Al conectarse, se registra como print-host
 * en el server. El server elige el PRIMER cliente registrado por tenant
 * como primary y solo a él le manda los eventos. Esto evita duplicados
 * si hay múltiples Electrons del mismo restaurante conectados.
 */
export function usePrintListener() {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const electronPrint = (window as any).electronPrint;
    if (!electronPrint?.isElectron) return; // solo en Electron

    // Registrar al server que esta instancia puede imprimir local
    const registerSelf = () => socket.emit('register:print-host');
    if (socket.connected) registerSelf();
    socket.on('connect', registerSelf);

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
      socket.off('connect', registerSelf);
      socket.off('print:comanda', onComanda);
      socket.off('print:receipt', onReceipt);
    };
  }, [socket]);
}
