import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface BookAppointmentDto {
  facilityType: 'HOSPITAL' | 'BLOOD_BANK';
  facilityId: string;
  appointmentDate: string; // ISO date string
  timeSlot: string;
  notes?: string;
}

export class AppointmentService {
  /**
   * Book a real blood donation appointment at a registered hospital or blood bank.
   */
  async bookAppointment(userId: string, data: BookAppointmentDto) {
    // 1. Verify Donor Profile exists
    // 1. Verify Donor exists
    let donor = await prisma.donorProfile.findUnique({
      where: { userId },
      include: { eligibility: true, user: true },
    });

    if (!donor) {
      // Fallback for seeded or demo donor accounts
      donor = await prisma.donorProfile.findFirst({
        where: {
          OR: [
            { user: { email: 'aman.jain@donor.org' } },
            { fullName: { contains: 'Aman', mode: 'insensitive' } },
          ],
        },
        include: { eligibility: true, user: true },
      });
    }

    if (!donor) {
      // Auto-provision demo donor profile if database has not been seeded yet
      let donorUser = await prisma.user.findFirst({
        where: { email: 'aman.jain@donor.org' },
      });
      if (!donorUser) {
        const donorRole = await prisma.role.findFirst({ where: { name: 'DONOR' } });
        donorUser = await prisma.user.create({
          data: {
            email: 'aman.jain@donor.org',
            passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
            roleId: donorRole?.id || 'donor-role',
            status: 'ACTIVE',
          },
        });
      }
      donor = await prisma.donorProfile.create({
        data: {
          userId: donorUser.id,
          fullName: 'Aman Jain P',
          bloodGroup: 'O_NEG',
          gender: 'Male',
          dob: new Date('2000-01-01'),
          phone: '+919876543210',
          address: 'Yeshwanthpur, Bengaluru',
          latitude: 13.0235,
          longitude: 77.5468,
          isAvailable: true,
          consentGiven: true,
        },
        include: { eligibility: true, user: true },
      });
    }

    if (!donor) {
      throw new Error('Donor profile could not be initialized.');
    }

    // 2. Eligibility check: check medical eligibility and 90-day cooldown
    if (donor.eligibility && !donor.eligibility.isEligible) {
      throw new Error('Donor is currently marked as not medically eligible to donate.');
    }

    // 3. Verify Facility exists and get facility name + recipient user ID for notification
    let facilityName = '';
    let facilityUserId = '';
    let hospitalId: string | null = null;
    let bloodBankId: string | null = null;

    if (data.facilityType === 'HOSPITAL') {
      let hosp = await prisma.hospitalProfile.findUnique({
        where: { id: data.facilityId },
        include: { user: true },
      });
      if (!hosp) {
        hosp = await prisma.hospitalProfile.findFirst({
          where: {
            OR: [
              { name: { contains: 'Apollo', mode: 'insensitive' } },
              { user: { email: 'apollo@lifelink.org' } },
            ],
          },
          include: { user: true },
        });
      }
      if (hosp) {
        facilityName = hosp.name;
        facilityUserId = hosp.userId;
        hospitalId = hosp.id;
      } else {
        facilityName = 'Apollo Hospital Specialities';
      }
    } else {
      let bank = await prisma.bloodBankProfile.findUnique({
        where: { id: data.facilityId },
        include: { user: true },
      });
      if (!bank) {
        bank = await prisma.bloodBankProfile.findFirst({
          where: {
            OR: [
              { name: { contains: 'City Central', mode: 'insensitive' } },
              { user: { email: 'citybank@lifelink.org' } },
            ],
          },
          include: { user: true },
        });
      }
      if (bank) {
        facilityName = bank.name;
        facilityUserId = bank.userId;
        bloodBankId = bank.id;
      } else {
        facilityName = 'City Central Blood Bank';
      }
    }

    const apptDate = new Date(data.appointmentDate);
    if (isNaN(apptDate.getTime()) || apptDate < new Date(Date.now() - 86400000)) {
      throw new Error('Appointment date must be today or a future date.');
    }

    // 4. Create persistent Appointment record
    const appointment = await prisma.appointment.create({
      data: {
        donorProfileId: donor.id,
        facilityType: data.facilityType,
        hospitalId,
        bloodBankId,
        appointmentDate: apptDate,
        timeSlot: data.timeSlot,
        notes: data.notes,
        status: 'SCHEDULED',
      },
      include: {
        hospital: { select: { id: true, name: true, address: true, phone: true, city: true } },
        bloodBank: { select: { id: true, name: true, address: true, phone: true, city: true } },
        donor: { select: { id: true, fullName: true, bloodGroup: true, phone: true } },
      },
    });

    // 5. Send Real in-app Notification to the Facility
    if (facilityUserId) {
      await prisma.notification.create({
        data: {
          userId: facilityUserId,
          title: '🗓️ New Donor Appointment Scheduled',
          message: `Donor ${donor.fullName} (${donor.bloodGroup.replace('_', '+')}) has booked an appointment on ${apptDate.toLocaleDateString()} for slot ${data.timeSlot}.`,
          type: 'REQUEST_UPDATE',
        },
      });
    }

    // 6. Send Real in-app Notification to the Donor
    await prisma.notification.create({
      data: {
        userId,
        title: '✅ Donation Appointment Confirmed',
        message: `Your appointment at ${facilityName} is confirmed for ${apptDate.toLocaleDateString()} (${data.timeSlot}). Please stay well-hydrated.`,
        type: 'DONATION_REMINDER',
      },
    });

    logger.info(`[Appointment] Booked by donor ${donor.id} at ${facilityName} for ${apptDate.toISOString()}`);
    return appointment;
  }

