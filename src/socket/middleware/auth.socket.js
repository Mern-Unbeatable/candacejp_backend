import prisma from '../../lib/prisma.js';
import { auth } from '../../lib/auth.js';

async function resolveActiveSocketUser(token) {
  if (!token) return null;

  const sessionData = await auth.api.getSession({
    headers: new Headers({ Authorization: `Bearer ${token}` }),
  });

  if (!sessionData?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionData.user.id },
    select: {
      id: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  return user?.status === 'ACTIVE' ? user : null;
}

export async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token
      ?? socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const user = await resolveActiveSocketUser(token);
    if (!user) {
      return next(new Error('Unauthorized socket connection'));
    }

    socket.authToken = token;
    socket.user = user;
    return next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
}

export async function revalidateSocketEvent(socket, next) {
  try {
    const user = await resolveActiveSocketUser(socket.authToken);
    if (!user) {
      socket.disconnect(true);
      return next(new Error('Session expired or revoked'));
    }

    socket.user = user;
    return next();
  } catch {
    socket.disconnect(true);
    return next(new Error('Session validation failed'));
  }
}
