import memberService from '../services/member.service.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

class MemberController {
  getOpportunities = async (req, res) => {
    try {
      const { page = 1, limit = 10, direction } = req.query;
      const data = await memberService.getAvailableOpportunities(req.user.id, page, limit, { direction });
      return sendSuccess(res, 'Available opportunities retrieved successfully.', data);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };

  placeReservation = async (req, res) => {
    try {
      await memberService.placeReservation(req.user.id, req.params.id);
      return sendSuccess(res, 'Reservation placed successfully.', null, 201);
    } catch (error) {
      const status = error.message.includes('not found') ? 404 : 400;
      return sendError(res, error.message, status);
    }
  };

  getPendingReservations = async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const data = await memberService.getPendingReservations(req.user.id, page, limit);
      return sendSuccess(res, 'Pending reservations retrieved successfully.', data);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };

  getUpcomingTrips = async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const data = await memberService.getUpcomingTrips(req.user.id, page, limit);
      return sendSuccess(res, 'Upcoming trips retrieved successfully.', data);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };

  getReservationDetails = async (req, res) => {
    try {
      const data = await memberService.getReservationDetails(req.user.id, req.params.id);
      return sendSuccess(res, 'Reservation details retrieved successfully.', data);
    } catch (error) {
      return sendError(res, error.message, 404);
    }
  };

  cancelReservation = async (req, res) => {
    try {
      const data = await memberService.cancelReservation(req.user.id, req.params.id);
      return sendSuccess(res, 'Reservation cancelled successfully.', data);
    } catch (error) {
      const status = error.message === 'Reservation not found' ? 404 : 400;
      return sendError(res, error.message, status);
    }
  };

  getTravelPreferences = async (req, res) => {
    try {
      const data = await memberService.getTravelPreferences(req.user.id);
      return sendSuccess(res, 'Travel preferences retrieved successfully.', data);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };

  createTravelPreference = async (req, res) => {
    try {
      const data = await memberService.createTravelPreference(req.user.id, req.body);
      return sendSuccess(res, 'Travel preference added successfully.', data, 201);
    } catch (error) {
      return sendError(res, error.message, 400);
    }
  };

  deleteTravelPreference = async (req, res) => {
    try {
      await memberService.deleteTravelPreference(req.user.id, req.params.id);
      return sendSuccess(res, 'Travel preference deleted successfully.');
    } catch (error) {
      const status = error.message === 'Travel preference not found' ? 404 : 400;
      return sendError(res, error.message, status);
    }
  };
}

export default new MemberController();
