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

router.get('/dashboard/summary', staffOnly, staffController.getDashboardSummary);
router.get('/dashboard/calendar', staffOnly, staffController.getDashboardCalendar);

router.get('/member-interests', staffOnly, staffController.getMemberInterests);
router.delete('/member-interests/:id', staffOnly, staffController.deleteMemberInterest);
router.patch('/member-interests/:id/confirm', staffOnly, staffController.confirmMemberInterest);

router.get('/travel-preferences', staffOnly, staffController.getTravelPreferences);
router.get('/travel-preferences/:id', staffOnly, staffController.getTravelPreferenceDetails);
router.patch(
    '/travel-preferences/:id/status',
    staffOnly,
    validate(staffValidation.updateTravelPreferenceStatus),
    staffController.updateTravelPreferenceStatus,
);

router.patch('/reservations/:id/confirm', staffOnly, staffController.confirmReservation);

router.post('/opportunities', staffOnly, validate(staffValidation.createOpportunity), staffController.create);
router.get('/opportunities', staffOnly, staffController.getAll);
router.get('/opportunities/:id', staffOnly, staffController.getDetails);
router.put('/opportunities/:id', staffOnly, validate(staffValidation.editOpportunity), staffController.edit);
router.patch('/opportunities/:id/publish', staffOnly, staffController.publish);
router.patch('/opportunities/:id/status', staffOnly, validate(staffValidation.updateOpportunityStatus), staffController.updateStatus);

export default router;
