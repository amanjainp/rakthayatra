import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller';
import { authenticate, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// 1. Search blood stocks (Authenticated users)
router.get('/', authenticate, (req, res) => inventoryController.search(req, res));

// 2. Register blood units (Blood Banks & Admins)
router.post('/', authenticate, requireRoles(['BLOOD_BANK', 'ADMIN']), (req, res) =>
  inventoryController.register(req, res)
);

// 3. Reserve units (Hospitals, Blood Banks & Admins)
router.post('/reserve', authenticate, requireRoles(['HOSPITAL', 'BLOOD_BANK', 'ADMIN']), (req, res) =>
  inventoryController.reserve(req, res)
);

// 4. Release units (Blood Banks & Admins only)
router.post('/release/:id', authenticate, requireRoles(['BLOOD_BANK', 'ADMIN']), (req, res) =>
  inventoryController.release(req, res)
);

// 5. Trigger scan for expired units (Admins only)
router.post('/expiry-check', authenticate, requireRoles(['ADMIN']), (req, res) =>
  inventoryController.triggerExpiryCheck(req, res)
);

// 6. Trigger sweep for expired reservations (Admins only)
router.post('/reservations-sweep', authenticate, requireRoles(['ADMIN']), (req, res) =>
  inventoryController.triggerReservationsSweep(req, res)
);

export default router;
