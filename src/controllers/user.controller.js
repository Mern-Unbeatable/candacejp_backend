import userService from '../services/user.service.js';
import { disconnectUserSockets } from '../socket/index.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

class UserController {
  // Get logged-in user profile
  getMyProfile = async (req, res) => {
    try {
      // req.user.id comes from your verifyToken middleware
      const profile = await userService.getProfileById(req.user.id);
      if (!profile) return sendError(res, 'User not found', 404);
      return sendSuccess(res, 'Profile retrieved successfully', profile);
    } catch (error) {
      return sendError(res, error.message, 500);
    }
  };

  updateProfile = async (req, res) => {
    try {
      const updated = await userService.updateProfile(req.user.id, req.body);
      return sendSuccess(res, 'Profile updated successfully', updated);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };

  updatePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await userService.updatePassword(req.user.id, currentPassword, newPassword);
      disconnectUserSockets(req.user.id);
      return sendSuccess(res, 'Password changed successfully');
    } catch (error) {
      if (error.message === 'Current password is incorrect') {
        return sendError(res, error.message, 401);
      }
      return sendError(res, error.message, 400);
    }
  };
}
export default new UserController();