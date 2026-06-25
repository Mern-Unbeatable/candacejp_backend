import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import adminController from '../controllers/admin.controller.js';

const router = Router();

router.use(authMiddleware.verifyToken, authMiddleware.requireRole(['ADMIN']));

// Dashboard
router.get('/dashboard/overview', adminController.getDashboardOverview);
router.get('/dashboard/members-over-time', adminController.getMembersOverTime);
router.get('/dashboard/monthly-activity', adminController.getMonthlyActivity);

// Concierge management
router.post('/concierge', adminController.addStaff);
router.get('/concierge', adminController.getStaff);
router.get('/concierge/:id', adminController.getStaffDetails);
router.put('/concierge/:id', adminController.updateStaff);
router.patch('/concierge/:id/status', adminController.updateStaffStatus);
router.delete('/concierge/:id', adminController.deleteStaff);

// Member management
router.get('/members', adminController.getMembers);
router.get('/members/:id', adminController.getMemberDetails);
router.put('/members/:id', adminController.updateMember);

export default router;
