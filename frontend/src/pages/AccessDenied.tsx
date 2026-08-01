import React from 'react';
import { useNavigate } from 'react-router-dom';

export const AccessDenied: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6 py-12">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800/80 rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-rose-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-rose-600/10 rounded-full blur-3xl"></div>

        <div className="mx-auto w-24 h-24 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-3xl flex items-center justify-center text-4xl font-extrabold select-none">
          403
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">
            Access Denied
          </h2>
          <p className="text-sm text-slate-400">
            You do not have the required role permissions to view this dashboard page.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-rose-600/25"
          >
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
};
export default AccessDenied;
