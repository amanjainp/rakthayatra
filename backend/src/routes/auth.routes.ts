import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate, requireRoles, AuthenticatedRequest } from '../middlewares/auth.middleware';
import rateLimit from 'express-rate-limit';

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
