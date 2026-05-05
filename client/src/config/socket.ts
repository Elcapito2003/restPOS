import { io, Socket } from 'socket.io-client';
import { serverUrl } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = serverUrl || window.location.origin;
    const token = localStorage.getItem('token');
    console.log('[socket] creando socket nuevo. tieneToken:', !!token);
    socket = io(url, {
      autoConnect: false,
      auth: { token: token || undefined },
    });
  }
  return socket;
}

/**
 * Conecta el socket con el token actual del localStorage. Si ya hay un socket
 * activo creado con un token diferente (o sin token), lo destruye y crea uno
 * nuevo. socket.io-client envía auth solo en el handshake inicial — cambiar
 * `s.auth` después de conectado NO se propaga al server, por eso recreamos.
 */
export function connectSocket() {
  const token = localStorage.getItem('token');
  // Si ya hay socket pero el token cambió o está conectado con auth viejo, recrear
  if (socket) {
    const currentToken = (socket.auth as any)?.token;
    if (currentToken !== token) {
      console.log('[socket] token cambió, recreando socket');
      socket.disconnect();
      socket = null;
    }
  }
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
