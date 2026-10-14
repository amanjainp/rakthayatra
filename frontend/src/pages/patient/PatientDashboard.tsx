import React, { useState } from 'react';
import { usePatientDashboardData } from '../../hooks/useDashboardData';
import {
  Activity,
  Plus,
  Search,
  FileText,
  User,
  Clock,
  Building,
  Upload,
  Globe,
  MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = usePatientDashboardData();

  const [lang, setLang] = useState<'en' | 'kn'>('en');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('FOUND_ALTERNATE');
  const [selectedReqToCancel, setSelectedReqToCancel] = useState<string | null>(null);

  // Active Requests with Detailed Multi-Stage Timeline
  const [activeRequests, setActiveRequests] = useState([
    {
      id: 'req-8841',
      referenceNumber: 'LL-REQ-8841',
      bloodGroup: 'B+',
      component: 'PRBC (Packed Red Cells)',
      unitsRequired: 2,
      unitsFulfilled: 1,
      urgency: 'EMERGENCY',
      receivingHospital: 'Victoria Teaching Hospital, Ward 4',
      stage: 'FACILITY_RESPONSE', // 'SUBMITTED' | 'VERIFICATION' | 'SEARCHING' | 'FACILITY_RESPONSE' | 'FULFILLED'
      createdAt: 'Today, 10:15 AM',
      requiredBy: 'Today by 06:00 PM',
      prescriptionUploaded: true,
    },
    {
      id: 'req-6210',
      referenceNumber: 'LL-REQ-6210',
      bloodGroup: 'B+',
      component: 'Platelets (Single Donor)',
      unitsRequired: 1,
      unitsFulfilled: 0,
      urgency: 'NORMAL',
      receivingHospital: 'St. John’s Medical Centre',
      stage: 'SEARCHING',
      createdAt: 'Yesterday, 04:30 PM',
      requiredBy: 'Tomorrow by 12:00 PM',
      prescriptionUploaded: true,
    },
  ]);

  const quickActions = [
    { label: 'Submit Blood Request', action: () => setIsCreateOpen(true), desc: 'File an emergency or normal request for compatible blood units.', icon: <Plus className="w-5 h-5" /> },
    { label: 'Track All Requests', action: () => navigate('/requests'), desc: 'Inspect fulfillment progress and active allocations.', icon: <FileText className="w-5 h-5" /> },
    { label: 'Find Blood Banks', action: () => navigate('/emergency-map'), desc: 'Locate nearby storage banks or facility centers.', icon: <Search className="w-5 h-5" /> },
    { label: 'My Recipient Profile', action: () => navigate('/profile'), desc: 'Update contact details or download emergency records.', icon: <User className="w-5 h-5" /> },
  ];

  const stagesList = [
    { key: 'SUBMITTED', label: '1. Submitted', desc: 'Request logged' },
    { key: 'VERIFICATION', label: '2. Verification', desc: 'Prescription reviewed' },
    { key: 'SEARCHING', label: '3. Searching', desc: 'Radial scan in 25km' },
    { key: 'FACILITY_RESPONSE', label: '4. Bank Response', desc: 'Stock reserved' },
    { key: 'FULFILLED', label: '5. Fulfilled', desc: 'Transfusion issued' },
  ];

  const getStageIndex = (stage: string) => {
    return stagesList.findIndex((s) => s.key === stage);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreateOpen(false);
    toast.success('Emergency Blood Request LL-REQ-9012 submitted successfully!');
    setActiveRequests((prev) => [
      {
        id: `req-${Date.now()}`,
        referenceNumber: `LL-REQ-${Math.floor(1000 + Math.random() * 9000)}`,
        bloodGroup: 'B+',
        component: 'PRBC (Packed Cells)',
        unitsRequired: 2,
        unitsFulfilled: 0,
        urgency: 'EMERGENCY',
        receivingHospital: 'Bowring Hospital, ICU 2',
        stage: 'SEARCHING',
        createdAt: 'Just now',
        requiredBy: 'Today by 08:00 PM',
        prescriptionUploaded: true,
      },
      ...prev,
    ]);
  };

  const confirmCancel = () => {
    if (selectedReqToCancel) {
      setActiveRequests((prev) => prev.filter((r) => r.id !== selectedReqToCancel));
      toast('Request cancelled successfully.', { icon: 'ℹ️' });
      setIsCancelOpen(false);
      setSelectedReqToCancel(null);
    }
  };

  return (
    <div className="space-y-8 text-slate-100">
      {/* 1. Header with Language and Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white font-display">
                {lang === 'kn' ? 'ಸ್ವೀಕರ್ತ / ರೋಗಿಯ ಪೋರ್ಟಲ್' : 'Recipient & Patient Portal'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                Emergency Priority Active
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {lang === 'kn'
                ? `ಸ್ವಾಗತ, ${user?.fullName || 'ರೋಗಿ'}! ರಕ್ತದ ವಿನಂತಿಗಳನ್ನು ಸಲ್ಲಿಸಿ ಮತ್ತು ನೈಜ ಸಮಯದ ಪೂರೈಕೆಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ.`
                : `Welcome back, ${user?.fullName || 'Patient'}! File blood requests and track fulfillment progress`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang((prev) => (prev === 'en' ? 'kn' : 'en'))}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-rose-500" />
            {lang === 'en' ? 'ಕನ್ನಡ' : 'English'}
          </button>
          <Button variant="primary" onClick={() => setIsCreateOpen(true)} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            {lang === 'kn' ? 'ಹೊಸ ವಿನಂತಿ ಸಲ್ಲಿಸಿ' : 'Request Blood'}
          </Button>
        </div>
      </div>

      {/* 2. Metrics Grid */}
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
                  m.changeType === 'success'
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

      {/* 3. Transparent Multi-Stage Fulfillment Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-500" />
            {lang === 'kn' ? 'ನೈಜ ಸಮಯದ ವಿನಂತಿ ಪ್ರಗತಿ ಟ್ರ್ಯಾಕರ್' : 'Live Request Fulfillment Progress Tracker'}
          </h3>
          <span className="text-xs text-slate-400">
            {activeRequests.length} active requests monitored
          </span>
        </div>

        {activeRequests.map((req) => {
          const currentStageIdx = getStageIndex(req.stage);
          return (
            <div
              key={req.id}
              className="p-6 rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl space-y-6"
            >
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-black text-rose-400 font-mono tracking-wider">
                      {req.referenceNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        req.urgency === 'EMERGENCY'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {req.urgency}
                    </span>
                    <span className="text-xs text-slate-400">Created: {req.createdAt}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1">
                    Requiring <strong className="text-rose-400">{req.unitsRequired} Units</strong> of{' '}
                    <strong className="text-white">{req.bloodGroup}</strong> ({req.component})
                  </h4>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    Receiving Hospital: {req.receivingHospital}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="block text-[10px] text-slate-500 uppercase font-bold">Allocation Progress</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {req.unitsFulfilled} of {req.unitsRequired} Units Reserved
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedReqToCancel(req.id);
                      setIsCancelOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-950/40 border border-rose-500/20 transition-all"
                  >
                    Cancel Request
                  </button>
                </div>
              </div>

              {/* Visual Progress Steps */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {stagesList.map((stg, i) => {
                  const isDone = i < currentStageIdx;
                  const isCurrent = i === currentStageIdx;
                  return (
                    <div
                      key={stg.key}
                      className={`p-3.5 rounded-2xl border text-xs transition-all relative ${
                        isCurrent
                          ? 'border-rose-500 bg-rose-950/30 shadow-lg shadow-rose-950/50'
                          : isDone
                          ? 'border-emerald-500/30 bg-emerald-950/10'
                          : 'border-slate-800/80 bg-slate-950/40 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isCurrent
                              ? 'bg-rose-500 text-white animate-pulse'
                              : isDone
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isDone ? '✓' : i + 1}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-extrabold uppercase text-rose-400 animate-pulse">
                            Active
                          </span>
                        )}
                      </div>
                      <span className={`block font-bold ${isCurrent ? 'text-white' : isDone ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {stg.label}
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{stg.desc}</span>
                    </div>
                  );
                })}
              </div>

              {/* Real-time Status Explanation */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-300">
                    {req.stage === 'FACILITY_RESPONSE'
                      ? 'Victoria Teaching Hospital Blood Bank has accepted and reserved 1 unit under cold-chain lock. Logistics courier dispatched.'
                      : 'Scanning registered blood banks and active donors within 25 km radius.'}
                  </span>
                </div>
                <span className="text-[11px] text-amber-400 font-bold whitespace-nowrap ml-2">
                  Target: {req.requiredBy}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Facility Comparison Matrix */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
          <Building className="w-5 h-5 text-rose-500" />
          {lang === 'kn' ? 'ಹತ್ತಿರದ ರಕ್ತ ಕೇಂದ್ರಗಳ ಹೋಲಿಕೆ' : 'Nearby Blood Facilities Comparison Matrix'}
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-xs">
          {[
            {
              name: 'Red Cross Central Blood Centre',
              distance: '2.8 km away',
              stockStatus: '6 Units B+ Available',
              freshness: 'Synced 8 mins ago',
              rating: '24/7 Transfusion Facility',
            },
            {
              name: 'Victoria Regional Trauma Blood Bank',
              distance: '4.5 km away',
              stockStatus: '11 Units B+ Available',
              freshness: 'Synced 15 mins ago',
              rating: 'High-Capacity Cold Storage',
            },
            {
              name: 'Apex Rotary Blood Storage',
              distance: '7.2 km away',
              stockStatus: '3 Units B+ (Low Reserve)',
              freshness: 'Synced 30 mins ago',
              rating: 'Day-Shift Operating Facility',
            },
          ].map((fac, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/30 hover:border-rose-500/30 transition-all space-y-3"
            >
              <h4 className="font-bold text-white text-sm">{fac.name}</h4>
              <div className="space-y-1.5 text-slate-300">
                <p className="flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" /> {fac.distance}
                </p>
                <p className="font-semibold text-emerald-400">{fac.stockStatus}</p>
                <p className="text-[10px] text-slate-500">{fac.freshness}</p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400">{fac.rating}</span>
                <button
                  onClick={() => navigate('/emergency-map')}
                  className="text-xs font-bold text-rose-400 hover:text-white flex items-center gap-1"
                >
                  View on Map →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Quick Actions & Recipient Profile Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-white font-display">Actions Ledger</h3>
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
                  <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{action.label}</h4>
                  <p className="text-xs text-slate-500 leading-normal">{action.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white font-display">Recent Activity Log</h3>
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

      {/* 6. Submit Blood Request Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Submit Blood Transfusion Request">
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Required Blood Group *</label>
              <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
                <option value="B_POS">B Positive (B+)</option>
                <option value="O_POS">O Positive (O+)</option>
                <option value="O_NEG">O Negative (O-)</option>
                <option value="A_POS">A Positive (A+)</option>
                <option value="A_NEG">A Negative (A-)</option>
                <option value="B_NEG">B Negative (B-)</option>
                <option value="AB_POS">AB Positive (AB+)</option>
                <option value="AB_NEG">AB Negative (AB-)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Blood Component *</label>
              <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
                <option value="PRBC">Packed Red Blood Cells (PRBC)</option>
                <option value="WHOLE_BLOOD">Whole Blood</option>
                <option value="PLATELETS">Platelets (RDP / SDP)</option>
                <option value="PLASMA">Fresh Frozen Plasma (FFP)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Quantity (Units/Bags) *</label>
              <input
                type="number"
                min="1"
                max="10"
                defaultValue={2}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Urgency Priority *</label>
              <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
                <option value="EMERGENCY">EMERGENCY (Immediate Life-Saving)</option>
                <option value="NORMAL">NORMAL (Scheduled Surgery / 24h)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Receiving Hospital / Ward Name *</label>
            <input
              type="text"
              placeholder="e.g. Victoria Hospital, ICU Bed 12"
              defaultValue="Victoria Teaching Hospital, Ward 4"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Required By Timestamp *</label>
            <input
              type="datetime-local"
              defaultValue={new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              required
            />
          </div>

          {/* Document Upload Area */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Doctor Prescription / Hospital Requisition Form</label>
            <div className="border border-dashed border-slate-800 rounded-2xl p-4 text-center space-y-2 bg-slate-950/40">
              <Upload className="w-6 h-6 text-slate-500 mx-auto" />
              <p className="text-[11px] text-slate-400">
                Upload scanned requisition slip (PDF, JPG, PNG up to 10MB).
              </p>
              <span className="text-[10px] text-emerald-400 font-semibold block">✓ Encrypted storage with access audit</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Dispatch Emergency Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. Cancel Request Reason Modal */}
      <Modal isOpen={isCancelOpen} onClose={() => setIsCancelOpen(false)} title="Cancel Blood Request">
        <div className="space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            Please specify the reason for cancelling this blood request so participating blood banks can release reserved units for other patients.
          </p>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Cancellation Reason</label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
            >
              <option value="FOUND_ALTERNATE">Found alternate donor / blood bank</option>
              <option value="SURGERY_POSTPONED">Surgery or procedure postponed</option>
              <option value="PATIENT_DISCHARGED">Patient recovered or discharged</option>
              <option value="INCORRECT_DETAILS">Entered incorrect clinical details</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsCancelOpen(false)}>
              Keep Active
            </Button>
            <Button variant="primary" onClick={confirmCancel} className="bg-rose-600 hover:bg-rose-500">
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default PatientDashboard;
