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

// Normalize API Base URL (handle missing https:// protocol, internal Render hostnames, and /api prefix gracefully)
const normalizeApiUrl = (url: string): string => {
  let trimmed = url ? url.trim().replace(/\/+$/, '') : '';

  // 1. If running in a browser on Render (*.onrender.com)
  if (typeof window !== 'undefined' && window.location.hostname.includes('.onrender.com')) {
    const stripped = trimmed.replace(/^https?:\/\//i, '');
    if (!stripped.includes('.') || stripped.includes('localhost') || !trimmed) {
      const backendHostname = window.location.hostname.replace('-frontend', '-backend');
      trimmed = `https://${backendHostname}`;
    }
  }

  // 2. If host is an internal service name without dots (e.g. 'rakthayatra-backend') and not localhost
  const strippedHost = trimmed.replace(/^https?:\/\//i, '');
  if (!strippedHost.includes('.') && !strippedHost.includes('localhost') && strippedHost.length > 0) {
    trimmed = `https://${strippedHost}.onrender.com`;
  }

  // 3. Ensure protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  // 4. Ensure /api suffix
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
