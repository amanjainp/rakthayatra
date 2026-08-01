import React from 'react';
import { Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../contexts/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const RootLayout: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Outlet />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#0f172a', // slate-900
                color: '#f8fafc', // slate-50
                border: '1px solid #1e293b', // slate-800
                borderRadius: '1rem',
                fontSize: '0.875rem',
                padding: '0.75rem 1rem',
              },
              success: {
                iconTheme: {
                  primary: '#10b981', // emerald-500
                  secondary: '#0f172a',
                },
              },
              error: {
                iconTheme: {
                  primary: '#f43f5e', // rose-500
                  secondary: '#0f172a',
                },
              },
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};
export default RootLayout;
