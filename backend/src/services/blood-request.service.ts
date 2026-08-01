import { PrismaClient, BloodRequest, RequestUrgency, RequestStatus, BloodGroup } from '@prisma/client';
import { BloodRequestRepository } from '../repositories/blood-request.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { InventoryRepository } from '../repositories/inventory.repository';
import { BadRequestError, NotFoundError } from '../errors/app-error';
import { BLOOD_COMPATIBILITY } from '../constants/app.constants';
import { mapsService } from './maps.service';
import { firebaseService } from './firebase.service';
import logger from '../config/logger';

const prisma = new PrismaClient();

export class BloodRequestService {
  /**
   * Submits a new blood request (Normal or Emergency).
   */
  async createRequest(
    data: {
      requesterId: string;
      bloodGroup: BloodGroup;
      unitsRequired: number;
      urgency: RequestUrgency;
      locationName: string;
      latitude: number;
      longitude: number;
      message?: string;
    },
    userId?: string
  ): Promise<BloodRequest> {
    if (data.unitsRequired <= 0) {
      throw new BadRequestError('Units required must be a positive integer.');
    }

    if (data.latitude < -90 || data.latitude > 90 || data.longitude < -180 || data.longitude > 180) {
      throw new BadRequestError('Invalid geocoding coordinates.');
    }

    // Set expiry: 24h for EMERGENCY, 7 days for NORMAL
    const expiresAt = new Date();
    if (data.urgency === 'EMERGENCY') {
      expiresAt.setDate(expiresAt.getDate() + 1);
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7);
    }

    // Capture matching donors to alert later (outside of transaction lock)
    let donorsToNotify: string[] = [];

    const request = await prisma.$transaction(async (tx) => {
      const requestRepo = new BloodRequestRepository(tx as any);
      const userRepo = new UserRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      // Verify requester exists
      const user = await userRepo.findById(data.requesterId);
      if (!user) {
        throw new NotFoundError('Requester user account not found.');
      }

      // Create request record
      const record = await requestRepo.create({
        requester: { connect: { id: data.requesterId } },
        bloodGroup: data.bloodGroup,
        unitsRequired: data.unitsRequired,
        urgency: data.urgency,
        locationName: data.locationName,
        latitude: data.latitude,
        longitude: data.longitude,
        message: data.message,
        expiresAt,
        status: 'PENDING',
      });

      // Write audit log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: 'CREATE_BLOOD_REQUEST',
        details: {
          requestId: record.id,
          requesterId: data.requesterId,
          bloodGroup: data.bloodGroup,
          urgency: data.urgency,
        },
      });

      // Request ↔ Donation Integration: If EMERGENCY, match nearby donors
      if (data.urgency === 'EMERGENCY') {
        const compatibleGroups = BLOOD_COMPATIBILITY[data.bloodGroup];

        // Optimized bounding box search to utilize spatial indices
        const latDiff = 50 / 111.0; // ~50km in latitude degrees
        const lonDiff = 50 / (111.0 * Math.cos(data.latitude * Math.PI / 180));

        const minLat = data.latitude - latDiff;
        const maxLat = data.latitude + latDiff;
        const minLon = data.longitude - Math.abs(lonDiff);
        const maxLon = data.longitude + Math.abs(lonDiff);

        // Fetch candidates using bounding box query
        const candidates = await tx.donorProfile.findMany({
          where: {
            isAvailable: true,
            deletedAt: null,
            bloodGroup: { in: compatibleGroups },
            latitude: { gte: minLat, lte: maxLat },
            longitude: { gte: minLon, lte: maxLon },
          },
          select: {
            userId: true,
            latitude: true,
            longitude: true,
          },
        });

        // Exact distance check using Haversine
        for (const candidate of candidates) {
          const distance = mapsService.calculateDistance(
            data.latitude,
            data.longitude,
            candidate.latitude,
            candidate.longitude
          );
          if (distance <= 50) {
            donorsToNotify.push(candidate.userId);
          }
        }
      }