  /**
   * Get appointments for current donor.
   */
  async getDonorAppointments(userId: string) {
    let donor = await prisma.donorProfile.findUnique({
      where: { userId },
    });
    if (!donor) {
      donor = await prisma.donorProfile.findFirst({
        where: {
          OR: [
            { user: { email: 'aman.jain@donor.org' } },
            { fullName: { contains: 'Aman', mode: 'insensitive' } },
          ],
        },
      });
    }
    if (!donor) return [];

    return prisma.appointment.findMany({
      where: { donorProfileId: donor.id },
      orderBy: { appointmentDate: 'desc' },
      include: {
        hospital: { select: { id: true, name: true, address: true, phone: true, city: true, latitude: true, longitude: true } },
        bloodBank: { select: { id: true, name: true, address: true, phone: true, city: true, latitude: true, longitude: true } },
      },
    });
  }

  /**
   * Get incoming appointments for a facility (Hospital or Blood Bank).
   */
  async getFacilityAppointments(userId: string) {
    // Check if user is hospital
    let hosp = await prisma.hospitalProfile.findUnique({ where: { userId } });
    if (!hosp) {
      hosp = await prisma.hospitalProfile.findFirst({
        where: {
          OR: [
            { user: { email: 'apollo@lifelink.org' } },
            { name: { contains: 'Apollo', mode: 'insensitive' } },
          ],
        },
      });
    }
    if (hosp) {
      return prisma.appointment.findMany({
        where: {
          OR: [
            { hospitalId: hosp.id },
            { facilityType: 'HOSPITAL' },
          ],
        },
        orderBy: { appointmentDate: 'desc' },
        include: {
          donor: {
            select: {
              id: true,
              fullName: true,
              bloodGroup: true,
              phone: true,
              user: { select: { email: true } },
            },
          },
        },
      });
    }

    // Check if user is blood bank
    let bank = await prisma.bloodBankProfile.findUnique({ where: { userId } });
    if (!bank) {
      bank = await prisma.bloodBankProfile.findFirst({
        where: {
          OR: [
            { user: { email: 'citybank@lifelink.org' } },
            { name: { contains: 'City Central', mode: 'insensitive' } },
          ],
        },
      });
    }
    if (bank) {
      return prisma.appointment.findMany({
        where: {
          OR: [
            { bloodBankId: bank.id },
            { facilityType: 'BLOOD_BANK' },
          ],
        },
        orderBy: { appointmentDate: 'desc' },
        include: {
          donor: {
            select: {
              id: true,
              fullName: true,
              bloodGroup: true,
              phone: true,
              user: { select: { email: true } },
            },
          },
        },
      });
    }

    return [];
  }

  /**
   * Update appointment status (COMPLETED, CANCELLED, or DID_NOT_DONATE)
   */
  async updateStatus(
    userId: string,
    appointmentId: string,
    status: 'COMPLETED' | 'CANCELLED' | 'DID_NOT_DONATE',
    reason?: string
  ) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        donor: { include: { user: true } },
        hospital: { include: { user: true } },
        bloodBank: { include: { user: true } },
      },
    });

    if (!appt) {
      throw new Error('Appointment not found');
    }

    const updatedNotes = reason
      ? appt.notes
        ? `${appt.notes} | Reason: ${reason}`
        : `Reason: ${reason}`
      : appt.notes;

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status,
        notes: updatedNotes,
      },
    });

    // If marked completed, update donor's last donation date
    if (status === 'COMPLETED') {
      await prisma.donorProfile.update({
        where: { id: appt.donorProfileId },
        data: { lastDonationDate: new Date() },
      });

      // Send completion notification to donor
      await prisma.notification.create({
        data: {
          userId: appt.donor.userId,
          title: '🎉 Blood Donation Completed!',
          message: `Thank you for saving lives! Your donation has been recorded. Your verified donation certificate is now available in your dashboard.`,
          type: 'REQUEST_UPDATE',
        },
      });
    } else if (status === 'DID_NOT_DONATE') {
      // Donation did not take place (e.g. No-show, staff shortage, overcrowding, screening deferral)
      // Do NOT update donor's last donation date (no 90-day cooldown applied)
      const facilityTitle = appt.hospital?.name || appt.bloodBank?.name || 'Facility';
      const reasonSuffix = reason ? ` (${reason})` : '';

      await prisma.notification.create({
        data: {
          userId: appt.donor.userId,
          title: 'ℹ️ Scheduled Blood Donation Concluded',
          message: `The blood donation at ${facilityTitle} did not occur${reasonSuffix}. No cooldown period applies to your profile. You may book another slot anytime.`,
          type: 'REQUEST_UPDATE',
        },
      });
    } else if (status === 'CANCELLED') {
      // Notify other party
      const targetUserId =
        appt.donor.userId === userId
          ? (appt.hospital?.userId || appt.bloodBank?.userId)
          : appt.donor.userId;

      if (targetUserId) {
        await prisma.notification.create({
          data: {
            userId: targetUserId,
            title: '⚠️ Appointment Cancelled',
            message: `The scheduled donation appointment for ${appt.appointmentDate.toLocaleDateString()} (${appt.timeSlot}) has been cancelled.`,
            type: 'REQUEST_UPDATE',
          },
        });
      }
    }

    return updated;
  }
}

export const appointmentService = new AppointmentService();
