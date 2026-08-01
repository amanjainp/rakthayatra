import { PrismaClient, Donation } from '@prisma/client';
import { DonationRepository } from '../repositories/donation.repository';
import { DonorRepository } from '../repositories/donor.repository';
import { MedicalEligibilityRepository } from '../repositories/medical-eligibility.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { inventoryService } from './inventory.service';
import { BadRequestError, NotFoundError } from '../errors/app-error';

const prisma = new PrismaClient();

export class DonationService {
  /**
   * Registers a new blood donation appointment (Pending status).
   */
  async registerAppointment(
    data: {
      donorProfileId: string;
      bloodBankId?: string;
      donationCampId?: string;
      donationDate: Date;
      unitsDonated: number;
    },
    userId?: string
  ): Promise<Donation> {
    if (data.unitsDonated <= 0) {
      throw new BadRequestError('Units to donate must be a positive integer.');
    }

    const appointment = await prisma.$transaction(async (tx) => {
      const donationRepo = new DonationRepository(tx as any);
      const donorRepo = new DonorRepository(tx as any);
      const eligibilityRepo = new MedicalEligibilityRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      // 1. Verify donor profile exists
      const donor = await donorRepo.findById(data.donorProfileId);
      if (!donor) {
        throw new NotFoundError('Donor profile not found.');
      }

      // 2. Medical Eligibility Checks
      const eligibility = await eligibilityRepo.findByDonorId(data.donorProfileId);
      if (eligibility) {
        if (!eligibility.isEligible) {
          throw new BadRequestError('Donor is marked as medically ineligible.');
        }

        if (eligibility.nextEligibleDate && new Date(eligibility.nextEligibleDate) > new Date()) {
          throw new BadRequestError(
            `Donor is currently in deferral period. Eligible after: ${new Date(
              eligibility.nextEligibleDate
            ).toLocaleDateString()}`
          );
        }
      }

      // 3. Create pending donation appointment record
      const donation = await donationRepo.create({
        donor: { connect: { id: data.donorProfileId } },
        bloodBank: data.bloodBankId ? { connect: { id: data.bloodBankId } } : undefined,
        donationCamp: data.donationCampId ? { connect: { id: data.donationCampId } } : undefined,
        donationDate: new Date(data.donationDate),
        unitsDonated: data.unitsDonated,
        status: 'PENDING',
      });

      // Write audit log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'BOOK_DONATION_APPOINTMENT',
        details: {
          donationId: donation.id,
          donorProfileId: data.donorProfileId,
          bloodBankId: data.bloodBankId,
          donationCampId: data.donationCampId,
        },
      });

      return donation;
    });

    return appointment;
  }

  /**
   * Completes a donation appointment.
   * Changes status to COMPLETED, updates donor eligibility (90-day deferral), and adds units to Blood Inventory.
   */
  async completeDonation(
    donationId: string,
    data: { notes?: string },
    userId?: string
  ): Promise<Donation> {
    const completed = await prisma.$transaction(async (tx) => {
      const donationRepo = new DonationRepository(tx as any);
      const donorRepo = new DonorRepository(tx as any);
      const eligibilityRepo = new MedicalEligibilityRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      // 1. Retrieve donation record
      const donation = await donationRepo.findById(donationId);
      if (!donation) {
        throw new NotFoundError('Donation record not found.');
      }

      if (donation.status !== 'PENDING') {
        throw new BadRequestError(`Cannot complete a donation with status: ${donation.status}`);
      }

      // 2. Fetch donor profile
      const donor = await donorRepo.findById(donation.donorProfileId);
      if (!donor) {
        throw new NotFoundError('Donor profile associated with this donation was not found.');
      }

      // 3. Update donation status to COMPLETED
      const updatedDonation = await donationRepo.update(donationId, {
        status: 'COMPLETED',
        notes: data.notes,
      });

      // 4. Update lastDonationDate on DonorProfile
      const donationDate = new Date();
      await donorRepo.update(donation.donorProfileId, {
        lastDonationDate: donationDate,
      });

      // 5. Apply Deferral Window (90 Days standard)
      const nextEligibleDate = new Date();
      nextEligibleDate.setDate(donationDate.getDate() + 90);

      const eligibility = await eligibilityRepo.findByDonorId(donation.donorProfileId);
      if (eligibility) {
        await eligibilityRepo.update(eligibility.id, {
          isEligible: false,
          nextEligibleDate,
        });
      } else {
        await eligibilityRepo.create({
          donor: { connect: { id: donation.donorProfileId } },
          isEligible: false,
          nextEligibleDate,
          answers: JSON.stringify({}),
        });
      }

      // 6. Update Blood Stock Inventory if associated with a blood bank
      if (donation.bloodBankId) {
        // Shelf life is 35 days standard
        const expiryDate = new Date();
        expiryDate.setDate(donationDate.getDate() + 35);

        // Call inventory service inside transaction context
        await inventoryService.registerBloodUnit(
          {
            bloodBankId: donation.bloodBankId,
            bloodGroup: donor.bloodGroup,
            unitsCount: donation.unitsDonated,
            expiryDate,
            status: 'AVAILABLE',
          },
          userId
        );
      }

      // 7. Audit Log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'COMPLETE_DONATION',
        details: {
          donationId,
          donorProfileId: donation.donorProfileId,
          bloodBankId: donation.bloodBankId,
          unitsDonated: donation.unitsDonated,
        },
      });

      return updatedDonation;
    });

    return completed;
  }

  /**
   * Cancels a pending donation appointment.
   */
  async cancelDonation(donationId: string, userId?: string): Promise<Donation> {
    const cancelled = await prisma.$transaction(async (tx) => {
      const donationRepo = new DonationRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      const donation = await donationRepo.findById(donationId);
      if (!donation) {
        throw new NotFoundError('Donation record not found.');
      }

      if (donation.status !== 'PENDING') {
        throw new BadRequestError(`Cannot cancel a donation with status: ${donation.status}`);
      }

      // Cancel
      const record = await donationRepo.update(donationId, {
        status: 'CANCELLED',
      });

      // Audit Log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'CANCEL_DONATION_APPOINTMENT',
        details: {
          donationId,
          donorProfileId: donation.donorProfileId,
        },
      });

      return record;
    });

    return cancelled;
  }

  /**
   * Lists paginated donation history for a specific donor.
   */
  async getDonorHistory(
    donorProfileId: string,
    params: { page?: number; limit?: number }
  ): Promise<{ items: Donation[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 10;

    const donationRepo = new DonationRepository(prisma);
    return donationRepo.findPaginated({
      page,
      limit,
      where: { donorProfileId },
      orderBy: { donationDate: 'desc' },
      include: {
        bloodBank: true,
        donationCamp: true,
      },
    });
  }

  /**
   * Compiles statistics for a specific donor.
   */
  async getDonorStatistics(donorProfileId: string): Promise<{
    totalDonations: number;
    totalUnitsDonated: number;
    lastDonationDate: Date | null;
    isEligibleToDonate: boolean;
    nextEligibleDate: Date | null;
  }> {
    const donationRepo = new DonationRepository(prisma);
    const eligibilityRepo = new MedicalEligibilityRepository(prisma);

    const donations = await donationRepo.findByDonorProfileId(donorProfileId);
    const completed = donations.filter((d) => d.status === 'COMPLETED');
    const totalUnits = completed.reduce((sum, d) => sum + d.unitsDonated, 0);

    const eligibility = await eligibilityRepo.findByDonorId(donorProfileId);

    let isEligibleToDonate = true;
    let nextEligibleDate: Date | null = null;

    if (eligibility) {
      isEligibleToDonate = eligibility.isEligible;
      if (eligibility.nextEligibleDate) {
        nextEligibleDate = new Date(eligibility.nextEligibleDate);
        if (nextEligibleDate > new Date()) {
          isEligibleToDonate = false;
        }
      }
    }

    const lastDonation = completed.length > 0 ? completed[0].donationDate : null;

    return {
      totalDonations: completed.length,
      totalUnitsDonated: totalUnits,
      lastDonationDate: lastDonation,
      isEligibleToDonate,
      nextEligibleDate,
    };
  }
}

export const donationService = new DonationService();
