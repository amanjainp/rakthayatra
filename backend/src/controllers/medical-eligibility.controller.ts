import { Response } from 'express';
import { z } from 'zod';
import { medicalEligibilityService } from '../services/medical-eligibility.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from '../errors/app-error';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

// Zod Validation Schemas
const submitSchema = z.object({
  donorProfileId: z.string().uuid('Invalid donor profile ID format.').optional(),
  weight: z.number().positive('Weight must be a positive number.'),
  hasInfections: z.boolean(),
  recentTattooOrPiercing: z.boolean(),
  recentSurgery: z.boolean(),
  isPregnantOrBreastfeeding: z.boolean(),
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

  logger.error(`Unhandled medical eligibility controller exception: ${error.message}`);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected database or server error occurred.',
    },
  });
}

export class MedicalEligibilityController {
  /**
   * Submits/updates questionnaire answers and logs status.
   */
  async submit(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = submitSchema.parse(req.body);

      let donorProfileId = parsed.donorProfileId;
      let donor = null;

      if (donorProfileId) {
        donor = await prisma.donorProfile.findUnique({
          where: { id: donorProfileId },
        });
        if (!donor) {
          donor = await prisma.donorProfile.findFirst({
            where: { userId: donorProfileId },
          });
        }
      } else {
        donor = await prisma.donorProfile.findFirst({
          where: { userId: req.user?.userId },
        });
      }

      if (!donor) {
        throw new NotFoundError('Donor profile not found.');
      }
      donorProfileId = donor.id;

      if (req.user?.role === 'DONOR' && donor.userId !== req.user?.userId) {
        throw new ForbiddenError('You do not have permission to update eligibility for this profile.');
      }

      const eligibility = await medicalEligibilityService.submitQuestionnaire(
        donorProfileId,
        {
          weight: parsed.weight,
          hasInfections: parsed.hasInfections,
          recentTattooOrPiercing: parsed.recentTattooOrPiercing,
          recentSurgery: parsed.recentSurgery,
          isPregnantOrBreastfeeding: parsed.isPregnantOrBreastfeeding,
        },
        req.user?.userId
      );

      return res.status(200).json({
        success: true,
        message: 'Medical eligibility evaluated successfully.',
        data: { eligibility },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Retrieves donor current eligibility status.
   */
  async getStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params; // Donor Profile ID or User ID
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donor profile ID parameter.');
      }

      let donor = await prisma.donorProfile.findUnique({
        where: { id },
      });

      if (!donor) {
        donor = await prisma.donorProfile.findFirst({
          where: { userId: id },
        });
      }

      if (!donor) {
        throw new NotFoundError('Donor profile record not found.');
      }

      const eligibility = await medicalEligibilityService.getDonorEligibility(donor.id);
      if (!eligibility) {
        return res.status(200).json({
          success: true,
          message: 'No eligibility evaluations recorded for this donor.',
          data: { eligibility: null },
        });
      }

      return res.status(200).json({
        success: true,
        data: { eligibility },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Retrieves historical evaluations list.
   */
  async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params; // Donor Profile ID or User ID
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid donor profile ID parameter.');
      }

      let donor = await prisma.donorProfile.findUnique({
        where: { id },
      });

      if (!donor) {
        donor = await prisma.donorProfile.findFirst({
          where: { userId: id },
        });
      }

      if (!donor) {
        throw new NotFoundError('Donor profile record not found.');
      }

      const history = await medicalEligibilityService.getEligibilityHistory(donor.id);

      return res.status(200).json({
        success: true,
        data: { history },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }
}

export const medicalEligibilityController = new MedicalEligibilityController();
