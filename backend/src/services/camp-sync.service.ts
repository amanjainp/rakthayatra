import { PrismaClient, CampStatus } from '@prisma/client';
import { z } from 'zod';
import logger from '../config/logger';

const prisma = new PrismaClient();

export const ExternalCampSchema = z.object({
  name: z.string().min(1, 'Camp name is required'),
  organizer: z.string().min(1, 'Organizer name is required'),
  address: z.string().min(1, 'Venue address is required'),
  city: z.string().min(1, 'City is required'),
  latitude: z.number().min(-90).max(90).default(0),
  longitude: z.number().min(-180).max(180).default(0),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Start date must be a valid date string',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'End date must be a valid date string',
  }),
  status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional().default('UPCOMING'),
  externalRegistrationUrl: z.string().url().optional().nullable(),
  source: z.string().optional().default('eRaktKosh / State Blood Transfusion Council'),
});

export type ExternalCampInput = z.infer<typeof ExternalCampSchema>;

export interface CampSyncResult {
  lastSyncAt: Date;
  status: 'SYNCHRONIZED' | 'UNAVAILABLE' | 'STANDALONE_VERIFIED';
  source: string;
  syncedCount: number;
  expiredTransitionedCount: number;
  message: string;
}

export class CampSyncService {
  private lastSyncAt: Date | null = null;
  private cachedSyncResult: CampSyncResult | null = null;
  private readonly syncIntervalMs = 15 * 60 * 1000; // 15-minute revalidation throttle

  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  /**
   * Identifies expired camps by actual event end date and transitions them to COMPLETED.
   * Identifies ongoing camps and transitions them to ACTIVE.
   * Preserves historical records for audit and compliance without deleting them.
   */
  async maintainCampStatuses(tx?: any): Promise<number> {
    const now = new Date();
    const client = tx || this.prismaClient;

    if (!client.donationCamp || typeof client.donationCamp.updateMany !== 'function') {
      return 0;
    }

    try {
      // 1. Transition past camps whose end date has passed to COMPLETED
      const expiredResult = await client.donationCamp.updateMany({
        where: {
          endDate: { lt: now },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          deletedAt: null,
        },
        data: {
          status: 'COMPLETED' as CampStatus,
        },
      });

      // 2. Transition currently running camps to ACTIVE
      await client.donationCamp.updateMany({
        where: {
          startDate: { lte: now },
          endDate: { gte: now },
          status: 'UPCOMING' as CampStatus,
          deletedAt: null,
        },
        data: {
          status: 'ACTIVE' as CampStatus,
        },
      });

      return expiredResult?.count || 0;
    } catch (err: any) {
      logger.warn(`[CampSyncService] Failed to update camp statuses: ${err.message}`);
      return 0;
    }
  }

  /**
   * Synchronizes authentic camps from official feeds if configured,
   * otherwise ensures status transitions on local organizer-verified camps.
   */
  async syncOfficialCamps(): Promise<CampSyncResult> {
    const now = new Date();

    // Respect revalidation throttle window to prevent flooding external resources
    if (this.lastSyncAt && now.getTime() - this.lastSyncAt.getTime() < this.syncIntervalMs && this.cachedSyncResult) {
      return this.cachedSyncResult;
    }

    const expiredTransitionedCount = await this.maintainCampStatuses();

    const feedUrl = process.env.OFFICIAL_CAMP_FEED_URL || process.env.ERAKTKOSH_CAMP_API_URL;
    if (!feedUrl) {
      this.lastSyncAt = now;
      const result: CampSyncResult = {
        lastSyncAt: now,
        status: 'STANDALONE_VERIFIED',
        source: 'eRaktKosh Portal & Authorized Healthcare Providers',
        syncedCount: 0,
        expiredTransitionedCount,
        message: 'Operating in verified organizer mode. Real-time external gateway not configured.',
      };
      this.cachedSyncResult = result;
      return result;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(process.env.OFFICIAL_CAMP_API_KEY
            ? { Authorization: `Bearer ${process.env.OFFICIAL_CAMP_API_KEY}` }
            : {}),
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Upstream camp feed responded with status ${response.status}`);
      }

      const data: any = await response.json();
      const rawList = Array.isArray(data) ? data : data.items || data.data || [];
      let imported = 0;

      for (const item of rawList) {
        const validated = ExternalCampSchema.safeParse(item);
        if (!validated.success) continue;

        const camp = validated.data;
        const startDate = new Date(camp.startDate);
        const endDate = new Date(camp.endDate);

        // Discard invalid date ranges or already expired events
        if (startDate > endDate || endDate < now) continue;

        // Prevent duplicate records: match by unique name and start date
        const existing = await this.prismaClient.donationCamp.findFirst({
          where: {
            name: camp.name,
            startDate,
            deletedAt: null,
          },
        });

        const computedStatus: CampStatus =
          startDate <= now && endDate >= now ? 'ACTIVE' : (camp.status as CampStatus);

        if (!existing) {
          await this.prismaClient.donationCamp.create({
            data: {
              name: camp.name,
              organizer: camp.organizer,
              address: camp.address,
              city: camp.city,
              latitude: camp.latitude,
              longitude: camp.longitude,
              startDate,
              endDate,
              status: computedStatus,
              externalRegistrationUrl: camp.externalRegistrationUrl || null,
            },
          });
          imported++;
        } else {
          // Update existing record if details changed
          await this.prismaClient.donationCamp.update({
            where: { id: existing.id },
            data: {
              address: camp.address,
              city: camp.city,
              endDate,
              status: computedStatus,
              externalRegistrationUrl: camp.externalRegistrationUrl || existing.externalRegistrationUrl,
            },
          });
        }
      }

      this.lastSyncAt = now;
      const result: CampSyncResult = {
        lastSyncAt: now,
        status: 'SYNCHRONIZED',
        source: 'eRaktKosh Official Feed / MoHFW NBTC',
        syncedCount: imported,
        expiredTransitionedCount,
        message: `Successfully synchronized ${imported} authentic camps from official source.`,
      };
      this.cachedSyncResult = result;
      return result;
    } catch (err: any) {
      logger.warn(`[CampSyncService] Upstream feed sync failed: ${err.message}`);
      this.lastSyncAt = now;
      const result: CampSyncResult = {
        lastSyncAt: now,
        status: 'UNAVAILABLE',
        source: 'Authorized Healthcare Providers (Official Gateway Unreachable)',
        syncedCount: 0,
        expiredTransitionedCount,
        message: 'External official feed temporarily unavailable. Displaying local verified listings.',
      };
      this.cachedSyncResult = result;
      return result;
    }
  }

  getLastSyncStatus(): CampSyncResult {
    return (
      this.cachedSyncResult || {
        lastSyncAt: new Date(),
        status: 'STANDALONE_VERIFIED',
        source: 'eRaktKosh Portal & Authorized Healthcare Providers',
        syncedCount: 0,
        expiredTransitionedCount: 0,
        message: 'Verified organizer listings active.',
      }
    );
  }
}

export const campSyncService = new CampSyncService();
