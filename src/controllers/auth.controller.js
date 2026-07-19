import authService from '../services/auth.service.js';
import { disconnectUserSockets } from '../socket/index.js';
import logger from '../utils/logger.js';
import { getInactiveAccountMessage } from '../utils/accountStatus.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

class AuthController {
  register = async (req, res) => {
    try {
      const result = await authService.register(req.body);
      logger.info(`User registered: ${result.user.email}`);
      return sendSuccess(res, 'Registration successful. Please complete payment.', result, 201);
    } catch (error) {
      logger.error(`Registration failed - Error: ${error.message}`);

      let status = 500;

      if (error.message === 'User already exists') {
        status = 409;
      } else if (error.message.startsWith('Missing required fields')) {
        status = 400;
      }

      return sendError(res, error.message, status);
    }
  };

  verifyPayment = async (req, res) => {
    const sessionId = req.body.session_id ?? req.body.sessionId;
    try {
      const result = await authService.verifyPayment(sessionId);
      logger.info(`Payment verified for user: ${result.user.id}`);
      return sendSuccess(res, 'Payment verified successfully.', result);
    } catch (error) {
      logger.error(`Payment verification failed - Error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  };

  login = async (req, res) => {
    const { email, password } = req.body;

    try {
      const result = await authService.login(email, password, req.headers);
      logger.info(`User logged in successfully: ${email}`);
      return sendSuccess(res, 'Login successful.', result);
    } catch (error) {
      const knownAuthErrors = new Set([
        'User not found',
        'Incorrect password',
        'PaymentRequired',
        'MemberAccountInactive',
        'AccountInactive',
      ]);

      if (!knownAuthErrors.has(error.message)) {
        const { explainDatabaseError, logDatabaseDiagnostics } = await import('../config/database.js');
        const isAuthSecretMissing =
          !process.env.BETTER_AUTH_SECRET
          && !process.env.JWT_ACCESS_SECRET;
        const dbIssue = isAuthSecretMissing
          ? {
            type: 'AUTH_SECRET_MISSING',
            hint:
              'Set BETTER_AUTH_SECRET (at least 32 random characters) in Coolify, then restart.',
          }
          : explainDatabaseError(error);

        console.error('========== LOGIN FAILURE DEBUG ==========');
        console.error(`[login] email=${email}`);
        console.error(`[login] errorName=${error?.name || 'Error'}`);
        console.error(`[login] errorCode=${error?.code || error?.meta?.code || '(none)'}`);
        console.error(`[login] errorMessage=${error?.message}`);
        console.error(`[login] dbIssueType=${dbIssue.type}`);
        console.error(`[login] hint=${dbIssue.hint}`);
        console.error(
          `[login] BETTER_AUTH_SECRET set=${Boolean(process.env.BETTER_AUTH_SECRET)} `
          + `legacyFallback set=${Boolean(process.env.JWT_ACCESS_SECRET)}`,
        );
        if (error?.stack) {
          console.error(`[login] stack=${error.stack}`);
        }
        logDatabaseDiagnostics('login');
        console.error('=========================================');

        logger.error(
          `Login failed for ${email} - [${dbIssue.type}] ${error.message} | hint: ${dbIssue.hint}`,
        );

        if (dbIssue.type === 'AUTH_SECRET_MISSING') {
          return sendError(
            res,
            'Server misconfigured: BETTER_AUTH_SECRET is missing.',
            500,
            { debugType: dbIssue.type },
          );
        }

        if (dbIssue.type === 'DB_AUTH_FAILED') {
          return sendError(
            res,
            'Database authentication failed. Check DATABASE_USER / DATABASE_PASSWORD on the server.',
            500,
            { debugType: dbIssue.type },
          );
        }

        if (dbIssue.type === 'DB_UNREACHABLE') {
          return sendError(
            res,
            'Database is unreachable. Check DATABASE_HOST / port / network access.',
            500,
            { debugType: dbIssue.type },
          );
        }

        return sendError(res, 'An unexpected error occurred during login.', 500, {
          debugType: dbIssue.type,
        });
      }

      logger.error(`Login failed for ${email} - Error: ${error.message}`);

      if (error.message === 'User not found') {
        return sendError(res, 'No account found with this email address.', 404);
      }

      if (error.message === 'Incorrect password') {
        return sendError(res, 'The password you entered is incorrect.', 401);
      }

      if (error.message === 'PaymentRequired') {
        return sendError(
          res,
          'Registration fee pending. Please complete your payment.',
          402,
          { requiresRegistration: true, requiresPayment: true }
        );
      }

      if (error.message === 'MemberAccountInactive') {
        return sendError(res, getInactiveAccountMessage('MEMBER'), 403);
      }

      if (error.message === 'AccountInactive') {
        return sendError(res, getInactiveAccountMessage('CONCIERGE'), 403);
      }

      return sendError(res, 'An unexpected error occurred during login.', 500);
    }
  };

  resumePayment = async (req, res) => {
    const { email, password } = req.body;

    try {
      const result = await authService.resumePayment(email, password);
      logger.info(`Payment checkout resumed for: ${email}`);
      return sendSuccess(res, 'Please complete your registration payment.', result);
    } catch (error) {
      logger.error(`Resume payment failed for ${email} - Error: ${error.message}`);

      if (error.message === 'User not found') {
        return sendError(res, 'No account found with this email address.', 404);
      }

      if (error.message === 'Incorrect password') {
        return sendError(res, 'The password you entered is incorrect.', 401);
      }

      if (error.message === 'Payment already completed') {
        return sendError(res, 'Your registration payment is already complete. Please log in.', 409);
      }

      if (error.message === 'Payment resume is only available for member accounts') {
        return sendError(res, error.message, 403);
      }

      if (error.message === 'MemberAccountInactive') {
        return sendError(res, getInactiveAccountMessage('MEMBER'), 403);
      }

      return sendError(res, 'Unable to start payment checkout.', 400);
    }
  };

  refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    try {
      const result = await authService.refreshAccessToken(refreshToken);
      logger.info('Access token refreshed successfully');
      return sendSuccess(res, 'Token refreshed successfully.', result);
    } catch (error) {
      logger.warn(`Failed token refresh attempt: ${error.message}`);

      if (error.message === 'MemberAccountInactive') {
        return sendError(res, getInactiveAccountMessage('MEMBER'), 403);
      }

      if (error.message === 'AccountInactive') {
        return sendError(res, getInactiveAccountMessage('CONCIERGE'), 403);
      }

      return sendError(res, error.message, 403);
    }
  };

  forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
      const result = await authService.forgotPassword(email);
      logger.info(`Password reset OTP requested for: ${email}`);
      return sendSuccess(res, result.message, result);
    } catch (error) {
      logger.error(`Forgot password failed for ${email} - Error: ${error.message}`);
      return sendError(res, 'Unable to process password reset request.', 500);
    }
  };

  verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
      const result = await authService.verifyOtp(email, otp);
      logger.info(`Password reset OTP verified for: ${email}`);
      return sendSuccess(res, 'Verification successful.', result);
    } catch (error) {
      logger.warn(`OTP verification failed for ${email} - Error: ${error.message}`);

      if (error.message === 'Invalid OTP' || error.message === 'Invalid or expired OTP') {
        return sendError(res, 'The verification code is invalid or has expired.', 400);
      }

      return sendError(res, 'Unable to verify code.', 500);
    }
  };

  resetPassword = async (req, res) => {
    const { resetToken, password } = req.body;

    try {
      const result = await authService.resetPassword(resetToken, password);
      disconnectUserSockets(result.userId);
      logger.info('Password reset completed successfully');
      return sendSuccess(res, 'Password reset successfully.');
    } catch (error) {
      logger.warn(`Password reset failed - Error: ${error.message}`);

      if (error.message === 'Invalid or expired reset token') {
        return sendError(res, 'Your reset link has expired. Please start again.', 400);
      }

      return sendError(res, 'Unable to reset password.', 500);
    }
  };
}

export default new AuthController();
