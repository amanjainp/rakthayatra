import { Router } from 'express';
import { donationController } from '../controllers/donation.controller';
import { authenticate, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// 1. Register donation appointment (Donors, Blood Banks, and Admins)
router.post('/', authenticate, requireRoles(['DONOR', 'BLOOD_BANK', 'ADMIN']), (req, res) =>
  donationController.register(req, res)
);

// 2. Complete donation (Blood Banks & Admins only)
router.post('/:id/complete', authenticate, requireRoles(['BLOOD_BANK', 'ADMIN']), (req, res) =>
  donationController.complete(req, res)
);

// 3. Cancel appointment (Donors, Blood Banks, and Admins)
router.post('/:id/cancel', authenticate, requireRoles(['DONOR', 'BLOOD_BANK', 'ADMIN']), (req, res) =>
  donationController.cancel(req, res)
);

// Get verified blood banks list
router.get('/blood-banks', authenticate, (req, res) => donationController.getBloodBanks(req, res));

// 4. Retrieve donor donation history (Authenticated users)
router.get('/donor/:id', authenticate, (req, res) => donationController.getHistory(req, res));

// 5. Retrieve donor donation statistics (Authenticated users)
router.get('/donor/:id/stats', authenticate, (req, res) => donationController.getStats(req, res));

export default router;
