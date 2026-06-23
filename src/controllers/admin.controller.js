import adminService from '../services/admin.service.js';

class AdminController {
    // --- Concierge ---
    addStaff = async (req, res) => {
        try {
            const staff = await adminService.addConciergeStaff(req.body);
            res.status(201).json(staff);
        } catch (error) {
            if (error.message === 'A user with this email already exists' || error.code === 'P2002') {
                return res.status(409).json({ error: 'A user with this email already exists' });
            }
            res.status(400).json({ error: error.message });
        }
    };

    getStaff = async (req, res) => {
        const { page, limit } = req.query;
        const data = await adminService.getAllStaff(page, limit);
        res.status(200).json(data);
    };

    updateStaffStatus = async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        const updated = await adminService.updateStaffStatus(id, status);
        res.status(200).json(updated);
    };

    deleteStaff = async (req, res) => {
        try {
            const result = await adminService.deleteStaff(req.params.id);
            res.status(200).json(result);
        } catch (error) {
            if (error.message === 'Staff not found' || error.code === 'P2025') {
                return res.status(404).json({ success: false, message: 'Staff not found' });
            }
            res.status(400).json({ success: false, message: error.message });
        }
    };


    // Get individual concierge details
    getStaffDetails = async (req, res) => {
        try {
            const staff = await adminService.getStaffById(req.params.id);
            res.status(200).json(staff);
        } catch (error) {
            res.status(404).json({ error: "Staff not found" });
        }
    };

    // Full update of concierge info (PUT)
    updateStaff = async (req, res) => {
        try {
            const updated = await adminService.updateStaffDetails(req.params.id, req.body);
            res.status(200).json(updated);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    };
    // --- Members ---
    getMembers = async (req, res) => {
        const { page, limit } = req.query;
        const data = await adminService.getAllMembers(page, limit);
        res.status(200).json(data);
    };

    getMemberDetails = async (req, res) => {
        const member = await adminService.getMemberById(req.params.id);
        res.status(200).json(member);
    };
    updateMember = async (req, res) => {
        try {
            const { id } = req.params;
            const updated = await adminService.updateMember(id, req.body);
            res.status(200).json(updated);
        } catch (error) {
            logger.error(`Error updating member ${req.params.id}: ${error.message}`);
            res.status(400).json({ error: "Failed to update member information" });
        }
    };
}
export default new AdminController();