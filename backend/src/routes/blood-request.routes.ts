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

// 6. Delete request (Authenticated users - ownership checked in controller)
router.delete('/:id', authenticate, (req, res) => bloodRequestController.delete(req as any, res));

// Get intelligent matches (Hospitals, Patients, Admins)
router.get('/:id/matches', authenticate, requireRoles(['HOSPITAL', 'PATIENT', 'ADMIN']), (req, res) =>
  bloodRequestController.getMatches(req, res)
);

// 6. Get map coordinates (Authenticated users)
router.get('/map', authenticate, (req, res) => bloodRequestController.getMapLocations(req, res));

// Get human readable address from coords
router.get('/reverse-geocode', authenticate, (req, res) => bloodRequestController.reverseGeocode(req, res));

// 7. Search blood requests (Authenticated users)
router.get('/', authenticate, (req, res) => bloodRequestController.search(req, res));

// Hospital Requisition to Blood Bank
router.post('/hospital-requisition', authenticate, requireRoles(['HOSPITAL', 'ADMIN']), (req, res) =>
  bloodRequestController.createHospitalRequisition(req as any, res)
);

// Blood Bank Process Requisition
router.post('/:id/process-requisition', authenticate, requireRoles(['BLOOD_BANK', 'ADMIN']), (req, res) =>
  bloodRequestController.processRequisition(req as any, res)
);

// Hospital Emergency Radius Broadcast
router.post('/emergency-broadcast', authenticate, requireRoles(['HOSPITAL', 'ADMIN']), (req, res) =>
  bloodRequestController.emergencyBroadcast(req as any, res)
);

// Donor Respond to Emergency Alert
router.post('/:id/donor-respond', authenticate, requireRoles(['DONOR']), (req, res) =>
  bloodRequestController.donorRespond(req as any, res)
);

// Get Hospital's Requisitions
router.get('/hospital-requisitions', authenticate, requireRoles(['HOSPITAL', 'ADMIN']), (req, res) =>
  bloodRequestController.getHospitalRequisitions(req as any, res)
);

// Get Blood Bank's Incoming Requisitions
router.get('/bloodbank-incoming', authenticate, requireRoles(['BLOOD_BANK', 'ADMIN']), (req, res) =>
  bloodRequestController.getIncomingBloodBankRequisitions(req as any, res)
);

// Get Donor's Emergency Alerts within Radius
router.get('/donor-emergency-alerts', authenticate, requireRoles(['DONOR']), (req, res) =>
  bloodRequestController.getDonorEmergencyAlerts(req as any, res)
);

// 7. Trigger expired requests sweep (Admins only)
router.post('/expiry-check', authenticate, requireRoles(['ADMIN']), (req, res) =>
  bloodRequestController.triggerExpiryCheck(req, res)
);

export default router;
