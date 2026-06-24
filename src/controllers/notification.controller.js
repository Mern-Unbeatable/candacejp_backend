import notificationService from '../services/notification.service.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

class NotificationController {
  getAll = async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const data = await notificationService.getMemberNotifications(req.user.id, page, limit);
      return sendSuccess(res, 'Notifications retrieved successfully.', data);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };

  markAsRead = async (req, res) => {
    try {
      const data = await notificationService.markAsRead(req.user.id, req.params.id);
      return sendSuccess(res, 'Notification marked as read.', data);
    } catch (error) {
      const status = error.message === 'Notification not found' ? 404 : 400;
      return sendError(res, error.message, status);
    }
  };

  markAllAsRead = async (req, res) => {
    try {
      await notificationService.markAllAsRead(req.user.id);
      return sendSuccess(res, 'All notifications marked as read.');
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };
}

export default new NotificationController();
