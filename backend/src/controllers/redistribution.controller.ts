import { Response } from 'express';
import { z } from 'zod';
import { redistributionService } from '../services/redistribution.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError, BadRequestError } from '../errors/app-error';
import logger from '../config/logger';

const bloodGroupEnum = z.enum([
  'A_POS',
  'A_NEG',
  'B_POS',
  'B_NEG',
  'AB_POS',
  'AB_NEG',
  'O_POS',
  'O_NEG',
]);

const componentTypeEnum = z.enum([
  'WHOLE_BLOOD',
  'PACKED_RBC',
  'PLASMA',
  'PLATELETS',
  'CRYOPRECIPITATE',
]);

const urgencyEnum = z.enum(['ROUTINE', 'URGENT', 'CRITICAL']);

const createRequestSchema = z.object({
  bloodGroup: bloodGroupEnum,
  componentType: componentTypeEnum.optional().default('WHOLE_BLOOD'),
  unitsRequired: z.number().int().positive('Number of units required must be a positive integer.'),
  urgency: urgencyEnum.optional().default('ROUTINE'),
  requiredBy: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'requiredBy must be a valid ISO date string.',
  }),
  minRemainingShelfLifeDays: z.number().int().min(1).max(365).optional(),
  deliveryAddress: z.string().min(3).optional(),
  reason: z.string().min(3, 'Reason for the redistribution request is required.'),
  specialHandlingNotes: z.string().optional(),
  additionalNotes: z.string().optional(),
  destinationHospitalId: z.string().uuid().optional(),
  destinationBloodBankId: z.string().uuid().optional(),
});

const createProposalSchema = z.object({
  sourceFacilityType: z.enum(['HOSPITAL', 'BLOOD_BANK']).optional(),
  sourceHospitalId: z.string().uuid().optional(),
  sourceBloodBankId: z.string().uuid().optional(),
  bloodGroup: bloodGroupEnum.optional(),
  unitsProposed: z.number().int().positive('Units proposed must be a positive integer.'),
  proposedInventoryIds: z.array(z.string().uuid()).optional(),
  notes: z.string().optional(),
});

const approveProposalSchema = z.object({
  idempotencyKey: z.string().optional(),
  notes: z.string().optional(),
});

const rejectProposalSchema = z.object({
  reason: z.string().min(2, 'Rejection reason is required.').optional(),
});

const dispatchTransferSchema = z.object({
  shipmentReference: z.string().optional(),
  dispatcherName: z.string().min(2, 'Authorized dispatcher name is required.'),
  unitsDispatched: z.number().int().positive().optional(),
  transportVehicleDetails: z.string().optional(),
  temperatureCheckConfirmed: z.boolean(),
  coldChainNotes: z.string().optional(),
  expectedArrivalAt: z.string().optional(),
});

const inTransitSchema = z.object({
  inTransitNotes: z.string().min(2).optional(),
  expectedArrivalAt: z.string().optional(),
});

const receiveTransferSchema = z.object({
  unitsReceived: z.number().int().min(0, 'Units received must be 0 or greater.'),
  damagedUnits: z.number().int().min(0).optional().default(0),
  receiverStaffName: z.string().min(2, 'Receiving staff member name is required.'),
  conditionVerified: z.boolean(),
  discrepancyReason: z.string().optional(),
  autoComplete: z.boolean().optional().default(true),
});

const cancelTransferSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason is required.'),
});

const addInventorySchema = z.object({
  bloodGroup: bloodGroupEnum,
  componentType: componentTypeEnum.optional().default('WHOLE_BLOOD'),
  unitsCount: z.number().int().positive('Units count must be a positive integer.'),
  expiryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Expiry date must be a valid date string.',
  }),
  collectionDate: z.string().optional(),
  batchNumber: z.string().optional(),
  storageTemp: z.string().optional(),
  targetHospitalId: z.string().uuid().optional(),
  targetBloodBankId: z.string().uuid().optional(),
});

function handleControllerError(res: Response, error: any) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed.',
        details: error.issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.errorCode,
        message: error.message,
        details: error.details,
      },
    });
  }

  logger.error(`Unhandled redistribution controller error: ${error.message}`);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred while processing the redistribution request.',
    },
  });
}

