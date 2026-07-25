import request from 'supertest';
import app from '../src/app';
import { cacheService } from '../src/services/cache.service';
import { generateAccessToken } from '../src/utils/crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client inside Jest hoist scope
jest.mock('@prisma/client', () => {
  const localMockPrisma: any = {
    role: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    donorProfile: {
      create: jest.fn(),
    },
    medicalEligibility: {
      create: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };
  localMockPrisma.$transaction = jest.fn((callback: (tx: any) => any) => callback(localMockPrisma));

  return {
    PrismaClient: jest.fn().mockImplementation(() => localMockPrisma),
    UserStatus: {
      PENDING_VERIFICATION: 'PENDING_VERIFICATION',
      ACTIVE: 'ACTIVE',
      SUSPENDED: 'SUSPENDED',
    },
    BloodGroup: {
      O_NEG: 'O_NEG',
    },
  };
});

const prisma = new PrismaClient() as any;

describe('Authentication Module API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (tx: any) => any) => callback(prisma));
  });

  describe('POST /api/auth/register', () => {
    it('should fail registration with invalid input schema', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: '123',
          role: 'DONOR',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully register a donor with valid profile details', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'DONOR' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'aman.jain@donor.org',
        status: 'ACTIVE',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'aman.jain@donor.org',
          password: 'Password@1234',
          role: 'DONOR',
          details: {
            fullName: 'Aman Jain P',
            gender: 'Male',
            dob: '2005-06-15',
            phone: '+919876543210',
            bloodGroup: 'O_NEG',
            address: 'Yeshwanthpur, Bengaluru',
            latitude: 13.0235,
            longitude: 77.5468,
            consentGiven: true,
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('user-1');
      expect(response.body.data.otp).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password@1234', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'aman.jain@donor.org',
        passwordHash: hashedPassword,
        status: 'ACTIVE',
        role: { name: 'DONOR' },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'aman.jain@donor.org',
          password: 'Password@1234',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined(); // HTTPOnly Cookie set
    });

    it('should reject login for invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@donor.org',
          password: 'WrongPassword@1',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('should successfully verify a valid OTP', async () => {
      const email = 'aman.jain@donor.org';
      const otp = '123456';
      
      await cacheService.set(`otp:${email}`, otp, 300);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email,
        status: 'PENDING_VERIFICATION',
      });

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({ email, otp });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('OTP verified');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject requests without a valid Bearer token', async () => {
      const response = await request(app).get('/api/auth/me');
      expect(response.status).toBe(401);
    });

    it('should resolve session profile for requests with a valid token', async () => {
      const token = generateAccessToken({ userId: 'user-1', role: 'DONOR' });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.userId).toBe('user-1');
    });
  });
});
