import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate, requireRoles, AuthenticatedRequest } from '../middlewares/auth.middleware';
import rateLimit from 'express-rate-limit';
import logger from '../config/logger';

const router = Router();

// Endpoint-specific Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 5, // Limit 5 logins per window per IP
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_LOGINS',
      message: 'Too many login attempts. Please try again after 15 minutes.',
    },
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit 3 accounts per hour per IP
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REGISTRATIONS',
      message: 'Too many accounts registered from this IP. Please try again later.',
    },
  },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_OTP_ATTEMPTS',
      message: 'Too many OTP requests. Please try again after 15 minutes.',
    },
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_PASSWORD_RESETS',
      message: 'Too many password reset attempts. Please try again after 15 minutes.',
    },
  },
});

// Authentication Routes
router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.post('/verify-otp', otpLimiter, authController.verifyOtp);
router.post('/resend-otp', otpLimiter, authController.resendOtp);
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Test Authenticated Route (GET /me)
router.get('/me', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      include: {
        role: true,
        donorProfile: true,
        hospitalProfile: true,
        bloodBankProfile: true,
      },
    });

    if (user) {
      // Remove password hash from response
      (user as any).passwordHash = undefined;
      (user as any).userId = user.id;
    }

    return res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve session user details.',
      },
    });
  }
});

/**
 * PATCH /api/auth/me/availability
 * Updates the authenticated donor's availability (isAvailable: true/false).
 * Setting isAvailable to false removes the donor from hospital radar and pauses emergency alerts.
 */
router.patch('/me/availability', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const { isAvailable, status } = req.body;
    let targetAvailable: boolean;
    if (typeof isAvailable === 'boolean') {
      targetAvailable = isAvailable;
    } else if (typeof status === 'string') {
      targetAvailable = status === 'AVAILABLE';
    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Please provide either isAvailable (boolean) or status ("AVAILABLE", "TEMPORARY_PAUSE", "INACTIVE").',
        },
      });
    }

    const existingProfile = await prisma.donorProfile.findUnique({
      where: { userId },
    });
    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Donor profile not found for this user.' },
      });
    }

    const updatedProfile = await prisma.donorProfile.update({
      where: { userId },
      data: { isAvailable: targetAvailable },
    });

    logger.info(`[DonorAvailability] Donor ${existingProfile.id} (${existingProfile.fullName}) updated isAvailable to ${targetAvailable}`);

    return res.status(200).json({
      success: true,
      message: `Donor availability updated to ${targetAvailable ? 'ACTIVE' : 'INACTIVE'} successfully.`,
      data: {
        isAvailable: updatedProfile.isAvailable,
        donorProfile: updatedProfile,
      },
    });
  } catch (error: any) {
    logger.error('Failed to update donor availability:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update donor availability.' },
    });
  }
});

// Test RBAC Route (GET /admin-only)
router.get('/admin-only', authenticate, requireRoles(['ADMIN']), (req: AuthenticatedRequest, res) => {
  return res.status(200).json({
    success: true,
    message: 'Welcome Admin!',
    data: {
      user: req.user,
    },
  });
});

export default router;
