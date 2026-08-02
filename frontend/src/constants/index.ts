import { Role } from '../types';

export const ACCESS_TOKEN_KEY = 'll_access_token';
export const REFRESH_TOKEN_KEY = 'll_refresh_token';
export const USER_KEY = 'll_user';

let resolvedBaseUrl = 'http://localhost:5000/api';
try {
  const envGetter = new Function('return import.meta.env');
  const env = envGetter();
  if (env && env.VITE_API_URL) {
    resolvedBaseUrl = env.VITE_API_URL;
  }
} catch {
  if (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) {
    resolvedBaseUrl = process.env.VITE_API_URL;
  }
}

export const API_BASE_URL = resolvedBaseUrl;

export const ROLE_DASHBOARDS: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  DONOR: '/donor/dashboard',
  PATIENT: '/patient/dashboard',
  HOSPITAL: '/hospital/dashboard',
  BLOOD_BANK: '/blood-bank/dashboard',
};
