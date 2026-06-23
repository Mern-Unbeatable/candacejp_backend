import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

class AuthMiddleware {
  verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      logger.warn(`Unauthorized access attempt - No token: ${req.originalUrl}`);
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      logger.error(`Invalid or expired access token: ${error.message}`);
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  };

  requireRole = (allowedRoles) => {
    return (req, res, next) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        logger.warn(`Forbidden access attempt by role '${req.user?.role}' to ${req.originalUrl}`);
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      }
      next();
    };
  };
}
export default new AuthMiddleware();