import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { JwtPayload } from '../types';

let io: Server;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      methods: ['GET', 'POST'],
    },
  });

  // Optional JWT auth: if provided, the socket joins tenant + user rooms.
  // Unauthenticated sockets still work (backward-compat with legacy clients).
  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth as any)?.token ||
      (typeof socket.handshake.headers.authorization === 'string'
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
        : undefined);
    if (!token) return next();
    try {
      const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
      (socket.data as any).userId = payload.userId;
      (socket.data as any).tenantId = payload.tenantId;
      if (payload.userId) socket.join(`user:${payload.userId}`);
      if (payload.tenantId) socket.join(`tenant:${payload.tenantId}`);
    } catch {
      // invalid token → still allow unauth connection
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join:floor', (floorId: string) => {
      socket.join(`floor:${floorId}`);
    });

    socket.on('join:kitchen', () => {
      socket.join('kitchen');
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function emitToUser(userId: number, event: string, payload?: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToTenant(tenantId: string | undefined | null, event: string, payload?: any) {
  if (!io) return;
  if (tenantId) io.to(`tenant:${tenantId}`).emit(event, payload);
  else io.emit(event, payload); // legacy fallback
}
