import { io, Socket } from 'socket.io-client';
import { serverUrl } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = serverUrl || window.location.origin;
    const token = localStorage.getItem('token');
    socket = io(url, {
      autoConnect: false,
      auth: { token: token || undefined },
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  // Refrescar el token por si cambió desde la última conexión (login/logout/token expirado).
  // Sin esto, el server NO recibe tenantId y register:print-host se ignora silenciosamente.
  const token = localStorage.getItem('token');
  (s.auth as any) = { token: token || undefined };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
