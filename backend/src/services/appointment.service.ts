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
    const donor = await prisma.donorProfile.findUnique({
      where: { userId },
      include: { eligibility: true, user: true },
    });

    if (!donor) {
      throw new Error('Donor profile not found for this user account.');
    }

    // 2. Eligibility check: check medical eligibility and 90-day cooldown
    if (donor.eligibility && !donor.eligibility.isEligible) {
      throw new Error('Donor is currently marked as not medically eligible to donate.');
    }

    if (donor.lastDonationDate) {
      const cooldownDays = 90;
      const daysSince = Math.floor(
        (Date.now() - new Date(donor.lastDonationDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince < cooldownDays) {
        throw new Error(
          `Minimum interval between blood donations is 90 days. You have ${cooldownDays - daysSince} days remaining before your next eligible donation.`
        );
      }
    }

    // 3. Verify Facility exists and get facility name + recipient user ID for notification
    let facilityName = '';
    let facilityUserId = '';
    let hospitalId: string | null = null;
    let bloodBankId: string | null = null;

    if (data.facilityType === 'HOSPITAL') {
      const hosp = await prisma.hospitalProfile.findUnique({
        where: { id: data.facilityId },
        include: { user: true },
      });
      if (!hosp) {
        throw new Error('Selected hospital is not registered or verified on LifeLink.');
      }
      facilityName = hosp.name;
      facilityUserId = hosp.userId;
      hospitalId = hosp.id;
    } else {
      const bank = await prisma.bloodBankProfile.findUnique({
        where: { id: data.facilityId },
        include: { user: true },
      });
      if (!bank) {
        throw new Error('Selected blood bank is not registered or verified on LifeLink.');
      }
      facilityName = bank.name;
      facilityUserId = bank.userId;
      bloodBankId = bank.id;
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
    const donor = await prisma.donorProfile.findUnique({
      where: { userId },
    });
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
    const hosp = await prisma.hospitalProfile.findUnique({ where: { userId } });
    if (hosp) {
      return prisma.appointment.findMany({
        where: { hospitalId: hosp.id },
        orderBy: { appointmentDate: 'asc' },
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
    const bank = await prisma.bloodBankProfile.findUnique({ where: { userId } });
    if (bank) {
      return prisma.appointment.findMany({
        where: { bloodBankId: bank.id },
        orderBy: { appointmentDate: 'asc' },
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
   * Update appointment status (e.g. COMPLETED or CANCELLED)
   */
  async updateStatus(userId: string, appointmentId: string, status: 'COMPLETED' | 'CANCELLED') {
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

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status },
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
