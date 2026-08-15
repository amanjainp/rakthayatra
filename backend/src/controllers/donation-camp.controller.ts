import { Request, Response } from 'express';
import { z } from 'zod';
import { donationCampService } from '../services/donation-camp.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../errors/app-error';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

// Zod Validation Schemas
const createCampSchema = z.object({
  name: z.string().min(1, 'Camp name is required.'),
  organizer: z.string().min(1, 'Organizer name is required.'),
  address: z.string().min(1, 'Address is required.'),
  city: z.string().min(1, 'City is required.'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Start date must be a valid date string.',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'End date must be a valid date string.',
  }),
  status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  externalRegistrationUrl: z.string().url().or(z.string().length(0)).nullable().optional(),
});

const updateCampSchema = z.object({
  name: z.string().optional(),
  organizer: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  externalRegistrationUrl: z.string().url().or(z.string().length(0)).nullable().optional(),
});

const volunteerSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address format.'),
  phone: z.string().min(1, 'Phone number is required.'),
});

const registerDonorSchema = z.object({
  donorProfileId: z.string().uuid('Invalid donor profile ID format.'),
});

const associateHospitalSchema = z.object({
  hospitalProfileId: z.string().uuid('Invalid hospital profile ID format.'),
});

const searchSchema = z.object({
  city: z.string().optional(),
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

  logger.error(`Unhandled donation camp controller exception: ${error.message}`);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected database or server error occurred.',
    },
  });
}

export class DonationCampController {
  /**
   * Registers a new blood donation camp.
   */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = createCampSchema.parse(req.body);
      const camp = await donationCampService.createCamp(
        {
          ...parsed,
          startDate: new Date(parsed.startDate),
          endDate: new Date(parsed.endDate),
        },
        req.user?.userId
      );

      return res.status(201).json({
        success: true,
        message: 'Donation camp registered successfully.',
        data: { camp },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Updates camp details.
   */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donation camp ID parameter.');
      }

      const parsed = updateCampSchema.parse(req.body);
      const camp = await donationCampService.updateCamp(
        id,
        {
          ...parsed,
          startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
          endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
        },
        req.user?.userId
      );

      return res.status(200).json({
        success: true,
        message: 'Donation camp updated successfully.',
        data: { camp },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Performs soft-deletion.
   */
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donation camp ID parameter.');
      }

      const camp = await donationCampService.deleteCamp(id, req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Donation camp deleted successfully.',
        data: { camp },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Registers volunteer details.
   */
  async registerVolunteer(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params; // Camp ID
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donation camp ID parameter.');
      }

      const parsed = volunteerSchema.parse(req.body);
      await donationCampService.registerVolunteer(id, parsed, req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Volunteer registered successfully for the donation camp.',
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Registers donor registration.
   */
  async registerDonor(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params; // Camp ID
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donation camp ID parameter.');
      }

      const parsed = registerDonorSchema.parse(req.body);

      // Security Ownership check
      const donor = await prisma.donorProfile.findUnique({
        where: { id: parsed.donorProfileId },
      });
      if (!donor) {
        throw new NotFoundError('Donor profile not found.');
      }

      if (req.user?.role === 'DONOR' && donor.userId !== req.user?.userId) {
        throw new ForbiddenError('You do not have permission to register this profile.');
      }

      await donationCampService.registerDonor(id, parsed.donorProfileId, req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Donor profile registered to attend donation camp.',
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Associates hospital.
   */
  async associateHospital(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params; // Camp ID
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donation camp ID parameter.');
      }

      const parsed = associateHospitalSchema.parse(req.body);

      // Security Ownership check
      const hospital = await prisma.hospitalProfile.findUnique({
        where: { id: parsed.hospitalProfileId },
      });
      if (!hospital) {
        throw new NotFoundError('Hospital profile not found.');
      }

      if (req.user?.role === 'HOSPITAL' && hospital.userId !== req.user?.userId) {
        throw new ForbiddenError('You do not have permission to associate this hospital profile.');
      }

      await donationCampService.associateHospital(id, parsed.hospitalProfileId, req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Hospital profile associated with donation camp successfully.',
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Compiles camp statistics.
   */
  async getStats(req: Request, res: Response) {
    try {
      const { id } = req.params; // Camp ID
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donation camp ID parameter.');
      }

      const stats = await donationCampService.getCampStatistics(id);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Lists camps.
   */
  async list(req: Request, res: Response) {
    try {
      const parsed = searchSchema.parse(req.query);
      const result = await donationCampService.getCamps({
        city: parsed.city,
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
}

export const donationCampController = new DonationCampController();
