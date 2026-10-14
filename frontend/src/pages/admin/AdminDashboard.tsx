import React, { useState } from 'react';
import { useAdminDashboardData } from '../../hooks/useDashboardData';
import {
  Shield,
  Plus,
  Settings,
  UserCheck,
  Building,
  Radio,
  Search,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export const AdminDashboard: React.FC = () => {
  const { data, isLoading } = useAdminDashboardData();

  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'AUDIT_LOGS' | 'FRAUD_MONITOR'>('OVERVIEW');
  const [auditFilter, setAuditFilter] = useState('');

  // Sample Immutable Audit Logs
  const [auditLogs, setAuditLogs] = useState([
    {
      id: 'aud-109',
      action: 'ENCRYPTION_KEY_ROTATION',
      user: 'SYSTEM_DAEMON',
      ip: '10.0.4.12',
      details: 'Rotated MedicalEligibility AES-256-GCM key to version v2. 0 records failed.',
      time: '12 mins ago',
      level: 'INFO',
    },
    {
      id: 'aud-108',
      action: 'APPROVE_HOSPITAL_LICENSE',
      user: 'admin@rakthayatra.org',
      ip: '103.21.244.18',
      details: 'Approved Bowring Teaching Hospital (License KA-HOSP-2024-819).',
      time: '34 mins ago',
      level: 'SUCCESS',
    },
    {
      id: 'aud-107',
      action: 'FEFO_RESERVATION_SWEEP',
      user: 'SYSTEM_CRON',
      ip: '10.0.2.88',
      details: 'Released 2 expired reservations (>24h stale) back to AVAILABLE stock.',
      time: '1 hour ago',
      level: 'INFO',
    },
    {
      id: 'aud-106',
      action: 'SUSPICIOUS_REQUEST_FLAGGED',
      user: 'ANTI_FRAUD_FILTER',
      ip: '45.112.54.2',
      details: 'Flagged duplicate rapid request from IP 45.112.54.2 for rate limiting.',
      time: '2 hours ago',
      level: 'WARNING',
    },
  ]);

  // Pending Verifications Queue
  const [pendingVerifications, setPendingVerifications] = useState([
    {
      id: 'ver-1',
      type: 'HOSPITAL',
      name: 'Victoria Trauma Resuscitation Centre',
      licenseNumber: 'KA-HOSP-2026-9041',
      city: 'Bengaluru',
      submittedAt: 'Today, 09:30 AM',
      documentsVerified: true,
    },
    {
      id: 'ver-2',
      type: 'BLOOD_BANK',
      name: 'Lions Community Cold Storage Unit',
      licenseNumber: 'KA-BB-2026-3104',
      city: 'Mysuru',
      submittedAt: 'Yesterday, 02:15 PM',
      documentsVerified: true,
    },
  ]);

  const handleApproveFacility = (id: string, name: string) => {
    setPendingVerifications((prev) => prev.filter((v) => v.id !== id));
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        action: 'APPROVE_FACILITY_LICENSE',
        user: 'admin@rakthayatra.org',
        ip: '127.0.0.1',
        details: `Approved credentials for ${name}. Verification badge assigned.`,
        time: 'Just now',
        level: 'SUCCESS',
      },
      ...prev,
    ]);
    toast.success(`${name} verified and approved successfully!`);
  };

  const handleBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    toast.success('Emergency platform-wide alert broadcasted to all active dashboards and mobile push notifications!');
    setBroadcastText('');
    setIsBroadcastOpen(false);
  };

  const filteredLogs = auditLogs.filter(
    (l) =>
      l.action.toLowerCase().includes(auditFilter.toLowerCase()) ||
      l.details.toLowerCase().includes(auditFilter.toLowerCase()) ||
      l.user.toLowerCase().includes(auditFilter.toLowerCase())
  );

  return (
    <div className="space-y-8 text-slate-100">
      {/* 1. Header with System Broadcast Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white font-display">System Administration</h2>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                Super Admin Privilege
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Platform governance, facility accreditation, encrypted audit trails, and infrastructure health
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsBroadcastOpen(true)}
            className="flex items-center gap-1.5 text-rose-400 border-rose-500/30 hover:bg-rose-950/20"
          >
            <Radio className="w-4 h-4 animate-pulse text-rose-500" /> Broadcast Alert
          </Button>
          <Link
            to="/admin/management"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5"
          >
            <UserCheck className="w-4 h-4" /> User & Role Management
          </Link>
        </div>
      </div>

      {/* 2. Platform Status & Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {data?.metrics.map((m, idx) => (
          <div
            key={idx}
            className="p-6 bg-slate-900/30 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl space-y-2 hover:border-slate-800 transition-all group"
          >
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{m.label}</span>
            <span className="block text-3xl font-extrabold text-white font-display tracking-tight group-hover:text-rose-500 transition-colors">
              {isLoading ? '...' : m.value}
            </span>
            {m.change && (
              <span
                className={`block text-xs font-semibold ${
                  m.changeType === 'increase'
                    ? 'text-emerald-500'
                    : m.changeType === 'danger'
                    ? 'text-rose-500 animate-pulse'
                    : 'text-slate-400'
                }`}
              >
                {m.change}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 3. Navigation Tabs (Overview, Audit Logs, Fraud Monitor) */}
      <div className="border-b border-slate-800 flex gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'OVERVIEW'
              ? 'text-rose-400 border-b-2 border-rose-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Administrative Overview
        </button>
        <button
          onClick={() => setActiveTab('AUDIT_LOGS')}
          className={`pb-3 transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'AUDIT_LOGS'
              ? 'text-rose-400 border-b-2 border-rose-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" /> Immutable Audit Logs ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('FRAUD_MONITOR')}
          className={`pb-3 transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'FRAUD_MONITOR'
              ? 'text-rose-400 border-b-2 border-rose-500'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Fraud & Abuse Shield
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-8">
          {/* Facility Verification Queue */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
                <Building className="w-5 h-5 text-rose-500" />
                Facility Accreditation & Verification Review Queue
              </h3>
              <span className="text-xs text-slate-400">{pendingVerifications.length} awaiting approval</span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {pendingVerifications.map((ver) => (
                <div
                  key={ver.id}
                  className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 backdrop-blur-xl shadow-xl flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ver.type === 'HOSPITAL'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {ver.type === 'HOSPITAL' ? 'Hospital Requisition' : 'Blood Bank License'}
                      </span>
                      <span className="text-[11px] text-slate-500">{ver.submittedAt}</span>
                    </div>

                    <h4 className="text-sm font-bold text-white">{ver.name}</h4>
                    <p className="text-xs text-slate-400">
                      License / Accreditation: <strong className="font-mono text-slate-200">{ver.licenseNumber}</strong>
                    </p>
                    <p className="text-xs text-slate-400">Jurisdiction: {ver.city}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Credentials Pre-Verified
                    </span>
                    <button
                      onClick={() => handleApproveFacility(ver.id, ver.name)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-md shadow-emerald-600/30"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve Accreditation
                    </button>
                  </div>
                </div>
              ))}
              {pendingVerifications.length === 0 && (
                <div className="col-span-2 p-8 text-center text-xs text-slate-500 border border-slate-800 rounded-2xl bg-slate-900/10">
                  All facility licenses and accreditations are up to date.
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Recent Platform Logs Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-bold text-white font-display">Administrative Actions</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: 'Register New Camp', href: '/camps', desc: 'Schedule calendars for community blood donation drives.', icon: Plus },
                  { label: 'User Directory', href: '/admin/management', desc: 'Inspect registrations and manage system roles.', icon: UserCheck },
                  { label: 'Emergency Match Map', href: '/emergency-map', desc: 'Inspect live radial coordinates and emergency incidents.', icon: Radio },
                  { label: 'Platform Settings', href: '/profile', desc: 'Configure global rate limits and alert thresholds.', icon: Settings },
                ].map((action, idx) => (
                  <Link
                    key={idx}
                    to={action.href}
                    className="p-5 rounded-2xl border border-slate-800/60 bg-slate-900/10 hover:bg-slate-900/30 hover:border-rose-500/20 transition-all flex gap-4 group"
                  >
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-800 border border-slate-700/80 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <action.icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                        {action.label}
                      </h4>
                      <p className="text-xs text-slate-500 leading-normal">{action.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* System Logs */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white font-display">System Logs Activity</h3>
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
        </div>
      )}

      {/* Tab 2: Searchable Immutable Audit Logs */}
      {activeTab === 'AUDIT_LOGS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Filter by action, user, or correlation details..."
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-rose-500/40"
              />
            </div>
            <span className="text-xs text-slate-400">
              Showing {filteredLogs.length} immutable events (WORM archive synced)
            </span>
          </div>

          <div className="border border-slate-800 rounded-2xl bg-slate-900/20 overflow-hidden text-xs">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 border-b border-slate-800/80 hover:bg-slate-900/40 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-rose-400">{log.action}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                        log.level === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : log.level === 'WARNING'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-slate-500 text-[10px]">User: {log.user}</span>
                    <span className="text-slate-500 text-[10px]">IP: {log.ip}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{log.details}</p>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Fraud & Abuse Monitor */}
      {activeTab === 'FRAUD_MONITOR' && (
        <div className="space-y-6 text-xs">
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-500" />
              Automated Duplicate Detection & Abuse Mitigation Rules
            </h4>
            <p className="text-slate-300 leading-relaxed">
              The platform actively enforces rate-limiting safeguards, detects duplicate active blood requests submitted by the same IP within 15 minutes, and prevents multiple registrations with identical telephone numbers.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="block text-slate-400 font-semibold">Active Request Deduplication</span>
                <span className="font-bold text-emerald-400 text-sm">Enforced</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="block text-slate-400 font-semibold">Commercial Blood Sale Filter</span>
                <span className="font-bold text-emerald-400 text-sm">Active Scanner</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="block text-slate-400 font-semibold">Rate Limit Shield</span>
                <span className="font-bold text-emerald-400 text-sm">0 Attacks Detected</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Alert Modal */}
      <Modal isOpen={isBroadcastOpen} onClose={() => setIsBroadcastOpen(false)} title="Broadcast Emergency Platform Alert">
        <form onSubmit={handleBroadcastSubmit} className="space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            Send a high-priority banner notification to all logged-in hospitals, blood banks, and donors across the platform. Use only during severe blood stock deficits or regional mass-casualty emergencies.
          </p>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Alert Message *</label>
            <textarea
              rows={3}
              placeholder="e.g. Critical O-negative deficit reported in Bengaluru Central. All eligible O- donors are requested to schedule appointments immediately."
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-rose-500/40"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsBroadcastOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="bg-rose-600 hover:bg-rose-500 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" /> Dispatch Alert
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default AdminDashboard;
