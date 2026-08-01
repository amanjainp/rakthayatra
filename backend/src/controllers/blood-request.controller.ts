import { Request, Response } from 'express';
import { z } from 'zod';
import { bloodRequestService } from '../services/blood-request.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../errors/app-error';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

// Zod Validation Schemas
const createSchema = z.object({
  bloodGroup: z.enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG']),
  unitsRequired: z.number().int().positive('Units count must be a positive integer.'),
  urgency: z.enum(['NORMAL', 'EMERGENCY']),
  locationName: z.string().min(1, 'Location name is required.'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  message: z.string().optional(),
});

const searchSchema = z.object({
  bloodGroup: z.enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'FULFILLED', 'CANCELLED']).optional(),
  page: z.preprocess((val) => Number(val) || 1, z.number().int().positive()),
  limit: z.preprocess((val) => Number(val) || 10, z.number().int().positive()),
});

function handleControllerError(res: Response, error: any) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed.',
        details: error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })),
      },
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.errorCode,
        message: error.message,
      },
    });
  }

  logger.error(`Unhandled blood request controller exception: ${error.message}`);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected database or server error occurred.',
    },
  });
}

export class BloodRequestController {
  /**
   * Creates a new blood request.
   */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = createSchema.parse(req.body);
      const requesterId = req.user?.userId;
      if (!requesterId) {
        throw new ForbiddenError('User identity must be authenticated.');
      }

      const request = await bloodRequestService.createRequest(
        {
          requesterId,
          bloodGroup: parsed.bloodGroup,
          unitsRequired: parsed.unitsRequired,
          urgency: parsed.urgency,
          locationName: parsed.locationName,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          message: parsed.message,
        },
        requesterId
      );

      return res.status(201).json({
        success: true,
        message: 'Blood request submitted successfully.',
        data: { request },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Approves a pending blood request (Admins only).
   */
  async approve(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid blood request ID parameter.');
      }

      const approved = await bloodRequestService.updateRequestStatus(id, 'APPROVED', req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Blood request approved successfully.',
        data: { request: approved },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Rejects a pending blood request (Admins only).
   */
  async reject(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid blood request ID parameter.');
      }

      const rejected = await bloodRequestService.updateRequestStatus(id, 'CANCELLED', req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Blood request rejected successfully.',
        data: { request: rejected },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Fulfills an approved blood request.
   */
  async fulfill(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid blood request ID parameter.');
      }

      const fulfilled = await bloodRequestService.updateRequestStatus(id, 'FULFILLED', req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Blood request marked as fulfilled successfully.',
        data: { request: fulfilled },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Cancels a blood request (Ownership check applied).
   */
  async cancel(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid blood request ID parameter.');
      }

      // 1. Security Ownership Check
      const requestRecord = await prisma.bloodRequest.findUnique({ where: { id } });
      if (!requestRecord) {
        throw new NotFoundError('Blood request record not found.');
      }

      if (req.user?.role !== 'ADMIN' && requestRecord.requesterId !== req.user?.userId) {
        throw new ForbiddenError('You do not have permission to cancel this blood request.');
      }

      const cancelled = await bloodRequestService.updateRequestStatus(id, 'CANCELLED', req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Blood request cancelled successfully.',
        data: { request: cancelled },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Searches and filters blood requests.
   */
  async search(req: Request, res: Response) {
    try {
      const parsed = searchSchema.parse(req.query);
      const result = await bloodRequestService.searchRequests({
        bloodGroup: parsed.bloodGroup,
        status: parsed.status,
        page: parsed.page,
        limit: parsed.limit,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Triggers background auto-expiration sweeps (Admins only).
   */
  async triggerExpiryCheck(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await bloodRequestService.checkAndFlagExpiredRequests(req.user?.userId);

      return res.status(200).json({
        success: true,
        message: `Checked and flagged ${updated.length} expired blood requests.`,
        data: { expiredRequestsCount: updated.length },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }
}

export const bloodRequestController = new BloodRequestController();
