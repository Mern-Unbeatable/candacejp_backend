import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import logger from '../utils/logger.js';
import { getInactiveAccountMessage } from '../utils/accountStatus.js';
import { sendError } from '../utils/apiResponse.js';

class AuthMiddleware {
  verifyToken = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      logger.warn(`Unauthorized access attempt - No token: ${req.originalUrl}`);
      return sendError(res, 'Access denied. No token provided.', 401);
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, status: true },
      });

      if (!user) {
        return sendError(res, 'Invalid or expired token.', 401);
      }

      if (user.status !== 'ACTIVE') {
        logger.warn(`Inactive account access attempt: ${user.id} (${user.status})`);
        return sendError(res, getInactiveAccountMessage(user.role), 403);
      }

      req.user = user;
      next();
    } catch (error) {
      logger.error(`Invalid or expired access token: ${error.message}`);
      return sendError(res, 'Invalid or expired token.', 401);
    }
  };

  requireRole = (allowedRoles) => {
    return (req, res, next) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        logger.warn(`Forbidden access attempt by role '${req.user?.role}' to ${req.originalUrl}`);
        return sendError(res, 'Access denied. Insufficient permissions.', 403);
      }
      next();
    };
  };
}
export default new AuthMiddleware();