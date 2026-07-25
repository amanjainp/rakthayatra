import { Client } from '@googlemaps/google-maps-services-js';
import { PrismaClient, BloodGroup } from '@prisma/client';
import { env } from '../config/env';
import logger from '../config/logger';
import { cacheService } from './cache.service';
import { BadRequestError, InternalServerError } from '../errors/app-error';

const prisma = new PrismaClient();

export class MapsService {
  private client: Client;
  private apiKey: string;
  private isMockMode = false;

  constructor() {
    this.client = new Client({});
    this.apiKey = env.GOOGLE_MAPS_API_KEY || '';

    if (!this.apiKey) {
      logger.warn('GOOGLE_MAPS_API_KEY not configured. MapsService is running in MOCK mode.');
      this.isMockMode = true;
    } else {
      logger.info('Google Maps Client successfully initialized.');
    }
  }

  public getMockMode(): boolean {
    return this.isMockMode;
  }

  /**
   * Geocodes an address into latitude and longitude coordinates.
   */
  async geocode(address: string): Promise<{ latitude: number; longitude: number }> {
    if (!address || address.trim() === '') {
      throw new BadRequestError('Address is required for geocoding.');
    }

    const cacheKey = `geocode:${Buffer.from(address.trim().toLowerCase()).toString('base64')}`;

    // 1. Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug(`Geocode Cache Hit for address: ${address}`);
      return JSON.parse(cached);
    }

    if (this.isMockMode) {
      logger.info(`[MOCK] Geocoding address: ${address}`);
      const mockResult = { latitude: 12.9716, longitude: 77.5946 }; // Default: Bengaluru coords
      await cacheService.set(cacheKey, JSON.stringify(mockResult), 86400); // Cache 24h
      return mockResult;
    }

    try {
      const response = await this.client.geocode({
        params: {
          address,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results[0]) {
        throw new BadRequestError(`Could not geocode address: ${response.data.status}`);
      }

      const location = response.data.results[0].geometry.location;
      const result = { latitude: location.lat, longitude: location.lng };

      await cacheService.set(cacheKey, JSON.stringify(result), 86400); // Cache 24h
      logger.info(`Geocode success for: ${address}`);
      return result;
    } catch (error: any) {
      logger.error(`Geocoding error for ${address}: ${error.message}`);
      if (error instanceof BadRequestError) throw error;
      throw new InternalServerError('Failed to connect to geocoding services.');
    }
  }

  /**
   * Reverse-geocodes coordinate values into a formatted address string.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    const cacheKey = `rgeocode:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;

    // 1. Check cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug(`Reverse Geocode Cache Hit for coords: ${latitude},${longitude}`);
      return cached;
    }

    if (this.isMockMode) {
      logger.info(`[MOCK] Reverse geocoding coords: ${latitude},${longitude}`);
      const mockAddress = 'Malleshwaram, Bengaluru, Karnataka, India';
      await cacheService.set(cacheKey, mockAddress, 86400);
      return mockAddress;
    }

    try {
      const response = await this.client.reverseGeocode({
        params: {
          latlng: { lat: latitude, lng: longitude },
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results[0]) {
        throw new BadRequestError('Could not reverse geocode coordinates.');
      }

      const address = response.data.results[0].formatted_address;
      await cacheService.set(cacheKey, address, 86400);
      logger.info(`Reverse geocode success for: ${latitude}, ${longitude}`);
      return address;
    } catch (error: any) {
      logger.error(`Reverse geocoding error for ${latitude},${longitude}: ${error.message}`);
      if (error instanceof BadRequestError) throw error;
      throw new InternalServerError('Failed to connect to reverse-geocoding services.');
    }
  }

  /**
   * Calculates the straight-line distance in kilometers between two coordinates.
   * Utilizes the Haversine formula (offline, zero external API latency).
   */
  public calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Return rounded to 2 decimal places
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Performs radius searches (5km, 10km, 25km, 50km) for donors, hospitals, or blood banks.
   */
  async radiusSearch(
    lat: number,
    lng: number,
    radiusKm: number,
    type: 'donors' | 'hospitals' | 'blood_banks',
    bloodGroup?: BloodGroup,
  ): Promise<any[]> {
    if (![5, 10, 25, 50].includes(radiusKm)) {
      throw new BadRequestError('Search radius must be 5, 10, 25, or 50 kilometers.');
    }

    let entities: any[] = [];

    if (type === 'donors') {
      entities = await prisma.donorProfile.findMany({
        where: {
          isAvailable: true,
          deletedAt: null,
          ...(bloodGroup ? { bloodGroup } : {}),
        },
      });
    } else if (type === 'hospitals') {
      entities = await prisma.hospitalProfile.findMany({
        where: {
          isVerified: true,
          deletedAt: null,
        },
      });
    } else if (type === 'blood_banks') {
      entities = await prisma.bloodBankProfile.findMany({
        where: {
          isVerified: true,
          deletedAt: null,
        },
      });
    }

    // Filter by calculated distance and map results
    return entities
      .map((entity) => {
        const distance = this.calculateDistance(lat, lng, entity.latitude, entity.longitude);
        return { ...entity, distanceKm: distance };
      })
      .filter((entity) => entity.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  /**
   * Finds the single nearest entity (donor, hospital, blood bank) to coordinate targets.
   */
  async findNearest(
    lat: number,
    lng: number,
    type: 'donor' | 'hospital' | 'blood_bank',
    bloodGroup?: BloodGroup,
  ): Promise<any | null> {
    const listType = type === 'donor' ? 'donors' : type === 'hospital' ? 'hospitals' : 'blood_banks';
    
    // Scan up to the maximum 50km radius for lookups
    const results = await this.radiusSearch(lat, lng, 50, listType, bloodGroup);
    return results.length > 0 ? results[0] : null;
  }
}

export const mapsService = new MapsService();
