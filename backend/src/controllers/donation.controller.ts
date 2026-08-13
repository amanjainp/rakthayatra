import { Response } from 'express';
import { z } from 'zod';
import { donationService } from '../services/donation.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError, BadRequestError, NotFoundError } from '../errors/app-error';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

// Zod Validation Schemas
const registerSchema = z
  .object({
    donorProfileId: z.string().uuid('Invalid donor profile ID format.'),
    bloodBankId: z.string().uuid('Invalid blood bank ID format.').optional(),
    donationCampId: z.string().uuid('Invalid donation camp ID format.').optional(),
    donationDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Donation date must be a valid date string.',
    }),
    unitsDonated: z.number().int().positive('Units count must be a positive integer.').default(1),
  })
  .refine((data) => data.bloodBankId || data.donationCampId, {
    message: 'Either bloodBankId or donationCampId must be specified.',
    path: ['bloodBankId'],
  });

const completeSchema = z.object({
  notes: z.string().optional(),
});

const querySchema = z.object({
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

  logger.error(`Unhandled donation controller exception: ${error.message}`);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected database or server error occurred.',
    },
  });
}

export class DonationController {
  /**
   * Registers a new blood donation appointment.
   */
  async register(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = registerSchema.parse(req.body);
      const appointment = await donationService.registerAppointment(
        {
          donorProfileId: parsed.donorProfileId,
          bloodBankId: parsed.bloodBankId,
          donationCampId: parsed.donationCampId,
          donationDate: new Date(parsed.donationDate),
          unitsDonated: parsed.unitsDonated,
        },
        req.user?.userId
      );

      return res.status(201).json({
        success: true,
        message: 'Donation appointment registered successfully.',
        data: { donation: appointment },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Completes a pending donation appointment.
   */
  async complete(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donation record ID parameter.');
      }

      const parsed = completeSchema.parse(req.body);
      const completed = await donationService.completeDonation(id, parsed, req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Donation completed and logged successfully.',
        data: { donation: completed },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Cancels a pending donation appointment.
   */
  async cancel(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donation record ID parameter.');
      }

      const cancelled = await donationService.cancelDonation(id, req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Donation appointment cancelled successfully.',
        data: { donation: cancelled },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Lists paginated donation history.
   */
  async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params; // Donor Profile ID
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donor profile ID parameter.');
      }

      let donorProfile = await prisma.donorProfile.findFirst({
        where: { id },
      });

      if (!donorProfile) {
        donorProfile = await prisma.donorProfile.findFirst({
          where: { userId: id },
        });
      }

      if (!donorProfile) {
        throw new NotFoundError('Donor profile record not found.');
      }

      const parsed = querySchema.parse(req.query);
      const history = await donationService.getDonorHistory(donorProfile.id, {
        page: parsed.page,
        limit: parsed.limit,
      });

      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Compiles donor statistics.
   */
  async getStats(req: AuthenticatedRequest, res: Response) {
    try {
       const { id } = req.params;
       if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
         throw new BadRequestError('Invalid donor profile ID parameter.');
       }

       let donorProfile = await prisma.donorProfile.findFirst({
         where: { id },
       });

       if (!donorProfile) {
         donorProfile = await prisma.donorProfile.findFirst({
           where: { userId: id },
         });
       }

       if (!donorProfile) {
         throw new NotFoundError('Donor profile record not found.');
       }

       const stats = await donationService.getDonorStatistics(donorProfile.id);

       return res.status(200).json({
         success: true,
         data: stats,
       });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }
}

export const donationController = new DonationController();
