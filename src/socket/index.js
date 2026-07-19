import { Server } from 'socket.io';
import logger from '../utils/logger.js';
import { socketCorsOptions } from '../config/cors.js';
import {
  authenticateSocket,
  revalidateSocketEvent,
} from './middleware/auth.socket.js';
import {
  registerMessageHandlers,
  registerPresenceHandlers,
} from './handlers/message.handler.js';
import { getOnlineUserIds } from './presence.store.js';

let ioInstance = null;

export function initializeSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: socketCorsOptions,
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.user.id}`);

    // Session revocation, password changes, and status changes must also stop
    // already-connected sockets, not only future handshakes.
    socket.use((_, next) => revalidateSocketEvent(socket, next));

    registerPresenceHandlers(io, socket);
    registerMessageHandlers(io, socket);

    socket.emit('presence:online-users', { userIds: getOnlineUserIds() });
  });

  ioInstance = io;
  return io;
}

export function getIO() {
  return ioInstance;
}

export function disconnectUserSockets(userId) {
  if (!ioInstance || !userId) return;
  ioInstance.in(`user:${userId}`).disconnectSockets(true);
}
