import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthResponse } from '../types';
import { apiClient } from '../services/api';
import { ACCESS_TOKEN_KEY, USER_KEY } from '../constants';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (data: any) => Promise<any>;
  verifyOtp: (email: string, code: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const response = await apiClient.get('/auth/me');
      if (response.data?.success && response.data?.data?.user) {
        const userData = response.data.data.user;
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      }
    } catch (err) {
      // If user retrieval fails, clear invalid tokens
      handleLogoutLocal();
    }
  };

  const handleLogoutLocal = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
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
      
      // Save tokens
      localStorage.setItem(ACCESS_TOKEN_KEY, authData.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(authData.user));
      
      setToken(authData.accessToken);
      setUser(authData.user);
      
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
        // Save tokens if registration/login OTP verification returned user details
        if (authData.accessToken && authData.user) {
          localStorage.setItem(ACCESS_TOKEN_KEY, authData.accessToken);
          localStorage.setItem(USER_KEY, JSON.stringify(authData.user));
          setToken(authData.accessToken);
          setUser(authData.user);
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
      // Logout in backend (revokes token)
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