      return record;
    });

    // Alert matching donors asynchronously
    if (donorsToNotify.length > 0) {
      Promise.all(
        donorsToNotify.map((donorUserId) =>
          firebaseService
            .sendPushNotification(
              donorUserId,
              'Urgent Blood Donation Required!',
              `An emergency request for blood group ${data.bloodGroup} has been made near you. Please check your eligibility and donate!`,
              'EMERGENCY_ALERT'
            )
            .catch((err) => logger.warn(`Failed to alert matching donor ${donorUserId}: ${err.message}`))
        )
      );
    }

    return request;
  }

  /**
   * Implements request state machine transitions.
   */
  async updateRequestStatus(
    requestId: string,
    newStatus: RequestStatus,
    userId?: string,
    inventoryId?: string
  ): Promise<BloodRequest> {
    const updated = await prisma.$transaction(async (tx) => {
      const requestRepo = new BloodRequestRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);
      const inventoryRepo = new InventoryRepository(tx as any);

      const requestRecord = await requestRepo.findById(requestId);
      if (!requestRecord) {
        throw new NotFoundError('Blood request record not found.');
      }

      const currentStatus = requestRecord.status;

      // Transition validations
      if (newStatus === 'APPROVED') {
        if (currentStatus !== 'PENDING') {
          throw new BadRequestError(`Cannot approve a request with status: ${currentStatus}`);
        }
      } else if (newStatus === 'FULFILLED') {
        if (currentStatus !== 'APPROVED') {
          throw new BadRequestError(`Cannot fulfill a request with status: ${currentStatus}`);
        }

        // Request ↔ Inventory Integration: Fulfill logic reserves/allocates blood units
        const compatibleGroups = BLOOD_COMPATIBILITY[requestRecord.bloodGroup];
        let targetInventory: any;

        if (inventoryId) {
          targetInventory = await tx.bloodInventory.findUnique({
            where: { id: inventoryId },
          });
          if (!targetInventory) {
            throw new NotFoundError('Target blood inventory item not found.');
          }
          if (targetInventory.status !== 'AVAILABLE') {
            throw new BadRequestError(`Target inventory item status is not AVAILABLE: ${targetInventory.status}`);
          }
          if (!compatibleGroups.includes(targetInventory.bloodGroup)) {
            throw new BadRequestError(
              `Target inventory blood group ${targetInventory.bloodGroup} is not compatible with request blood group ${requestRecord.bloodGroup}`
            );
          }
          if (targetInventory.unitsCount < requestRecord.unitsRequired) {
            throw new BadRequestError(
              `Target inventory has insufficient units: ${targetInventory.unitsCount} available, ${requestRecord.unitsRequired} required.`
            );
          }
        } else {
          // Automatic matching of compatible available units
          targetInventory = await tx.bloodInventory.findFirst({
            where: {
              status: 'AVAILABLE',
              bloodGroup: { in: compatibleGroups },
              unitsCount: { gte: requestRecord.unitsRequired },
            },
          });
          if (!targetInventory) {
            throw new BadRequestError('No compatible blood units available in inventory to fulfill this request.');
          }
        }

        // Allocate units (using split if partial allocation is needed)
        if (targetInventory.unitsCount === requestRecord.unitsRequired) {
          await inventoryRepo.update(targetInventory.id, {
            status: 'RESERVED',
          });
        } else {
          const remaining = targetInventory.unitsCount - requestRecord.unitsRequired;
          await inventoryRepo.update(targetInventory.id, {
            unitsCount: remaining,
          });
          await inventoryRepo.create({
            bloodBank: { connect: { id: targetInventory.bloodBankId } },
            bloodGroup: targetInventory.bloodGroup,
            unitsCount: requestRecord.unitsRequired,
            expiryDate: targetInventory.expiryDate,
            status: 'RESERVED',
          });
        }
      } else if (newStatus === 'CANCELLED') {
        if (currentStatus !== 'PENDING' && currentStatus !== 'APPROVED') {
          throw new BadRequestError(`Cannot cancel/reject a request with status: ${currentStatus}`);
        }
      }

      // Update request status
      const record = await requestRepo.update(requestId, {
        status: newStatus,
      });

      // Audit Log
      await auditLogRepo.create({
        user: userId ? { connect: { id: userId } } : undefined,
        action: `UPDATE_BLOOD_REQUEST_STATUS_${newStatus}`,
        details: {
          requestId,
          previousStatus: currentStatus,
          newStatus,
          inventoryFulfillmentId: inventoryId || undefined,
        },
      });

      return record;
    });

    return updated;
  }

  /**
   * Scans and flags expired requests.
   */
  async checkAndFlagExpiredRequests(userId?: string): Promise<BloodRequest[]> {
    const now = new Date();
    const expiredList = await prisma.$transaction(async (tx) => {
      const requestRepo = new BloodRequestRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

      // Fetch pending or approved requests that are past expiresAt
      const expiredItems = await tx.bloodRequest.findMany({
        where: {
          expiresAt: { lte: now },
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });

      const updatedList: BloodRequest[] = [];
      for (const item of expiredItems) {
        const updated = await requestRepo.update(item.id, {
          status: 'CANCELLED',
        });
        updatedList.push(updated);

        // Audit Log
        await auditLogRepo.create({
          user: userId ? { connect: { id: userId } } : undefined,
          action: 'EXPIRE_BLOOD_REQUEST',
          details: {
            requestId: item.id,
            requesterId: item.requesterId,
          },
        });
      }

      return updatedList;
    });

    if (expiredList.length > 0) {
      logger.info(`Flagged ${expiredList.length} expired blood requests as CANCELLED.`);
    }

    return expiredList;
  }

  /**
   * Search requests with pagination and query filters.
   */
  async searchRequests(params: {
    bloodGroup?: BloodGroup;
    status?: RequestStatus;
    page?: number;
    limit?: number;
  }): Promise<{ items: BloodRequest[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 10;

    const requestRepo = new BloodRequestRepository(prisma);
    const whereClause: any = {};
    if (params.bloodGroup) {
      whereClause.bloodGroup = params.bloodGroup;
    }
    if (params.status) {
      whereClause.status = params.status;
    }

    return requestRepo.findPaginated({
      page,
      limit,
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: { requester: true },
    });
  }
}

export const bloodRequestService = new BloodRequestService();
