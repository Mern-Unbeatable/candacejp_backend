import express from 'express';
import authController from '../controllers/auth.controller.js';
import validate from '../middlewares/validate.middleware.js';
import authValidation from '../validations/auth.validation.js';

const router = express.Router();

router.post('/register', validate(authValidation.register), authController.register);
router.post('/verify-payment', authController.verifyPayment);
router.post('/login', validate(authValidation.login), authController.login);
router.post('/resume-payment', validate(authValidation.resumePayment), authController.resumePayment);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', validate(authValidation.forgotPassword), authController.forgotPassword);
router.post('/verify-otp', validate(authValidation.verifyOtp), authController.verifyOtp);
router.post('/reset-password', validate(authValidation.resetPassword), authController.resetPassword);

export default router;
