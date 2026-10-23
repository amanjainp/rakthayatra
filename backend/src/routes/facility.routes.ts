import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * Public facilities directory (Hospitals & Blood Banks)
 */
router.get('/public', async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined; // 'HOSPITAL' | 'BLOOD_BANK'
    const city = req.query.city as string | undefined;

    const hospitalWhere: any = {};
    const bloodBankWhere: any = {};

    if (city) {
      hospitalWhere.city = { contains: city, mode: 'insensitive' };
      bloodBankWhere.city = { contains: city, mode: 'insensitive' };
    }

    let hospitals: any[] = [];
    let bloodBanks: any[] = [];

    if (!type || type === 'HOSPITAL') {
      hospitals = await prisma.hospitalProfile.findMany({
        where: hospitalWhere,
        select: {
          id: true,
          name: true,
          licenseNumber: true,
          phone: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
          isVerified: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    if (!type || type === 'BLOOD_BANK') {
      bloodBanks = await prisma.bloodBankProfile.findMany({
        where: bloodBankWhere,
        select: {
          id: true,
          name: true,
          licenseNumber: true,
          phone: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
          isVerified: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      });
    }

    const facilities = [
      ...hospitals.map((h) => ({ ...h, facilityType: 'HOSPITAL' })),
      ...bloodBanks.map((b) => ({ ...b, facilityType: 'BLOOD_BANK' })),
    ];

    return res.status(200).json({
      success: true,
      data: {
        total: facilities.length,
        hospitalsCount: hospitals.length,
        bloodBanksCount: bloodBanks.length,
        facilities,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch public facilities: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve facilities list.',
      },
    });
  }
});

/**
 * GET /api/facilities/active-donors
 * Returns active registered donors around the authenticated facility (Hospital or Blood Bank)
 * within a requested radius (e.g. 10km, 25km, 50km, 100km).
 */
router.get('/active-donors', async (req: Request, res: Response) => {
  try {
    const { authenticate } = require('../middlewares/auth.middleware');
    // Run authentication
    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err: any) => (err ? reject(err) : resolve()));
    });

    const userId = (req as any).user?.userId || (req as any).user?.id;
    const radius = parseFloat((req.query.radius as string) || '100');
    const bloodGroup = req.query.bloodGroup as string | undefined;

    // Determine facility origin coordinates
    let facilityLat = 12.9716;
    let facilityLng = 77.5946;
    let facilityName = 'Facility';

    const hosp = await prisma.hospitalProfile.findUnique({ where: { userId } });
    if (hosp) {
      facilityLat = hosp.latitude;
      facilityLng = hosp.longitude;
      facilityName = hosp.name;
    } else {
      const bank = await prisma.bloodBankProfile.findUnique({ where: { userId } });
      if (bank) {
        facilityLat = bank.latitude;
        facilityLng = bank.longitude;
        facilityName = bank.name;
      }
    }

    const { mapsService } = require('../services/maps.service');

    const whereClause: any = {
      isAvailable: true,
      deletedAt: null,
    };
    if (bloodGroup) {
      whereClause.bloodGroup = bloodGroup;
    }

    const activeDonors = await prisma.donorProfile.findMany({
      where: whereClause,
      include: {
        eligibility: true,
      },
    });

    const matchedDonors = [];
    for (const d of activeDonors) {
      const dist = mapsService.calculateDistance(
        facilityLat,
        facilityLng,
        d.latitude,
        d.longitude
      );

      if (dist <= radius) {
        matchedDonors.push({
          id: d.id,
          fullName: d.fullName,
          bloodGroup: d.bloodGroup,
          address: d.address,
          latitude: d.latitude,
          longitude: d.longitude,
          distanceKm: parseFloat(dist.toFixed(1)),
          isAvailable: d.isAvailable,
          isEligible: d.eligibility ? d.eligibility.isEligible : true,
          lastDonationDate: d.lastDonationDate,
        });
      }
    }

    matchedDonors.sort((a, b) => a.distanceKm - b.distanceKm);

    return res.status(200).json({
      success: true,
      data: {
        facility: { name: facilityName, latitude: facilityLat, longitude: facilityLng },
        radiusKm: radius,
        totalDonorsFound: matchedDonors.length,
        donors: matchedDonors,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to fetch active donors for facility: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve active donors.',
    });
  }
});

export default router;
