import { mapsService } from '../src/services/maps.service';
import { cacheService } from '../src/services/cache.service';
import { BadRequestError } from '../src/errors/app-error';
import { PrismaClient } from '@prisma/client';

// Mock Prisma within Jest hoist scope
jest.mock('@prisma/client', () => {
  const localMockPrisma = {
    donorProfile: { findMany: jest.fn() },
    hospitalProfile: { findMany: jest.fn() },
    bloodBankProfile: { findMany: jest.fn() },
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => localMockPrisma),
    BloodGroup: {
      O_NEG: 'O_NEG',
      A_POS: 'A_POS',
    },
  };
});

const prisma = new PrismaClient() as any;

// Mock Google Maps Client SDK with internal mock getters
jest.mock('@googlemaps/google-maps-services-js', () => {
  return {
    Client: jest.fn().mockImplementation(() => {
      return {
        geocode: jest.fn(),
        reverseGeocode: jest.fn(),
      };
    }),
  };
});

// Retrieve the instantiated mock client from mapsService
const mockClient = (mapsService as any).client;

describe('MapsService Infrastructure Layer Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Haversine Offline Formula Calculation', () => {
    it('should correctly calculate straight-line distances between coordinate pairs', () => {
      const bangalore = { lat: 12.9716, lng: 77.5946 };
      const mysuru = { lat: 12.2958, lng: 76.6394 };

      const distance = mapsService.calculateDistance(
        bangalore.lat,
        bangalore.lng,
        mysuru.lat,
        mysuru.lng,
      );

      expect(distance).toBeGreaterThanOrEqual(125.0);
      expect(distance).toBeLessThanOrEqual(135.0);
    });

    it('should return 0.0 for identical coordinates', () => {
      const distance = mapsService.calculateDistance(12.9716, 77.5946, 12.9716, 77.5946);
      expect(distance).toBe(0.0);
    });
  });

  describe('Geocoding Caching and Execution Mocks', () => {
    it('should check cache first and skip API call on hit', async () => {
      const address = 'Yeshwanthpur, Bengaluru';
      const cacheKey = `geocode:${Buffer.from(address.toLowerCase()).toString('base64')}`;
      
      // Seed cache
      const cachedCoords = { latitude: 13.0235, longitude: 77.5468 };
      await cacheService.set(cacheKey, JSON.stringify(cachedCoords), 3600);

      const result = await mapsService.geocode(address);

      expect(result).toEqual(cachedCoords);
      expect(mockClient.geocode).not.toHaveBeenCalled();
    });

    it('should fail on empty address queries', async () => {
      await expect(mapsService.geocode('   ')).rejects.toThrow(BadRequestError);
    });
  });

  describe('Radius Range Search Lookups', () => {
    it('should throw BadRequestError on invalid radius targets', async () => {
      await expect(
        mapsService.radiusSearch(12.9716, 77.5946, 15, 'donors'),
      ).rejects.toThrow(BadRequestError);
    });

    it('should filter and sort nearby profiles within radius limit', async () => {
      // Mock 3 donors (2 close, 1 far away)
      const mockDonors = [
        { id: 'donor-1', latitude: 12.9750, longitude: 77.5980 }, // ~0.5 km
        { id: 'donor-2', latitude: 13.0500, longitude: 77.6200 }, // ~9.1 km
        { id: 'donor-3', latitude: 14.5000, longitude: 78.0000 }, // Far away (>100 km)
      ];
      prisma.donorProfile.findMany.mockResolvedValue(mockDonors);

      // Search within a 10 km radius of Bangalore Center (12.9716, 77.5946)
      const results = await mapsService.radiusSearch(12.9716, 77.5946, 10, 'donors');

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('donor-1');
      expect(results[1].id).toBe('donor-2');
      expect(results[0].distanceKm).toBeLessThan(1.0);
    });
  });

  describe('Nearest entity selector', () => {
    it('should select the single closest entity from radius results', async () => {
      const mockHospitals = [
        { id: 'hosp-1', latitude: 12.9800, longitude: 77.6000 }, // Close
        { id: 'hosp-2', latitude: 12.9750, longitude: 77.5970 }, // Closer
      ];
      prisma.hospitalProfile.findMany.mockResolvedValue(mockHospitals);

      const nearest = await mapsService.findNearest(12.9716, 77.5946, 'hospital');

      expect(nearest).toBeDefined();
      expect(nearest.id).toBe('hosp-2');
    });

    it('should return null if no entity is found within 50km', async () => {
      prisma.bloodBankProfile.findMany.mockResolvedValue([]);
      const nearest = await mapsService.findNearest(12.9716, 77.5946, 'blood_bank');
      expect(nearest).toBeNull();
    });
  });
});
