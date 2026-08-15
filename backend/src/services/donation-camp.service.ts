import { PrismaClient, DonationCamp, CampStatus } from '@prisma/client';
import { DonationCampRepository } from '../repositories/donation-camp.repository';
import { DonorRepository } from '../repositories/donor.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { RedisService } from './redis.service';
import { BadRequestError, NotFoundError } from '../errors/app-error';
import { metricsService } from './metrics.service';

const prisma = new PrismaClient();
const redisService = new RedisService();

export interface VolunteerInput {
  name: string;
  email: string;
  phone: string;
}

export class DonationCampService {
  /**
   * Creates a new blood donation camp.
   */
  async createCamp(
    data: {
      name: string;
      organizer: string;
      address: string;
      city: string;
      latitude: number;
      longitude: number;
      startDate: Date;
      endDate: Date;
      status?: CampStatus;
      externalRegistrationUrl?: string | null;
    },
    userId?: string
  ): Promise<DonationCamp> {
    if (new Date(data.startDate) > new Date(data.endDate)) {
      throw new BadRequestError('Start date must be before end date.');
    }

    const camp = await prisma.$transaction(async (tx) => {
      const campRepo = new DonationCampRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      const record = await campRepo.create({
        name: data.name,
        organizer: data.organizer,
        address: data.address,
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: data.status || 'UPCOMING',
        externalRegistrationUrl: data.externalRegistrationUrl || null,
      });

      // Audit Log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'CREATE_DONATION_CAMP',
        details: {
          campId: record.id,
          name: data.name,
          startDate: data.startDate,
        },
      });

      return record;
    });

    return camp;
  }

  /**
   * Updates an existing donation camp.
   */
  async updateCamp(
    campId: string,
    data: {
      name?: string;
      organizer?: string;
      address?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      startDate?: Date;
      endDate?: Date;
      status?: CampStatus;
      externalRegistrationUrl?: string | null;
    },
    userId?: string
  ): Promise<DonationCamp> {
    const updated = await prisma.$transaction(async (tx) => {
      const campRepo = new DonationCampRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      const camp = await campRepo.findById(campId);
      if (!camp) {
        throw new NotFoundError('Donation camp record not found.');
      }

      const updateData: any = { ...data };
      if (data.startDate) updateData.startDate = new Date(data.startDate);
      if (data.endDate) updateData.endDate = new Date(data.endDate);

      if (updateData.startDate && updateData.endDate && updateData.startDate > updateData.endDate) {
        throw new BadRequestError('Start date must be before end date.');
      }

      const record = await campRepo.update(campId, updateData);

      // Audit Log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'UPDATE_DONATION_CAMP',
        details: {
          campId,
          updates: data,
        },
      });

      return record;
    });

    return updated;
  }

  /**
   * Performs soft deletion of a donation camp.
   */
  async deleteCamp(campId: string, userId?: string): Promise<DonationCamp> {
    const deleted = await prisma.$transaction(async (tx) => {
      const campRepo = new DonationCampRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      const camp = await campRepo.findById(campId);
      if (!camp) {
        throw new NotFoundError('Donation camp record not found.');
      }

      const record = await campRepo.delete(campId);

      // Audit Log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'DELETE_DONATION_CAMP',
        details: { campId },
      });

      return record;
    });

    return deleted;
  }

  /**
   * Registers a volunteer for a camp (stores in Redis, logs audit).
   */
  async registerVolunteer(campId: string, volunteer: VolunteerInput, userId?: string): Promise<void> {
    const campRepo = new DonationCampRepository(prisma);
    const camp = await campRepo.findById(campId);
    if (!camp) {
      throw new NotFoundError('Donation camp not found.');
    }

    const key = `camp:${campId}:volunteers`;
    const volunteersStr = await redisService.get(key);
    const volunteers = JSON.parse(volunteersStr || '[]');

    // Prevent duplicate registrations
    if (volunteers.some((v: any) => v.email === volunteer.email)) {
      throw new BadRequestError('Volunteer with this email is already registered for this camp.');
    }

    volunteers.push({
      ...volunteer,
      registeredAt: new Date(),
    });

    await redisService.set(key, JSON.stringify(volunteers));

    // Audit Log
    const auditLogRepo = new AuditLogRepository(prisma);
    await auditLogRepo.create({
      user: userId ? { connect: { id: userId } } : undefined,
      action: 'REGISTER_CAMP_VOLUNTEER',
      details: {
        campId,
        volunteerEmail: volunteer.email,
        volunteerName: volunteer.name,
      },
    });

    metricsService.recordCampRegistration('volunteer');
  }

  /**
   * Registers a donor to attend a camp (Updates DonorProfile in database).
   */
  async registerDonor(campId: string, donorProfileId: string, userId?: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const campRepo = new DonationCampRepository(tx as any);
      const donorRepo = new DonorRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      const camp = await campRepo.findById(campId);
      if (!camp) {
        throw new NotFoundError('Donation camp not found.');
      }

      if (camp.status === 'COMPLETED' || camp.status === 'CANCELLED') {
        throw new BadRequestError(`Cannot register donor for a camp drives with status: ${camp.status}`);
      }

      const donor = await donorRepo.findById(donorProfileId);
      if (!donor) {
        throw new NotFoundError('Donor profile not found.');
      }

      await donorRepo.update(donorProfileId, {
        donationCamp: { connect: { id: campId } },
      });

      // Audit Log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'REGISTER_CAMP_DONOR',
        details: { campId, donorProfileId },
      });
    });

    metricsService.recordCampRegistration('donor');
  }

  /**
   * Associates a hospital profile with a camp (stores in Redis, logs audit).
   */
  async associateHospital(campId: string, hospitalProfileId: string, userId?: string): Promise<void> {
    const campRepo = new DonationCampRepository(prisma);
    const camp = await campRepo.findById(campId);
    if (!camp) {
      throw new NotFoundError('Donation camp not found.');
    }

    const hospitalRepo = new HospitalRepository(prisma);
    const hospital = await hospitalRepo.findById(hospitalProfileId);
    if (!hospital) {
      throw new NotFoundError('Hospital profile not found.');
    }

    const key = `camp:${campId}:hospitals`;
    const hospitalsStr = await redisService.get(key);
    const hospitals = JSON.parse(hospitalsStr || '[]');

    if (hospitals.some((h: any) => h.hospitalProfileId === hospitalProfileId)) {
      throw new BadRequestError('Hospital is already associated with this donation camp.');
    }

    hospitals.push({
      hospitalProfileId,
      associatedAt: new Date(),
    });

    await redisService.set(key, JSON.stringify(hospitals));

    // Audit Log
    const auditLogRepo = new AuditLogRepository(prisma);
    await auditLogRepo.create({
      user: userId ? { connect: { id: userId } } : undefined,
      action: 'ASSOCIATE_CAMP_HOSPITAL',
      details: { campId, hospitalProfileId },
    });

    metricsService.recordCampRegistration('hospital');
  }

  /**
   * Compiles detailed statistics for a donation camp.
   */
  async getCampStatistics(campId: string): Promise<{
    registeredDonorsCount: number;
    completedDonationsCount: number;
    totalUnitsCollected: number;
    volunteersRegisteredCount: number;
    associatedHospitalsCount: number;
  }> {
    const campRepo = new DonationCampRepository(prisma);
    const camp = await campRepo.findById(campId);
    if (!camp) {
      throw new NotFoundError('Donation camp not found.');
    }

    // 1. Registered Donors
    const registeredDonorsCount = await prisma.donorProfile.count({
      where: { donationCampId: campId, deletedAt: null },
    });

    // 2. Completed Donations
    const completedDonationsCount = await prisma.donation.count({
      where: { donationCampId: campId, status: 'COMPLETED' },
    });

    // 3. Units collected
    const donationSum = await prisma.donation.aggregate({
      where: { donationCampId: campId, status: 'COMPLETED' },
      _sum: { unitsDonated: true },
    });
    const totalUnitsCollected = donationSum._sum.unitsDonated || 0;

    // 4. Volunteers (from Redis)
    const volunteersStr = await redisService.get(`camp:${campId}:volunteers`);
    const volunteersCount = JSON.parse(volunteersStr || '[]').length;

    // 5. Hospitals (from Redis)
    const hospitalsStr = await redisService.get(`camp:${campId}:hospitals`);
    const hospitalsCount = JSON.parse(hospitalsStr || '[]').length;

    return {
      registeredDonorsCount,
      completedDonationsCount,
      totalUnitsCollected,
      volunteersRegisteredCount: volunteersCount,
      associatedHospitalsCount: hospitalsCount,
    };
  }

  /**
   * Queries list of upcoming/active camps.
   */
  async getCamps(params: { page?: number; limit?: number; city?: string }): Promise<{
    items: DonationCamp[];
    total: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 10;

    // Seed real-world active and upcoming blood donation camps in Mysuru and Bengaluru
    const realCamps = [
      {
        name: 'CurePlus Blood Centre Donation Camp',
        organizer: 'CurePlus Blood Centre',
        address: 'ARC Sportzone, Hebbal Industrial Area, Mysuru',
        city: 'Mysuru',
        latitude: 12.3550,
        longitude: 76.6200,
        startDate: new Date('2026-08-16T09:00:00Z'),
        endDate: new Date('2026-08-18T18:00:00Z'),
        status: 'UPCOMING' as any,
        externalRegistrationUrl: 'https://cureplusbloodbank.com/'
      },
      {
        name: 'Juhar Parivar Independence Drive',
        organizer: 'Juhar Parivar & Kauvery Hospital',
        address: 'Kauvery Hospital, Electronic City, Bengaluru',
        city: 'Bengaluru',
        latitude: 12.8465,
        longitude: 77.6625,
        startDate: new Date('2026-08-17T09:00:00Z'),
        endDate: new Date('2026-08-19T18:00:00Z'),
        status: 'UPCOMING' as any,
        externalRegistrationUrl: 'https://www.kauveryhospital.com/'
      }
    ];

    for (const camp of realCamps) {
      if (prisma.donationCamp && typeof prisma.donationCamp.findFirst === 'function') {
        const existing = await prisma.donationCamp.findFirst({
          where: { name: camp.name }
        });
        if (!existing) {
          if (typeof prisma.donationCamp.create === 'function') {
            await prisma.donationCamp.create({ data: camp }).catch(() => null);
          }
        } else if (existing.externalRegistrationUrl !== camp.externalRegistrationUrl) {
          if (typeof prisma.donationCamp.update === 'function') {
            await prisma.donationCamp.update({
              where: { id: existing.id },
              data: { externalRegistrationUrl: camp.externalRegistrationUrl }
            }).catch(() => null);
          }
        }
      }
    }

    const campRepo = new DonationCampRepository(prisma);
    const whereClause: any = {};
    if (params.city) {
      whereClause.city = { contains: params.city, mode: 'insensitive' };
    }

    return campRepo.findPaginated({
      page,
      limit,
      where: whereClause,
      orderBy: { startDate: 'asc' },
    });
  }
}

export const donationCampService = new DonationCampService();
