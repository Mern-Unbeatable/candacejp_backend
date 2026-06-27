import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma.js';

export async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token
      ?? socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, status: true, firstName: true, lastName: true, email: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return next(new Error('Unauthorized socket connection'));
    }

    socket.user = user;
    return next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
}
