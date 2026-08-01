import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { otpSchema } from '../utils/validation';
import { authService } from '../services/authService';
import { z } from 'zod';
import AuthLayout from '../layouts/AuthLayout';
import { Loader } from '../components/Loader';
import { ROLE_DASHBOARDS } from '../constants';

type OtpFormInputs = z.infer<typeof otpSchema>;

export const VerifyOtp: React.FC = () => {
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpFormInputs>({
    resolver: zodResolver(otpSchema),
  });

  const onSubmit = async (data: OtpFormInputs) => {
    if (!email) {
      toast.error('Invalid request context. Email is missing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await verifyOtp(email, data.otp);
      toast.success('Account verified successfully!');
      
      const role = response.data?.user?.role || 'DONOR';
      navigate(ROLE_DASHBOARDS[role] || '/', { replace: true });
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'OTP verification failed. Please try again.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('Email is missing.');
      return;
    }

    setIsResending(true);
    try {
      await authService.resendOtp(email);
      toast.success('A new 6-digit OTP code has been sent to your email.');
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Failed to resend OTP. Please try again later.';
      toast.error(errMsg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout title="Verify OTP" subtitle={`A 6-digit code has been sent to ${email}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        
        {/* OTP Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            One-Time Passcode
          </label>
          <input
            type="text"
            maxLength={6}
            placeholder="123456"
            {...register('otp')}
            className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] font-mono text-white placeholder-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all duration-200
              ${errors.otp ? 'border-rose-500/50' : 'border-slate-800 focus:border-slate-700'}
            `}
          />
          {errors.otp && (
            <p className="text-xs font-semibold text-rose-500 text-center">{errors.otp.message}</p>
          )}
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-rose-600/20 flex items-center justify-center disabled:opacity-50"
        >
          {isSubmitting ? <Loader size="sm" color="text-white" /> : 'Verify Code'}
        </button>

        {/* Resend Action */}
        <div className="text-center pt-2">
          <button
            type="button"
            disabled={isResending}
            onClick={handleResend}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 font-semibold underline"
          >
            {isResending ? 'Resending Code...' : 'Resend OTP Code'}
          </button>
        </div>

      </form>
    </AuthLayout>
  );
};
export default VerifyOtp;
