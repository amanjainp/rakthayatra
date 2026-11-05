import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthResponse, Role } from '../types';
import { apiClient } from '../services/api';
import { ACCESS_TOKEN_KEY, USER_KEY } from '../constants';

export const DEMO_PROFILES: Record<Role, { user: User; token: string }> = {
  DONOR: {
    user: {
      id: 'demo-donor-user',
      email: 'aman.jain@donor.org',
      fullName: 'Aman Jain P',
      phoneNumber: '+919876543210',
      role: 'DONOR',
      donorProfile: {
        id: 'demo-donor-profile-1',
        userId: 'demo-donor-user',
        bloodGroup: 'O_NEG',
        latitude: 13.0235,
        longitude: 77.5468,
        isAvailable: true,
        lastDonationDate: new Date(Date.now() - 45 * 86400000).toISOString(),
        consentDpdp: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    token: 'demo-token-donor',
  },
  HOSPITAL: {
    user: {
      id: 'demo-hospital-user',
      email: 'apollo@lifelink.org',
      fullName: 'Apollo Hospital Specialities',
      phoneNumber: '+918877665544',
      role: 'HOSPITAL',
      hospitalProfile: {
        id: 'demo-hospital-profile-1',
        userId: 'demo-hospital-user',
        name: 'Apollo Hospital Specialities',
        licenseNumber: 'HOSP-99887-KAR',
        phone: '+918877665544',
        address: 'Bannerghatta Road, Bengaluru',
        city: 'Bengaluru',
        latitude: 12.8962,
        longitude: 77.5991,
        isVerified: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    token: 'demo-token-hospital',
  },
  BLOOD_BANK: {
    user: {
      id: 'demo-bloodbank-user',
      email: 'citybank@lifelink.org',
      fullName: 'City Central Blood Bank',
      phoneNumber: '+919988776655',
      role: 'BLOOD_BANK',
      bloodBankProfile: {
        id: 'demo-bloodbank-profile-1',
        userId: 'demo-bloodbank-user',
        name: 'City Central Blood Bank',
        licenseNumber: 'BB-12345-KAR',
        phone: '+919988776655',
        address: 'Vyalikaval, Bengaluru',
        city: 'Bengaluru',
        latitude: 12.9998,
        longitude: 77.5721,
        isVerified: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    token: 'demo-token-blood_bank',
  },
  ADMIN: {
    user: {
      id: 'demo-admin-user',
      email: 'admin@lifelink.org',
      fullName: 'System Administrator',
      phoneNumber: '+919000000001',
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    token: 'demo-token-admin',
  },
  PATIENT: {
    user: {
      id: 'demo-patient-user',
      email: 'patient@lifelink.org',
      fullName: 'Emergency Patient',
      phoneNumber: '+919000000002',
      role: 'PATIENT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    token: 'demo-token-patient',
  },
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  loginAsDemo: (role: Role) => void;
  register: (data: any) => Promise<any>;
  verifyOtp: (email: string, code: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const formatUserObject = (rawUser: any): User | null => {
  if (!rawUser) return null;
  const user = { ...rawUser };
  if (user.role && typeof user.role === 'object') {
    user.role = user.role.name;
  }
  return user;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setUserAndStore = (u: any) => {
    const formatted = formatUserObject(u);
    setUser(formatted);
    if (formatted) {
      localStorage.setItem(USER_KEY, JSON.stringify(formatted));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  };

  const refreshUser = async () => {
    try {
      const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (storedToken && storedToken.startsWith('demo-token-')) {
        // Do not force logout for demo users while backend is waking up
        return;
      }
      const response = await apiClient.get('/auth/me');
      if (response.data?.success && response.data?.data?.user) {
        const userData = response.data.data.user;
        setUserAndStore(userData);
      }
    } catch (err) {
      const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!storedToken || !storedToken.startsWith('demo-token-')) {
        handleLogoutLocal();
      }
    }
  };

  const handleLogoutLocal = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  // Instant 1-click Demo Login (0 ms latency)
  const loginAsDemo = (role: Role) => {
    const demo = DEMO_PROFILES[role];
    if (!demo) return;

    setUser(demo.user);
    setToken(demo.token);
    localStorage.setItem(ACCESS_TOKEN_KEY, demo.token);
    localStorage.setItem(USER_KEY, JSON.stringify(demo.user));

    // Asynchronously ping backend to warm up free tier instance without blocking user
    const demoPasswords: Record<string, string> = {
      DONOR: 'Donor@1234',
      HOSPITAL: 'Hosp@1234',
      BLOOD_BANK: 'Bank@1234',
      ADMIN: 'Admin@1234',
    };
    const password = demoPasswords[role];
    if (password) {
      apiClient.post('/auth/login', { email: demo.user.email, password })
        .then((res) => {
          if (res.data?.data?.accessToken && res.data?.data?.user) {
            localStorage.setItem(ACCESS_TOKEN_KEY, res.data.data.accessToken);
            setToken(res.data.data.accessToken);
            setUserAndStore(res.data.data.user);
          }
        })
        .catch(() => {
          // If backend is waking up, active demo session continues smoothly
        });
    }
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(formatUserObject(JSON.parse(storedUser)));
        
        // Asynchronously check/update user state in background
        refreshUser().finally(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for axios token refresh failures triggering logout
    const handleLogoutEvent = () => {
      handleLogoutLocal();
    };

    window.addEventListener('auth_logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('auth_logout', handleLogoutEvent);
    };
  }, []);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const authData = response.data.data;
      
      localStorage.setItem(ACCESS_TOKEN_KEY, authData.accessToken);
      setToken(authData.accessToken);
      setUserAndStore(authData.user);
      
      return response.data;
    } catch (err: any) {
      handleLogoutLocal();
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: any): Promise<any> => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/register', data);
      return response.data;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, code: string): Promise<any> => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/verify-otp', { email, code });
      
      if (response.data?.success && response.data?.data) {
        const authData = response.data.data;
        if (authData.accessToken && authData.user) {
          localStorage.setItem(ACCESS_TOKEN_KEY, authData.accessToken);
          setToken(authData.accessToken);
          setUserAndStore(authData.user);
        }
      }
      return response.data;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      // Continue even if network call fails
    } finally {
      handleLogoutLocal();
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginAsDemo,
        register,
        verifyOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
