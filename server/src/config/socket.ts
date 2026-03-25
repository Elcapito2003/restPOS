import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from './env';

let io: Server;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      methods: ['GET', 'POST'],
    },
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
