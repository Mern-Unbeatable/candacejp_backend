import { Router } from 'express';
import memberController from '../controllers/member.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();
const { verifyToken, requireRole } = authMiddleware;

router.use(verifyToken, requireRole(['MEMBER']));

router.get('/opportunities', memberController.getOpportunities);
router.post('/opportunities/:id/reservations', memberController.placeReservation);
router.get('/reservations/pending', memberController.getPendingReservations);
router.get('/reservations/upcoming', memberController.getUpcomingTrips);
router.get('/reservations/:id', memberController.getReservationDetails);
router.patch('/reservations/:id/cancel', memberController.cancelReservation);

export default router;
