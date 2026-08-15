import React, { useState } from 'react';
import { useCamps } from '../hooks/useCamps';
import { useAuth } from '../hooks/useAuth';
import { Calendar, Plus, MapPin, Megaphone, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useForm } from 'react-hook-form';

export const DonationCamps: React.FC = () => {
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [volunteerTargetId, setVolunteerTargetId] = useState<string | null>(null);

  const { data: camps = [], createCamp, registerVolunteer, associateHospital, isCreatingCamp } = useCamps();

  const { register: regCamp, handleSubmit: handleCamp, reset: resetCamp } = useForm({
    defaultValues: {
      name: 'Sector 62 Mega Drive',
      location: 'Expo Centre Noida',
      startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      bloodBankId: 'bb-1',
      latitude: 28.625,
      longitude: 77.37,
    }
  });

  const { register: regVol, handleSubmit: handleVol, reset: resetVol } = useForm({
    defaultValues: {
      name: user?.fullName || '',
      email: user?.email || '',
      phone: '',
    }
  });

  const onCampSubmit = async (values: any) => {
    try {
      await createCamp({
        name: values.name,
        location: values.location,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
        bloodBankId: values.bloodBankId,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
      });
      setIsAddOpen(false);
      resetCamp();
    } catch {
      // handled
    }
  };

  const onVolSubmit = async (values: any) => {
    try {
      if (!volunteerTargetId) return;
      await registerVolunteer({
        campId: volunteerTargetId,
        name: values.name,
        email: values.email,
        phone: values.phone,
      });
      setVolunteerTargetId(null);
      resetVol();
    } catch {
      // handled
    }
  };

  const handleHospitalAssociate = async (campId: string) => {
    if (!user) return;
    await associateHospital({ campId, hospitalId: user.id });
  };

  const isDonor = user?.role === 'DONOR';
  const isHospital = user?.role === 'HOSPITAL';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'BLOOD_BANK';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-display">Blood Donation Camps</h2>
            <p className="text-xs text-slate-400">Browse nearby campaigns, register to donate, or sign up as a volunteer helper</p>
          </div>
        </div>

        {isAdmin && (
          <Button variant="primary" onClick={() => setIsAddOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Camp
          </Button>
        )}
      </div>

      {/* Grid Cards list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {camps.map((camp) => (
          <div key={camp.id} className="p-6 bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl flex flex-col justify-between hover:border-slate-800 transition-all space-y-5">
            <div className="space-y-3">
              <div className="flex justify-between items-start gap-4">
                <h3 className="text-lg font-bold text-white font-display leading-tight">{camp.name}</h3>
                <Badge variant="info">Upcoming</Badge>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> {camp.location}
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {new Date(camp.startDate).toLocaleDateString()} - {new Date(camp.endDate).toLocaleDateString()}
              </p>
              <span className="block text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                Organized by: {camp.bloodBankName || 'Noida Blood Trust'}
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
              <div className="flex flex-wrap gap-2">
                {isDonor && camp.externalRegistrationUrl && (
                  <a
                    href={camp.externalRegistrationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-xl text-xs font-semibold h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all gap-1.5"
                  >
                    Register on Official Website
                  </a>
                )}
                {isHospital && (
                  <Button variant="outline" size="sm" onClick={() => handleHospitalAssociate(camp.id)} className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Associate Facility
                  </Button>
                )}
                {!user && (
                  <p className="text-xs text-slate-500 italic">Sign in to interact with camps</p>
                )}
              </div>
              {camp.externalRegistrationUrl && (
                <p className="text-[10px] text-slate-500 italic mt-1 leading-normal">
                  * Note: Registration will be completed on the official external website of {camp.bloodBankName || 'the organizer'}, not through Rakthayatra/LifeLink.
                </p>
              )}
            </div>
          </div>
        ))}
        {camps.length === 0 && (
          <div className="md:col-span-2 text-center py-16 text-slate-500 border border-slate-800 border-dashed rounded-3xl">
            No active donation camps scheduled. Awaiting organizers sweep.
          </div>
        )}
      </div>

      {/* Create Camp Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Create Donation Camp">
        <form onSubmit={handleCamp(onCampSubmit)} className="space-y-5">
          <Input
            label="Camp Campaign Name"
            {...regCamp('name', { required: 'Name is required' })}
          />

          <Input
            label="Location Address"
            {...regCamp('location', { required: 'Address is required' })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              {...regCamp('startDate', { required: 'Start date is required' })}
            />
            <Input
              label="End Date"
              type="date"
              {...regCamp('endDate', { required: 'End date is required' })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude"
              type="number"
              step="any"
              {...regCamp('latitude', { required: 'Latitude coordinate is required' })}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              {...regCamp('longitude', { required: 'Longitude coordinate is required' })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isCreatingCamp}>Register Camp</Button>
          </div>
        </form>
      </Modal>

      {/* Volunteer Registration Modal */}
      <Modal isOpen={volunteerTargetId !== null} onClose={() => setVolunteerTargetId(null)} title="Sign Up as Camp Volunteer">
        <form onSubmit={handleVol(onVolSubmit)} className="space-y-5">
          <Input
            label="Full Name"
            {...regVol('name', { required: 'Full name is required' })}
          />

          <Input
            label="Email Address"
            type="email"
            {...regVol('email', { required: 'Email is required' })}
          />

          <Input
            label="Phone Number"
            type="tel"
            {...regVol('phone', { required: 'Phone number is mandatory' })}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setVolunteerTargetId(null)}>Cancel</Button>
            <Button variant="primary" type="submit">Verify & Register</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default DonationCamps;
