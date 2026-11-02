import {
  PrismaClient,
  BloodGroup,
  BloodComponent,
  RedistributionUrgency,
  RedistributionStatus,
} from '@prisma/client';
import crypto from 'crypto';
import { compatibilityService, COMPONENT_STORAGE_POLICIES, REGULATORY_DISCLAIMER } from './compatibility.service';
import { mapsService } from './maps.service';
import { firebaseService } from './firebase.service';
import { redisService } from './redis.service';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../errors/app-error';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface AuthorizedInstitution {
  userId: string;
  role: string;
  facilityType: 'HOSPITAL' | 'BLOOD_BANK' | 'ADMIN';
  facilityId: string | null;
  hospitalId: string | null;
  bloodBankId: string | null;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  isVerified: boolean;
}

/**
 * Transparent & Configurable Matching Scoring Weights
 */
export const REDISTRIBUTION_SCORING_WEIGHTS = {
  proximityWeight: 0.30,
  fulfillmentCapacityWeight: 0.30,
  shelfLifeOptimizationWeight: 0.20,
  compatibilityTierWeight: 0.20,
} as const;

/**
 * Operational limits per urgency level
 */
export const URGENCY_OPERATIONAL_RULES: Record<
  RedistributionUrgency,
  {
    maxUnitsPerRequest: number;
    minLeadTimeMinutes: number;
    description: string;
  }
> = {
  ROUTINE: {
    maxUnitsPerRequest: 50,
    minLeadTimeMinutes: 60,
    description: 'Scheduled inter-facility stock balancing and preventive inventory replenishment.',
  },
  URGENT: {
    maxUnitsPerRequest: 30,
    minLeadTimeMinutes: 15,
    description: 'High-priority clinical shortage requiring expedited inter-hospital coordination.',
  },
  CRITICAL: {
    maxUnitsPerRequest: 20,
    minLeadTimeMinutes: 5,
    description: 'Immediate life-critical clinical shortage; triggers priority alerts to compatible verified institutions.',
  },
};

/**
 * Explicit State Transition Matrix for Transfers
 */
