export type Role = 'ADMIN' | 'DONOR' | 'PATIENT' | 'HOSPITAL' | 'BLOOD_BANK';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface DonorProfile {
  id: string;
  userId: string;
  bloodGroup: string;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
  lastDonationDate?: string;
  consentDpdp: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: ApiError;
}
