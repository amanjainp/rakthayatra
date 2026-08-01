import React from 'react';
import { Activity } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Premium glowing red blur accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-rose-600/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Branding header */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-xl shadow-rose-500/20 animate-pulse">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <div className="text-center space-y-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight font-display bg-gradient-to-b from-white to-rose-200 bg-clip-text text-transparent">
              LifeLink
            </h1>
            <p className="text-xs text-rose-500 font-bold tracking-widest uppercase">
              Rakthayatra Platform
            </p>
          </div>
        </div>

        {/* Form Container Glassmorphic Card */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-[2rem] p-8 shadow-2xl space-y-6">
          <div className="space-y-1.5 text-center">
            <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};
export default AuthLayout;
