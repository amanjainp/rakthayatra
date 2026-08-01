import { Role } from '../types';

export const ACCESS_TOKEN_KEY = 'll_access_token';
export const REFRESH_TOKEN_KEY = 'll_refresh_token';
export const USER_KEY = 'll_user';

export const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL as string) || 'http://localhost:5000/api';

export const ROLE_DASHBOARDS: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  DONOR: '/donor/dashboard',
  PATIENT: '/patient/dashboard',
  HOSPITAL: '/hospital/dashboard',
  BLOOD_BANK: '/blood-bank/dashboard',
};
