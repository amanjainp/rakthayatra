import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

const JWT_SECRET = env.JWT_SECRET;

export interface TokenPayload {
  userId: string;
  role: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateOTP(): string {
  // Generate a secure 6-digit numeric OTP
  return Math.floor(100000 + crypto.randomInt(900000)).toString();
}
