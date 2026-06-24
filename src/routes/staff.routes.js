import { Router } from 'express';
import staffController from '../controllers/staff.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import staffValidation from '../validations/staff.validation.js';

const router = Router();
const { verifyToken, requireRole } = authMiddleware;
const adminOrStaff = requireRole(['ADMIN', 'CONCIERGE']);
const staffOnly = requireRole(['CONCIERGE']);

router.use(verifyToken);

router.get('/dashboard/summary', adminOrStaff, staffController.getDashboardSummary);
router.get('/dashboard/calendar', adminOrStaff, staffController.getDashboardCalendar);

router.post('/opportunities', staffOnly, validate(staffValidation.createOpportunity), staffController.create);
router.get('/opportunities', adminOrStaff, staffController.getAll);
router.get('/opportunities/:id', adminOrStaff, staffController.getDetails);
router.put('/opportunities/:id', staffOnly, validate(staffValidation.editOpportunity), staffController.edit);
router.patch('/opportunities/:id/publish', staffOnly, staffController.publish);
router.patch('/opportunities/:id/status', staffOnly, validate(staffValidation.updateOpportunityStatus), staffController.updateStatus);

export default router;
