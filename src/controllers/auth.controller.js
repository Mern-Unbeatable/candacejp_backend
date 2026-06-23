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
      
      // Dynamically set the correct HTTP status code
      let status = 500; // Default to server error
      
      if (error.message === 'User already exists') {
        status = 409; // Conflict
      } else if (error.message.startsWith('Missing required fields')) {
        status = 400; // Bad Request (User error)
      }
      
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
      
      // Dynamically set the correct HTTP status code based on the specific error
      if (error.message === 'User not found') {
        // 404 Not Found is the standard code when a resource (the user) doesn't exist
        return res.status(404).json({ error: "No account found with this email address." });
      } 
      
      if (error.message === 'Incorrect password') {
        // 401 Unauthorized is the standard code for bad authentication
        return res.status(401).json({ error: "The password you entered is incorrect." });
      } 
      
      if (error.message === "PaymentRequired") {
        // 402 Payment Required
        return res.status(402).json({ error: "Registration fee pending. Please complete your payment." });
      }
      
      // Fallback for any other unexpected database or server errors
      return res.status(500).json({ error: "An unexpected error occurred during login." });
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