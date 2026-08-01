import { Router } from 'express';
import { medicalEligibilityController } from '../controllers/medical-eligibility.controller';
import { authenticate, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// 1. Submit eligibility questionnaire (Donors, Blood Banks, and Admins)
router.post('/', authenticate, requireRoles(['DONOR', 'BLOOD_BANK', 'ADMIN']), (req, res) =>
  medicalEligibilityController.submit(req, res)
);

// 2. Retrieve donor current eligibility state (Authenticated users)
router.get('/donor/:id', authenticate, (req, res) => medicalEligibilityController.getStatus(req, res));

// 3. Retrieve historical questionnaire updates (Authenticated users)
router.get('/donor/:id/history', authenticate, (req, res) => medicalEligibilityController.getHistory(req, res));

export default router;