export class RedistributionController {
  /**
   * GET /api/redistribution
   */
  async listDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      const data = await redistributionService.listRedistributionDashboard(userId, role, {
        bloodGroup: req.query.bloodGroup as any,
        componentType: req.query.componentType as any,
        urgency: req.query.urgency as any,
        status: req.query.status as any,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
      });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * GET /api/redistribution/inventory
   */
  async getInstitutionInventory(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await redistributionService.getInstitutionInventory(req.user!.userId, req.user!.role, {
        bloodGroup: req.query.bloodGroup as any,
        componentType: req.query.componentType as any,
        status: req.query.status as string | undefined,
      });
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * POST /api/redistribution/inventory
   */
  async addInstitutionInventory(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = addInventorySchema.parse(req.body);
      const inventory = await redistributionService.addInstitutionInventory(
        req.user!.userId,
        req.user!.role,
        parsed
      );
      return res.status(201).json({
        success: true,
        message: 'Institutional blood inventory batch registered successfully.',
        data: { inventory },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * POST /api/redistribution/requests
   */
  async createRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = createRequestSchema.parse(req.body);
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
      const requestRecord = await redistributionService.createRequest(
        req.user!.userId,
        req.user!.role,
        parsed,
        correlationId
      );

      return res.status(201).json({
        success: true,
        message: 'Blood redistribution request created and matching initiated.',
        data: { request: requestRecord },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * GET /api/redistribution/requests/:id
   */
  async getRequestById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id) throw new BadRequestError('Request ID is required.');
      const requestRecord = await redistributionService.getRequestById(id, req.user!.userId, req.user!.role);

      return res.status(200).json({
        success: true,
        data: { request: requestRecord },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * GET /api/redistribution/requests/:id/matches
   */
  async findMatches(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id) throw new BadRequestError('Request ID is required.');
      const matches = await redistributionService.findEligibleSources(id, req.user!.userId, req.user!.role);

      return res.status(200).json({
        success: true,
        data: matches,
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * POST /api/redistribution/requests/:id/proposals
   */
  async createProposal(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = createProposalSchema.parse(req.body);
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

      const proposal = await redistributionService.createProposal(
        id,
        req.user!.userId,
        req.user!.role,
        parsed,
        correlationId
      );

      return res.status(201).json({
        success: true,
        message: 'Transfer proposal submitted successfully.',
        data: { proposal },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * POST /api/redistribution/proposals/:id/approve
   */
  async approveProposal(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = approveProposalSchema.parse(req.body || {});
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

      const transfer = await redistributionService.approveProposal(
        id,
        req.user!.userId,
        req.user!.role,
        parsed,
        correlationId
      );

      return res.status(200).json({
        success: true,
        message: 'Proposal approved and eligible blood inventory units reserved atomically.',
        data: { transfer },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * POST /api/redistribution/proposals/:id/reject
   */
  async rejectProposal(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = rejectProposalSchema.parse(req.body || {});
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

      const proposal = await redistributionService.rejectProposal(
        id,
        req.user!.userId,
        req.user!.role,
        parsed,
        correlationId
      );

      return res.status(200).json({
        success: true,
        message: 'Transfer proposal rejected.',
        data: { proposal },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * POST /api/redistribution/transfers/:id/dispatch
   */
  async dispatchTransfer(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = dispatchTransferSchema.parse(req.body);
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

      const transfer = await redistributionService.dispatchTransfer(
        id,
        req.user!.userId,
        req.user!.role,
        parsed,
        correlationId
      );

      return res.status(200).json({
        success: true,
        message: 'Shipment dispatch recorded successfully.',
        data: { transfer },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * POST /api/redistribution/transfers/:id/in-transit
   */
  async markInTransit(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = inTransitSchema.parse(req.body || {});
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

      const transfer = await redistributionService.markInTransit(
        id,
        req.user!.userId,
        req.user!.role,
        parsed,
        correlationId
      );

      return res.status(200).json({
        success: true,
        message: 'Shipment in-transit status updated.',
        data: { transfer },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * POST /api/redistribution/transfers/:id/receive
   */
  async receiveTransfer(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = receiveTransferSchema.parse(req.body);
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

      const transfer = await redistributionService.receiveTransfer(
        id,
        req.user!.userId,
        req.user!.role,
        parsed,
        correlationId
      );

      return res.status(200).json({
        success: true,
        message: transfer.hasDiscrepancy
          ? 'Receipt recorded with discrepancy; transfer flagged for review.'
          : 'Receipt verified, inventory reconciled, and transfer completed.',
        data: { transfer },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * POST /api/redistribution/transfers/:id/complete
   */
  async completeTransfer(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

      const transfer = await redistributionService.completeTransfer(
        id,
        req.user!.userId,
        req.user!.role,
        { resolutionNotes: req.body?.resolutionNotes },
        correlationId
      );

      return res.status(200).json({
        success: true,
        message: 'Transfer marked as completed.',
        data: { transfer },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * POST /api/redistribution/transfers/:id/cancel
   */
  async cancelTransfer(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const parsed = cancelTransferSchema.parse(req.body);
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

      const transfer = await redistributionService.cancelTransfer(
        id,
        req.user!.userId,
        req.user!.role,
        parsed,
        correlationId
      );

      return res.status(200).json({
        success: true,
        message: 'Transfer cancelled and reserved blood inventory released back to available stock.',
        data: { transfer },
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * GET /api/redistribution/history
   */
  async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await redistributionService.getHistory(req.user!.userId, req.user!.role, {
        status: req.query.status as any,
        bloodGroup: req.query.bloodGroup as any,
        componentType: req.query.componentType as any,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }

  /**
   * GET /api/redistribution/analytics
   */
  async getAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await redistributionService.getAnalytics(req.user!.userId, req.user!.role);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      return handleControllerError(res, error);
    }
  }
}

export const redistributionController = new RedistributionController();

