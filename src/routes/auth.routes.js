import express from 'express';
import authController from '../controllers/auth.controller.js';
import validate from '../middlewares/validate.middleware.js';
import authValidation from '../validations/auth.validation.js';

const router = express.Router();

router.post('/register', validate(authValidation.register), authController.register);
router.post('/verify-payment', authController.verifyPayment);
router.post('/login', validate(authValidation.login), authController.login);
router.post('/refresh', authController.refreshToken); // <-- New route

export default router;