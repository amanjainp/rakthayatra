import { Router } from 'express';
import { bloodRequestController } from '../controllers/blood-request.controller';
import { authenticate, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// 1. Create a new blood request (Patients, Hospitals, and Admins)
router.post('/', authenticate, requireRoles(['PATIENT', 'HOSPITAL', 'ADMIN']), (req, res) =>
  bloodRequestController.create(req, res)
);

// 2. Approve request (Admins only)
router.post('/:id/approve', authenticate, requireRoles(['ADMIN']), (req, res) =>
  bloodRequestController.approve(req, res)
);

// 3. Reject request (Admins only)
router.post('/:id/reject', authenticate, requireRoles(['ADMIN']), (req, res) =>
  bloodRequestController.reject(req, res)
);

// 4. Fulfill request (Hospitals, Blood Banks, and Admins)
router.post('/:id/fulfill', authenticate, requireRoles(['HOSPITAL', 'BLOOD_BANK', 'ADMIN']), (req, res) =>
  bloodRequestController.fulfill(req, res)
);

// 5. Cancel request (Authenticated users - ownership checked in controller)
router.post('/:id/cancel', authenticate, (req, res) => bloodRequestController.cancel(req, res));

// 6. Get map coordinates (Authenticated users)
router.get('/map', authenticate, (req, res) => bloodRequestController.getMapLocations(req, res));

// 7. Search blood requests (Authenticated users)
router.get('/', authenticate, (req, res) => bloodRequestController.search(req, res));

// 7. Trigger expired requests sweep (Admins only)
router.post('/expiry-check', authenticate, requireRoles(['ADMIN']), (req, res) =>
  bloodRequestController.triggerExpiryCheck(req, res)
);

export default router;
