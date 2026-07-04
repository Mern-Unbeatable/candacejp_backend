import staffService from '../services/staff.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

class StaffController {
    create = async (req, res) => {
        try {
            // req.body now matches your UI: origin, destination, tripType, 
            // departureDate, estimatedPrice, aircraftType, totalCapacity, status
            const data = await staffService.createOpportunity(req.body, req.user.id);
            return sendSuccess(res, 'Opportunity created successfully', data, 201);
        } catch (e) {
            return sendError(res, e.message, 400);
        }
    }

    getAll = async (req, res) => {
        try {
            const { page = 1, limit = 10, direction = 'all', status = 'all' } = req.query;
            const data = await staffService.getAllOpportunities(page, limit, { direction, status });
            return sendSuccess(res, 'Opportunities retrieved successfully.', data);
        } catch (e) { return sendError(res, e.message, 400); }
    };

    getDetails = async (req, res) => {
        try {
            const data = await staffService.getOpportunityDetails(req.params.id);
            return data ? sendSuccess(res, 'Details retrieved', data) : sendError(res, 'Not found', 404);
        } catch (e) { return sendError(res, e.message, 400); }
    };

    edit = async (req, res) => {
        try {
            const data = await staffService.editDraftOpportunity(req.params.id, req.body);
            return sendSuccess(res, 'Opportunity updated', data);
        } catch (e) { return sendError(res, e.message, 400); }
    };

    publish = async (req, res) => {
        try {
            const data = await staffService.publishOpportunity(req.params.id);
            return sendSuccess(res, 'Opportunity is now Open for Reservation', data);
        } catch (e) { return sendError(res, e.message, 400); }
    };

    updateStatus = async (req, res) => {
        try {
            const data = await staffService.updateReservationStatus(req.params.id, req.body.status);
            return sendSuccess(res, `Status updated to ${req.body.status}`, data);
        } catch (e) { return sendError(res, e.message, 400); }
    };

    getDashboardSummary = async (req, res) => {
        try {
            const data = await staffService.getDashboardSummary();
            return sendSuccess(res, 'Dashboard summary retrieved successfully.', data);
        } catch (e) {
            return sendError(res, e.message, 400);
        }
    };

    getDashboardCalendar = async (req, res) => {
        try {
            const {
                month,
                year,
                from,
                to,
                startDate,
                endDate,
                direction,
                date,
                interestId,
            } = req.query;

            const data = await staffService.getDashboardCalendar({
                month,
                year,
                startDate: from || startDate,
                endDate: to || endDate,
                direction,
                date,
                interestId,
            });
            return sendSuccess(res, 'Dashboard calendar data retrieved successfully.', data);
        } catch (e) {
            const status = e.message === 'Interest not found' ? 404 : 400;
            return sendError(res, e.message, status);
        }
    };

    getMemberInterests = async (req, res) => {
        try {
            const { page = 1, limit = 10, direction = 'all', status = 'all' } = req.query;
            const data = await staffService.getMemberInterests(page, limit, { direction, status });
            return sendSuccess(res, 'Member interests retrieved successfully.', data);
        } catch (e) {
            return sendError(res, e.message, 400);
        }
    };

    deleteMemberInterest = async (req, res) => {
        try {
            await staffService.deleteMemberInterest(req.params.id);
            return sendSuccess(res, 'Member interest deleted successfully.');
        } catch (e) {
            const status = e.message === 'Member interest not found' ? 404 : 400;
            return sendError(res, e.message, status);
        }
    };

    confirmMemberInterest = async (req, res) => {
        try {
            const data = await staffService.confirmMemberInterest(req.params.id);
            return sendSuccess(res, 'Member interest confirmed successfully.', data);
        } catch (e) {
            const status = e.message === 'Member interest not found' ? 404 : 400;
            return sendError(res, e.message, status);
        }
    };

    getTravelPreferences = async (req, res) => {
        try {
            const {
                page = 1,
                limit = 10,
                type,
                direction = 'all',
                status = 'all',
                search = '',
            } = req.query;
            const data = await staffService.getTravelPreferences(page, limit, {
                type,
                direction,
                status,
                search,
            });
            return sendSuccess(res, 'Travel preferences retrieved successfully.', data);
        } catch (e) {
            return sendError(res, e.message, 400);
        }
    };

    getTravelPreferenceDetails = async (req, res) => {
        try {
            const data = await staffService.getTravelPreferenceDetails(req.params.id);
            return sendSuccess(res, 'Travel preference details retrieved successfully.', data);
        } catch (e) {
            const status = e.message === 'Travel preference not found' ? 404 : 400;
            return sendError(res, e.message, status);
        }
    };

    updateTravelPreferenceStatus = async (req, res) => {
        try {
            const data = await staffService.updateTravelPreferenceStatus(req.params.id, req.body.status);
            return sendSuccess(res, `Travel preference status updated to ${data.status}.`, data);
        } catch (e) {
            const status = e.message === 'Travel preference not found' ? 404 : 400;
            return sendError(res, e.message, status);
        }
    };

    confirmReservation = async (req, res) => {
        try {
            const data = await staffService.confirmReservation(req.params.id);
            return sendSuccess(res, 'Reservation confirmed successfully.', data);
        } catch (e) {
            const status = e.message === 'Reservation not found' ? 404 : 400;
            return sendError(res, e.message, status);
        }
    };
}
export default new StaffController();