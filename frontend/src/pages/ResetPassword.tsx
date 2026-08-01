import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { resetPasswordSchema } from '../utils/validation';
import { authService } from '../services/authService';
import { z } from 'zod';
import AuthLayout from '../layouts/AuthLayout';
import { Loader } from '../components/Loader';

type ResetFormInputs = z.infer<typeof resetPasswordSchema>;

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormInputs>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetFormInputs) => {
    if (!token) {
      toast.error('Invalid or missing password reset token.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, data.password);
      toast.success('Password updated successfully! Please sign in.');
      navigate('/login', { replace: true });
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Failed to reset password. Token may be expired.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Reset Password" subtitle="Choose a strong, compliant new password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        
        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            New Password
          </label>
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

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Confirm Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            {...register('confirmPassword')}
            className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all duration-200
              ${errors.confirmPassword ? 'border-rose-500/50' : 'border-slate-800 focus:border-slate-700'}
            `}
          />
          {errors.confirmPassword && (
            <p className="text-xs font-semibold text-rose-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-rose-600/20 flex items-center justify-center disabled:opacity-50"
        >
          {isSubmitting ? <Loader size="sm" color="text-white" /> : 'Update Password'}
        </button>

      </form>
    </AuthLayout>
  );
};
export default ResetPassword;
