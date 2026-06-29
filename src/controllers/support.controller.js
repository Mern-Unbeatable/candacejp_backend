import supportService from '../services/support.service.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

class SupportController {
  create = async (req, res) => {
    try {
      const data = await supportService.create(req.body);
      return sendSuccess(res, 'Your message has been sent successfully.', data, 201);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };

  getAll = async (req, res) => {
    try {
      const { page = 1, limit = 10, status = 'all' } = req.query;
      const data = await supportService.getAll(page, limit, status);
      return sendSuccess(res, 'Support requests retrieved successfully.', data);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };

  getById = async (req, res) => {
    try {
      const data = await supportService.getById(req.params.id);
      return sendSuccess(res, 'Support request retrieved successfully.', data);
    } catch (error) {
      if (error.message === 'Support request not found') {
        return sendError(res, error.message, 404);
      }
      return sendError(res, error.message, 400);
    }
  };

  updateStatus = async (req, res) => {
    try {
      const data = await supportService.updateStatus(req.params.id, req.body.status);
      return sendSuccess(res, 'Support request marked as solved.', data);
    } catch (error) {
      if (error.message === 'Support request not found') {
        return sendError(res, error.message, 404);
      }
      return sendError(res, error.message, 400);
    }
  };

  delete = async (req, res) => {
    try {
      await supportService.delete(req.params.id);
      return sendSuccess(res, 'Support request deleted successfully.');
    } catch (error) {
      if (error.message === 'Support request not found') {
        return sendError(res, error.message, 404);
      }
      return sendError(res, error.message, 400);
    }
  };
}

export default new SupportController();
