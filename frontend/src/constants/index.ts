import { Role } from '../types';

export const ACCESS_TOKEN_KEY = 'll_access_token';
export const REFRESH_TOKEN_KEY = 'll_refresh_token';
export const USER_KEY = 'll_user';

let rawBaseUrl = 'http://localhost:5000/api';
try {
  if (typeof (import.meta as any) !== 'undefined' && (import.meta as any).env?.VITE_API_URL) {
    rawBaseUrl = (import.meta as any).env.VITE_API_URL;
  } else {
    const envGetter = new Function('return import.meta.env');
    const env = envGetter();
    if (env && env.VITE_API_URL) {
      rawBaseUrl = env.VITE_API_URL;
    }
  }
} catch {
  if (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) {
    rawBaseUrl = process.env.VITE_API_URL;
  }
}

// Normalize API Base URL (handle missing https:// protocol and /api prefix gracefully)
const normalizeApiUrl = (url: string): string => {
  let trimmed = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  if (!trimmed.endsWith('/api')) {
    trimmed = `${trimmed}/api`;
  }
  return trimmed;
};

export const API_BASE_URL = normalizeApiUrl(rawBaseUrl);

export const ROLE_DASHBOARDS: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  DONOR: '/donor/dashboard',
  PATIENT: '/patient/dashboard',
  HOSPITAL: '/hospital/dashboard',
  BLOOD_BANK: '/blood-bank/dashboard',
};
