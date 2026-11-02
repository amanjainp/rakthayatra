import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRoles } from '../middlewares/auth.middleware';
import { redistributionController } from '../controllers/redistribution.controller';

const router = Router();

const isDev = process.env.NODE_ENV !== 'production';
const isLocalOrDev = (req: any) => {
  if (isDev) return true;
  const ip = req.ip || req.connection?.remoteAddress || '';
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('127.') ||
    ip === 'localhost'
  );
};

const redistributionMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 2000 : 120,
  skip: (req) => isLocalOrDev(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many redistribution operations from this IP. Please try again later.',
    },
  },
});

const allowedRoles = ['HOSPITAL', 'BLOOD_BANK', 'ADMIN'];

// Dashboard & Overview
router.get(
  '/',
  authenticate,
  requireRoles(allowedRoles),
  (req, res) => redistributionController.listDashboard(req, res)
);

// Institutional Inventory (Hospital & Blood Bank)
router.get(
  '/inventory',
  authenticate,
  requireRoles(allowedRoles),
  (req, res) => redistributionController.getInstitutionInventory(req, res)
);

router.post(
  '/inventory',
  authenticate,
  requireRoles(allowedRoles),
  redistributionMutationLimiter,
  (req, res) => redistributionController.addInstitutionInventory(req, res)
);

// History & Analytics
router.get(
  '/history',
  authenticate,
  requireRoles(allowedRoles),
  (req, res) => redistributionController.getHistory(req, res)
);

router.get(
  '/analytics',
  authenticate,
  requireRoles(allowedRoles),
  (req, res) => redistributionController.getAnalytics(req, res)
);

// Redistribution Requests
router.post(
  '/requests',
  authenticate,
  requireRoles(allowedRoles),
  redistributionMutationLimiter,
  (req, res) => redistributionController.createRequest(req, res)
);

router.get(
  '/requests/:id',
  authenticate,
  requireRoles(allowedRoles),
  (req, res) => redistributionController.getRequestById(req, res)
);

// Source Institution Discovery & Compatibility Matching
router.get(
  '/requests/:id/matches',
  authenticate,
  requireRoles(allowedRoles),
  (req, res) => redistributionController.findMatches(req, res)
);

// Transfer Proposals
router.post(
  '/requests/:id/proposals',
  authenticate,
  requireRoles(allowedRoles),
  redistributionMutationLimiter,
  (req, res) => redistributionController.createProposal(req, res)
);

router.post(
  '/proposals/:id/approve',
  authenticate,
  requireRoles(allowedRoles),
  redistributionMutationLimiter,
  (req, res) => redistributionController.approveProposal(req, res)
);

router.post(
  '/proposals/:id/reject',
  authenticate,
  requireRoles(allowedRoles),
  redistributionMutationLimiter,
  (req, res) => redistributionController.rejectProposal(req, res)
);

// Shipment Dispatch, Transit, Receipt, Completion & Cancellation
router.post(
  '/transfers/:id/dispatch',
  authenticate,
  requireRoles(allowedRoles),
  redistributionMutationLimiter,
  (req, res) => redistributionController.dispatchTransfer(req, res)
);

router.post(
  '/transfers/:id/in-transit',
  authenticate,
  requireRoles(allowedRoles),
  redistributionMutationLimiter,
  (req, res) => redistributionController.markInTransit(req, res)
);

router.post(
  '/transfers/:id/receive',
  authenticate,
  requireRoles(allowedRoles),
  redistributionMutationLimiter,
  (req, res) => redistributionController.receiveTransfer(req, res)
);

router.post(
  '/transfers/:id/complete',
  authenticate,
  requireRoles(allowedRoles),
  redistributionMutationLimiter,
  (req, res) => redistributionController.completeTransfer(req, res)
);

router.post(
  '/transfers/:id/cancel',
  authenticate,
  requireRoles(allowedRoles),
  redistributionMutationLimiter,
  (req, res) => redistributionController.cancelTransfer(req, res)
);

export default router;

