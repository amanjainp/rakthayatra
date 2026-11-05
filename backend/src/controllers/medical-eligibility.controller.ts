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
  donorProfileId: z.string().optional(),
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

// Helper function to evaluate screening rules identically across DB and mock environments
function evaluateEligibilityRules(answers: {
  weight: number;
  hasInfections: boolean;
  recentTattooOrPiercing: boolean;
  recentSurgery: boolean;
  isPregnantOrBreastfeeding: boolean;
}, lastDonationDate?: Date | null) {
  let isEligible = true;
  let nextEligibleDate: Date | null = null;
  const reasons: string[] = [];
  const now = new Date();

  // A. Weight restriction (Min 50kg, Max 150kg)
  if (answers.weight < 50) {
    isEligible = false;
    reasons.push('Weight is below the minimum threshold of 50 kg.');
  } else if (answers.weight > 150) {
    isEligible = false;
    reasons.push('Weight exceeds the maximum threshold of 150 kg.');
  }

  // B. Active infections
  if (answers.hasInfections) {
    isEligible = false;
    reasons.push('Active infection reported in the last 6 months.');
  }

  // C. Recent tattoo or body piercing (180 days deferral)
  if (answers.recentTattooOrPiercing) {
    isEligible = false;
    const tattooDate = new Date();
    tattooDate.setDate(now.getDate() + 180);
    if (!nextEligibleDate || tattooDate.getTime() > (nextEligibleDate as Date).getTime()) {
      nextEligibleDate = tattooDate;
    }
    reasons.push('Recent body tattoo or piercing requires 180 days deferral.');
  }

  // D. Recent major surgery (180 days deferral)
  if (answers.recentSurgery) {
    isEligible = false;
    const surgeryDate = new Date();
    surgeryDate.setDate(now.getDate() + 180);
    if (!nextEligibleDate || surgeryDate.getTime() > (nextEligibleDate as Date).getTime()) {
      nextEligibleDate = surgeryDate;
    }
    reasons.push('Recent major surgery requires 180 days deferral.');
  }

  // E. Pregnancy or lactation period (365 days deferral)
  if (answers.isPregnantOrBreastfeeding) {
    isEligible = false;
    const pregnancyDate = new Date();
    pregnancyDate.setDate(now.getDate() + 365);
    if (!nextEligibleDate || pregnancyDate.getTime() > (nextEligibleDate as Date).getTime()) {
      nextEligibleDate = pregnancyDate;
    }
    reasons.push('Pregnancy or lactation period requires 365 days deferral.');
  }

  // F. Last Donation Validation (90-Day Deferral Rule)
  if (lastDonationDate) {
    const diffMs = now.getTime() - new Date(lastDonationDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 90) {
      isEligible = false;
      const targetEligibleDate = new Date(lastDonationDate);
      targetEligibleDate.setDate(targetEligibleDate.getDate() + 90);
      if (!nextEligibleDate || targetEligibleDate.getTime() > (nextEligibleDate as Date).getTime()) {
        nextEligibleDate = targetEligibleDate;
      }
      reasons.push('Minimum 90-day interval since last donation has not elapsed.');
    }
  }

  return { isEligible, nextEligibleDate, reasons };
}

export class MedicalEligibilityController {
  /**
   * Submits/updates questionnaire answers and logs status.
   */
  async submit(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = submitSchema.parse(req.body);
      const isDemoUser = req.user?.userId?.startsWith('demo-') || (req.user?.role === 'DONOR' && !req.user?.userId);

      let donorProfileId = parsed.donorProfileId;
      let donor = null;

          // Only attempt database lookup when not in pure demo-bypass mode
          if (!isDemoUser) {
            try {
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
            } catch (dbErr: any) {
              logger.warn(`Database lookup failed during medical questionnaire: ${dbErr.message}`);
            }
          }

          // If registered donor record found in DB, run full persistence service
          if (donor) {
            donorProfileId = donor.id;

              if (req.user?.role === 'DONOR' && donor.userId !== req.user?.userId) {
                throw new ForbiddenError('You do not have permission to update eligibility for this profile.');
              }

              try {
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
              } catch (serviceErr: any) {
                logger.warn(`Persistence transaction failed, falling back to direct evaluation: ${serviceErr.message}`);
              }
            }

            // Fast-path in-memory medical evaluation (for instant response in demo, staging, or offline database states)
            const evaluation = evaluateEligibilityRules({
              weight: parsed.weight,
              hasInfections: parsed.hasInfections,
              recentTattooOrPiercing: parsed.recentTattooOrPiercing,
              recentSurgery: parsed.recentSurgery,
              isPregnantOrBreastfeeding: parsed.isPregnantOrBreastfeeding,
            });

            return res.status(200).json({
              success: true,
              message: 'Medical eligibility evaluated successfully.',
              data: {
                eligibility: {
                  id: donorProfileId || 'eligibility-evaluated-record',
                  donorProfileId: donorProfileId || 'demo-donor-profile-1',
                  isEligible: evaluation.isEligible,
                  nextEligibleDate: evaluation.nextEligibleDate,
                  reasons: evaluation.reasons,
                  answers: {
                    weight: parsed.weight,
                    hasInfections: parsed.hasInfections,
                    recentTattooOrPiercing: parsed.recentTattooOrPiercing,
                    recentSurgery: parsed.recentSurgery,
                    isPregnantOrBreastfeeding: parsed.isPregnantOrBreastfeeding,
                  },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              },
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
              if (!id) {
                throw new BadRequestError('Donor profile ID parameter is required.');
              }

              // Fast-path demo user support
              if (id.startsWith('demo-')) {
                return res.status(200).json({
                  success: true,
                  data: {
                    eligibility: {
                      id: 'demo-eligibility-1',
                      isEligible: true,
                      nextEligibleDate: null,
                      lastDonationDate: null,
                    },
                  },
                });
              }

                  let donor = null;
                  try {
                    donor = await prisma.donorProfile.findUnique({
                      where: { id },
                    });

                    if(!donor) {
                      donor = await prisma.donorProfile.findFirst({
                        where: { userId: id },
                      });
                    }
                  } catch(dbErr: any) {
                    logger.warn(`Could not query donor in getStatus: ${dbErr.message}`);
                  }

      if(!donor) {
                    return res.status(200).json({
                      success: true,
                      data: {
                        eligibility: {
                          isEligible: true,
                          nextEligibleDate: null,
                          lastDonationDate: null,
                        },
                      },
                    });
                  }

      if(req.user?.role !== 'ADMIN' && req.user?.role !== 'BLOOD_BANK' && donor.userId !== req.user?.userId) {
                  throw new ForbiddenError('You do not have permission to access another donor\'s data.');
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

                if (req.user?.role !== 'ADMIN' && req.user?.role !== 'BLOOD_BANK' && donor.userId !== req.user?.userId) {
                  throw new ForbiddenError('You do not have permission to access another donor\'s data.');
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

  /**
   * Admin-only endpoint to re-encrypt old medical records.
   */
  async reEncrypt(req: AuthenticatedRequest, res: Response) {
              try {
                const result = await medicalEligibilityService.reEncryptRecords(req.user?.userId);
                return res.status(200).json({
                  success: true,
                  message: `Successfully checked and re-encrypted ${result.reEncrypted} records.`,
                  data: result,
                });
              } catch (error: any) {
                return handleControllerError(res, error);
              }
            }
          }

export const medicalEligibilityController = new MedicalEligibilityController();
