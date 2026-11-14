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
import { Navigation, CheckCircle2, MapPin } from 'lucide-react';

type RegisterFormInputs = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const { register: signup } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<RegisterFormInputs['role']>('DONOR');

  // GPS Geolocation state
  const [isLocating, setIsLocating] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isGpsAcquired, setIsGpsAcquired] = useState(false);

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

  const handleDetectGpsLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast.error('Geolocation is not supported by your current browser.');
      return;
    }

    if (isLocating) return;
    setIsLocating(true);
    toast.loading('Requesting GPS location permission...', { id: 'gps-detect' });

    const onPositionSuccess = (pos: GeolocationPosition) => {
      setIsLocating(false);
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      const accuracy = Math.round(pos.coords.accuracy);

      setValue('latitude', lat.toString(), { shouldValidate: true });
      setValue('longitude', lng.toString(), { shouldValidate: true });
      setGpsAccuracy(accuracy);
      setIsGpsAcquired(true);

      toast.success(
        `📍 GPS coordinates acquired: ${lat}, ${lng} (±${accuracy}m accuracy)`,
        { id: 'gps-detect', duration: 4000 }
      );
    };

    const onPositionError = (err: GeolocationPositionError) => {
      setIsLocating(false);
      let msg = 'Unable to acquire GPS coordinates.';
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Location permission denied. Please allow location access in your browser settings to auto-fill GPS coordinates.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = 'Device location is currently unavailable. Please verify GPS is enabled or enter coordinates manually.';
      } else if (err.code === err.TIMEOUT) {
        msg = 'GPS request timed out. Please click "Use My Current Location" again or enter manually.';
      }
      toast.error(msg, { id: 'gps-detect', duration: 5000 });
    };

    navigator.geolocation.getCurrentPosition(
      onPositionSuccess,
      (err) => {
        // Fallback to standard accuracy if high-accuracy satellite lock times out
        if (err.code === err.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            onPositionSuccess,
            onPositionError,
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
          );
        } else {
          onPositionError(err);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const onSubmit = async (data: RegisterFormInputs) => {
    setIsSubmitting(true);
    try {
      const { email, password, role, fullName, phone, ...rest } = data;
      
      if ((role as string) === 'PATIENT') {
        toast.error('Recipient/Patient registration has been removed.');
        return;
      }

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

      toast.success('Registration successful! Please log in.');
      navigate('/login');
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error?.message ||
        (err.response?.data?.error?.details && Array.isArray(err.response.data.error.details)
          ? err.response.data.error.details.map((d: any) => d.message).join(', ')
          : null) ||
        (err.message === 'Network Error'
          ? 'Unable to reach API server. Please check connection or verify backend is online.'
          : err.message) ||
        'Registration failed. Please try again.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleSelect = (role: RegisterFormInputs['role']) => {
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
          <div className="grid grid-cols-1 gap-3">
            {[
              { id: 'DONOR' as const, label: 'Blood Donor', desc: 'Donate blood to save lives' },
              { id: 'HOSPITAL' as const, label: 'Hospital Facility', desc: 'Coordinate clinical supply' },
              { id: 'BLOOD_BANK' as const, label: 'Blood Bank', desc: 'Manage stock inventories' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRoleSelect(r.id)}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/30 p-4 rounded-2xl text-left transition-all duration-200 group cursor-pointer"
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
              className="text-xs text-slate-500 hover:text-slate-400 underline font-semibold cursor-pointer"
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
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all cursor-pointer"
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
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all cursor-pointer"
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
                    className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="Not Specified">Select</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              {/* Geolocation Section */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-500" />
                    Geographic Coordinates (GPS)
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectGpsLocation}
                    disabled={isLocating}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50 group shadow-sm"
                    title="Request GPS permission and auto-detect latitude & longitude"
                  >
                    {isLocating ? (
                      <>
                        <Loader size="sm" color="text-rose-400" />
                        <span className="animate-pulse">Detecting GPS...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3 h-3 text-rose-500 group-hover:rotate-45 transition-transform" />
                        <span>Use My Current Location</span>
                      </>
                    )}
                  </button>
                </div>

                {isGpsAcquired && (
                  <div className="flex items-center justify-between text-[10px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-3 py-1 rounded-lg">
                    <span className="flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Live GPS fix acquired {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">Auto-Filled</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Latitude
                    </label>
                    <input
                      type="text"
                      placeholder="28.6139"
                      {...formRegister('latitude')}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all font-mono"
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
                      className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Used strictly for calculating distance to emergency blood SOS requests within your radius under DPDP rules.
                </p>
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

              {/* Geolocation Section */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-rose-500" />
                    Facility Coordinates (GPS)
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectGpsLocation}
                    disabled={isLocating}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50 group shadow-sm"
                    title="Request GPS permission and auto-detect facility location"
                  >
                    {isLocating ? (
                      <>
                        <Loader size="sm" color="text-rose-400" />
                        <span className="animate-pulse">Detecting GPS...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3 h-3 text-rose-500 group-hover:rotate-45 transition-transform" />
                        <span>Use My Current Location</span>
                      </>
                    )}
                  </button>
                </div>

                {isGpsAcquired && (
                  <div className="flex items-center justify-between text-[10px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-3 py-1 rounded-lg">
                    <span className="flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Live GPS fix acquired {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">Auto-Filled</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Latitude
                    </label>
                    <input
                      type="text"
                      placeholder="28.6139"
                      {...formRegister('latitude')}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all font-mono"
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
                      className="w-full bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-all font-mono"
                    />
                  </div>
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
            className="w-full h-11 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-bold transition-all duration-200 shadow-lg shadow-rose-600/20 flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? <Loader size="sm" color="text-white" /> : 'Register Account'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
};
export default Register;
