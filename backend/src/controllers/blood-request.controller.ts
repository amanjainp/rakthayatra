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

      const inventoryId = req.body.inventoryId || req.query.inventoryId;
      if (inventoryId && !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(inventoryId)) {
        throw new BadRequestError('Invalid blood inventory ID parameter.');
      }

      const fulfilled = await bloodRequestService.updateRequestStatus(id, 'FULFILLED', req.user?.userId, inventoryId);

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

  /**
   * Retrieves real-time coordinates/markers for compatible donors, blood banks, and emergency requests.
   */
  async getMapLocations(req: Request, res: Response) {
    try {
      const lat = parseFloat(req.query.latitude as string) || 28.6139;
      const lng = parseFloat(req.query.longitude as string) || 77.209;
      const radiusKm = parseFloat(req.query.radius as string) || 25.0;

      // 1. Fetch Active Donors
      const donors = await prisma.donorProfile.findMany({
        where: {
          isAvailable: true,
          deletedAt: null,
          user: { status: 'ACTIVE' },
        },
      });

      // 2. Fetch Active Blood Banks
      const bloodBanks = await prisma.bloodBankProfile.findMany({
        where: {
          deletedAt: null,
          user: { status: 'ACTIVE' },
        },
        include: {
          inventory: {
            where: { status: 'AVAILABLE' }
          }
        }
      });

      // 3. Fetch Emergency Requests
      const requests = await prisma.bloodRequest.findMany({
        where: {
          urgency: 'EMERGENCY',
          status: { in: ['PENDING', 'APPROVED'] }
        }
      });

      const markers: any[] = [];
      const { mapsService } = require('../services/maps.service');

      // Process Donors
      for (const donor of donors) {
        const dist = mapsService.calculateDistance(lat, lng, donor.latitude, donor.longitude);
        if (dist <= radiusKm) {
          markers.push({
            id: `donor-${donor.id}`,
            type: 'DONOR',
            name: donor.fullName,
            bloodGroup: donor.bloodGroup,
            latitude: donor.latitude,
            longitude: donor.longitude,
            contact: donor.phone,
            distanceKm: dist,
          });
        }
      }

      // Process Blood Banks
      for (const bank of bloodBanks) {
        const dist = mapsService.calculateDistance(lat, lng, bank.latitude, bank.longitude);
        if (dist <= radiusKm) {
          const availableBags = bank.inventory.reduce((sum: number, item: any) => sum + item.unitsCount, 0);
          markers.push({
            id: `bank-${bank.id}`,
            type: 'BLOOD_BANK',
            name: bank.name,
            latitude: bank.latitude,
            longitude: bank.longitude,
            contact: bank.phone,
            availableBags,
            distanceKm: dist,
          });
        }
      }

      // Process Emergency Requests
      for (const reqRecord of requests) {
        const dist = mapsService.calculateDistance(lat, lng, reqRecord.latitude, reqRecord.longitude);
        if (dist <= radiusKm) {
          markers.push({
            id: `request-${reqRecord.id}`,
            type: 'EMERGENCY_REQUEST',
            name: `EMERGENCY: ${reqRecord.locationName}`,
            bloodGroup: reqRecord.bloodGroup,
            latitude: reqRecord.latitude,
            longitude: reqRecord.longitude,
            contact: `Needs ${reqRecord.unitsRequired} Bags`,
            distanceKm: dist,
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: markers,
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Translates coordinates to a human-readable address.
   */
  async reverseGeocode(req: Request, res: Response) {
    try {
      const lat = parseFloat(req.query.latitude as string);
      const lng = parseFloat(req.query.longitude as string);

      if (isNaN(lat) || isNaN(lng)) {
        throw new BadRequestError('Latitude and Longitude query parameters are required.');
      }

      const { mapsService } = require('../services/maps.service');
      const address = await mapsService.reverseGeocode(lat, lng);

      return res.status(200).json({
        success: true,
        data: { address },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }
}

export const bloodRequestController = new BloodRequestController();
