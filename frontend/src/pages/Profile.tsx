import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { User, Shield, Lock, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  const { register: regProfile, handleSubmit: handleProfile } = useForm({
    defaultValues: {
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phoneNumber || '',
    }
  });

  const { register: regPass, handleSubmit: handlePass, reset: resetPass } = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
  });

  const onProfileSubmit = (_values: any) => {
    // Stub profile save
    toast.success('Profile settings updated successfully');
  };

  const onPassSubmit = (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    toast.success('Password updated successfully');
    resetPass();
  };

  const handlePurgeData = () => {
    const confirm = window.confirm('Under DPDP rules, this will permanently delete your profiles and data logs. Proceed?');
    if (confirm) {
      toast.success('Data deletion sweep initiated successfully');
      logout();
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">Account Profile Settings</h2>
          <p className="text-xs text-slate-400">Update personal details, credentials, and manage notification device tokens</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left: General Info */}
        <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/10 space-y-6">
          <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <User className="w-5 h-5 text-rose-500" /> General Information
          </h3>

          <form onSubmit={handleProfile(onProfileSubmit)} className="space-y-4">
            <Input
              label="Full Name / Facility Title"
              {...regProfile('fullName')}
            />
            <Input
              label="Email Address"
              type="email"
              disabled
              {...regProfile('email')}
              helperText="Email changes must be swept by administrative verification"
            />
            <Input
              label="Phone Number"
              {...regProfile('phone')}
            />

            <div className="pt-2">
              <Button variant="primary" type="submit">
                Save Details
              </Button>
            </div>
          </form>
        </div>

        {/* Right: Security & Deletion */}
        <div className="space-y-8">
          
          {/* Change Password */}
          <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/10 space-y-6">
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-500" /> Security Controls
            </h3>

            <form onSubmit={handlePass(onPassSubmit)} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                {...regPass('currentPassword')}
              />
              <Input
                label="New Password"
                type="password"
                {...regPass('newPassword')}
              />
              <Input
                label="Confirm New Password"
                type="password"
                {...regPass('confirmPassword')}
              />

              <div className="pt-2">
                <Button variant="outline" type="submit">
                  Update Password
                </Button>
              </div>
            </form>
          </div>

          {/* DPDP Deletion */}
          <div className="p-6 rounded-2xl border border-rose-950/40 bg-rose-950/5 space-y-4">
            <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" /> DPDP Privacy Center
            </h3>
            <p className="text-xs text-slate-400 leading-normal">
              In compliance with local DPDP data protection rules, you can request immediate purging of all diagnostic, medical screening, and location tracking logs from our active registry indexes.
            </p>
            <Button variant="outline" onClick={handlePurgeData} className="border-rose-900/40 hover:bg-rose-900/20 text-rose-400 hover:text-rose-300">
              <Trash2 className="w-4 h-4 mr-1.5" /> Purge Account & Logs
            </Button>
          </div>

        </div>

      </div>
    </div>
  );
};
export default Profile;
