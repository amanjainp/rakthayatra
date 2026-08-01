import { Request, Response } from 'express';
import { z } from 'zod';
import { inventoryService } from '../services/inventory.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError, BadRequestError } from '../errors/app-error';
import logger from '../config/logger';

// Zod Validation Schemas
const registerSchema = z.object({
  bloodBankId: z.string().uuid('Invalid blood bank ID format.'),
  bloodGroup: z.enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG']),
  unitsCount: z.number().int().positive('Units count must be a positive integer.'),
  expiryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Expiry date must be a valid date string.',
  }),
});

const reserveSchema = z.object({
  inventoryId: z.string().uuid('Invalid inventory ID format.'),
  unitsToReserve: z.number().int().positive('Units to reserve must be a positive integer.'),
});

const searchSchema = z.object({
  bloodBankId: z.string().uuid('Invalid blood bank ID format.').optional(),
  bloodGroup: z.enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG']).optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'EXPIRED', 'DISTRIBUTED']).optional(),
  page: z.preprocess((val) => Number(val) || 1, z.number().int().positive()),
  limit: z.preprocess((val) => Number(val) || 10, z.number().int().positive()),
});

function handleControllerError(res: Response, error: any) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed.',
        details: error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })),
      },
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.errorCode,
        message: error.message,
      },
    });
  }

  logger.error(`Unhandled inventory controller exception: ${error.message}`);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected database or server error occurred.',
    },
  });
}

export class InventoryController {
  /**
   * Registers a new blood unit.
   */
  async register(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = registerSchema.parse(req.body);
      const inventory = await inventoryService.registerBloodUnit(
        {
          bloodBankId: parsed.bloodBankId,
          bloodGroup: parsed.bloodGroup,
          unitsCount: parsed.unitsCount,
          expiryDate: new Date(parsed.expiryDate),
        },
        req.user?.userId
      );

      return res.status(201).json({
        success: true,
        message: 'Blood unit batch registered successfully.',
        data: { inventory },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Reserves blood units.
   */
  async reserve(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = reserveSchema.parse(req.body);
      const reserved = await inventoryService.reserveUnits(
        {
          inventoryId: parsed.inventoryId,
          unitsToReserve: parsed.unitsToReserve,
        },
        req.user?.userId
      );

      return res.status(200).json({
        success: true,
        message: 'Blood units reserved successfully.',
        data: { inventory: reserved },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Releases reserved blood units.
   */
  async release(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
        throw new BadRequestError('Invalid inventory batch ID parameter.');
      }

      const released = await inventoryService.releaseUnits(id, req.user?.userId);

      return res.status(200).json({
        success: true,
        message: 'Reserved blood units released to available stock successfully.',
        data: { inventory: released },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Filters and lists blood stock.
   */
  async search(req: Request, res: Response) {
    try {
      const parsed = searchSchema.parse(req.query);
      const result = await inventoryService.searchInventory({
        bloodBankId: parsed.bloodBankId,
        bloodGroup: parsed.bloodGroup,
        status: parsed.status,
        page: parsed.page,
        limit: parsed.limit,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }

  /**
   * Triggers manual scanning for expired stocks.
   */
  async triggerExpiryCheck(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await inventoryService.checkAndFlagExpiredUnits(req.user?.userId);

      return res.status(200).json({
        success: true,
        message: `Checked and flagged ${updated.length} expired blood inventory batches.`,
        data: { expiredBatchesCount: updated.length },
      });
    } catch (error: any) {
      return handleControllerError(res, error);
    }
  }
}

export const inventoryController = new InventoryController();
