import { Router } from 'express';
import notificationController from '../controllers/notification.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();
const { verifyToken, requireRole } = authMiddleware;

router.use(verifyToken, requireRole(['MEMBER']));

router.get('/', notificationController.getAll);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

export default router;
