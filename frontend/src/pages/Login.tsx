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

type LoginFormInputs = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setIsSubmitting(true);
    try {
      const response = await login(data.email, data.password);
      toast.success('Successfully logged in!');
      
      const role = response.data.user.role;
      navigate(ROLE_DASHBOARDS[role] || '/', { replace: true });
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Login failed. Invalid email or password.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="Please sign in to access your dashboard">
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
          className="w-full h-11 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-rose-600/20 flex items-center justify-center disabled:opacity-50"
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
