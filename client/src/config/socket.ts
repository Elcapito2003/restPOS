import { io, Socket } from 'socket.io-client';
import { serverUrl } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = serverUrl || window.location.origin;
    console.log('[socket] creando socket (auth como callback)');
    socket = io(url, {
      autoConnect: false,
      // auth como callback se ejecuta en cada conexión/reconexión, garantizando
      // que siempre usamos el token actual del localStorage. Sin esto, cuando
      // socket.io reconecta automáticamente, podría usar un token viejo o
      // ninguno, dejando el handshake sin tenantId.
      auth: (cb: (data: any) => void) => {
        const token = localStorage.getItem('token');
        console.log('[socket] handshake auth callback. tieneToken:', !!token);
        cb({ token: token || undefined });
      },
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    console.log('[socket] connect()');
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
