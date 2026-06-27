import { Router } from 'express';
import messageController from '../controllers/message.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import messageValidation from '../validations/message.validation.js';

const router = Router();

router.use(
  authMiddleware.verifyToken,
  authMiddleware.requireRole(['MEMBER', 'CONCIERGE'])
);

router.get('/conversations', messageController.getConversations);
router.get('/with/:userId', messageController.getMessagesWithUser);
router.patch('/seen', validate(messageValidation.markSeen), messageController.markMessagesSeen);

export default router;
