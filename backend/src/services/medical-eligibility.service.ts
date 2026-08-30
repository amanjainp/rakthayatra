import { PrismaClient, MedicalEligibility } from '@prisma/client';
import { MedicalEligibilityRepository } from '../repositories/medical-eligibility.repository';
import { DonorRepository } from '../repositories/donor.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { BadRequestError, NotFoundError } from '../errors/app-error';
import { encryptData, decryptData } from '../utils/encryption';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface QuestionnaireAnswers {
  weight: number;
  hasInfections: boolean;
  recentTattooOrPiercing: boolean;
  recentSurgery: boolean;
  isPregnantOrBreastfeeding: boolean;
}

export class MedicalEligibilityService {
  /**
   * Evaluates answers and updates donor eligibility status.
   */
  async submitQuestionnaire(
    donorProfileId: string,
    answers: QuestionnaireAnswers,
    userId?: string
  ): Promise<MedicalEligibility> {
    if (answers.weight <= 0) {
      throw new BadRequestError('Weight parameter must be a positive number.');
    }

    const evaluated = await prisma.$transaction(async (tx) => {
      const donorRepo = new DonorRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      // 1. Fetch donor profile
      const donor = await donorRepo.findById(donorProfileId);
      if (!donor) {
        throw new NotFoundError('Donor profile not found.');
      }

      // 2. Perform Medical Logic Calculations
      let isEligible = true;
      let nextEligibleDate: Date | null = null;
      const reasons: string[] = [];

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
        reasons.push('Active infection reported.');
      }

      const now = new Date();

      // C. Recent tattoo or body piercing (180 days deferral)
      if (answers.recentTattooOrPiercing) {
        isEligible = false;
        const tattooDate = new Date();
        tattooDate.setDate(now.getDate() + 180);
        if (!nextEligibleDate || tattooDate > (nextEligibleDate as any)) {
          nextEligibleDate = tattooDate;
        }
        reasons.push('Recent body tattoo or piercing requires 180 days deferral.');
      }

      // D. Recent major surgery (180 days deferral)
      if (answers.recentSurgery) {
        isEligible = false;
        const surgeryDate = new Date();
        surgeryDate.setDate(now.getDate() + 180);
        if (!nextEligibleDate || surgeryDate > (nextEligibleDate as any)) {
          nextEligibleDate = surgeryDate;
        }
        reasons.push('Recent major surgery requires 180 days deferral.');
      }

      // E. Pregnancy or breastfeeding (365 days deferral)
      if (answers.isPregnantOrBreastfeeding) {
        isEligible = false;
        const pregnancyDate = new Date();
        pregnancyDate.setDate(now.getDate() + 365);
        if (!nextEligibleDate || pregnancyDate > (nextEligibleDate as any)) {
          nextEligibleDate = pregnancyDate;
        }
        reasons.push('Pregnancy or lactation period requires 365 days deferral.');
      }

      // F. Last Donation Validation (90-Day Deferral Rule)
      if (donor.lastDonationDate) {
        const lastDonation = new Date(donor.lastDonationDate);
        const diffMs = now.getTime() - lastDonation.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays < 90) {
          isEligible = false;
          const targetEligibleDate = new Date(lastDonation);
          targetEligibleDate.setDate(lastDonation.getDate() + 90);

          if (!nextEligibleDate || targetEligibleDate > (nextEligibleDate as any)) {
            nextEligibleDate = targetEligibleDate;
          }
          reasons.push('Minimum 90-day interval since last donation has not elapsed.');
        }
      }

      // 3. Upsert MedicalEligibility record
      const encryptedAnswers = encryptData(JSON.stringify(answers));
      const record = await tx.medicalEligibility.upsert({
        where: { donorProfileId },
        update: {
          answers: encryptedAnswers as any,
          isEligible,
          nextEligibleDate,
        },
        create: {
          donorProfileId,
          answers: encryptedAnswers as any,
          isEligible,
          nextEligibleDate,
        },
      });

      // 4. Update Donor Profile availability matching eligibility
      await donorRepo.update(donorProfileId, {
        isAvailable: isEligible,
      });

      // 5. Write audit log history tracking (omits plaintext answers for compliance)
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'SUBMIT_MEDICAL_QUESTIONNAIRE',
        details: {
          donorProfileId,
          answersMasked: true,
          isEligible,
          nextEligibleDate,
          reasons,
        } as any,
      });

      logger.info(`[AUDIT] Action: SUBMIT_MEDICAL_QUESTIONNAIRE | User: ${userId || 'System'} | Details: ${JSON.stringify({ donorProfileId, isEligible, reasons })}`);

      return record;
    });

    if (evaluated && evaluated.answers) {
      try {
        const decryptedStr = decryptData(evaluated.answers);
        evaluated.answers = JSON.parse(decryptedStr);
      } catch (err: any) {
        logger.error(`Failed to decrypt answers during submission: ${err.message}`);
        if (typeof evaluated.answers === 'string') {
          evaluated.answers = JSON.parse(evaluated.answers);
        }
      }
    }

    return evaluated;
  }

  /**
   * Retrieves donor medical eligibility state.
   */
  async getDonorEligibility(donorProfileId: string): Promise<MedicalEligibility | null> {
    const eligibilityRepo = new MedicalEligibilityRepository(prisma);
    const record = await eligibilityRepo.findByDonorId(donorProfileId);
    
    if (record && record.answers) {
      try {
        const decryptedStr = decryptData(record.answers);
        record.answers = JSON.parse(decryptedStr);
      } catch (err: any) {
        logger.error(`Failed to decrypt medical eligibility answers on fetch: ${err.message}`);
        if (typeof record.answers === 'string') {
          record.answers = JSON.parse(record.answers);
        }
      }
    }
    return record;
  }

  /**
   * Retrieves historical evaluations from the audit logs.
   */
  async getEligibilityHistory(donorProfileId: string): Promise<any[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'SUBMIT_MEDICAL_QUESTIONNAIRE',
        details: {
          path: ['donorProfileId'],
          equals: donorProfileId,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    return logs.map((log) => {
      let details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      return {
        id: log.id,
        evaluatedBy: log.user ? log.user.email : 'System/Self',
        createdAt: log.createdAt,
        details,
      };
    });
  }
}

export const medicalEligibilityService = new MedicalEligibilityService();
