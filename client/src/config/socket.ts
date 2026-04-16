import { io, Socket } from 'socket.io-client';
import { serverUrl } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = serverUrl || window.location.origin;
    socket = io(url, {
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
