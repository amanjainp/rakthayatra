import React, { useState } from 'react';
import { useDonorDashboardData } from '../../hooks/useDashboardData';
import { Heart, Plus, Search, Award, ClipboardCheck } from 'lucide-react';
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
  const { data, isLoading } = useDonorDashboardData(user?.id);

  const quickActions = [
    { label: 'Book Appointment', href: '/donations', desc: 'Schedule your next blood donation appointment.', icon: <Plus className="w-5 h-5" /> },
    { label: 'Medical Eligibility', href: '/eligibility', desc: 'Fill out the screening check to verify donor eligibility.', icon: <ClipboardCheck className="w-5 h-5" /> },
    { label: 'Find Donation Camps', href: '/camps', desc: 'Browse scheduled blood drives and donation camps.', icon: <Search className="w-5 h-5" /> },
    { label: 'My Achievements', href: '/donor/dashboard', desc: 'Inspect certificates and donation milestones.', icon: <Award className="w-5 h-5" /> },
  ];

  const totalDonations = typeof data?.metrics[0]?.value === 'number' ? data.metrics[0].value : 0;

  const milestones = [
    { name: 'First Drop (Bronze)', req: 1, desc: 'Complete 1 blood donation to start your journey.', achieved: totalDonations >= 1 },
    { name: 'Life Saver (Silver)', req: 3, desc: 'Complete 3 blood donations to unlock community appreciation.', achieved: totalDonations >= 3 },
    { name: 'Blood Champion (Gold)', req: 5, desc: 'Complete 5 blood donations and receive the ultimate recognition.', achieved: totalDonations >= 5 },
  ];

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

  const handleActionClick = (action: typeof quickActions[0]) => {
    if (action.label === 'My Achievements') {
      setIsAchievementsOpen(true);
    } else {
      navigate(action.href);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-600/10 text-rose-500 flex items-center justify-center">
          <Heart className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">Donor Dashboard</h2>
          <p className="text-xs text-slate-400">Welcome back, {user?.fullName || 'Donor'}! Schedule donations and track compatibility requests</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {data?.metrics.map((m, idx) => (
          <div
            key={idx}
            className="p-6 bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl space-y-2 hover:border-slate-800 transition-all group"
          >
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{m.label}</span>
            <span className={`block text-3xl font-extrabold font-display tracking-tight group-hover:text-rose-500 transition-colors ${
              m.value === 'Eligible' ? 'text-emerald-400' :
              m.value === 'Deferred' ? 'text-amber-500' : 'text-white'
            }`}>
              {isLoading ? '...' : m.value}
            </span>
            {m.change && (
              <span className={`block text-xs font-semibold ${
                m.changeType === 'success' ? 'text-emerald-500' :
                m.changeType === 'warning' ? 'text-amber-500' :
                'text-slate-400'
              }`}>
                {m.change}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Main Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-white font-display">Quick Actions</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {quickActions.map((action, idx) => (
              <div
                key={idx}
                onClick={() => handleActionClick(action)}
                className="p-5 rounded-2xl border border-slate-800/60 bg-slate-900/10 hover:bg-slate-900/30 hover:border-rose-500/20 transition-all flex gap-4 group cursor-pointer"
              >
                <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-800 border border-slate-700/80 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {action.icon}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{action.label}</h4>
                  <p className="text-xs text-slate-500 leading-normal">{action.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white font-display">My History</h3>
          <div className="border border-slate-800/60 bg-slate-900/10 rounded-2xl p-6 space-y-5">
            {data?.activities.map((a) => (
              <div key={a.id} className="flex gap-3 relative pb-2 group">
                <div className="w-2 h-2 shrink-0 rounded-full bg-rose-500 mt-1.5 animate-pulse" />
                <div className="space-y-0.5">
                  <h5 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{a.title}</h5>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{a.subtitle}</p>
                  <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Achievements Modal */}
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
            <Button variant="outline" onClick={() => setIsAchievementsOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default DonorDashboard;
