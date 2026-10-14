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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export const DonorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'kn'>('en');

  // Donor settings & preferences
  const [availability, setAvailability] = useState<'AVAILABLE' | 'TEMPORARY_PAUSE' | 'INACTIVE'>('AVAILABLE');
  const [searchRadius, setSearchRadius] = useState<number>(25);

  // Sample Matching Emergency Invitations
  const [invitations, setInvitations] = useState([
    {
      id: 'inv-1',
      hospitalName: 'Bowring & Lady Curzon Hospital',
      bloodGroup: 'O+',
      component: 'PRBC (Packed Cells)',
      unitsRequired: 2,
      urgency: 'EMERGENCY',
      distance: '3.4 km away',
      deadline: 'Required within 4 hours',
      status: 'PENDING',
    },
    {
      id: 'inv-2',
      hospitalName: 'Victoria Regional Trauma Centre',
      bloodGroup: 'O+',
      component: 'Whole Blood',
      unitsRequired: 1,
      urgency: 'NORMAL',
      distance: '6.1 km away',
      deadline: 'Required tomorrow morning',
      status: 'PENDING',
    },
  ]);

  const { data, isLoading } = useDonorDashboardData(user?.id);

  const quickActions = [
    { label: 'Book Appointment', action: () => setIsBookModalOpen(true), desc: 'Schedule your next blood donation appointment.', icon: <Plus className="w-5 h-5" /> },
    { label: 'Medical Eligibility', action: () => navigate('/eligibility'), desc: 'Fill out the screening check to verify donor eligibility.', icon: <ClipboardCheck className="w-5 h-5" /> },
    { label: 'Find Donation Camps', action: () => navigate('/camps'), desc: 'Browse scheduled blood drives and donation camps.', icon: <Search className="w-5 h-5" /> },
    { label: 'My Achievements', action: () => setIsAchievementsOpen(true), desc: 'Inspect certificates and donation milestones.', icon: <Award className="w-5 h-5" /> },
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
      toast.success('Your status is now ACTIVE. You will receive emergency alerts.');
    } else if (status === 'TEMPORARY_PAUSE') {
      toast('Invitations paused temporarily.', { icon: '⏸️' });
    } else {
      toast('Your availability is set to Inactive.', { icon: '📴' });
    }
  };

  const handleRespondInvitation = (id: string, response: 'ACCEPT' | 'DECLINE') => {
    setInvitations((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, status: response === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED' } : inv))
    );
    if (response === 'ACCEPT') {
      toast.success('Invitation accepted! Facility coordinators notified.');
    } else {
      toast('Invitation declined.', { icon: 'ℹ️' });
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
${milestones.map(m => `- ${m.name}: ${m.achieved ? 'UNLOCKED' : 'LOCKED'}`).join('\n')}

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
                <ShieldCheck className="w-3 h-3" /> Verified Donor
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {lang === 'kn'
                ? `ಸ್ವಾಗತ, ${user?.fullName || 'ದಾನಿ'}! ನಿಮ್ಮ ಲಭ್ಯತೆ ಮತ್ತು ಹೊಂದಾಣಿಕೆ ವಿನಂತಿಗಳನ್ನು ಇಲ್ಲಿ ನಿರ್ವಹಿಸಿ.`
                : `Welcome back, ${user?.fullName || 'Donor'}! Schedule donations and track compatibility requests`}
            </p>
          </div>
        </div>

        {/* Language switch */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang((prev) => (prev === 'en' ? 'kn' : 'en'))}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-rose-500" />
            {lang === 'en' ? 'ಕನ್ನಡ' : 'English'}
          </button>
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
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
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
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
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
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
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
            max="50"
            step="5"
            value={searchRadius}
            onChange={(e) => setSearchRadius(Number(e.target.value))}
            className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 block text-right">Only receives requests within this radius</span>
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

      {/* 4. Live Emergency Blood Matching Invitations Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500 animate-pulse" />
            {lang === 'kn' ? 'ಹೊಂದಾಣಿಕೆಯಾಗುವ ತುರ್ತು ಆಹ್ವಾನಗಳು' : 'Matching Blood Requests & Invitations'}
          </h3>
          <span className="text-xs text-slate-400">
            {invitations.filter((i) => i.status === 'PENDING').length} active pending
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className={`p-5 rounded-2xl border transition-all space-y-3 ${
                inv.status === 'ACCEPTED'
                  ? 'border-emerald-500/30 bg-emerald-950/10'
                  : inv.status === 'DECLINED'
                  ? 'border-slate-800 bg-slate-950/40 opacity-60'
                  : 'border-rose-500/30 bg-rose-950/10 shadow-lg shadow-rose-950/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        inv.urgency === 'EMERGENCY'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {inv.urgency}
                    </span>
                    <span className="text-xs font-bold text-white">{inv.hospitalName}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Requires <strong className="text-rose-400 font-bold">{inv.unitsRequired} Units</strong> of{' '}
                    <strong className="text-white">{inv.bloodGroup}</strong> ({inv.component})
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">{inv.distance}</span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-amber-400 font-medium">{inv.deadline}</span>

                {inv.status === 'PENDING' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespondInvitation(inv.id, 'DECLINE')}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleRespondInvitation(inv.id, 'ACCEPT')}
                      className="px-3.5 py-1 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1 shadow-md shadow-rose-600/30"
                    >
                      <ThumbsUp className="w-3 h-3" /> Accept & Donate
                    </button>
                  </div>
                ) : (
                  <span
                    className={`font-bold text-xs ${
                      inv.status === 'ACCEPTED' ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    Status: {inv.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Main Layout Split (Actions & Recent History) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
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

        {/* Recent Activity */}
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
                  <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Achievements Modal */}
      <Modal isOpen={isAchievementsOpen} onClose={() => setIsAchievementsOpen(false)} title="My Achievements & Milestones">
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
                    m.achieved ? 'border-emerald-950/30 bg-emerald-950/5' : 'border-slate-800 bg-slate-900/10 opacity-70'
                  }`}
                >
                  <div className="space-y-1">
                    <span className={`text-sm font-bold block ${m.achieved ? 'text-emerald-400' : 'text-slate-300'}`}>
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

      {/* 7. Appointment Booking Modal */}
      <Modal isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} title="Schedule Blood Donation Slot">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsBookModalOpen(false);
            toast.success('Donation appointment booked successfully!');
            navigate('/donations');
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Select Participating Facility</label>
            <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
              <option value="bb-1">Red Cross Central Blood Centre (Race Course Rd)</option>
              <option value="bb-2">Victoria Hospital Regional Blood Bank (Fort Rd)</option>
              <option value="bb-3">St. John’s Medical College Blood Bank (Koramangala)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Appointment Date</label>
              <input
                type="date"
                defaultValue={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Preferred Time Slot</label>
              <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
                <option>09:00 AM - 11:00 AM</option>
                <option>11:00 AM - 01:00 PM</option>
                <option>02:00 PM - 04:00 PM</option>
                <option>04:00 PM - 06:00 PM</option>
              </select>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
            Please hydrate well with water and avoid greasy foods 2 hours prior to your scheduled appointment.
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsBookModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Confirm Appointment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default DonorDashboard;
