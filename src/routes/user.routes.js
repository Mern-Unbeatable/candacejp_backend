import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import userValidation from '../validations/user.validation.js';

const router = Router();
router.use(authMiddleware.verifyToken); // All user routes require login

router.get('/me', userController.getMyProfile);
router.put('/profile', userController.updateProfile);
router.put('/change-password', validate(userValidation.changePassword), userController.updatePassword);

export default router;