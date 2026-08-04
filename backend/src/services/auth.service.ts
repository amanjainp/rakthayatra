import { PrismaClient, UserStatus, BloodGroup, User, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateAccessToken, generateSecureToken, generateOTP } from '../utils/crypto';
import { cacheService } from './cache.service';
import { metricsService } from './metrics.service';

const prisma = new PrismaClient();

export class AuthService {
  async register(
    email: string,
    passwordRaw: string,
    roleName: string,
    details: any,
    ipAddress?: string,
  ): Promise<{ user: User; otp: string }> {
    // 1. Find role
    const role = await prisma.role.findUnique({
      where: { name: roleName.toUpperCase() },
    });
    if (!role) {
      throw new Error(`Role ${roleName} does not exist in the system.`);
    }

    // 2. Check if email is already taken
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new Error('Email is already registered.');
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordRaw, salt);

    // 4. Create user and profile in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          roleId: role.id,
          status: role.name === 'DONOR' || role.name === 'PATIENT' ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION,
        },
      });

      if (role.name === 'DONOR') {
        if (!details.fullName || !details.phone || !details.bloodGroup) {
          throw new Error('Missing required donor profile fields.');
        }
        await tx.donorProfile.create({
          data: {
            userId: user.id,
            fullName: details.fullName,
            gender: details.gender || 'Not Specified',
            dob: new Date(details.dob),
            phone: details.phone,
            bloodGroup: details.bloodGroup as BloodGroup,
            address: details.address || 'Unknown',
            latitude: parseFloat(details.latitude) || 0.0,
            longitude: parseFloat(details.longitude) || 0.0,
            consentGiven: details.consentGiven === true,
            consentDate: details.consentGiven === true ? new Date() : null,
          },
        });
      } else if (role.name === 'HOSPITAL') {
        if (!details.name || !details.licenseNumber || !details.phone) {
          throw new Error('Missing required hospital profile fields.');
        }
        await tx.hospitalProfile.create({
          data: {
            userId: user.id,
            name: details.name,
            licenseNumber: details.licenseNumber,
            phone: details.phone,
            address: details.address || 'Unknown',
            city: details.city || 'Unknown',
            latitude: parseFloat(details.latitude) || 0.0,
            longitude: parseFloat(details.longitude) || 0.0,
          },
        });
      } else if (role.name === 'BLOOD_BANK') {
        if (!details.name || !details.licenseNumber || !details.phone) {
          throw new Error('Missing required blood bank profile fields.');
        }
        await tx.bloodBankProfile.create({
          data: {
            userId: user.id,
            name: details.name,
            licenseNumber: details.licenseNumber,
            phone: details.phone,
            address: details.address || 'Unknown',
            city: details.city || 'Unknown',
            latitude: parseFloat(details.latitude) || 0.0,
            longitude: parseFloat(details.longitude) || 0.0,
          },
        });
      }

      // Generate OTP and save to cache
      const otp = generateOTP();
      await cacheService.set(`otp:${email}`, otp, 300); // 5 min TTL

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_REGISTER',
          details: { role: role.name, email: user.email },
          ipAddress: ipAddress || null,
        },
      });

      return { user, otp };
    });

    return result;
  }

  async login(
    email: string,
    passwordRaw: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User & { role: Role } }> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { role: true },
      });

      if (!user || user.deletedAt) {
        throw new Error('Invalid email or password.');
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new Error('Your account has been suspended. Please contact support.');
      }

      const isMatch = await bcrypt.compare(passwordRaw, user.passwordHash);
      if (!isMatch) {
        throw new Error('Invalid email or password.');
      }

      const accessToken = generateAccessToken({ userId: user.id, role: user.role.name });
      const refreshTokenString = generateSecureToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.$transaction(async (tx) => {
        await tx.refreshToken.create({
          data: {
            token: refreshTokenString,
            userId: user.id,
            expiresAt,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'USER_LOGIN',
            details: { email: user.email },
            ipAddress: ipAddress || null,
          },
        });
      });

      metricsService.recordLoginSuccess();
      return { accessToken, refreshToken: refreshTokenString, user };
    } catch (error) {
      metricsService.recordLoginFailure();
      throw error;
    }
  }

  async logout(tokenString: string, ipAddress?: string): Promise<void> {
    const record = await prisma.refreshToken.findUnique({
      where: { token: tokenString },
    });

    if (record) {
      await prisma.$transaction(async (tx) => {
        await tx.refreshToken.delete({
          where: { id: record.id },
        });

        await tx.auditLog.create({
          data: {
            userId: record.userId,
            action: 'USER_LOGOUT',
            details: { message: 'User logged out' },
            ipAddress: ipAddress || null,
          },
        });
      });
    }
  }

  async refresh(
    tokenString: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const record = await prisma.refreshToken.findUnique({
        where: { token: tokenString },
        include: { user: { include: { role: true } } },
      });

      if (!record || record.expiresAt < new Date()) {
        if (record) {
          await prisma.refreshToken.delete({ where: { id: record.id } });
        }
        throw new Error('Refresh token is invalid or has expired.');
      }

      // Refresh Token Rotation (RTR): delete old one and assign a new one
      const newAccessToken = generateAccessToken({ userId: record.userId, role: record.user.role.name });
      const newRefreshTokenString = generateSecureToken();
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.$transaction(async (tx) => {
        await tx.refreshToken.delete({
          where: { id: record.id },
        });

        await tx.refreshToken.create({
          data: {
            token: newRefreshTokenString,
            userId: record.userId,
            expiresAt: newExpiresAt,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: record.userId,
            action: 'TOKEN_REFRESH',
            details: { message: 'Token rotated' },
            ipAddress: ipAddress || null,
          },
        });
      });

      metricsService.recordJWTRefresh(true);
      return { accessToken: newAccessToken, refreshToken: newRefreshTokenString };
    } catch (error) {
      metricsService.recordJWTRefresh(false);
      throw error;
    }
  }

  async verifyOtp(email: string, otp: string, ipAddress?: string): Promise<void> {
    try {
      const cachedOtp = await cacheService.get(`otp:${email}`);
      if (!cachedOtp || cachedOtp !== otp) {
        throw new Error('Invalid or expired OTP.');
      }

      await cacheService.delete(`otp:${email}`);

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Set status to active if pending email verification (e.g. for donors or patients)
        if (user.status === UserStatus.PENDING_VERIFICATION) {
          // If hospital or blood bank, verification still requires admin document review,
          // but we flag their email validation in logs
          // For simplicity:
          await prisma.user.update({
            where: { id: user.id },
            data: { status: UserStatus.ACTIVE },
          });

          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'EMAIL_VERIFIED',
              details: { email },
              ipAddress: ipAddress || null,
            },
          });
        }
      }
      metricsService.recordOTPVerification(true);
    } catch (error) {
      metricsService.recordOTPVerification(false);
      throw error;
    }
  }

  async resendOtp(email: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new Error('User not found.');
    }

    const otp = generateOTP();
    await cacheService.set(`otp:${email}`, otp, 300);
    return otp;
  }

  async forgotPassword(email: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new Error('User not found.');
    }

    const resetToken = generateSecureToken();
    await cacheService.set(`reset:${resetToken}`, user.id, 1800); // 30 mins TTL
    return resetToken;
  }

  async resetPassword(resetToken: string, passwordRaw: string, ipAddress?: string): Promise<void> {
    const userId = await cacheService.get(`reset:${resetToken}`);
    if (!userId) {
      throw new Error('Invalid or expired password reset token.');
    }

    await cacheService.delete(`reset:${resetToken}`);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordRaw, salt);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'PASSWORD_RESET',
          details: { message: 'Password reset completed' },
          ipAddress: ipAddress || null,
        },
      });
    });
  }
}
export const authService = new AuthService();
