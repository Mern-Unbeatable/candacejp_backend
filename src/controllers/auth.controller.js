import authService from '../services/auth.service.js';
import logger from '../utils/logger.js';

class AuthController {
  register = async (req, res) => {
    try {
      const result = await authService.register(req.body);
      logger.info(`User registered: ${result.user.email}`);
      return res.status(201).json(result);
    } catch (error) {
      logger.error(`Registration failed - Error: ${error.message}`);
      const status = error.message === 'User already exists' ? 409 : 500;
      return res.status(status).json({ error: error.message });
    }
  };

  verifyPayment = async (req, res) => {
    const sessionId = req.body.session_id ?? req.body.sessionId;
    try {
      const result = await authService.verifyPayment(sessionId);
      logger.info(`Payment verified for user: ${result.user.id}`);
      return res.status(200).json(result);
    } catch (error) {
      logger.error(`Payment verification failed - Error: ${error.message}`);
      return res.status(400).json({ error: error.message });
    }
  };

  login = async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await authService.login(email, password);
      logger.info(`User logged in successfully: ${email}`);
      return res.status(200).json(result);
    } catch (error) {
      logger.error(`Login failed for ${email} - Error: ${error.message}`);
      if (error.message === "PaymentRequired") {
        return res.status(402).json({ error: "Registration fee pending." });
      }
      return res.status(401).json({ error: error.message });
    }
  };

  refreshToken = async (req, res) => {
    // The refresh token is usually sent in the body or a secure HttpOnly cookie
    const { refreshToken } = req.body; 
    
    try {
      const result = await authService.refreshAccessToken(refreshToken);
      logger.info(`Access token refreshed successfully`);
      return res.status(200).json(result);
    } catch (error) {
      logger.warn(`Failed token refresh attempt: ${error.message}`);
      // 403 is standard for a failed refresh (they need to log in again)
      return res.status(403).json({ error: error.message }); 
    }
  };
}

export default new AuthController();