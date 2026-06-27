import { Server } from 'socket.io';
import logger from '../utils/logger.js';
import { socketCorsOptions } from '../config/cors.js';
import { authenticateSocket } from './middleware/auth.socket.js';
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
