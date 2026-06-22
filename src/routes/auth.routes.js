import express from 'express';
import authController from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/verify-payment', authController.verifyPayment);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken); // <-- New route

export default router;