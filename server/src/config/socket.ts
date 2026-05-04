import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { JwtPayload } from '../types';

let io: Server;

// Registro de "print hosts" — instancias Electron que pueden imprimir local.
// Solo el primero por tenant recibe los eventos de impresión, evitando duplicados
// cuando hay múltiples Electrons del mismo restaurante conectados (PC del local + laptop, etc.).
const printHostsByTenant = new Map<string, string[]>(); // tenantId → [socketId, ...]

function registerPrintHost(socketId: string, tenantId: string) {
  const list = printHostsByTenant.get(tenantId) || [];
  if (!list.includes(socketId)) {
    list.push(socketId);
    printHostsByTenant.set(tenantId, list);
    console.log(`[print-host] registered ${socketId} for tenant ${tenantId} (total: ${list.length})`);
  }
}

function unregisterPrintHost(socketId: string) {
  for (const [tid, list] of printHostsByTenant) {
    const idx = list.indexOf(socketId);
    if (idx !== -1) {
      list.splice(idx, 1);
      console.log(`[print-host] unregistered ${socketId} from tenant ${tid} (remaining: ${list.length})`);
      if (list.length === 0) printHostsByTenant.delete(tid);
    }
  }
}

export function getPrimaryPrintHost(tenantId: string): string | null {
  const list = printHostsByTenant.get(tenantId);
  return list && list.length > 0 ? list[0] : null;
}

/**
 * Emite un evento de impresión SOLO al primary print host del tenant (primera
 * instancia Electron registrada). Evita duplicados cuando hay múltiples
 * instancias conectadas. Si no hay print host registrado, hace broadcast al
 * room del tenant como fallback (algún cliente puede imprimir).
 */
export function emitPrintToTenant(tenantId: string | undefined | null, event: string, payload: any) {
  if (!io) return;
  if (tenantId) {
    const primary = getPrimaryPrintHost(tenantId);
    if (primary) {
      io.to(primary).emit(event, payload);
      return;
    }
    // Fallback: broadcast al room del tenant (algún navegador podría escuchar)
    io.to(`tenant:${tenantId}`).emit(event, payload);
  } else {
    io.emit(event, payload); // legacy
  }
}

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

    // Cliente Electron se anuncia como capaz de imprimir local.
    // El server sólo manda print:comanda al primary (primero registrado por tenant).
    socket.on('register:print-host', () => {
      const tid = (socket.data as any).tenantId as string | undefined;
      if (tid) registerPrintHost(socket.id, tid);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      unregisterPrintHost(socket.id);
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