export const VALID_TRANSFER_TRANSITIONS: Record<RedistributionStatus, RedistributionStatus[]> = {
  REQUESTED: ['MATCHING', 'PROPOSED', 'CANCELLED', 'EXPIRED'],
  MATCHING: ['PROPOSED', 'AWAITING_APPROVAL', 'CANCELLED', 'EXPIRED'],
  PROPOSED: ['AWAITING_APPROVAL', 'APPROVED', 'RESERVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  AWAITING_APPROVAL: ['APPROVED', 'RESERVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  APPROVED: ['RESERVED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'CANCELLED', 'FAILED'],
  RESERVED: ['READY_FOR_DISPATCH', 'DISPATCHED', 'CANCELLED', 'EXPIRED', 'FAILED'],
  READY_FOR_DISPATCH: ['DISPATCHED', 'CANCELLED', 'FAILED'],
  DISPATCHED: ['IN_TRANSIT', 'RECEIVED', 'FAILED'],
  IN_TRANSIT: ['RECEIVED', 'FAILED'],
  RECEIVED: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
  FAILED: [],
};

export class RedistributionService {
  /**
   * Resolves the authenticated user's institution and enforces RBAC.
   */
  async resolveUserInstitution(userId: string, role: string, requireVerified = false): Promise<AuthorizedInstitution> {
    if (!['HOSPITAL', 'BLOOD_BANK', 'ADMIN'].includes(role)) {
      throw new ForbiddenError('Only authorized hospitals, blood banks, and platform administrators can access blood redistribution workflows.');
    }

    if (role === 'HOSPITAL') {
      const hospital = await prisma.hospitalProfile.findUnique({
        where: { userId },
      });
      if (!hospital || hospital.deletedAt) {
        throw new ForbiddenError('No active Hospital profile is associated with this account.');
      }
      if (requireVerified && !hospital.isVerified) {
        throw new ForbiddenError('Your Hospital facility must be verified before initiating or approving blood redistribution transfers.');
      }
      return {
        userId,
        role,
        facilityType: 'HOSPITAL',
        facilityId: hospital.id,
        hospitalId: hospital.id,
        bloodBankId: null,
        name: hospital.name,
        city: hospital.city,
        address: hospital.address,
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        isVerified: hospital.isVerified,
      };
    }

    if (role === 'BLOOD_BANK') {
      const bank = await prisma.bloodBankProfile.findUnique({
        where: { userId },
      });
      if (!bank || bank.deletedAt) {
        throw new ForbiddenError('No active Blood Bank profile is associated with this account.');
      }
      if (requireVerified && !bank.isVerified) {
        throw new ForbiddenError('Your Blood Bank facility must be verified before initiating or approving blood redistribution transfers.');
      }
      return {
        userId,
        role,
        facilityType: 'BLOOD_BANK',
        facilityId: bank.id,
        hospitalId: null,
        bloodBankId: bank.id,
        name: bank.name,
        city: bank.city,
        address: bank.address,
        latitude: bank.latitude,
        longitude: bank.longitude,
        isVerified: bank.isVerified,
      };
    }

    // ADMIN
    return {
      userId,
      role: 'ADMIN',
      facilityType: 'ADMIN',
      facilityId: null,
      hospitalId: null,
      bloodBankId: null,
      name: 'Platform Administrator',
      city: 'System',
      address: 'Platform Command Center',
      latitude: 12.9716,
      longitude: 77.5946,
      isVerified: true,
    };
  }

  /**
   * Checks whether an institution owns the destination side of a request/transfer.
   */
  public isDestinationOwner(
    inst: AuthorizedInstitution,
    record: { destinationHospitalId?: string | null; destinationBloodBankId?: string | null }
  ): boolean {
    if (inst.role === 'ADMIN') return true;
    if (inst.hospitalId && record.destinationHospitalId === inst.hospitalId) return true;
    if (inst.bloodBankId && record.destinationBloodBankId === inst.bloodBankId) return true;
    return false;
  }

  /**
   * Checks whether an institution owns the source side of a proposal/transfer.
   */
  public isSourceOwner(
    inst: AuthorizedInstitution,
    record: { sourceHospitalId?: string | null; sourceBloodBankId?: string | null }
  ): boolean {
    if (inst.role === 'ADMIN') return true;
    if (inst.hospitalId && record.sourceHospitalId === inst.hospitalId) return true;
    if (inst.bloodBankId && record.sourceBloodBankId === inst.bloodBankId) return true;
    return false;
  }

  /**
   * Validates state machine transition.
   */
  public validateTransition(currentState: RedistributionStatus, nextState: RedistributionStatus): void {
    const allowed = VALID_TRANSFER_TRANSITIONS[currentState] || [];
    if (!allowed.includes(nextState)) {
      throw new BadRequestError(
        `Invalid state transition from ${currentState} to ${nextState}. Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'None (terminal state)'
        }.`
      );
    }
  }

  /**
   * Lists the authenticated institution's own blood inventory (supporting both Hospitals and Blood Banks).
   */
  async getInstitutionInventory(userId: string, role: string, filters?: { bloodGroup?: BloodGroup; componentType?: BloodComponent; status?: string }) {
    const inst = await this.resolveUserInstitution(userId, role, false);

    const where: any = {};
    if (inst.role === 'HOSPITAL') {
      where.hospitalId = inst.hospitalId;
    } else if (inst.role === 'BLOOD_BANK') {
      where.bloodBankId = inst.bloodBankId;
    }

    if (filters?.bloodGroup) where.bloodGroup = filters.bloodGroup;
    if (filters?.componentType) where.componentType = filters.componentType;
    if (filters?.status) where.status = filters.status;

    const items = await prisma.bloodInventory.findMany({
      where,
      include: {
        hospital: { select: { id: true, name: true, city: true, isVerified: true } },
        bloodBank: { select: { id: true, name: true, city: true, isVerified: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    return {
      institution: inst,
      items,
      storagePolicies: COMPONENT_STORAGE_POLICIES,
    };
  }

  /**
   * Registers blood/component stock for the authenticated Hospital or Blood Bank.
   */
  async addInstitutionInventory(
    userId: string,
    role: string,
    data: {
      bloodGroup: BloodGroup;
      componentType?: BloodComponent;
      unitsCount: number;
      expiryDate: string | Date;
      collectionDate?: string | Date;
      batchNumber?: string;
      storageTemp?: string;
      targetHospitalId?: string;
      targetBloodBankId?: string;
    }
  ) {
    const inst = await this.resolveUserInstitution(userId, role, true);

    if (data.unitsCount <= 0 || !Number.isInteger(data.unitsCount)) {
      throw new BadRequestError('Units count must be a positive integer.');
    }

    const expiry = new Date(data.expiryDate);
    if (isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
      throw new BadRequestError('Expiry date must be a valid future date.');
    }

    const componentType = data.componentType || 'WHOLE_BLOOD';
    const policy = compatibilityService.getStoragePolicy(componentType);

    const hospitalId = inst.role === 'HOSPITAL' ? inst.hospitalId : data.targetHospitalId || null;
    const bloodBankId = inst.role === 'BLOOD_BANK' ? inst.bloodBankId : data.targetBloodBankId || null;

    if (!hospitalId && !bloodBankId) {
      throw new BadRequestError('Target institution (Hospital or Blood Bank) could not be determined.');
    }

    const created = await prisma.$transaction(async (tx) => {
      const record = await tx.bloodInventory.create({
        data: {
          hospitalId,
          bloodBankId,
          bloodGroup: data.bloodGroup,
          componentType,
          unitsCount: data.unitsCount,
          expiryDate: expiry,
          collectionDate: data.collectionDate ? new Date(data.collectionDate) : new Date(),
          batchNumber: data.batchNumber || `LOT-${Date.now().toString().slice(-6)}`,
          storageTemp: data.storageTemp || policy.storageTempRange,
          status: 'AVAILABLE',
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'REGISTER_INSTITUTION_INVENTORY',
          details: {
            inventoryId: record.id,
            facilityType: inst.facilityType,
            facilityId: hospitalId || bloodBankId,
            bloodGroup: data.bloodGroup,
            componentType,
            unitsCount: data.unitsCount,
            expiryDate: expiry.toISOString(),
          },
        },
      });

      return record;
    });

    if (bloodBankId) {
      await redisService.del(`inventory:${bloodBankId}`).catch(() => null);
    }

    return created;
  }

  /**
   * Creates a new Hospital-to-Hospital / Facility Blood Redistribution Request.
   */
  async createRequest(
    userId: string,
    role: string,
    data: {
      bloodGroup: BloodGroup;
      componentType?: BloodComponent;
      unitsRequired: number;
      urgency?: RedistributionUrgency;
      requiredBy: string | Date;
      minRemainingShelfLifeDays?: number;
      deliveryAddress?: string;
      reason: string;
      specialHandlingNotes?: string;
      additionalNotes?: string;
      destinationHospitalId?: string;
      destinationBloodBankId?: string;
    },
    correlationId?: string
  ) {
    const inst = await this.resolveUserInstitution(userId, role, true);

    if (!Number.isInteger(data.unitsRequired) || data.unitsRequired <= 0) {
      throw new BadRequestError('Number of units required must be a positive integer.');
    }

    const urgency: RedistributionUrgency = data.urgency || 'ROUTINE';
    const urgencyRule = URGENCY_OPERATIONAL_RULES[urgency];

    if (data.unitsRequired > urgencyRule.maxUnitsPerRequest) {
      throw new BadRequestError(
        `Requested quantity (${data.unitsRequired}) exceeds maximum operational limit (${urgencyRule.maxUnitsPerRequest} units) for ${urgency} requests.`
      );
    }

    const requiredByDate = new Date(data.requiredBy);
    if (isNaN(requiredByDate.getTime())) {
      throw new BadRequestError('Invalid required-by date and time.');
    }

    const minAllowedTime = Date.now() + urgencyRule.minLeadTimeMinutes * 60 * 1000;
    if (requiredByDate.getTime() < minAllowedTime) {
      throw new BadRequestError(
        `Required-by time for ${urgency} requests must be at least ${urgencyRule.minLeadTimeMinutes} minutes in the future.`
      );
    }

    // Prevent creating request on behalf of an unrelated institution
    if (inst.role === 'HOSPITAL' && data.destinationHospitalId && data.destinationHospitalId !== inst.hospitalId) {
      throw new ForbiddenError('Cannot create a redistribution request on behalf of an unrelated hospital.');
    }
    if (inst.role === 'BLOOD_BANK' && data.destinationBloodBankId && data.destinationBloodBankId !== inst.bloodBankId) {
      throw new ForbiddenError('Cannot create a redistribution request on behalf of an unrelated blood bank.');
    }

    let destinationFacilityType = inst.facilityType === 'ADMIN' ? 'HOSPITAL' : inst.facilityType;
    let destinationHospitalId = inst.hospitalId;
    let destinationBloodBankId = inst.bloodBankId;
    let deliveryAddress = data.deliveryAddress || inst.address;
    let deliveryLat = inst.latitude;
    let deliveryLng = inst.longitude;
    let destName = inst.name;

    if (inst.role === 'ADMIN') {
      if (data.destinationHospitalId) {
        const h = await prisma.hospitalProfile.findUnique({ where: { id: data.destinationHospitalId } });
        if (!h || !h.isVerified) throw new BadRequestError('Target destination hospital not found or unverified.');
        destinationFacilityType = 'HOSPITAL';
        destinationHospitalId = h.id;
        deliveryAddress = data.deliveryAddress || h.address;
        deliveryLat = h.latitude;
        deliveryLng = h.longitude;
        destName = h.name;
      } else if (data.destinationBloodBankId) {
        const b = await prisma.bloodBankProfile.findUnique({ where: { id: data.destinationBloodBankId } });
        if (!b || !b.isVerified) throw new BadRequestError('Target destination blood bank not found or unverified.');
        destinationFacilityType = 'BLOOD_BANK';
        destinationBloodBankId = b.id;
        deliveryAddress = data.deliveryAddress || b.address;
        deliveryLat = b.latitude;
        deliveryLng = b.longitude;
        destName = b.name;
      } else {
        throw new BadRequestError('Admin must specify an authorized destinationHospitalId or destinationBloodBankId.');
      }
    }

    const componentType: BloodComponent = data.componentType || 'WHOLE_BLOOD';
    const defaultShelfLife = compatibilityService.getStoragePolicy(componentType).defaultMinRemainingDays;
    const minRemainingShelfLifeDays =
      data.minRemainingShelfLifeDays !== undefined ? data.minRemainingShelfLifeDays : defaultShelfLife;

    if (minRemainingShelfLifeDays < 1 || minRemainingShelfLifeDays > 365) {
      throw new BadRequestError('Minimum acceptable remaining shelf life must be between 1 and 365 days.');
    }

    const createdRequest = await prisma.$transaction(async (tx) => {
      const reqRecord = await tx.redistributionRequest.create({
        data: {
          requesterUserId: userId,
          destinationFacilityType,
          destinationHospitalId,
          destinationBloodBankId,
          bloodGroup: data.bloodGroup,
          componentType,
          unitsRequired: data.unitsRequired,
          urgency,
          status: 'MATCHING',
          requiredBy: requiredByDate,
          minRemainingShelfLifeDays,
          deliveryAddress,
          deliveryLatitude: deliveryLat,
          deliveryLongitude: deliveryLng,
          reason: data.reason.trim(),
          specialHandlingNotes: data.specialHandlingNotes?.trim() || null,
          additionalNotes: data.additionalNotes?.trim() || null,
        },
        include: {
          destinationHospital: { select: { id: true, name: true, city: true, address: true, phone: true } },
          destinationBloodBank: { select: { id: true, name: true, city: true, address: true, phone: true } },
        },
      });

      await tx.redistributionEvent.create({
        data: {
          requestId: reqRecord.id,
          actorUserId: userId,
          actorRole: inst.role,
          actorInstitutionId: destinationHospitalId || destinationBloodBankId,
          actorInstitutionName: destName,
          action: 'REDISTRIBUTION_REQUEST_CREATED',
          previousState: null,
          newState: 'MATCHING',
          reason: data.reason,
          correlationId: correlationId || null,
          metadata: {
            bloodGroup: data.bloodGroup,
            componentType,
            unitsRequired: data.unitsRequired,
            urgency,
            requiredBy: requiredByDate.toISOString(),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_REDISTRIBUTION_REQUEST',
          details: {
            requestId: reqRecord.id,
            destinationFacilityType,
            destinationInstitutionId: destinationHospitalId || destinationBloodBankId,
            bloodGroup: data.bloodGroup,
            componentType,
            unitsRequired: data.unitsRequired,
            urgency,
          },
        },
      });

      return reqRecord;
    });

    // Non-blocking notification to eligible matching institutions
    this.notifyMatchingInstitutionsAsync(createdRequest, destName).catch((err) =>
      logger.warn(`[Redistribution] Non-blocking alert error for request ${createdRequest.id}: ${err.message}`)
    );

    return createdRequest;
  }

  /**
   * Asynchronously alerts verified institutions with compatible inventory when a request is created.
   */
  private async notifyMatchingInstitutionsAsync(requestRecord: any, destName: string) {
    const matchesResult = await this.findEligibleSources(requestRecord.id, requestRecord.requesterUserId, 'ADMIN');
    const topCandidates = [...matchesResult.eligibleMatches, ...matchesResult.reviewRequiredMatches].slice(0, 5);

    for (const candidate of topCandidates) {
      if (!candidate.institutionUserId) continue;
      const prefix = requestRecord.urgency === 'CRITICAL' ? '[CRITICAL REDISTRIBUTION]' : '[REDISTRIBUTION MATCH]';
      const title = `${prefix} ${destName} needs ${requestRecord.unitsRequired}u ${requestRecord.bloodGroup.replace('_', ' ')} (${requestRecord.componentType})`;
      const message = `Your facility has ${candidate.eligibleUnitsAvailable} eligible units (${candidate.distanceKm} km away). Please review and submit a transfer proposal if stock can be released.`;

      await prisma.notification
        .create({
          data: {
            userId: candidate.institutionUserId,
            title,
            message,
            type: 'REDISTRIBUTION_ALERT',
          },
        })
        .catch((err) => logger.warn(`Failed to create in-app notification: ${err.message}`));

      if (requestRecord.urgency === 'CRITICAL') {
        await firebaseService
          .sendPushNotification(candidate.institutionUserId, title, message, 'EMERGENCY_ALERT')
          .catch(() => null);
      }
    }
  }

  /**
   * Intelligent Source Discovery & Prioritization Engine (Modules C & D).
   */
  async findEligibleSources(requestId: string, userId: string, role: string) {
    const inst = await this.resolveUserInstitution(userId, role, false);

    const reqRecord = await prisma.redistributionRequest.findUnique({
      where: { id: requestId },
      include: {
        destinationHospital: true,
        destinationBloodBank: true,
      },
    });

    if (!reqRecord) {
      throw new NotFoundError('Redistribution request not found.');
    }

    const now = new Date();
    const minExpiryDate = new Date(now.getTime() + reqRecord.minRemainingShelfLifeDays * 24 * 60 * 60 * 1000);
    const storagePolicy = compatibilityService.getStoragePolicy(reqRecord.componentType);

    // Fetch all non-deleted hospitals and blood banks with their inventory of the requested component
    const [hospitals, bloodBanks] = await Promise.all([
      prisma.hospitalProfile.findMany({
        where: {
          deletedAt: null,
          ...(reqRecord.destinationHospitalId ? { id: { not: reqRecord.destinationHospitalId } } : {}),
        },
        include: {
          user: { select: { id: true, email: true, status: true } },
          inventory: {
            where: {
              componentType: reqRecord.componentType,
            },
            orderBy: { expiryDate: 'asc' },
          },
        },
      }),
      prisma.bloodBankProfile.findMany({
        where: {
          deletedAt: null,
          ...(reqRecord.destinationBloodBankId ? { id: { not: reqRecord.destinationBloodBankId } } : {}),
        },
        include: {
          user: { select: { id: true, email: true, status: true } },
          inventory: {
            where: {
              componentType: reqRecord.componentType,
            },
            orderBy: { expiryDate: 'asc' },
          },
        },
      }),
    ]);

    const allFacilities = [
      ...hospitals.map((h) => ({ ...h, facilityType: 'HOSPITAL' as const })),
      ...bloodBanks.map((b) => ({ ...b, facilityType: 'BLOOD_BANK' as const })),
    ];

    const eligibleMatches: any[] = [];
    const reviewRequiredMatches: any[] = [];
    const ineligibleMatches: any[] = [];

    for (const facility of allFacilities) {
      const distanceKm = mapsService.calculateDistance(
        reqRecord.deliveryLatitude,
        reqRecord.deliveryLongitude,
        facility.latitude,
        facility.longitude
      );
      // Approximate courier travel time at 40 km/h urban speed + 10 min loading buffer
      const estimatedTransitMins = Math.max(10, Math.round((distanceKm / 40) * 60) + 10);

      // 1. Check mandatory verification filter
      if (!facility.isVerified || facility.user?.status !== 'ACTIVE') {
        if (facility.inventory.length > 0) {
          ineligibleMatches.push({
            institutionId: facility.id,
            institutionName: facility.name,
            facilityType: facility.facilityType,
            city: facility.city,
            distanceKm,
            estimatedTransitMins,
            isApproximateDistance: true,
            category: 'INELIGIBLE',
            ineligibilityReason: 'Institution account is not verified or not active.',
            eligibleUnitsAvailable: 0,
            reservedUnitsCount: 0,
          });
        }
        continue;
      }

      // Inspect inventory batches at this facility
      let eligibleUnitsAvailable = 0;
      let reservedUnitsCount = 0;
      let expiredOrShortShelfLifeUnits = 0;
      let earliestEligibleExpiry: Date | null = null;
      let hasExactMatch = false;
      let requiresClinicalReview = false;
      const eligibleBatches: any[] = [];

      for (const batch of facility.inventory) {
        if (batch.status === 'RESERVED') {
          reservedUnitsCount += batch.unitsCount;
          continue;
        }
        if (batch.status !== 'AVAILABLE') {
          continue;
        }

        const compat = compatibilityService.evaluateCompatibility(
          reqRecord.bloodGroup,
          batch.bloodGroup,
          reqRecord.componentType
        );

        if (!compat.isCompatible) {
          continue;
        }

        if (new Date(batch.expiryDate).getTime() < minExpiryDate.getTime()) {
          expiredOrShortShelfLifeUnits += batch.unitsCount;
          continue;
        }

        const remainingDays = Math.max(
          1,
          Math.floor((new Date(batch.expiryDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        );

        eligibleUnitsAvailable += batch.unitsCount;
        if (!earliestEligibleExpiry || new Date(batch.expiryDate) < earliestEligibleExpiry) {
          earliestEligibleExpiry = new Date(batch.expiryDate);
        }

        if (compat.tier === 'ISOGROUP_EXACT') {
          hasExactMatch = true;
        } else if (compat.requiresClinicalReview) {
          requiresClinicalReview = true;
        }

        eligibleBatches.push({
          inventoryId: batch.id,
          bloodGroup: batch.bloodGroup,
          componentType: batch.componentType,
          unitsCount: batch.unitsCount,
          expiryDate: batch.expiryDate,
          remainingShelfLifeDays: remainingDays,
          batchNumber: batch.batchNumber,
          compatibilityTier: compat.tier,
          clinicalNote: compat.clinicalNote,
        });
      }

      if (eligibleUnitsAvailable === 0) {
        if (expiredOrShortShelfLifeUnits > 0 || reservedUnitsCount > 0) {
          ineligibleMatches.push({
            institutionId: facility.id,
            institutionName: facility.name,
            facilityType: facility.facilityType,
            city: facility.city,
            distanceKm,
            estimatedTransitMins,
            isApproximateDistance: true,
            category: 'INELIGIBLE',
            ineligibilityReason:
              expiredOrShortShelfLifeUnits > 0
                ? `Available compatible units (${expiredOrShortShelfLifeUnits}) do not meet the minimum ${reqRecord.minRemainingShelfLifeDays}-day remaining shelf-life requirement.`
                : `All compatible units (${reservedUnitsCount}) are currently reserved for other transfers.`,
            eligibleUnitsAvailable: 0,
            reservedUnitsCount,
          });
        }
        continue;
      }

      // Compute Transparent Prioritization Score (Module D)
      const proximityScore = Math.max(0, 1 - distanceKm / 120);
      const fulfillmentRatio = Math.min(1, eligibleUnitsAvailable / reqRecord.unitsRequired);
      const canFulfillCompletely = eligibleUnitsAvailable >= reqRecord.unitsRequired;

      // FEFO optimization score: units that satisfy minRemainingShelfLifeDays and expire within 14 days get a boost to reduce wastage
      const minBatchRemainingDays = earliestEligibleExpiry
        ? Math.max(1, Math.floor((earliestEligibleExpiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
        : 15;
      const fefoScore =
        minBatchRemainingDays <= 14
          ? 1.0
          : Math.max(0.4, 1 - (minBatchRemainingDays - 14) / 60);

      const compatibilityScore = hasExactMatch ? 1.0 : requiresClinicalReview ? 0.65 : 0.85;

      const totalScore = parseFloat(
        (
          proximityScore * REDISTRIBUTION_SCORING_WEIGHTS.proximityWeight +
          fulfillmentRatio * REDISTRIBUTION_SCORING_WEIGHTS.fulfillmentCapacityWeight +
          fefoScore * REDISTRIBUTION_SCORING_WEIGHTS.shelfLifeOptimizationWeight +
          compatibilityScore * REDISTRIBUTION_SCORING_WEIGHTS.compatibilityTierWeight
        ).toFixed(3)
      );

      const explanationParts: string[] = [];
      if (canFulfillCompletely) {
        explanationParts.push(`can fulfill 100% of requested ${reqRecord.unitsRequired} units (${eligibleUnitsAvailable} available)`);
      } else {
        explanationParts.push(`can partially supply ${eligibleUnitsAvailable} of ${reqRecord.unitsRequired} requested units`);
      }
      if (hasExactMatch) {
        explanationParts.push(`exact ${reqRecord.bloodGroup.replace('_', ' ')} isogroup match`);
      } else {
        explanationParts.push(`compatible ${eligibleBatches[0]?.bloodGroup?.replace('_', ' ')} substitute`);
      }
      explanationParts.push(`approx. ${distanceKm} km away (~${estimatedTransitMins} mins transit)`);
      if (minBatchRemainingDays <= 14) {
        explanationParts.push(`FEFO wastage-prevention candidate (${minBatchRemainingDays} days remaining shelf life)`);
      }

      const matchEntry = {
        institutionId: facility.id,
        institutionUserId: facility.user?.id,
        institutionName: facility.name,
        facilityType: facility.facilityType,
        city: facility.city,
        address: facility.address,
        latitude: facility.latitude,
        longitude: facility.longitude,
        distanceKm,
        isApproximateDistance: mapsService.getMockMode(),
        estimatedTransitMins,
        requestedBloodGroup: reqRecord.bloodGroup,
        matchedBloodGroups: Array.from(new Set(eligibleBatches.map((b) => b.bloodGroup))),
        componentType: reqRecord.componentType,
        eligibleUnitsAvailable,
        reservedUnitsCount,
        canFulfillCompletely,
        earliestExpiryDate: earliestEligibleExpiry?.toISOString() || null,
        minRemainingShelfLifeDays: minBatchRemainingDays,
        score: totalScore,
        scoreBreakdown: {
          proximityScore: parseFloat(proximityScore.toFixed(2)),
          fulfillmentScore: parseFloat(fulfillmentRatio.toFixed(2)),
          fefoOptimizationScore: parseFloat(fefoScore.toFixed(2)),
          compatibilityScore,
        },
        compatibilityTier: hasExactMatch
          ? 'ISOGROUP_EXACT'
          : requiresClinicalReview
            ? 'CLINICAL_REVIEW_REQUIRED'
            : 'COMPATIBLE_SUBSTITUTE',
        requiresClinicalReview: requiresClinicalReview && !hasExactMatch,
        matchExplanation: `Suggested because the institution ${explanationParts.join(', ')}.`,
        suggestedNextAction:
          requiresClinicalReview && !hasExactMatch
            ? 'Review clinical compatibility notes with Blood Bank Medical Officer before proposing transfer'
            : canFulfillCompletely
              ? `Propose full transfer of ${reqRecord.unitsRequired} units`
              : `Propose partial transfer of ${eligibleUnitsAvailable} units`,
        eligibleBatches,
      };

      if (matchEntry.requiresClinicalReview || !canFulfillCompletely) {
        reviewRequiredMatches.push({ ...matchEntry, category: 'POTENTIAL_REVIEW_REQUIRED' });
      } else {
        eligibleMatches.push({ ...matchEntry, category: 'ELIGIBLE' });
      }
    }

    // Sort by score descending, then distance ascending
    eligibleMatches.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
    reviewRequiredMatches.sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);

    // Optional Multi-Source Fulfillment Plan if no single source can fulfill 100%
    let multiSourcePlan: any = null;
    if (eligibleMatches.length === 0) {
      const partialCandidates = [...reviewRequiredMatches].filter((m) => m.eligibleUnitsAvailable > 0);
      let remainingNeeded = reqRecord.unitsRequired;
      const combinedSources: any[] = [];

      for (const cand of partialCandidates) {
        if (remainingNeeded <= 0) break;
        const allocateFromCand = Math.min(remainingNeeded, cand.eligibleUnitsAvailable);
        combinedSources.push({
          institutionId: cand.institutionId,
          institutionName: cand.institutionName,
          facilityType: cand.facilityType,
          unitsToRequest: allocateFromCand,
          distanceKm: cand.distanceKm,
        });
        remainingNeeded -= allocateFromCand;
      }

      if (combinedSources.length > 1) {
        multiSourcePlan = {
          canCollectivelyFulfill: remainingNeeded === 0,
          totalUnitsCovered: reqRecord.unitsRequired - remainingNeeded,
          unitsStillUnfulfilled: remainingNeeded,
          sources: combinedSources,
          operationalNote:
            'No single facility holds the complete requested quantity. You may submit individual proposals for each source facility above; each transfer reserves and tracks its own units independently.',
        };
      }
    }

    return {
      requestId: reqRecord.id,
      requestedBloodGroup: reqRecord.bloodGroup,
      componentType: reqRecord.componentType,
      unitsRequired: reqRecord.unitsRequired,
      urgency: reqRecord.urgency,
      minRemainingShelfLifeDays: reqRecord.minRemainingShelfLifeDays,
      storagePolicy,
      scoringWeights: REDISTRIBUTION_SCORING_WEIGHTS,
      regulatoryDisclaimer: REGULATORY_DISCLAIMER,
      eligibleMatches,
      reviewRequiredMatches,
      ineligibleMatches,
      multiSourcePlan,
      requesterCanPropose: this.isDestinationOwner(inst, reqRecord),
    };
  }

  /**
   * Submits a transfer proposal for a redistribution request (Module E).
   */
  async createProposal(
    requestId: string,
    userId: string,
    role: string,
    data: {
      sourceFacilityType?: 'HOSPITAL' | 'BLOOD_BANK';
      sourceHospitalId?: string;
      sourceBloodBankId?: string;
      bloodGroup?: BloodGroup;
      unitsProposed: number;
      proposedInventoryIds?: string[];
      notes?: string;
    },
    correlationId?: string
  ) {
    const inst = await this.resolveUserInstitution(userId, role, true);

    if (!Number.isInteger(data.unitsProposed) || data.unitsProposed <= 0) {
      throw new BadRequestError('Proposed units must be a positive integer.');
    }

    const reqRecord = await prisma.redistributionRequest.findUnique({
      where: { id: requestId },
    });
    if (!reqRecord) {
      throw new NotFoundError('Redistribution request not found.');
    }

    if (['COMPLETED', 'CANCELLED', 'EXPIRED', 'REJECTED', 'FAILED'].includes(reqRecord.status)) {
      throw new BadRequestError(`Cannot submit a proposal for a request in ${reqRecord.status} status.`);
    }

    if (data.unitsProposed > reqRecord.unitsRequired) {
      throw new BadRequestError(
        `Proposed units (${data.unitsProposed}) cannot exceed requested units (${reqRecord.unitsRequired}).`
      );
    }

    // Determine source facility
    let sourceFacilityType: 'HOSPITAL' | 'BLOOD_BANK';
    let sourceHospitalId: string | null = null;
    let sourceBloodBankId: string | null = null;

    if (this.isDestinationOwner(inst, reqRecord) && (data.sourceHospitalId || data.sourceBloodBankId)) {
      // Destination hospital is requesting a transfer proposal from a matched source institution
      if (data.sourceHospitalId) {
        sourceFacilityType = 'HOSPITAL';
        sourceHospitalId = data.sourceHospitalId;
      } else {
        sourceFacilityType = 'BLOOD_BANK';
        sourceBloodBankId = data.sourceBloodBankId!;
      }
    } else if (inst.role === 'HOSPITAL') {
      sourceFacilityType = 'HOSPITAL';
      sourceHospitalId = inst.hospitalId;
    } else if (inst.role === 'BLOOD_BANK') {
      sourceFacilityType = 'BLOOD_BANK';
      sourceBloodBankId = inst.bloodBankId;
    } else {
      throw new BadRequestError('Source institution must be specified.');
    }

    // Ensure source != destination
    if (
      (sourceHospitalId && sourceHospitalId === reqRecord.destinationHospitalId) ||
      (sourceBloodBankId && sourceBloodBankId === reqRecord.destinationBloodBankId)
    ) {
      throw new BadRequestError('Source and destination institution cannot be the same facility.');
    }

    // Verify source facility is verified and has eligible inventory
    let sourceLat = 12.9716;
    let sourceLng = 77.5946;
    let sourceName = 'Source Facility';
    let sourceOwnerUserId: string | null = null;

    if (sourceHospitalId) {
      const h = await prisma.hospitalProfile.findUnique({ where: { id: sourceHospitalId } });
      if (!h || !h.isVerified || h.deletedAt) {
        throw new BadRequestError('Source hospital is not verified or does not exist.');
      }
      sourceLat = h.latitude;
      sourceLng = h.longitude;
      sourceName = h.name;
      sourceOwnerUserId = h.userId;
    } else if (sourceBloodBankId) {
      const b = await prisma.bloodBankProfile.findUnique({ where: { id: sourceBloodBankId } });
      if (!b || !b.isVerified || b.deletedAt) {
        throw new BadRequestError('Source blood bank is not verified or does not exist.');
      }
      sourceLat = b.latitude;
      sourceLng = b.longitude;
      sourceName = b.name;
      sourceOwnerUserId = b.userId;
    }

    const compatibleGroups = compatibilityService.getCompatibleSourceGroups(
      reqRecord.bloodGroup,
      reqRecord.componentType,
      true
    );
    const minExpiryDate = new Date(Date.now() + reqRecord.minRemainingShelfLifeDays * 24 * 60 * 60 * 1000);

    const availableBatches = await prisma.bloodInventory.findMany({
      where: {
        ...(sourceHospitalId ? { hospitalId: sourceHospitalId } : { bloodBankId: sourceBloodBankId }),
        status: 'AVAILABLE',
        componentType: reqRecord.componentType,
        bloodGroup: data.bloodGroup ? data.bloodGroup : { in: compatibleGroups },
        expiryDate: { gte: minExpiryDate },
        ...(data.proposedInventoryIds && data.proposedInventoryIds.length > 0
          ? { id: { in: data.proposedInventoryIds } }
          : {}),
      },
      orderBy: { expiryDate: 'asc' },
    });

    const totalEligible = availableBatches.reduce((sum, b) => sum + b.unitsCount, 0);
    if (totalEligible < data.unitsProposed) {
      throw new BadRequestError(
        `Source institution (${sourceName}) only has ${totalEligible} eligible available units meeting shelf-life and compatibility requirements (attempted to propose ${data.unitsProposed}).`
      );
    }

    const selectedGroup = data.bloodGroup || availableBatches[0].bloodGroup;
    const compatCheck = compatibilityService.evaluateCompatibility(
      reqRecord.bloodGroup,
      selectedGroup,
      reqRecord.componentType
    );
    if (!compatCheck.isCompatible) {
      throw new BadRequestError(compatCheck.clinicalNote);
    }

    const distanceKm = mapsService.calculateDistance(
      reqRecord.deliveryLatitude,
      reqRecord.deliveryLongitude,
      sourceLat,
      sourceLng
    );
    const estimatedTransitMins = Math.max(10, Math.round((distanceKm / 40) * 60) + 10);

    const proposal = await prisma.$transaction(async (tx) => {
      const created = await tx.redistributionProposal.create({
        data: {
          requestId: reqRecord.id,
          proposerUserId: userId,
          sourceFacilityType,
          sourceHospitalId,
          sourceBloodBankId,
          bloodGroup: selectedGroup,
          componentType: reqRecord.componentType,
          unitsProposed: data.unitsProposed,
          status: 'PENDING',
          proposedInventoryIds:
            data.proposedInventoryIds && data.proposedInventoryIds.length > 0
              ? data.proposedInventoryIds
              : availableBatches.map((b) => b.id),
          estimatedDistanceKm: distanceKm,
          estimatedTransitMins,
          notes: data.notes?.trim() || null,
        },
        include: {
          sourceHospital: { select: { id: true, name: true, city: true, phone: true } },
          sourceBloodBank: { select: { id: true, name: true, city: true, phone: true } },
        },
      });

      const nextReqStatus: RedistributionStatus = 'AWAITING_APPROVAL';
      await tx.redistributionRequest.update({
        where: { id: reqRecord.id },
        data: { status: nextReqStatus },
      });

      await tx.redistributionEvent.create({
        data: {
          requestId: reqRecord.id,
          actorUserId: userId,
          actorRole: inst.role,
          actorInstitutionId: inst.facilityId,
          actorInstitutionName: inst.name,
          action: 'TRANSFER_PROPOSAL_SUBMITTED',
          previousState: reqRecord.status,
          newState: nextReqStatus,
          reason: data.notes || `Proposed ${data.unitsProposed} units from ${sourceName}`,
          correlationId: correlationId || null,
          metadata: {
            proposalId: created.id,
            sourceName,
            unitsProposed: data.unitsProposed,
            bloodGroup: selectedGroup,
            distanceKm,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_REDISTRIBUTION_PROPOSAL',
          details: {
            proposalId: created.id,
            requestId: reqRecord.id,
            sourceFacilityType,
            sourceInstitutionId: sourceHospitalId || sourceBloodBankId,
            unitsProposed: data.unitsProposed,
          },
        },
      });

      return created;
    });

    // Notify counterpart institution
    const notifyTargetUserId =
      userId === reqRecord.requesterUserId ? sourceOwnerUserId : reqRecord.requesterUserId;
    if (notifyTargetUserId) {
      await prisma.notification
        .create({
          data: {
            userId: notifyTargetUserId,
            title: `[PROPOSAL] Blood Redistribution Proposal (${data.unitsProposed}u ${selectedGroup.replace('_', ' ')})`,
            message: `${sourceName} proposed ${data.unitsProposed} units of ${selectedGroup.replace('_', ' ')} (${reqRecord.componentType}) for Request #${reqRecord.id.slice(0, 8)}. Action required: Review & Approve.`,
            type: 'REDISTRIBUTION_ALERT',
          },
        })
        .catch(() => null);
    }

    return proposal;
  }

  /**
   * Approves a transfer proposal and atomically reserves eligible inventory units (Modules E & F).
   * Protects against concurrent double-allocation and duplicate approval calls.
   */
  async approveProposal(
    proposalId: string,
    userId: string,
    role: string,
    options?: { idempotencyKey?: string; notes?: string },
    correlationId?: string
  ) {
    const inst = await this.resolveUserInstitution(userId, role, true);

    const proposal = await prisma.redistributionProposal.findUnique({
      where: { id: proposalId },
      include: {
        request: true,
        transfer: true,
        sourceHospital: true,
        sourceBloodBank: true,
      },
    });

    if (!proposal) {
      throw new NotFoundError('Redistribution proposal not found.');
    }

    // Verify authorization: either the destination institution or the source institution (or ADMIN)
    const isDest = this.isDestinationOwner(inst, proposal.request);
    const isSource = this.isSourceOwner(inst, proposal);
    if (!isDest && !isSource && inst.role !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to approve this transfer proposal.');
    }

    // Duplicate / idempotency guard
    if (proposal.status === 'APPROVED' || proposal.transfer) {
      throw new ConflictError('This transfer proposal has already been approved and inventory is reserved.');
    }
    if (proposal.status !== 'PENDING') {
      throw new BadRequestError(`Cannot approve proposal in ${proposal.status} status.`);
    }

    if (options?.idempotencyKey) {
      const existingByKey = await prisma.redistributionTransfer.findUnique({
        where: { idempotencyKey: options.idempotencyKey },
      });
      if (existingByKey) {
        throw new ConflictError('Duplicate approval request detected via idempotency key.');
      }
    }

    const now = new Date();
    const minExpiryDate = new Date(
      now.getTime() + proposal.request.minRemainingShelfLifeDays * 24 * 60 * 60 * 1000
    );

    // Atomic Reservation Transaction with Optimistic Concurrency Control
    const transfer = await prisma.$transaction(async (tx) => {
      // Re-verify proposal status inside transaction
      const freshProposal = await tx.redistributionProposal.findUnique({
        where: { id: proposalId },
      });
      if (!freshProposal || freshProposal.status !== 'PENDING') {
        throw new ConflictError('Concurrent modification: Proposal is no longer pending.');
      }

      // Fetch eligible available inventory at source institution ordered by FEFO (expiryDate ASC)
      const candidateBatches = await tx.bloodInventory.findMany({
        where: {
          ...(proposal.sourceHospitalId
            ? { hospitalId: proposal.sourceHospitalId }
            : { bloodBankId: proposal.sourceBloodBankId }),
          status: 'AVAILABLE',
          bloodGroup: proposal.bloodGroup,
          componentType: proposal.componentType,
          expiryDate: { gte: minExpiryDate },
          ...(proposal.proposedInventoryIds && proposal.proposedInventoryIds.length > 0
            ? { id: { in: proposal.proposedInventoryIds } }
            : {}),
        },
        orderBy: { expiryDate: 'asc' },
      });

      const totalAvailable = candidateBatches.reduce((sum, b) => sum + b.unitsCount, 0);
      if (totalAvailable < proposal.unitsProposed) {
        throw new ConflictError(
          `Insufficient eligible inventory at source institution to reserve ${proposal.unitsProposed} units (currently available: ${totalAvailable}).`
        );
      }

      let remainingToReserve = proposal.unitsProposed;
      const allocationsToCreate: Array<{
        inventoryId: string;
        originalInventoryId: string;
        bloodGroup: BloodGroup;
        componentType: BloodComponent;
        unitsAllocated: number;
        expiryDate: Date;
      }> = [];

      for (const batch of candidateBatches) {
        if (remainingToReserve <= 0) break;

        const allocateCount = Math.min(remainingToReserve, batch.unitsCount);

        if (allocateCount === batch.unitsCount) {
          // Reserve entire batch using optimistic lock check on updatedAt & status & unitsCount
          const updateResult = await tx.bloodInventory.updateMany({
            where: {
              id: batch.id,
              status: 'AVAILABLE',
              unitsCount: batch.unitsCount,
              updatedAt: batch.updatedAt,
            },
            data: {
              status: 'RESERVED',
            },
          });

          if (updateResult.count === 0) {
            throw new ConflictError(
              'Concurrent inventory allocation detected. Another transaction modified the source inventory batch.'
            );
          }

          allocationsToCreate.push({
            inventoryId: batch.id,
            originalInventoryId: batch.id,
            bloodGroup: batch.bloodGroup,
            componentType: batch.componentType,
            unitsAllocated: allocateCount,
            expiryDate: batch.expiryDate,
          });
        } else {
          // Fractional reservation: decrement available batch with optimistic lock and create reserved batch
          const remainingInBatch = batch.unitsCount - allocateCount;
          const updateResult = await tx.bloodInventory.updateMany({
            where: {
              id: batch.id,
              status: 'AVAILABLE',
              unitsCount: batch.unitsCount,
              updatedAt: batch.updatedAt,
            },
            data: {
              unitsCount: remainingInBatch,
            },
          });

          if (updateResult.count === 0) {
            throw new ConflictError(
              'Concurrent inventory allocation detected during batch split. Please retry.'
            );
          }

          const reservedBatch = await tx.bloodInventory.create({
            data: {
              hospitalId: batch.hospitalId,
              bloodBankId: batch.bloodBankId,
              bloodGroup: batch.bloodGroup,
              componentType: batch.componentType,
              unitsCount: allocateCount,
              expiryDate: batch.expiryDate,
              collectionDate: batch.collectionDate,
              batchNumber: batch.batchNumber,
              storageTemp: batch.storageTemp,
              status: 'RESERVED',
            },
          });

          allocationsToCreate.push({
            inventoryId: reservedBatch.id,
            originalInventoryId: batch.id,
            bloodGroup: batch.bloodGroup,
            componentType: batch.componentType,
            unitsAllocated: allocateCount,
            expiryDate: batch.expiryDate,
          });
        }

        remainingToReserve -= allocateCount;
      }

      // Mark proposal APPROVED
      await tx.redistributionProposal.update({
        where: { id: proposalId },
        data: {
          status: 'APPROVED',
          reviewedByUserId: userId,
          reviewedAt: now,
        },
      });

      // Create Transfer in RESERVED state
      const createdTransfer = await tx.redistributionTransfer.create({
        data: {
          requestId: proposal.requestId,
          proposalId: proposal.id,
          sourceFacilityType: proposal.sourceFacilityType,
          sourceHospitalId: proposal.sourceHospitalId,
          sourceBloodBankId: proposal.sourceBloodBankId,
          destinationFacilityType: proposal.request.destinationFacilityType,
          destinationHospitalId: proposal.request.destinationHospitalId,
          destinationBloodBankId: proposal.request.destinationBloodBankId,
          bloodGroup: proposal.bloodGroup,
          componentType: proposal.componentType,
          unitsApproved: proposal.unitsProposed,
          status: 'RESERVED',
          idempotencyKey: options?.idempotencyKey || crypto.randomUUID(),
        },
      });

      // Create Allocation records
      for (const alloc of allocationsToCreate) {
        await tx.redistributionAllocation.create({
          data: {
            transferId: createdTransfer.id,
            inventoryId: alloc.inventoryId,
            originalInventoryId: alloc.originalInventoryId,
            bloodGroup: alloc.bloodGroup,
            componentType: alloc.componentType,
            unitsAllocated: alloc.unitsAllocated,
            expiryDate: alloc.expiryDate,
            status: 'RESERVED',
            reservedByUserId: userId,
          },
        });
      }

      // Update Request status to RESERVED
      await tx.redistributionRequest.update({
        where: { id: proposal.requestId },
        data: { status: 'RESERVED' },
      });

      // Write Audit Event
      await tx.redistributionEvent.create({
        data: {
          requestId: proposal.requestId,
          transferId: createdTransfer.id,
          actorUserId: userId,
          actorRole: inst.role,
          actorInstitutionId: inst.facilityId,
          actorInstitutionName: inst.name,
          action: 'PROPOSAL_APPROVED_AND_INVENTORY_RESERVED',
          previousState: proposal.request.status,
          newState: 'RESERVED',
          reason: options?.notes || `Approved proposal and atomically reserved ${proposal.unitsProposed} units.`,
          correlationId: correlationId || null,
          metadata: {
            proposalId: proposal.id,
            transferId: createdTransfer.id,
            unitsReserved: proposal.unitsProposed,
            allocationsCount: allocationsToCreate.length,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'APPROVE_REDISTRIBUTION_PROPOSAL',
          details: {
            proposalId: proposal.id,
            transferId: createdTransfer.id,
            requestId: proposal.requestId,
            unitsReserved: proposal.unitsProposed,
          },
        },
      });

      return tx.redistributionTransfer.findUnique({
        where: { id: createdTransfer.id },
        include: {
          allocations: true,
          sourceHospital: { select: { id: true, name: true, city: true, phone: true } },
          sourceBloodBank: { select: { id: true, name: true, city: true, phone: true } },
          destinationHospital: { select: { id: true, name: true, city: true, phone: true } },
          destinationBloodBank: { select: { id: true, name: true, city: true, phone: true } },
        },
      });
    });

    if (proposal.sourceBloodBankId) {
      await redisService.del(`inventory:${proposal.sourceBloodBankId}`).catch(() => null);
    }

    // Notify both parties
    const sourceUserId = proposal.sourceHospital?.userId || proposal.sourceBloodBank?.userId;
    const targetIds = Array.from(new Set([proposal.request.requesterUserId, sourceUserId].filter(Boolean) as string[]));
    for (const uid of targetIds) {
      await prisma.notification
        .create({
          data: {
            userId: uid,
            title: `[RESERVED] ${proposal.unitsProposed}u ${proposal.bloodGroup.replace('_', ' ')} Reserved for Dispatch`,
            message: `Transfer #${transfer?.id.slice(0, 8)} has been approved and ${proposal.unitsProposed} units are reserved. Source facility may now prepare cold-chain dispatch.`,
            type: 'REDISTRIBUTION_ALERT',
          },
        })
        .catch(() => null);
    }

    return transfer;
  }

  /**
   * Rejects a transfer proposal.
   */
  async rejectProposal(
    proposalId: string,
    userId: string,
    role: string,
    data: { reason?: string },
    correlationId?: string
  ) {
    const inst = await this.resolveUserInstitution(userId, role, false);

    const proposal = await prisma.redistributionProposal.findUnique({
      where: { id: proposalId },
      include: { request: true },
    });
    if (!proposal) {
      throw new NotFoundError('Redistribution proposal not found.');
    }

    if (
      !this.isDestinationOwner(inst, proposal.request) &&
      !this.isSourceOwner(inst, proposal) &&
      inst.role !== 'ADMIN'
    ) {
      throw new ForbiddenError('You do not have permission to reject this proposal.');
    }

    if (proposal.status !== 'PENDING') {
      throw new BadRequestError(`Cannot reject a proposal in ${proposal.status} status.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.redistributionProposal.update({
        where: { id: proposalId },
        data: {
          status: 'REJECTED',
          rejectionReason: data.reason || 'Declined by reviewing institution.',
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });

      await tx.redistributionEvent.create({
        data: {
          requestId: proposal.requestId,
          actorUserId: userId,
          actorRole: inst.role,
          actorInstitutionId: inst.facilityId,
          actorInstitutionName: inst.name,
          action: 'PROPOSAL_REJECTED',
          previousState: 'AWAITING_APPROVAL',
          newState: 'REJECTED',
          reason: data.reason || 'Declined by reviewing institution.',
          correlationId: correlationId || null,
          metadata: { proposalId },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'REJECT_REDISTRIBUTION_PROPOSAL',
          details: {
            proposalId,
            requestId: proposal.requestId,
            reason: data.reason,
          },
        },
      });

      return p;
    });

    await prisma.notification
      .create({
        data: {
          userId: proposal.proposerUserId,
          title: `[REJECTED] Redistribution Proposal Declined`,
          message: `Proposal #${proposalId.slice(0, 8)} was declined. Reason: ${data.reason || 'Declined by reviewing institution.'
            }`,
          type: 'REDISTRIBUTION_ALERT',
        },
      })
      .catch(() => null);

    return updated;
  }

  /**
   * Records authorized dispatch of reserved blood units from the source institution (Module G).
   */
  async dispatchTransfer(
    transferId: string,
    userId: string,
    role: string,
    data: {
      shipmentReference?: string;
      dispatcherName: string;
      unitsDispatched?: number;
      transportVehicleDetails?: string;
      temperatureCheckConfirmed: boolean;
      coldChainNotes?: string;
      expectedArrivalAt?: string | Date;
    },
    correlationId?: string
  ) {
    const inst = await this.resolveUserInstitution(userId, role, true);

    const transfer = await prisma.redistributionTransfer.findUnique({
      where: { id: transferId },
      include: {
        request: true,
        allocations: true,
        sourceHospital: true,
        sourceBloodBank: true,
        destinationHospital: true,
        destinationBloodBank: true,
      },
    });

    if (!transfer) {
      throw new NotFoundError('Redistribution transfer record not found.');
    }

    if (!this.isSourceOwner(inst, transfer)) {
      throw new ForbiddenError('Only authorized personnel from the source institution can record shipment dispatch.');
    }

    this.validateTransition(transfer.status, 'DISPATCHED');

    if (!data.temperatureCheckConfirmed) {
      throw new BadRequestError(
        'Mandatory storage and transport temperature verification must be confirmed before dispatching blood units.'
      );
    }

    if (!data.dispatcherName || data.dispatcherName.trim().length < 2) {
      throw new BadRequestError('Authorized dispatcher name is required.');
    }

    const unitsDispatched = data.unitsDispatched !== undefined ? data.unitsDispatched : transfer.unitsApproved;
    if (unitsDispatched <= 0 || unitsDispatched > transfer.unitsApproved) {
      throw new BadRequestError(
        `Dispatched units (${unitsDispatched}) must be between 1 and the approved quantity (${transfer.unitsApproved}).`
      );
    }

    const shipmentRef =
      data.shipmentReference?.trim() ||
      `SHP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${transfer.id.slice(0, 6).toUpperCase()}`;

    const expectedArrival = data.expectedArrivalAt
      ? new Date(data.expectedArrivalAt)
      : new Date(Date.now() + 60 * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      const allocationInventoryIds = transfer.allocations.map((a) => a.inventoryId);
      if (allocationInventoryIds.length > 0) {
        await tx.bloodInventory.updateMany({
          where: { id: { in: allocationInventoryIds } },
          data: { status: 'DISTRIBUTED' },
        });
      }

      await tx.redistributionAllocation.updateMany({
        where: { transferId: transfer.id },
        data: { status: 'DISPATCHED' },
      });

      const updatedTransfer = await tx.redistributionTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'DISPATCHED',
          unitsDispatched,
          shipmentReference: shipmentRef,
          dispatcherName: data.dispatcherName.trim(),
          dispatchedByUserId: userId,
          dispatchedAt: new Date(),
          transportVehicleDetails: data.transportVehicleDetails?.trim() || 'Authorized Medical Courier',
          temperatureCheckConfirmed: true,
          coldChainNotes: data.coldChainNotes?.trim() || null,
          expectedArrivalAt: expectedArrival,
        },
        include: {
          allocations: true,
          sourceHospital: { select: { id: true, name: true, city: true, phone: true } },
          sourceBloodBank: { select: { id: true, name: true, city: true, phone: true } },
          destinationHospital: { select: { id: true, name: true, city: true, phone: true } },
          destinationBloodBank: { select: { id: true, name: true, city: true, phone: true } },
        },
      });

      await tx.redistributionRequest.update({
        where: { id: transfer.requestId },
        data: { status: 'DISPATCHED' },
      });

      await tx.redistributionEvent.create({
        data: {
          requestId: transfer.requestId,
          transferId: transfer.id,
          actorUserId: userId,
          actorRole: inst.role,
          actorInstitutionId: inst.facilityId,
          actorInstitutionName: inst.name,
          action: 'TRANSFER_DISPATCHED',
          previousState: transfer.status,
          newState: 'DISPATCHED',
          reason: `Dispatched ${unitsDispatched} units via ref ${shipmentRef}`,
          correlationId: correlationId || null,
          metadata: {
            shipmentReference: shipmentRef,
            dispatcherName: data.dispatcherName,
            unitsDispatched,
            transportVehicleDetails: data.transportVehicleDetails,
            temperatureCheckConfirmed: true,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'DISPATCH_REDISTRIBUTION_TRANSFER',
          details: {
            transferId: transfer.id,
            shipmentReference: shipmentRef,
            unitsDispatched,
            dispatcherName: data.dispatcherName,
          },
        },
      });

      return updatedTransfer;
    });

    if (transfer.sourceBloodBankId) {
      await redisService.del(`inventory:${transfer.sourceBloodBankId}`).catch(() => null);
    }

    // Notify destination institution
    await prisma.notification
      .create({
        data: {
          userId: transfer.request.requesterUserId,
          title: `[DISPATCHED] Shipment ${shipmentRef} Dispatched`,
          message: `${unitsDispatched} units of ${transfer.bloodGroup.replace('_', ' ')} (${transfer.componentType}) have been dispatched by ${data.dispatcherName}. Expected arrival: ${expectedArrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
          type: 'REDISTRIBUTION_ALERT',
        },
      })
      .catch(() => null);

    return updated;
  }

  /**
   * Records an authorized manual in-transit update (Module G).
   */
  async markInTransit(
    transferId: string,
    userId: string,
    role: string,
    data: {
      inTransitNotes?: string;
      expectedArrivalAt?: string | Date;
    },
    correlationId?: string
  ) {
    const inst = await this.resolveUserInstitution(userId, role, false);

    const transfer = await prisma.redistributionTransfer.findUnique({
      where: { id: transferId },
      include: { request: true },
    });

    if (!transfer) {
      throw new NotFoundError('Redistribution transfer not found.');
    }

    if (!this.isSourceOwner(inst, transfer) && !this.isDestinationOwner(inst, transfer)) {
      throw new ForbiddenError('Not authorized to update transit status for this transfer.');
    }

    if (transfer.status !== 'DISPATCHED' && transfer.status !== 'IN_TRANSIT') {
      this.validateTransition(transfer.status, 'IN_TRANSIT');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.redistributionTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'IN_TRANSIT',
          inTransitUpdatedAt: new Date(),
          inTransitNotes: data.inTransitNotes?.trim() || 'Manual checkpoint update: Shipment in transit.',
          ...(data.expectedArrivalAt ? { expectedArrivalAt: new Date(data.expectedArrivalAt) } : {}),
        },
      });

      await tx.redistributionRequest.update({
        where: { id: transfer.requestId },
        data: { status: 'IN_TRANSIT' },
      });

      await tx.redistributionEvent.create({
        data: {
          requestId: transfer.requestId,
          transferId: transfer.id,
          actorUserId: userId,
          actorRole: inst.role,
          actorInstitutionId: inst.facilityId,
          actorInstitutionName: inst.name,
          action: 'TRANSFER_IN_TRANSIT_UPDATE',
          previousState: transfer.status,
          newState: 'IN_TRANSIT',
          reason: data.inTransitNotes || 'Manual in-transit status update.',
          correlationId: correlationId || null,
        },
      });

      return t;
    });

    return updated;
  }

  /**
   * Records receipt at the destination institution, reconciles quantities, and credits destination inventory (Module G).
   */
  async receiveTransfer(
    transferId: string,
    userId: string,
    role: string,
    data: {
      unitsReceived: number;
      damagedUnits?: number;
      receiverStaffName: string;
      conditionVerified: boolean;
      discrepancyReason?: string;
      autoComplete?: boolean;
    },
    correlationId?: string
  ) {
    const inst = await this.resolveUserInstitution(userId, role, true);

    const transfer = await prisma.redistributionTransfer.findUnique({
      where: { id: transferId },
      include: {
        request: true,
        allocations: true,
        sourceHospital: true,
        sourceBloodBank: true,
      },
    });

    if (!transfer) {
      throw new NotFoundError('Redistribution transfer not found.');
    }

    if (!this.isDestinationOwner(inst, transfer)) {
      throw new ForbiddenError('Only authorized personnel at the receiving destination institution can confirm receipt.');
    }

    if (transfer.status === 'RECEIVED' || transfer.status === 'COMPLETED') {
      throw new ConflictError('Receipt has already been recorded for this transfer.');
    }

    this.validateTransition(transfer.status, 'RECEIVED');

    if (!Number.isInteger(data.unitsReceived) || data.unitsReceived < 0) {
      throw new BadRequestError('Units received must be a non-negative integer.');
    }

    const dispatchedCount = transfer.unitsDispatched ?? transfer.unitsApproved;
    if (data.unitsReceived > dispatchedCount) {
      throw new BadRequestError(
        `Units received (${data.unitsReceived}) cannot exceed units dispatched (${dispatchedCount}).`
      );
    }

    if (!data.receiverStaffName || data.receiverStaffName.trim().length < 2) {
      throw new BadRequestError('Receiving staff member name is required.');
    }

    const damagedUnits = data.damagedUnits || 0;
    if (damagedUnits < 0 || damagedUnits > data.unitsReceived) {
      throw new BadRequestError('Damaged units count must be between 0 and unitsReceived.');
    }

    const hasDiscrepancy =
      data.unitsReceived !== dispatchedCount || damagedUnits > 0 || !data.conditionVerified;

    if (hasDiscrepancy && (!data.discrepancyReason || data.discrepancyReason.trim().length < 3)) {
      throw new BadRequestError(
        'A discrepancy reason is required when received quantity differs from dispatched quantity, units are damaged, or condition check fails.'
      );
    }

    const usableGoodUnits = data.conditionVerified ? Math.max(0, data.unitsReceived - damagedUnits) : 0;
    // Do NOT silently mark as COMPLETED if there is a discrepancy
    const finalStatus: RedistributionStatus =
      !hasDiscrepancy && data.autoComplete !== false ? 'COMPLETED' : 'RECEIVED';

    const storagePolicy = compatibilityService.getStoragePolicy(transfer.componentType);
    const earliestExpiry =
      transfer.allocations.length > 0
        ? transfer.allocations.reduce(
          (min, a) => (new Date(a.expiryDate) < min ? new Date(a.expiryDate) : min),
          new Date(transfer.allocations[0].expiryDate)
        )
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      // Credit usable good units to destination institution's inventory
      let destinationInventoryRecord = null;
      if (usableGoodUnits > 0) {
        destinationInventoryRecord = await tx.bloodInventory.create({
          data: {
            hospitalId: transfer.destinationHospitalId,
            bloodBankId: transfer.destinationBloodBankId,
            bloodGroup: transfer.bloodGroup,
            componentType: transfer.componentType,
            unitsCount: usableGoodUnits,
            expiryDate: earliestExpiry,
            collectionDate: new Date(),
            batchNumber: `XFER-${transfer.shipmentReference || transfer.id.slice(0, 6).toUpperCase()}`,
            storageTemp: storagePolicy.storageTempRange,
            status: 'AVAILABLE',
          },
        });
      }

      await tx.redistributionAllocation.updateMany({
        where: { transferId: transfer.id },
        data: { status: 'RECEIVED' },
      });

      const updatedTransfer = await tx.redistributionTransfer.update({
        where: { id: transfer.id },
        data: {
          status: finalStatus,
          unitsReceived: data.unitsReceived,
          damagedUnits,
          receivedByUserId: userId,
          receiverStaffName: data.receiverStaffName.trim(),
          receivedAt: new Date(),
          conditionVerified: data.conditionVerified,
          hasDiscrepancy,
          discrepancyReason: hasDiscrepancy ? data.discrepancyReason?.trim() || 'Quantity/condition discrepancy' : null,
          ...(finalStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
        },
        include: {
          allocations: true,
          sourceHospital: { select: { id: true, name: true, city: true, phone: true } },
          sourceBloodBank: { select: { id: true, name: true, city: true, phone: true } },
          destinationHospital: { select: { id: true, name: true, city: true, phone: true } },
          destinationBloodBank: { select: { id: true, name: true, city: true, phone: true } },
        },
      });

      await tx.redistributionRequest.update({
        where: { id: transfer.requestId },
        data: { status: finalStatus },
      });

      await tx.redistributionEvent.create({
        data: {
          requestId: transfer.requestId,
          transferId: transfer.id,
          actorUserId: userId,
          actorRole: inst.role,
          actorInstitutionId: inst.facilityId,
          actorInstitutionName: inst.name,
          action: hasDiscrepancy ? 'TRANSFER_RECEIVED_WITH_DISCREPANCY' : 'TRANSFER_RECEIVED_AND_RECONCILED',
          previousState: transfer.status,
          newState: finalStatus,
          reason: hasDiscrepancy
            ? `Discrepancy recorded: ${data.discrepancyReason}`
            : `Received and reconciled ${usableGoodUnits} units in good condition.`,
          correlationId: correlationId || null,
          metadata: {
            unitsDispatched: dispatchedCount,
            unitsReceived: data.unitsReceived,
            damagedUnits,
            usableGoodUnitsCredited: usableGoodUnits,
            destinationInventoryId: destinationInventoryRecord?.id || null,
            hasDiscrepancy,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: hasDiscrepancy ? 'REDISTRIBUTION_RECEIPT_DISCREPANCY' : 'RECEIVE_REDISTRIBUTION_TRANSFER',
          details: {
            transferId: transfer.id,
            unitsDispatched: dispatchedCount,
            unitsReceived: data.unitsReceived,
            damagedUnits,
            usableGoodUnits,
            hasDiscrepancy,
            discrepancyReason: data.discrepancyReason,
          },
        },
      });

      return updatedTransfer;
    });

    if (transfer.destinationBloodBankId) {
      await redisService.del(`inventory:${transfer.destinationBloodBankId}`).catch(() => null);
    }

    // Notify source institution
    const sourceUserId = transfer.sourceHospital?.userId || transfer.sourceBloodBank?.userId;
    if (sourceUserId) {
      await prisma.notification
        .create({
          data: {
            userId: sourceUserId,
            title: hasDiscrepancy
              ? `[DISCREPANCY] Shipment ${transfer.shipmentReference || transfer.id.slice(0, 8)} Flagged for Review`
              : `[COMPLETED] Shipment ${transfer.shipmentReference || transfer.id.slice(0, 8)} Received`,
            message: hasDiscrepancy
              ? `Destination recorded ${data.unitsReceived}/${dispatchedCount} units received (${damagedUnits} damaged). Reason: ${data.discrepancyReason}`
              : `Destination confirmed receipt of ${usableGoodUnits} units in verified condition.`,
            type: 'REDISTRIBUTION_ALERT',
          },
        })
        .catch(() => null);
    }

    return updated;
  }

  /**
   * Completes a transfer in RECEIVED state after review/reconciliation checks succeed.
   */
  async completeTransfer(
    transferId: string,
    userId: string,
    role: string,
    data?: { resolutionNotes?: string },
    correlationId?: string
  ) {
    const inst = await this.resolveUserInstitution(userId, role, true);

    const transfer = await prisma.redistributionTransfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) {
      throw new NotFoundError('Redistribution transfer not found.');
    }

    if (!this.isDestinationOwner(inst, transfer) && inst.role !== 'ADMIN') {
      throw new ForbiddenError('Only the destination institution or platform administrator can finalize completion.');
    }

    if (transfer.status === 'COMPLETED') {
      return transfer;
    }

    this.validateTransition(transfer.status, 'COMPLETED');

    if (transfer.hasDiscrepancy && (!data?.resolutionNotes || data.resolutionNotes.trim().length < 5)) {
      throw new BadRequestError(
        'Transfers with recorded discrepancies require resolution notes before they can be marked COMPLETED.'
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.redistributionTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      await tx.redistributionRequest.update({
        where: { id: transfer.requestId },
        data: { status: 'COMPLETED' },
      });

      await tx.redistributionEvent.create({
        data: {
          requestId: transfer.requestId,
          transferId: transfer.id,
          actorUserId: userId,
          actorRole: inst.role,
          actorInstitutionId: inst.facilityId,
          actorInstitutionName: inst.name,
          action: 'TRANSFER_COMPLETED',
          previousState: transfer.status,
          newState: 'COMPLETED',
          reason: data?.resolutionNotes || 'Transfer reconciliation verified and completed.',
          correlationId: correlationId || null,
        },
      });

      return updated;
    });
  }

  /**
   * Cancels a transfer prior to dispatch and releases reserved units back to available stock (Module F).
   */
  async cancelTransfer(
    transferId: string,
    userId: string,
    role: string,
    data: { reason: string },
    correlationId?: string
  ) {
    const inst = await this.resolveUserInstitution(userId, role, false);

    const transfer = await prisma.redistributionTransfer.findUnique({
      where: { id: transferId },
      include: {
        request: true,
        allocations: {
          include: { inventory: true },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundError('Redistribution transfer not found.');
    }

    if (!this.isDestinationOwner(inst, transfer) && !this.isSourceOwner(inst, transfer)) {
      throw new ForbiddenError('You do not have permission to cancel this transfer.');
    }

    if (['DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED'].includes(transfer.status)) {
      throw new BadRequestError(
        `Cannot cancel transfer in ${transfer.status} state because units have already been dispatched.`
      );
    }

    this.validateTransition(transfer.status, 'CANCELLED');

    if (!data.reason || data.reason.trim().length < 3) {
      throw new BadRequestError('A cancellation reason is required.');
    }

    const now = new Date();

    const cancelled = await prisma.$transaction(async (tx) => {
      let unitsRestored = 0;
      let unitsExpiredDuringReservation = 0;

      for (const alloc of transfer.allocations) {
        if (alloc.status !== 'RESERVED') continue;

        const isStillUnexpired = new Date(alloc.expiryDate).getTime() > now.getTime();
        const newInvStatus = isStillUnexpired ? 'AVAILABLE' : 'EXPIRED';

        await tx.bloodInventory.update({
          where: { id: alloc.inventoryId },
          data: { status: newInvStatus },
        });

        await tx.redistributionAllocation.update({
          where: { id: alloc.id },
          data: {
            status: 'RELEASED',
            releasedAt: now,
          },
        });

        if (isStillUnexpired) {
          unitsRestored += alloc.unitsAllocated;
        } else {
          unitsExpiredDuringReservation += alloc.unitsAllocated;
        }
      }

      const updatedTransfer = await tx.redistributionTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: data.reason.trim(),
        },
      });

      await tx.redistributionRequest.update({
        where: { id: transfer.requestId },
        data: { status: 'CANCELLED' },
      });

      await tx.redistributionEvent.create({
        data: {
          requestId: transfer.requestId,
          transferId: transfer.id,
          actorUserId: userId,
          actorRole: inst.role,
          actorInstitutionId: inst.facilityId,
          actorInstitutionName: inst.name,
          action: 'TRANSFER_CANCELLED_AND_RESERVATION_RELEASED',
          previousState: transfer.status,
          newState: 'CANCELLED',
          reason: data.reason.trim(),
          correlationId: correlationId || null,
          metadata: {
            unitsRestoredToAvailable: unitsRestored,
            unitsFlaggedExpired: unitsExpiredDuringReservation,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CANCEL_REDISTRIBUTION_TRANSFER',
          details: {
            transferId: transfer.id,
            requestId: transfer.requestId,
            reason: data.reason,
            unitsRestored,
            unitsExpiredDuringReservation,
          },
        },
      });

      return updatedTransfer;
    });

    if (transfer.sourceBloodBankId) {
      await redisService.del(`inventory:${transfer.sourceBloodBankId}`).catch(() => null);
    }

    return cancelled;
  }

  /**
   * Retrieves a single redistribution request with full proposals, transfers, and audit events.
   */
  async getRequestById(requestId: string, userId: string, role: string) {
    await this.resolveUserInstitution(userId, role, false);

    const record = await prisma.redistributionRequest.findUnique({
      where: { id: requestId },
      include: {
        destinationHospital: { select: { id: true, name: true, city: true, address: true, phone: true, latitude: true, longitude: true } },
        destinationBloodBank: { select: { id: true, name: true, city: true, address: true, phone: true, latitude: true, longitude: true } },
        proposals: {
          include: {
            sourceHospital: { select: { id: true, name: true, city: true, phone: true } },
            sourceBloodBank: { select: { id: true, name: true, city: true, phone: true } },
            transfer: {
              include: {
                allocations: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        transfers: {
          include: {
            allocations: true,
            sourceHospital: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
            sourceBloodBank: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
            destinationHospital: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
            destinationBloodBank: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!record) {
      throw new NotFoundError('Redistribution request not found.');
    }

    return record;
  }

  /**
   * Lists redistribution dashboard summary, requests, incoming opportunities, and transfers (Module A).
   */
  async listRedistributionDashboard(
    userId: string,
    role: string,
    filters?: {
      bloodGroup?: BloodGroup;
      componentType?: BloodComponent;
      urgency?: RedistributionUrgency;
      status?: RedistributionStatus;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const inst = await this.resolveUserInstitution(userId, role, false);
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const reqWhere: any = {};
    if (filters?.bloodGroup) reqWhere.bloodGroup = filters.bloodGroup;
    if (filters?.componentType) reqWhere.componentType = filters.componentType;
    if (filters?.urgency) reqWhere.urgency = filters.urgency;
    if (filters?.status) reqWhere.status = filters.status;

    const [allRequests, allTransfers, allProposals] = await Promise.all([
      prisma.redistributionRequest.findMany({
        where: reqWhere,
        include: {
          destinationHospital: { select: { id: true, name: true, city: true, address: true, phone: true, latitude: true, longitude: true } },
          destinationBloodBank: { select: { id: true, name: true, city: true, address: true, phone: true, latitude: true, longitude: true } },
          proposals: {
            include: {
              sourceHospital: { select: { id: true, name: true, city: true, phone: true } },
              sourceBloodBank: { select: { id: true, name: true, city: true, phone: true } },
            },
          },
          transfers: {
            include: {
              allocations: true,
              sourceHospital: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
              sourceBloodBank: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
              destinationHospital: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
              destinationBloodBank: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.redistributionTransfer.findMany({
        where:
          inst.role === 'ADMIN'
            ? {}
            : inst.hospitalId
              ? { OR: [{ sourceHospitalId: inst.hospitalId }, { destinationHospitalId: inst.hospitalId }] }
              : { OR: [{ sourceBloodBankId: inst.bloodBankId }, { destinationBloodBankId: inst.bloodBankId }] },
        include: {
          request: true,
          allocations: true,
          sourceHospital: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
          sourceBloodBank: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
          destinationHospital: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
          destinationBloodBank: { select: { id: true, name: true, city: true, phone: true, latitude: true, longitude: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.redistributionProposal.findMany({
        where:
          inst.role === 'ADMIN'
            ? {}
            : inst.hospitalId
              ? { OR: [{ sourceHospitalId: inst.hospitalId }, { request: { destinationHospitalId: inst.hospitalId } }] }
              : { OR: [{ sourceBloodBankId: inst.bloodBankId }, { request: { destinationBloodBankId: inst.bloodBankId } }] },
        include: {
          request: {
            include: {
              destinationHospital: { select: { id: true, name: true, city: true } },
              destinationBloodBank: { select: { id: true, name: true, city: true } },
            },
          },
          sourceHospital: { select: { id: true, name: true, city: true } },
          sourceBloodBank: { select: { id: true, name: true, city: true } },
          transfer: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Enrich requests with distance from current institution
    const enrichedRequests = allRequests
      .map((r) => {
        const destName = r.destinationHospital?.name || r.destinationBloodBank?.name || 'Facility';
        const destCity = r.destinationHospital?.city || r.destinationBloodBank?.city || '';
        const isOwnRequest = this.isDestinationOwner(inst, r);
        const distanceKm = mapsService.calculateDistance(
          inst.latitude,
          inst.longitude,
          r.deliveryLatitude,
          r.deliveryLongitude
        );
        const estimatedTransitMins = Math.max(10, Math.round((distanceKm / 40) * 60) + 10);

        return {
          ...r,
          destinationName: destName,
          destinationCity: destCity,
          isOwnRequest,
          distanceKm,
          estimatedTransitMins,
        };
      })
      .filter((r) => {
        if (!filters?.search) return true;
        const q = filters.search.toLowerCase();
        return (
          r.id.toLowerCase().includes(q) ||
          r.destinationName.toLowerCase().includes(q) ||
          r.bloodGroup.toLowerCase().includes(q) ||
          r.componentType.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
        );
      });

    // Separate outgoing requests (created by this institution) vs incoming opportunities (created by other institutions)
    const outgoingRequests =
      inst.role === 'ADMIN' ? enrichedRequests : enrichedRequests.filter((r) => r.isOwnRequest);
    const incomingOpportunities =
      inst.role === 'ADMIN'
        ? enrichedRequests
        : enrichedRequests.filter(
          (r) => !r.isOwnRequest && ['REQUESTED', 'MATCHING', 'PROPOSED', 'AWAITING_APPROVAL'].includes(r.status)
        );

    // Summary Card Metrics (real backend counts)
    const activeStatuses = [
      'REQUESTED',
      'MATCHING',
      'PROPOSED',
      'AWAITING_APPROVAL',
      'APPROVED',
      'RESERVED',
      'READY_FOR_DISPATCH',
      'DISPATCHED',
      'IN_TRANSIT',
    ];

    const summary = {
      activeRedistributionRequests: outgoingRequests.filter((r) => activeStatuses.includes(r.status)).length,
      incomingTransferRequests: incomingOpportunities.length,
      outgoingTransferRequests: outgoingRequests.length,
      unitsAwaitingDispatch: allTransfers
        .filter((t) => ['APPROVED', 'RESERVED', 'READY_FOR_DISPATCH'].includes(t.status))
        .reduce((sum, t) => sum + t.unitsApproved, 0),
      unitsCurrentlyInTransit: allTransfers
        .filter((t) => ['DISPATCHED', 'IN_TRANSIT'].includes(t.status))
        .reduce((sum, t) => sum + (t.unitsDispatched ?? t.unitsApproved), 0),
      unitsReceivedInPeriod: allTransfers
        .filter(
          (t) =>
            ['RECEIVED', 'COMPLETED'].includes(t.status) &&
            (inst.role === 'ADMIN' || this.isDestinationOwner(inst, t))
        )
        .reduce((sum, t) => sum + (t.unitsReceived ?? 0), 0),
      urgentAndCriticalRequests: enrichedRequests.filter(
        (r) => (r.urgency === 'URGENT' || r.urgency === 'CRITICAL') && activeStatuses.includes(r.status)
      ).length,
      completedTransfers: allTransfers.filter((t) => t.status === 'COMPLETED').length,
    };

    const startIdx = (page - 1) * limit;
    const paginatedRequests = enrichedRequests.slice(startIdx, startIdx + limit);

    return {
      institution: inst,
      summary,
      requests: paginatedRequests,
      totalRequests: enrichedRequests.length,
      outgoingRequests,
      incomingOpportunities,
      proposals: allProposals,
      transfers: allTransfers,
      pagination: {
        page,
        limit,
        total: enrichedRequests.length,
        totalPages: Math.max(1, Math.ceil(enrichedRequests.length / limit)),
      },
    };
  }

  /**
   * Retrieves transfer history and immutable audit events for the authenticated institution (Module J).
   */
  async getHistory(
    userId: string,
    role: string,
    filters?: {
      status?: RedistributionStatus;
      bloodGroup?: BloodGroup;
      componentType?: BloodComponent;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const inst = await this.resolveUserInstitution(userId, role, false);

    const where: any =
      inst.role === 'ADMIN'
        ? {}
        : inst.hospitalId
          ? { OR: [{ sourceHospitalId: inst.hospitalId }, { destinationHospitalId: inst.hospitalId }] }
          : { OR: [{ sourceBloodBankId: inst.bloodBankId }, { destinationBloodBankId: inst.bloodBankId }] };

    if (filters?.status) where.status = filters.status;
    if (filters?.bloodGroup) where.bloodGroup = filters.bloodGroup;
    if (filters?.componentType) where.componentType = filters.componentType;
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [transfers, events] = await Promise.all([
      prisma.redistributionTransfer.findMany({
        where,
        include: {
          request: true,
          allocations: true,
          sourceHospital: { select: { id: true, name: true, city: true } },
          sourceBloodBank: { select: { id: true, name: true, city: true } },
          destinationHospital: { select: { id: true, name: true, city: true } },
          destinationBloodBank: { select: { id: true, name: true, city: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.redistributionEvent.findMany({
        where:
          inst.role === 'ADMIN'
            ? {}
            : {
              OR: [
                { actorInstitutionId: inst.facilityId },
                {
                  request: inst.hospitalId
                    ? { destinationHospitalId: inst.hospitalId }
                    : { destinationBloodBankId: inst.bloodBankId },
                },
              ],
            },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return {
      institution: inst,
      transfers,
      auditEvents: events,
    };
  }

  /**
   * Computes real database analytics & reporting metrics for the authenticated institution (Module J).
   */
  async getAnalytics(userId: string, role: string) {
    const inst = await this.resolveUserInstitution(userId, role, false);

    const transferWhere: any =
      inst.role === 'ADMIN'
        ? {}
        : inst.hospitalId
          ? { OR: [{ sourceHospitalId: inst.hospitalId }, { destinationHospitalId: inst.hospitalId }] }
          : { OR: [{ sourceBloodBankId: inst.bloodBankId }, { destinationBloodBankId: inst.bloodBankId }] };

    const [transfers, proposals] = await Promise.all([
      prisma.redistributionTransfer.findMany({
        where: transferWhere,
        include: {
          request: true,
          proposal: true,
        },
      }),
      prisma.redistributionProposal.findMany({
        where:
          inst.role === 'ADMIN'
            ? {}
            : inst.hospitalId
              ? { OR: [{ sourceHospitalId: inst.hospitalId }, { request: { destinationHospitalId: inst.hospitalId } }] }
              : { OR: [{ sourceBloodBankId: inst.bloodBankId }, { request: { destinationBloodBankId: inst.bloodBankId } }] },
      }),
    ]);

    let totalUnitsReceived = 0;
    let totalUnitsSupplied = 0;
    let completedTransfers = 0;
    let pendingTransfers = 0;
    let cancelledTransfers = 0;
    let recordedDiscrepancies = 0;
    let completedWithinDeadline = 0;

    const approvalDurationsMins: number[] = [];
    const transitDurationsMins: number[] = [];

    const byBloodGroup: Record<string, { transfers: number; units: number }> = {};
    const byComponent: Record<string, { transfers: number; units: number }> = {};
    const byMonth: Record<string, { completed: number; unitsTransferred: number }> = {};

    for (const t of transfers) {
      const isDest = inst.role === 'ADMIN' || this.isDestinationOwner(inst, t);
      const isSource = inst.role === 'ADMIN' || this.isSourceOwner(inst, t);

      if (['RECEIVED', 'COMPLETED'].includes(t.status)) {
        if (isDest) totalUnitsReceived += t.unitsReceived ?? 0;
        if (isSource) totalUnitsSupplied += t.unitsDispatched ?? t.unitsApproved;
      }

      if (t.status === 'COMPLETED') {
        completedTransfers++;
        if (t.receivedAt && t.request?.requiredBy && new Date(t.receivedAt) <= new Date(t.request.requiredBy)) {
          completedWithinDeadline++;
        }
      } else if (['APPROVED', 'RESERVED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED'].includes(t.status)) {
        pendingTransfers++;
      } else if (t.status === 'CANCELLED') {
        cancelledTransfers++;
      }

      if (t.hasDiscrepancy) {
        recordedDiscrepancies++;
      }

      // Request-to-approval duration
      if (t.request?.createdAt && t.createdAt) {
        const diffMins = (new Date(t.createdAt).getTime() - new Date(t.request.createdAt).getTime()) / (60 * 1000);
        if (diffMins >= 0) approvalDurationsMins.push(diffMins);
      }

      // Dispatch-to-receipt duration
      if (t.dispatchedAt && t.receivedAt) {
        const diffMins = (new Date(t.receivedAt).getTime() - new Date(t.dispatchedAt).getTime()) / (60 * 1000);
        if (diffMins >= 0) transitDurationsMins.push(diffMins);
      }

      const bgKey = t.bloodGroup;
      if (!byBloodGroup[bgKey]) byBloodGroup[bgKey] = { transfers: 0, units: 0 };
      byBloodGroup[bgKey].transfers += 1;
      byBloodGroup[bgKey].units += t.unitsReceived ?? t.unitsDispatched ?? t.unitsApproved;

      const compKey = t.componentType;
      if (!byComponent[compKey]) byComponent[compKey] = { transfers: 0, units: 0 };
      byComponent[compKey].transfers += 1;
      byComponent[compKey].units += t.unitsReceived ?? t.unitsDispatched ?? t.unitsApproved;

      const monthKey = new Date(t.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth[monthKey]) byMonth[monthKey] = { completed: 0, unitsTransferred: 0 };
      if (t.status === 'COMPLETED') {
        byMonth[monthKey].completed += 1;
        byMonth[monthKey].unitsTransferred += t.unitsReceived ?? t.unitsApproved;
      }
    }

    const rejectedRequests = proposals.filter((p) => p.status === 'REJECTED').length;

    const avgRequestToApprovalMins =
      approvalDurationsMins.length > 0
        ? parseFloat((approvalDurationsMins.reduce((a, b) => a + b, 0) / approvalDurationsMins.length).toFixed(1))
        : null;

    const avgDispatchToReceiptMins =
      transitDurationsMins.length > 0
        ? parseFloat((transitDurationsMins.reduce((a, b) => a + b, 0) / transitDurationsMins.length).toFixed(1))
        : null;

    return {
      institution: inst,
      metrics: {
        totalUnitsReceived,
        totalUnitsSupplied,
        completedTransfers,
        pendingTransfers,
        rejectedRequests,
        cancelledTransfers,
        recordedDiscrepancies,
        completedWithinDeadline,
        deadlineComplianceRate:
          completedTransfers > 0 ? parseFloat(((completedWithinDeadline / completedTransfers) * 100).toFixed(1)) : null,
        avgRequestToApprovalMins,
        avgDispatchToReceiptMins,
      },
      byBloodGroup,
      byComponent,
      byMonth,
    };
  }
}

export const redistributionService = new RedistributionService();