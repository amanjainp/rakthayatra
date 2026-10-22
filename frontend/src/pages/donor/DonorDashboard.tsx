import React, { useState } from 'react';
import { useDonorDashboardData } from '../../hooks/useDashboardData';
import {
  Heart,
  Plus,
  Search,
  Award,
  ClipboardCheck,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ThumbsUp,
  XCircle,
  Sliders,
  Globe,
  Clock,
  MapPin,
  Building,
  Phone,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';
import {
  useMyAppointments,
  useBookAppointment,
  useUpdateAppointmentStatus,
  useDonorEmergencyAlerts,
  useRespondEmergencyAlert,
  useRegisteredFacilities,
} from '../../hooks/useRealtimeLogistics';

export const DonorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'kn'>('en');

  // Donor settings & preferences
  const [availability, setAvailability] = useState<'AVAILABLE' | 'TEMPORARY_PAUSE' | 'INACTIVE'>('AVAILABLE');
  const [searchRadius, setSearchRadius] = useState<number>(25);

  // Appointment booking form state
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [timeSlot, setTimeSlot] = useState<string>('09:00 AM - 11:00 AM');
  const [appointmentNotes, setAppointmentNotes] = useState<string>('');

  // Real-time hooks
  const { data: myAppointments = [], isLoading: isLoadingAppointments } = useMyAppointments();
  const bookAppointmentMutation = useBookAppointment();
  const updateAppointmentMutation = useUpdateAppointmentStatus();
  const { data: emergencyAlerts = [], isLoading: isLoadingAlerts } = useDonorEmergencyAlerts();
  const respondEmergencyMutation = useRespondEmergencyAlert();
  const { data: facilities = [], isLoading: isLoadingFacilities } = useRegisteredFacilities();

  const { data, isLoading } = useDonorDashboardData(user?.id);

  const quickActions = [
    {
      label: 'Book Appointment',
      action: () => setIsBookModalOpen(true),
      desc: 'Schedule your next blood donation appointment with a verified facility.',
      icon: <Plus className="w-5 h-5" />,
    },
    {
      label: 'Medical Eligibility',
      action: () => navigate('/eligibility'),
      desc: 'Fill out the screening check to verify donor eligibility.',
      icon: <ClipboardCheck className="w-5 h-5" />,
    },
    {
      label: 'Find Donation Camps',
      action: () => navigate('/camps'),
      desc: 'Browse scheduled blood drives and community donation camps.',
      icon: <Search className="w-5 h-5" />,
    },
    {
      label: 'My Achievements',
      action: () => setIsAchievementsOpen(true),
      desc: 'Inspect official recognition certificates and donation milestones.',
      icon: <Award className="w-5 h-5" />,
    },
  ];

  const totalDonations = typeof data?.metrics[0]?.value === 'number' ? data.metrics[0].value : 0;

  const milestones = [
    { name: 'First Drop (Bronze)', req: 1, desc: 'Complete 1 blood donation to start your journey.', achieved: totalDonations >= 1 },
    { name: 'Life Saver (Silver)', req: 3, desc: 'Complete 3 blood donations to unlock community appreciation.', achieved: totalDonations >= 3 },
    { name: 'Blood Champion (Gold)', req: 5, desc: 'Complete 5 blood donations and receive the ultimate recognition.', achieved: totalDonations >= 5 },
    { name: 'Platinum Life Guardian', req: 10, desc: 'Hero of the community with 10+ completed voluntary donations.', achieved: totalDonations >= 10 },
  ];

  const handleAvailabilityChange = (status: 'AVAILABLE' | 'TEMPORARY_PAUSE' | 'INACTIVE') => {
    setAvailability(status);
    if (status === 'AVAILABLE') {
      toast.success('Your status is now ACTIVE. You are visible for emergency alerts in your radius.');
    } else if (status === 'TEMPORARY_PAUSE') {
      toast('Invitations paused temporarily.', { icon: '⏸️' });
    } else {
      toast('Your availability is set to Inactive.', { icon: '📴' });
    }
  };

  const handleRespondAlert = async (requestId: string, action: 'ACCEPT' | 'DECLINE') => {
    try {
      await respondEmergencyMutation.mutateAsync({
        requestId,
        action,
      });
      if (action === 'ACCEPT') {
        toast.success('🚨 Response sent to hospital! Coordinator has received your details.');
      } else {
        toast('Alert declined.', { icon: 'ℹ️' });
      }
    } catch {
      // Error handled in hook toast
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      await updateAppointmentMutation.mutateAsync({
        appointmentId,
        status: 'CANCELLED',
      });
      toast.success('Donation appointment cancelled.');
    } catch {
      // Error handled in hook toast
    }
  };

  const handleBookAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacilityId) {
      toast.error('Please select a hospital or blood bank from the list.');
      return;
    }

    const facility = facilities.find((f) => f.id === selectedFacilityId);
    if (!facility) {
      toast.error('Selected facility could not be found.');
      return;
    }

    try {
      await bookAppointmentMutation.mutateAsync({
        facilityType: facility.facilityType,
        facilityId: facility.id,
        appointmentDate,
        timeSlot,
        notes: appointmentNotes.trim() || undefined,
      });
      setIsBookModalOpen(false);
      setAppointmentNotes('');
    } catch {
      // Error handled in hook toast
    }
  };

  const downloadCertificate = () => {
    const text = `
=========================================
      CERTIFICATE OF APPRECIATION
=========================================

This certificate is proudly presented to:

            ${user?.fullName || 'Valued Donor'}

For their noble and generous contributions to
the Rakthayatra LifeLink Platform.

Donation Milestones Achieved:
${milestones.map((m) => `- ${m.name}: ${m.achieved ? 'UNLOCKED' : 'LOCKED'}`).join('\n')}

Total Completed Donations: ${totalDonations} Bag(s)

Thank you for donating blood and saving lives!
=========================================
Verification Ref: LL-CERT-${Math.floor(100000 + Math.random() * 900000)}
Generated on: ${new Date().toLocaleDateString()}
    `;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Donation_Certificate_${user?.fullName || 'Donor'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Certificate downloaded successfully!');
  };

  return (
    <div className="space-y-8 text-slate-100">
      {/* 1. Header with Language & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Heart className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white font-display">
                {lang === 'kn' ? 'ರಕ್ತದಾನಿ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' : 'Donor Portal'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Verified Voluntary Donor
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {lang === 'kn'
                ? `ಸ್ವಾಗತ, ${user?.fullName || 'ದಾನಿ'}! ನಿಮ್ಮ ಲಭ್ಯತೆ, ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಮತ್ತು ತುರ್ತು ಆಹ್ವಾನಗಳನ್ನು ನಿರ್ವಹಿಸಿ.`
                : `Welcome back, ${user?.fullName || 'Donor'}! Schedule donations, manage appointments, and respond to emergency blood alerts`}
            </p>
          </div>
        </div>

        {/* Language switch & Book Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang((prev) => (prev === 'en' ? 'kn' : 'en'))}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-rose-500" />
            {lang === 'en' ? 'ಕನ್ನಡ' : 'English'}
          </button>
          <Button
            variant="primary"
            onClick={() => setIsBookModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4" /> Book Donation Slot
          </Button>
        </div>
      </div>

      {/* 2. Availability Switch & Search Radius Preferences Banner */}
      <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="space-y-1.5 w-full md:w-auto">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            {lang === 'kn' ? 'ತುರ್ತು ಲಭ್ಯತೆ ಸ್ಥಿತಿ' : 'Live Donation Availability'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAvailabilityChange('AVAILABLE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                availability === 'AVAILABLE'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {lang === 'kn' ? 'ಲಭ್ಯವಿದ್ದೇನೆ (Active)' : 'Available to Donate'}
            </button>
            <button
              onClick={() => handleAvailabilityChange('TEMPORARY_PAUSE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                availability === 'TEMPORARY_PAUSE'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {lang === 'kn' ? 'ತಾತ್ಕಾಲಿಕ ವಿರಾಮ' : 'Temporary Pause'}
            </button>
            <button
              onClick={() => handleAvailabilityChange('INACTIVE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                availability === 'INACTIVE'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              {lang === 'kn' ? 'ನಿಷ್ಕ್ರಿಯ' : 'Inactive'}
            </button>
          </div>
        </div>

        {/* Notification Search Radius Slider */}
        <div className="space-y-1.5 w-full md:w-72">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-rose-500" />
              {lang === 'kn' ? 'ಶೋಧನಾ ವ್ಯಾಪ್ತಿ' : 'Emergency Radius'}:
            </span>
            <span className="font-bold text-rose-400 font-mono">{searchRadius} km</span>
          </div>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={searchRadius}
            onChange={(e) => setSearchRadius(Number(e.target.value))}
            className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 block text-right">Receives alerts within this geographic radius</span>
        </div>
      </div>

      {/* 3. Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {data?.metrics.map((m, idx) => (
          <div
            key={idx}
            className="p-6 bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl space-y-2 hover:border-slate-800 transition-all group"
          >
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{m.label}</span>
            <span
              className={`block text-3xl font-extrabold font-display tracking-tight group-hover:text-rose-500 transition-colors ${
                m.value === 'Eligible'
                  ? 'text-emerald-400'
                  : m.value === 'Deferred'
                  ? 'text-amber-500'
                  : 'text-white'
              }`}
            >
              {isLoading ? '...' : m.value}
            </span>
            {m.change && (
              <span
                className={`block text-xs font-semibold ${
                  m.changeType === 'success'
                    ? 'text-emerald-500'
                    : m.changeType === 'warning'
                    ? 'text-amber-500'
                    : 'text-slate-400'
                }`}
              >
                {m.change}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 4. Real Database Live Emergency Blood Alerts Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 animate-pulse" />
              {lang === 'kn' ? 'ತುರ್ತು ಹೊಂದಾಣಿಕೆಯ ಎಚ್ಚರಿಕೆಗಳು' : 'Live Emergency Blood SOS Alerts'}
            </h3>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          </div>
          <span className="text-xs text-slate-400">
            {emergencyAlerts.length} matching requests in your area
          </span>
        </div>

        {isLoadingAlerts ? (
          <div className="p-8 text-center text-xs text-slate-500">Checking for live emergency alerts...</div>
        ) : emergencyAlerts.length === 0 ? (
          <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/30 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No Immediate Emergency Alerts</p>
            <p className="text-xs text-slate-500">
              When a nearby hospital triggers a 100km SOS for your blood group, it will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {emergencyAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  alert.hasAccepted
                    ? 'border-emerald-500/30 bg-emerald-950/20'
                    : 'border-rose-500/40 bg-rose-950/20 shadow-lg shadow-rose-950/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500 text-white animate-pulse">
                        EMERGENCY SOS
                      </span>
                      <span className="text-xs font-bold text-white">
                        {alert.requester?.hospitalProfile?.name || 'Hospital Trauma Unit'}
                      </span>
                    </div>
                    {alert.requester?.hospitalProfile?.city && (
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {alert.requester.hospitalProfile.city} • {alert.requester.hospitalProfile.address}
                      </p>
                    )}
                    {alert.requester?.hospitalProfile?.phone && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {alert.requester.hospitalProfile.phone}
                      </p>
                    )}
                    <p className="text-xs text-slate-200 mt-2">
                      Urgently Requires:{' '}
                      <strong className="text-rose-400 font-bold">{alert.unitsRequired} Units</strong> of{' '}
                      <strong className="text-white font-bold">{alert.bloodGroup.replace('_', '+')}</strong>
                    </p>
                    {alert.message && (
                      <p className="text-[11px] text-rose-200 italic mt-1 bg-rose-950/40 p-2 rounded-lg border border-rose-500/20">
                        "{alert.message}"
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20 whitespace-nowrap">
                    {alert.distanceKm} km away
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-amber-400 font-medium">Critical Requirement</span>

                  {alert.hasAccepted ? (
                    <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> You Accepted • Hospital Notified
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespondAlert(alert.id, 'DECLINE')}
                        disabled={respondEmergencyMutation.isPending}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleRespondAlert(alert.id, 'ACCEPT')}
                        disabled={respondEmergencyMutation.isPending}
                        className="px-3.5 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1 shadow-md shadow-rose-600/30 cursor-pointer"
                      >
                        <ThumbsUp className="w-3 h-3" /> Accept & Willing to Donate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. My Scheduled Appointments Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
              <Calendar className="w-5 h-5 text-rose-500" />
              {lang === 'kn' ? 'ನನ್ನ ಬುಕ್ ಆದ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು' : 'My Scheduled Donation Appointments'}
            </h3>
            <p className="text-xs text-slate-400">
              Your booked slots at licensed blood banks and participating hospitals
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsBookModalOpen(true)}
            className="text-xs flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Book New Slot
          </Button>
        </div>

        {isLoadingAppointments ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading your appointments...</div>
        ) : myAppointments.length === 0 ? (
          <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/30 text-center space-y-2">
            <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No Scheduled Appointments</p>
            <p className="text-xs text-slate-500">You haven't scheduled any upcoming donation slot yet.</p>
            <button
              onClick={() => setIsBookModalOpen(true)}
              className="mt-2 px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/30 cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Book Your Slot Now
            </button>
          </div>
        ) : (
          <div className="border border-slate-800/80 rounded-2xl bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Facility Name & Type</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {myAppointments.map((apt) => {
                    const facilityName =
                      apt.facilityType === 'HOSPITAL'
                        ? apt.hospital?.name || 'Hospital'
                        : apt.bloodBank?.name || 'Blood Bank';
                    const facilityAddress =
                      apt.facilityType === 'HOSPITAL'
                        ? `${apt.hospital?.city || ''} • ${apt.hospital?.address || ''}`
                        : `${apt.bloodBank?.city || ''} • ${apt.bloodBank?.address || ''}`;
                    const facilityPhone =
                      apt.facilityType === 'HOSPITAL' ? apt.hospital?.phone : apt.bloodBank?.phone;

                    return (
                      <tr key={apt.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{facilityName}</div>
                          <span className="text-[10px] font-semibold text-rose-400">
                            {apt.facilityType === 'HOSPITAL' ? 'Hospital' : 'Blood Bank'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          <div>{facilityAddress}</div>
                          {facilityPhone && (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {facilityPhone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200">{apt.appointmentDate}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {apt.timeSlot}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              apt.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : apt.status === 'CANCELLED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {apt.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {apt.status === 'SCHEDULED' && (
                            <button
                              onClick={() => handleCancelAppointment(apt.id)}
                              disabled={updateAppointmentMutation.isPending}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6. Role-Specific Real-Time Map for Donor: Registered Hospitals & Blood Banks for Donation */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
              <Building className="w-5 h-5 text-rose-500" />
              Registered Hospitals & Blood Banks for Voluntary Donation
            </h3>
            <p className="text-xs text-slate-400">
              Verified facilities where you can walk in or schedule blood donation appointments
            </p>
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            {facilities.length} Verified Facilities Active
          </span>
        </div>

        {isLoadingFacilities ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading registered facilities directory...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {facilities.map((fac) => (
              <div
                key={fac.id}
                className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        fac.facilityType === 'BLOOD_BANK'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {fac.facilityType === 'BLOOD_BANK' ? 'Blood Bank' : 'Hospital'}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Licensed
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-sm group-hover:text-rose-400 transition-colors">
                      {fac.name}
                    </h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {fac.city} • {fac.address}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      {fac.phone}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {fac.licenseNumber || 'VERIFIED'}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedFacilityId(fac.id);
                      setIsBookModalOpen(true);
                    }}
                    className="px-3 py-1 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1 shadow-md shadow-rose-600/20 cursor-pointer"
                  >
                    <Calendar className="w-3 h-3" /> Book Slot Here
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. Main Layout Split (Actions & Recent History) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-white font-display">
            {lang === 'kn' ? 'ಕಾರ್ಯಾಚರಣೆಗಳು' : 'Quick Actions'}
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {quickActions.map((action, idx) => (
              <div
                key={idx}
                onClick={action.action}
                className="p-5 rounded-2xl border border-slate-800/60 bg-slate-900/10 hover:bg-slate-900/30 hover:border-rose-500/20 transition-all flex gap-4 group cursor-pointer"
              >
                <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-800 border border-slate-700/80 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {action.icon}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                    {action.label}
                  </h4>
                  <p className="text-xs text-slate-500 leading-normal">{action.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white font-display">
            {lang === 'kn' ? 'ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ' : 'My History'}
          </h3>
          <div className="border border-slate-800/60 bg-slate-900/10 rounded-2xl p-6 space-y-5">
            {data?.activities.map((a) => (
              <div key={a.id} className="flex gap-3 relative pb-2 group">
                <div className="w-2 h-2 shrink-0 rounded-full bg-rose-500 mt-1.5 animate-pulse" />
                <div className="space-y-0.5">
                  <h5 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                    {a.title}
                  </h5>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{a.subtitle}</p>
                  <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider">
                    {a.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 8. Achievements Modal */}
      <Modal
        isOpen={isAchievementsOpen}
        onClose={() => setIsAchievementsOpen(false)}
        title="My Achievements & Milestones"
      >
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-rose-950/30 bg-rose-950/5 text-center space-y-3">
            <Award className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
            <h4 className="text-base font-bold text-white font-display">Donor Recognition Certificate</h4>
            <p className="text-xs text-slate-400 leading-normal">
              Generate and download your official appreciation certificate outlining your lifetime blood donation history.
            </p>
            <Button
              variant="primary"
              onClick={downloadCertificate}
              disabled={totalDonations === 0}
              className="w-full"
            >
              Download Certificate
            </Button>
            {totalDonations === 0 && (
              <p className="text-[10px] text-amber-500 font-semibold">
                Complete at least 1 blood donation to unlock your certificate.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Milestones Ledger</h5>
            <div className="space-y-3">
              {milestones.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border flex justify-between items-center ${
                    m.achieved
                      ? 'border-emerald-950/30 bg-emerald-950/5'
                      : 'border-slate-800 bg-slate-900/10 opacity-70'
                  }`}
                >
                  <div className="space-y-1">
                    <span
                      className={`text-sm font-bold block ${
                        m.achieved ? 'text-emerald-400' : 'text-slate-300'
                      }`}
                    >
                      {m.name}
                    </span>
                    <span className="text-xs text-slate-500 block leading-normal">{m.desc}</span>
                  </div>
                  <Badge variant={m.achieved ? 'success' : 'neutral'}>
                    {m.achieved ? 'Unlocked' : 'Locked'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setIsAchievementsOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* 9. Real Appointment Booking Modal with Integrated Facility Directory & Dropdown */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Schedule Blood Donation Slot (Dropdown & Map Directory)"
      >
        <form onSubmit={handleBookAppointmentSubmit} className="space-y-4 text-xs text-slate-200">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Select Participating Facility (Dropdown) *
            </label>
            <select
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100 outline-none font-semibold focus:border-rose-500/40"
              required
            >
              <option value="">-- Choose a Hospital or Blood Bank --</option>
              {facilities.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name} ({fac.facilityType === 'BLOOD_BANK' ? 'Blood Bank' : 'Hospital'}) - {fac.city}
                </option>
              ))}
            </select>
          </div>

          {/* Integrated Facility View below Dropdown */}
          <div className="space-y-2">
            <span className="block text-slate-400 font-semibold">Or Click from Facility Directory Below:</span>
            <div className="max-h-44 overflow-y-auto space-y-2 border border-slate-800/80 rounded-xl p-2 bg-slate-950/60">
              {facilities.map((fac) => (
                <div
                  key={fac.id}
                  onClick={() => setSelectedFacilityId(fac.id)}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                    selectedFacilityId === fac.id
                      ? 'border-rose-500 bg-rose-950/30'
                      : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-white text-xs">{fac.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {fac.city} • {fac.address}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      fac.facilityType === 'BLOOD_BANK'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {fac.facilityType === 'BLOOD_BANK' ? 'Bank' : 'Hosp'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Appointment Date *</label>
              <input
                type="date"
                value={appointmentDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Preferred Time Slot *</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              >
                <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM (Morning)</option>
                <option value="11:00 AM - 01:00 PM">11:00 AM - 01:00 PM (Mid-Day)</option>
                <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM (Afternoon)</option>
                <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM (Evening)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Optional Notes / Requests</label>
            <input
              type="text"
              value={appointmentNotes}
              onChange={(e) => setAppointmentNotes(e.target.value)}
              placeholder="e.g. First time donor, requesting preliminary hemoglobin test..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
            Please hydrate well with water and ensure a light meal 2 hours prior to your scheduled appointment.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsBookModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={bookAppointmentMutation.isPending || !selectedFacilityId}
              className="flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" /> Confirm Appointment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DonorDashboard;
