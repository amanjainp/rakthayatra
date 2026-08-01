import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { forgotPasswordSchema } from '../utils/validation';
import { authService } from '../services/authService';
import { z } from 'zod';
import AuthLayout from '../layouts/AuthLayout';
import { Loader } from '../components/Loader';

type ForgotFormInputs = z.infer<typeof forgotPasswordSchema>;

export const ForgotPassword: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormInputs>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotFormInputs) => {
    setIsSubmitting(true);
    try {
      await authService.forgotPassword(data.email);
      toast.success('Reset email dispatched successfully!');
      setIsEmailSent(true);
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Failed to dispatch reset email. Please try again.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEmailSent) {
    return (
      <AuthLayout title="Check Your Email" subtitle="We have sent password recovery instructions">
        <div className="space-y-6 text-center">
          <div className="mx-auto w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center text-2xl font-bold">
            ✓
          </div>
          <p className="text-sm text-slate-400">
            A secure password reset link has been dispatched to your email address. Please review your spam filters if the message does not appear within 5 minutes.
          </p>
          <Link
            to="/login"
            className="block w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 rounded-xl text-sm font-semibold transition-all duration-200"
          >
            Back to Sign In
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Recover Password" subtitle="Enter your email to request recovery details">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        
        {/* Email */}
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

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-rose-600/20 flex items-center justify-center disabled:opacity-50"
        >
          {isSubmitting ? <Loader size="sm" color="text-white" /> : 'Send Reset Link'}
        </button>

        {/* Back Link */}
        <div className="text-center pt-2">
          <Link to="/login" className="text-xs text-rose-500 hover:text-rose-400 font-semibold">
            Back to Sign In
          </Link>
        </div>

      </form>
    </AuthLayout>
  );
};
export default ForgotPassword;
