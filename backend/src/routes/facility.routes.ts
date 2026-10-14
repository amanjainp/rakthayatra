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

export default router;
