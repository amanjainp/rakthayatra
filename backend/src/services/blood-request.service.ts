import { PrismaClient, BloodRequest, RequestUrgency, RequestStatus, BloodGroup } from '@prisma/client';
import { BloodRequestRepository } from '../repositories/blood-request.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { BadRequestError, NotFoundError } from '../errors/app-error';
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

      return record;
    });

    return request;
  }

  /**
   * Implements request state machine transitions.
   */
  async updateRequestStatus(
    requestId: string,
    newStatus: RequestStatus,
    userId?: string
  ): Promise<BloodRequest> {
    const updated = await prisma.$transaction(async (tx) => {
      const requestRepo = new BloodRequestRepository(tx as any);
      const auditLogRepo = new AuditLogRepository(tx as any);

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
