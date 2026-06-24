import { Router } from 'express';
import staffController from '../controllers/staff.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import staffValidation from '../validations/staff.validation.js';

const router = Router();
router.use(authMiddleware.verifyToken, authMiddleware.requireRole(['ADMIN', 'CONCIERGE']));

router.post('/opportunities', validate(staffValidation.createOpportunity), staffController.create);
router.get('/opportunities', staffController.getAll);
router.get('/opportunities/:id', staffController.getDetails);
router.put('/opportunities/:id', validate(staffValidation.editOpportunity), staffController.edit);
router.patch('/opportunities/:id/publish', staffController.publish);
router.patch('/opportunities/:id/status', validate(staffValidation.updateOpportunityStatus), staffController.updateStatus);

export default router;