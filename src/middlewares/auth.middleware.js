import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

class AuthMiddleware {
  verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      logger.warn(`Unauthorized access attempt - No token: ${req.originalUrl}`);
      return sendError(res, 'Access denied. No token provided.', 401);
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      req.user = decoded;
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