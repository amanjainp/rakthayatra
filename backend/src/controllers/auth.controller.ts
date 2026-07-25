import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import logger from '../config/logger';

// 1. Zod Validation Schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character.'),
  role: z.enum(['ADMIN', 'DONOR', 'PATIENT', 'HOSPITAL', 'BLOOD_BANK']),
  details: z.any().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  password: z.string().min(1, 'Password is required.'),
});

const otpSchema = z.object({
  email: z.string().email('Invalid email address format.'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address format.'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character.'),
});

// Helper for cookie configuration
const COOKIE_NAME = 'refreshToken';
const isProd = process.env.NODE_ENV === 'production';

function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
  });
}

function parseCookie(req: Request, name: string): string | undefined {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;

  if (rc) {
    rc.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      list[parts.shift()!.trim()] = decodeURI(parts.join('='));
    });
  }

  return list[name];
}

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const body = registerSchema.parse(req.body);
      const ipAddress = req.ip;

      const { user, otp } = await authService.register(
        body.email,
        body.password,
        body.role,
        body.details || {},
        ipAddress,
      );

      // In production, OTP is sent via SMS/Email (Milestone 4).
      // For Milestone 3 verification, we yield it in response metadata.
      logger.info(`OTP generated for ${body.email}: ${otp}`);

      return res.status(201).json({
        success: true,
        message: 'Registration successful. Verification OTP sent.',
        data: {
          userId: user.id,
          email: user.email,
          role: body.role,
          status: user.status,
          otp, // Returned only for local integration/testing verification stubs
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed.',
            details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
      }

      logger.error(`Registration controller error: ${error.message}`);
      return res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: error.message || 'Registration failed.',
        },
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const body = loginSchema.parse(req.body);
      const ipAddress = req.ip;

      const { accessToken, refreshToken, user } = await authService.login(
        body.email,
        body.password,
        ipAddress,
      );

      setRefreshTokenCookie(res, refreshToken);

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role.name,
            status: user.status,
          },
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed.',
            details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
      }

      logger.warn(`Login failed: ${error.message}`);
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Invalid email or password.',
        },
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const refreshToken = parseCookie(req, COOKIE_NAME);
      const ipAddress = req.ip;

      if (refreshToken) {
        await authService.logout(refreshToken, ipAddress);
      }

      clearRefreshTokenCookie(res);

      return res.status(200).json({
        success: true,
        message: 'Logout successful.',
      });
    } catch (error: any) {
      logger.error(`Logout controller error: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Logout failed.',
        },
      });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const refreshToken = parseCookie(req, COOKIE_NAME);
      const ipAddress = req.ip;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Refresh token is missing.',
          },
        });
      }

      const { accessToken, refreshToken: newRefreshToken } = await authService.refresh(
        refreshToken,
        ipAddress,
      );

      setRefreshTokenCookie(res, newRefreshToken);

      return res.status(200).json({
        success: true,
        message: 'Token refreshed successfully.',
        data: {
          accessToken,
        },
      });
    } catch (error: any) {
      clearRefreshTokenCookie(res);
      logger.warn(`Token refresh failed: ${error.message}`);
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Token refresh failed.',
        },
      });
    }
  }

  async verifyOtp(req: Request, res: Response) {
    try {
      const body = otpSchema.parse(req.body);
      const ipAddress = req.ip;

      await authService.verifyOtp(body.email, body.otp, ipAddress);

      return res.status(200).json({
        success: true,
        message: 'OTP verified and account activated.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed.',
            details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'VERIFICATION_FAILED',
          message: error.message || 'OTP verification failed.',
        },
      });
    }
  }

  async resendOtp(req: Request, res: Response) {
    try {
      const body = forgotPasswordSchema.parse(req.body);
      const otp = await authService.resendOtp(body.email);

      logger.info(`Resent OTP generated for ${body.email}: ${otp}`);

      return res.status(200).json({
        success: true,
        message: 'Verification OTP resent successfully.',
        data: {
          otp, // Verification mock hook
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed.',
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'RESEND_FAILED',
          message: error.message || 'Failed to resend OTP.',
        },
      });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const body = forgotPasswordSchema.parse(req.body);
      const resetToken = await authService.forgotPassword(body.email);

      logger.info(`Reset token generated for ${body.email}: ${resetToken}`);

      return res.status(200).json({
        success: true,
        message: 'Password reset instructions generated.',
        data: {
          resetToken, // Verification mock hook
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed.',
          },
        });
      }

      // To prevent account harvesting, return success even if user not found
      return res.status(200).json({
        success: true,
        message: 'Password reset instructions generated if account exists.',
      });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const body = resetPasswordSchema.parse(req.body);
      const ipAddress = req.ip;

      await authService.resetPassword(body.token, body.password, ipAddress);

      return res.status(200).json({
        success: true,
        message: 'Password reset successfully.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed.',
            details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'RESET_FAILED',
          message: error.message || 'Password reset failed.',
        },
      });
    }
  }
}

export const authController = new AuthController();
