import adminService from '../services/admin.service.js';
import { disconnectUserSockets } from '../socket/index.js';
import logger from '../utils/logger.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

class AdminController {
    // --- Concierge ---
    addStaff = async (req, res) => {
        try {
            const staff = await adminService.addConciergeStaff(req.body);
            return sendSuccess(res, 'Concierge staff created successfully.', staff, 201);
        } catch (error) {
            if (error.message === 'A user with this email already exists' || error.code === 'P2002') {
                return sendError(res, 'A user with this email already exists', 409);
            }
            return sendError(res, error.message, 400);
        }
    };

    getStaff = async (req, res) => {
        const { page, limit } = req.query;
        const data = await adminService.getAllStaff(page, limit);
        return sendSuccess(res, 'Concierge staff retrieved successfully.', data);
    };

    updateStaffStatus = async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const updated = await adminService.updateStaffStatus(id, status);
            if (status !== 'ACTIVE') {
                disconnectUserSockets(id);
            }
            return sendSuccess(res, 'Concierge staff status updated successfully.', updated);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    };

    deleteStaff = async (req, res) => {
        try {
            await adminService.deleteStaff(req.params.id);
            disconnectUserSockets(req.params.id);
            return sendSuccess(res, 'Concierge staff deleted successfully.');
        } catch (error) {
            if (error.message === 'Staff not found' || error.code === 'P2025') {
                return sendError(res, 'Staff not found', 404);
            }
            return sendError(res, error.message, 400);
        }
    };

    getStaffDetails = async (req, res) => {
        try {
            const staff = await adminService.getStaffById(req.params.id);
            if (!staff) {
                return sendError(res, 'Staff not found', 404);
            }
            return sendSuccess(res, 'Concierge staff retrieved successfully.', staff);
        } catch (error) {
            return sendError(res, 'Staff not found', 404);
        }
    };

    updateStaff = async (req, res) => {
        try {
            const updated = await adminService.updateStaffDetails(req.params.id, req.body);
            return sendSuccess(res, 'Concierge staff updated successfully.', updated);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    };

    // --- Members ---
    getMembers = async (req, res) => {
        const { page, limit } = req.query;
        const data = await adminService.getAllMembers(page, limit);
        return sendSuccess(res, 'Members retrieved successfully.', data);
    };

    getMemberDetails = async (req, res) => {
        try {
            const member = await adminService.getMemberById(req.params.id);
            if (!member) {
                return sendError(res, 'Member not found', 404);
            }
            return sendSuccess(res, 'Member retrieved successfully.', member);
        } catch (error) {
            return sendError(res, 'Member not found', 404);
        }
    };

    updateMember = async (req, res) => {
        try {
            const { id } = req.params;
            const updated = await adminService.updateMember(id, req.body);
            return sendSuccess(res, 'Member updated successfully.', updated);
        } catch (error) {
            logger.error(`Error updating member ${req.params.id}: ${error.message}`);
            return sendError(res, 'Failed to update member information', 400);
        }
    };

    getDashboardOverview = async (req, res) => {
        try {
            const data = await adminService.getDashboardOverview();
            return sendSuccess(res, 'Admin dashboard overview retrieved successfully.', data);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    };

    getMembersOverTime = async (req, res) => {
        try {
            const { year } = req.query;
            const data = await adminService.getMembersOverTime(year);
            return sendSuccess(res, 'Members over time retrieved successfully.', data);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    };

    getMonthlyActivity = async (req, res) => {
        try {
            const { year } = req.query;
            const data = await adminService.getMonthlyActivity(year);
            return sendSuccess(res, 'Monthly activity retrieved successfully.', data);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    };
}

export default new AdminController();
