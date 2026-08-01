import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { registerSchema } from '../utils/validation';
import { z } from 'zod';
import AuthLayout from '../layouts/AuthLayout';
import { Loader } from '../components/Loader';
import { Role } from '../types';

type RegisterFormInputs = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const { register: signup } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<Role>('DONOR');

  const {
    register: formRegister,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormInputs>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'DONOR',
      gender: 'Not Specified',
      consentGiven: false,
    },
  });

  const onSubmit = async (data: RegisterFormInputs) => {
    setIsSubmitting(true);
    try {
      const { email, password, role, fullName, phone, ...rest } = data;
      
      // Structure details payload matching backend requirements
      const details: Record<string, any> = { fullName, phone };
      if (role === 'DONOR') {
        details.dob = rest.dob;
        details.gender = rest.gender;
        details.bloodGroup = rest.bloodGroup;
        details.address = rest.address || 'Unknown';
        details.latitude = parseFloat(rest.latitude as string) || 0.0;
        details.longitude = parseFloat(rest.longitude as string) || 0.0;
        details.consentGiven = rest.consentGiven;
      } else if (role === 'HOSPITAL' || role === 'BLOOD_BANK') {
        details.name = rest.name;
        details.licenseNumber = rest.licenseNumber;
        details.address = rest.address || 'Unknown';
        details.city = rest.city || 'Unknown';
        details.latitude = parseFloat(rest.latitude as string) || 0.0;
        details.longitude = parseFloat(rest.longitude as string) || 0.0;
      }

      await signup({
        email,
        password,
        role,
        details,
      });

      toast.success('Registration successful! OTP sent to your email.');
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Registration failed. Please try again.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setValue('role', role);
    setStep(2);
  };

  return (
    <AuthLayout title="Create Account" subtitle="Register to join the LifeLink logistics network">
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
            Select Your Role
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'DONOR', label: 'Blood Donor', desc: 'Donate blood to save lives' },
              { id: 'PATIENT', label: 'Recipient/Patient', desc: 'Request blood batches' },
              { id: 'HOSPITAL', label: 'Hospital Facility', desc: 'Coordinate clinical supply' },
              { id: 'BLOOD_BANK', label: 'Blood Bank', desc: 'Manage stock inventories' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRoleSelect(r.id as Role)}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/30 p-4 rounded-2xl text-left transition-all duration-200 group"
              >
                <span className="block text-sm font-bold text-white group-hover:text-rose-500 transition-colors">
                  {r.label}
                </span>
                <span className="block text-[10px] text-slate-500 leading-tight mt-1">
                  {r.desc}
                </span>
              </button>
            ))}
          </div>
          <div className="text-center pt-2">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="text-rose-500 hover:text-rose-400 font-semibold">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Header to change role */}
          <div className="flex justify-between items-center bg-slate-950 border border-slate-800/80 px-4 py-2.5 rounded-xl">
            <span className="text-xs text-slate-400 font-semibold">
              Role: <span className="text-rose-500 font-bold">{selectedRole}</span>
            </span>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-slate-500 hover:text-slate-400 underline font-semibold"
            >
              Change Role
            </button>
          </div>

          {/* Standard Fields */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Full Name
            </label>
            <input
              type="text"
              placeholder="Aman Jain"
              {...formRegister('fullName')}
              className={`w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all`}
            />
            {errors.fullName && (
              <p className="text-[10px] font-semibold text-rose-500">{errors.fullName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Email
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                {...formRegister('email')}
                className={`w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all`}
              />
              {errors.email && (
                <p className="text-[10px] font-semibold text-rose-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Phone
              </label>
              <input
                type="text"
                placeholder="9876543210"
                {...formRegister('phone')}
                className={`w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all`}
              />
              {errors.phone && (
                <p className="text-[10px] font-semibold text-rose-500">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...formRegister('password')}
              className={`w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all`}
            />
            {errors.password && (
              <p className="text-[10px] font-semibold text-rose-500">{errors.password.message}</p>
            )}
          </div>

          {/* Donor Dynamic Fields */}
          {selectedRole === 'DONOR' && (
            <div className="space-y-3 pt-2 border-t border-slate-800/40">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Blood Group
                  </label>
                  <select
                    {...formRegister('bloodGroup')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  >
                    <option value="">Select</option>
                    {['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG'].map(g => (
                      <option key={g} value={g}>{g.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    {...formRegister('dob')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder="Sector 62, Noida"
                    {...formRegister('address')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Gender
                  </label>
                  <select
                    {...formRegister('gender')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  >
                    <option value="Not Specified">Select</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Latitude
                  </label>
                  <input
                    type="text"
                    placeholder="28.6139"
                    {...formRegister('latitude')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Longitude
                  </label>
                  <input
                    type="text"
                    placeholder="77.2090"
                    {...formRegister('longitude')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* DPDP Consent */}
              <div className="flex items-start space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="consentGiven"
                  {...formRegister('consentGiven')}
                  className="w-4.5 h-4.5 accent-rose-600 rounded bg-slate-950 border-slate-800 border focus:ring-0 focus:ring-offset-0 cursor-pointer mt-0.5"
                />
                <label htmlFor="consentGiven" className="text-[10px] text-slate-400 leading-normal select-none cursor-pointer">
                  I consent to having my blood group, latitude/longitude, and profile registered for emergency matching checks under DPDP rules.
                </label>
              </div>
              {errors.consentGiven && (
                <p className="text-[10px] font-semibold text-rose-500">{errors.consentGiven.message}</p>
              )}
            </div>
          )}

          {/* Hospital / Blood Bank Dynamic Fields */}
          {(selectedRole === 'HOSPITAL' || selectedRole === 'BLOOD_BANK') && (
            <div className="space-y-3 pt-2 border-t border-slate-800/40">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Facility Name
                  </label>
                  <input
                    type="text"
                    placeholder="City General Hospital"
                    {...formRegister('name')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    License Number
                  </label>
                  <input
                    type="text"
                    placeholder="REG-987654-IN"
                    {...formRegister('licenseNumber')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder="Hospital Road, Phase 2"
                    {...formRegister('address')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="Noida"
                    {...formRegister('city')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Latitude
                  </label>
                  <input
                    type="text"
                    placeholder="28.6139"
                    {...formRegister('latitude')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Longitude
                  </label>
                  <input
                    type="text"
                    placeholder="77.2090"
                    {...formRegister('longitude')}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all"
                  />
                </div>
              </div>
              {errors.licenseNumber && (
                <p className="text-[10px] font-semibold text-rose-500">{errors.licenseNumber.message}</p>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-rose-600/20 flex items-center justify-center disabled:opacity-50"
          >
            {isSubmitting ? <Loader size="sm" color="text-white" /> : 'Register Account'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
};
export default Register;
