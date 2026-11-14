import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { loginSchema } from '../utils/validation';
import { z } from 'zod';
import AuthLayout from '../layouts/AuthLayout';
import { Loader } from '../components/Loader';
import { ROLE_DASHBOARDS } from '../constants';
import {
  Heart,
  Building2,
  Database,
  ShieldAlert,
  Zap,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Role } from '../types';

type LoginFormInputs = z.infer<typeof loginSchema>;

interface QuickTryRole {
  role: Role;
  name: string;
  badge: string;
  description: string;
  accountName: string;
  email: string;
  password: string;
  dashboard: string;
  accent: {
    bg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    iconBg: string;
    iconColor: string;
  };
  icon: React.ReactNode;
}

const QUICK_TRY_ROLES: QuickTryRole[] = [
  {
    role: 'DONOR',
    name: 'Voluntary Donor',
    badge: 'Donor',
    description: 'Book donation appointments, monitor health eligibility & accept live emergency SOS alerts.',
    accountName: 'Aman Jain P (O-NEG)',
    email: 'aman.jain@donor.org',
    password: 'Donor@1234',
    dashboard: '/donor/dashboard',
    accent: {
      bg: 'hover:bg-emerald-950/20',
      border: 'hover:border-emerald-500/50',
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
      badgeText: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
    icon: <Heart className="w-4 h-4 text-emerald-400" />,
  },
  {
    role: 'HOSPITAL',
    name: 'Hospital Trauma Unit',
    badge: 'Hospital',
    description: 'Broadcast 100km radius emergency SOS alerts, locate active donors & raise blood requisitions.',
    accountName: 'Apollo Hospital Specialities',
    email: 'apollo@lifelink.org',
    password: 'Hosp@1234',
    dashboard: '/hospital/dashboard',
    accent: {
      bg: 'hover:bg-sky-950/20',
      border: 'hover:border-sky-500/50',
      badgeBg: 'bg-sky-500/10 border-sky-500/30',
      badgeText: 'text-sky-400',
      iconBg: 'bg-sky-500/10 border-sky-500/20',
      iconColor: 'text-sky-400',
    },
    icon: <Building2 className="w-4 h-4 text-sky-400" />,
  },
  {
    role: 'BLOOD_BANK',
    name: 'Licensed Blood Bank',
    badge: 'Blood Bank',
    description: 'Manage unit stock inventory, fulfill hospital orders & organize blood donation drives.',
    accountName: 'City Central Blood Bank',
    email: 'citybank@lifelink.org',
    password: 'Bank@1234',
    dashboard: '/blood-bank/dashboard',
    accent: {
      bg: 'hover:bg-rose-950/20',
      border: 'hover:border-rose-500/50',
      badgeBg: 'bg-rose-500/10 border-rose-500/30',
      badgeText: 'text-rose-400',
      iconBg: 'bg-rose-500/10 border-rose-500/20',
      iconColor: 'text-rose-400',
    },
    icon: <Database className="w-4 h-4 text-rose-400" />,
  },
  {
    role: 'ADMIN',
    name: 'System Administrator',
    badge: 'Admin',
    description: 'Audit platform-wide activity logs, verify hospitals & blood banks, and control user access.',
    accountName: 'LifeLink Administrator',
    email: 'admin@lifelink.org',
    password: 'Admin@1234',
    dashboard: '/admin/dashboard',
    accent: {
      bg: 'hover:bg-purple-950/20',
      border: 'hover:border-purple-500/50',
      badgeBg: 'bg-purple-500/10 border-purple-500/30',
      badgeText: 'text-purple-400',
      iconBg: 'bg-purple-500/10 border-purple-500/20',
      iconColor: 'text-purple-400',
    },
    icon: <ShieldAlert className="w-4 h-4 text-purple-400" />,
  },
];

export const Login: React.FC = () => {
  const { login, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setIsSubmitting(true);
    try {
      const response = await login(data.email, data.password);
      toast.success('Successfully logged in!');
      
      const role = response?.data?.user?.role || (response as any)?.user?.role;
      const targetRoute = (role && ROLE_DASHBOARDS[role as Role]) || '/';
      navigate(targetRoute, { replace: true });
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        (err.code === 'ECONNABORTED' || err.message?.includes('timeout')
          ? 'Login request timed out. Please retry.'
          : err.message === 'Network Error'
          ? 'Unable to reach API server. Please check connection or verify backend is online.'
          : err.message) ||
        'Login failed. Invalid email or password.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Instant single-click direct dashboard access
  const handleQuickLogin = (roleConfig: QuickTryRole) => {
    // 1. Visually populate credentials
    setValue('email', roleConfig.email, { shouldValidate: true });
    setValue('password', roleConfig.password, { shouldValidate: true });

    // 2. Instantly activate authenticated demo session (0 ms latency)
    loginAsDemo(roleConfig.role);

    // 3. User feedback
    toast.success(`⚡ Entering ${roleConfig.name} Dashboard!`, {
      icon: '🩸',
      duration: 3000,
    });

    // 4. Directly open the demo dashboard in single click!
    navigate(roleConfig.dashboard, { replace: true });
  };

  const quickTrySection = (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-[2rem] p-6 shadow-2xl space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 font-display">
              Quick Try
              <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Instant Single-Click Access
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Click any role below to directly open its demo dashboard
            </p>
          </div>
        </div>
        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
          4 Core Roles Available
        </span>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {QUICK_TRY_ROLES.map((r) => (
          <button
            key={r.role}
            type="button"
            onClick={() => handleQuickLogin(r)}
            className={`p-4 rounded-2xl border border-slate-800/80 bg-slate-950/40 text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer ${r.accent.border} ${r.accent.bg}`}
          >
            <div className="space-y-2 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center border ${r.accent.iconBg}`}>
                    {r.icon}
                  </div>
                  <span className="text-xs font-bold text-white group-hover:text-rose-400 transition-colors">
                    {r.name}
                  </span>
                </div>
                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${r.accent.badgeBg} ${r.accent.badgeText}`}>
                  {r.badge}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                {r.description}
              </p>

              <div className="text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-800/50 flex items-center justify-between">
                <span className="truncate max-w-[150px] text-slate-300 font-medium">{r.accountName}</span>
                <span className="text-slate-500 text-[9px] bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800/50">{r.password}</span>
              </div>
            </div>

            <div className="mt-3.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold">
              <span className="text-[11px] text-slate-300 group-hover:text-white transition-colors flex items-center gap-1.5 font-medium">
                <span className="text-rose-400 group-hover:text-rose-300 font-bold">Open Dashboard</span>
              </span>
              <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-rose-600 group-hover:text-white transition-all transform group-hover:translate-x-1 shadow-sm">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* CDSCO / Patient Care Regulatory Note */}
      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 flex items-start gap-2.5 text-[11px] text-slate-400 leading-relaxed">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-200">Looking for Patient access?</strong> Under CDSCO & NBTC guidelines, patients do not self-allocate blood units. Urgent patient blood requirements are initiated via <strong className="text-sky-300">Hospital Trauma Units</strong> or tracked publicly on the{' '}
          <Link to="/emergency-map" className="text-rose-400 hover:text-rose-300 font-bold underline underline-offset-2">
            Live Emergency Radar Map
          </Link>.
        </p>
      </div>
    </div>
  );

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Please sign in to access your dashboard"
      maxWidth="max-w-xl"
      belowCard={quickTrySection}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        
        {/* Email Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Email Address
          </label>
          <input
            type="email"
            placeholder="name@example.com"
            {...register('email')}
            className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all duration-200
              ${errors.email ? 'border-rose-500/50' : 'border-slate-800 focus:border-slate-700'}
            `}
          />
          {errors.email && (
            <p className="text-xs font-semibold text-rose-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password Input */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-rose-500 hover:text-rose-400 font-semibold"
            >
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            placeholder="••••••••"
            {...register('password')}
            className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all duration-200
              ${errors.password ? 'border-rose-500/50' : 'border-slate-800 focus:border-slate-700'}
            `}
          />
          {errors.password && (
            <p className="text-xs font-semibold text-rose-500">{errors.password.message}</p>
          )}
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-rose-600/20 flex items-center justify-center disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? <Loader size="sm" color="text-white" /> : 'Sign In'}
        </button>

        {/* Registration Link */}
        <div className="text-center pt-2">
          <p className="text-xs text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-rose-500 hover:text-rose-400 font-semibold">
              Create an account
            </Link>
          </p>
        </div>

      </form>
    </AuthLayout>
  );
};
export default Login;
