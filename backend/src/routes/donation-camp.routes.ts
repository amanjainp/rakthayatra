import { Router } from 'express';
import { donationCampController } from '../controllers/donation-camp.controller';
import { authenticate, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// 1. Create a camp (Blood Banks and Admins only)
router.post('/', authenticate, requireRoles(['BLOOD_BANK', 'ADMIN']), (req, res) =>
  donationCampController.create(req, res)
);

// 2. Update a camp (Blood Banks and Admins only)
router.patch('/:id', authenticate, requireRoles(['BLOOD_BANK', 'ADMIN']), (req, res) =>
  donationCampController.update(req, res)
);

// 3. Delete a camp (Admins only)
router.delete('/:id', authenticate, requireRoles(['ADMIN']), (req, res) =>
  donationCampController.delete(req, res)
);

// 4. Register volunteer (Authenticated users)
router.post('/:id/volunteer', authenticate, (req, res) =>
  donationCampController.registerVolunteer(req, res)
);

// 5. Register donor (Authenticated users - ownership checked in controller)
router.post('/:id/register-donor', authenticate, (req, res) =>
  donationCampController.registerDonor(req, res)
);

// 6. Associate hospital (Hospitals and Admins only)
router.post('/:id/associate-hospital', authenticate, requireRoles(['HOSPITAL', 'ADMIN']), (req, res) =>
  donationCampController.associateHospital(req, res)
);

// 7. Get camp statistics (Authenticated users)
router.get('/:id/stats', authenticate, (req, res) =>
  donationCampController.getStats(req, res)
);

// 8. Query/search camps list (Authenticated users)
router.get('/', authenticate, (req, res) =>
  donationCampController.list(req, res)
);

export default router;
