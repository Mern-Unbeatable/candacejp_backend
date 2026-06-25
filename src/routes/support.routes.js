import { Router } from 'express';
import supportController from '../controllers/support.controller.js';
import validate from '../middlewares/validate.middleware.js';
import supportValidation from '../validations/support.validation.js';

const router = Router();

router.post('/', validate(supportValidation.create), supportController.create);

export default router;
