import React, { useState } from 'react';
import { useHospitalDashboardData } from '../../hooks/useDashboardData';
import {
  Building,
  Plus,
  Search,
  Calendar,
  AlertOctagon,
  Clock,
  Check,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export const HospitalDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useHospitalDashboardData();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedReqForConfirm, setSelectedReqForConfirm] = useState<string | null>(null);

  // Hospital's multi-facility blood orders ledger
  const [hospitalOrders, setHospitalOrders] = useState([
    {
      id: 'ord-101',
      patientName: 'Kavitha M. (IP-4412)',
      bloodGroup: 'O+',
      component: 'PRBC (Packed Red Cells)',
      unitsRequested: 3,
      unitsReserved: 2,
      unitsDelivered: 1,
      urgency: 'EMERGENCY',
      targetWard: 'Emergency OT 3',
      targetTime: 'Within 2 hours',
      status: 'ALLOCATION_IN_PROGRESS',
      participatingBanks: [
        { name: 'Red Cross Central', reserved: 2, status: 'RESERVED_SAFE' },
        { name: 'Victoria Hospital BB', reserved: 0, status: 'AWAITING_STOCK' },
      ],
      escalated: false,
    },
    {
      id: 'ord-102',
      patientName: 'Devraj R. (IP-9801)',
      bloodGroup: 'AB-',
      component: 'Fresh Frozen Plasma (FFP)',
      unitsRequested: 2,
      unitsReserved: 2,
      unitsDelivered: 2,
      urgency: 'NORMAL',
      targetWard: 'Hematology Day Care',
      targetTime: 'Tomorrow morning',
      status: 'READY_FOR_COLLECTION',
      participatingBanks: [
        { name: 'St. John’s Medical BB', reserved: 2, status: 'COLLECTION_CONFIRMED' },
      ],
      escalated: false,
    },
  ]);

  const quickActions = [
    { label: 'Create Patient Request', action: () => setIsCreateOpen(true), desc: 'File emergency requirements for compatible blood units.', icon: <Plus className="w-5 h-5" /> },
    { label: 'Search Bank Inventory', action: () => navigate('/inventory'), desc: 'Check compatible inventories and reserves across banks.', icon: <Search className="w-5 h-5" /> },
    { label: 'Emergency Match Map', action: () => navigate('/emergency-map'), desc: 'View nearby blood banks and active donors in radius.', icon: <Building className="w-5 h-5" /> },
    { label: 'Sponsor Donation Camp', action: () => navigate('/camps'), desc: 'Associate with blood drives to replenish regional reserves.', icon: <Calendar className="w-5 h-5" /> },
  ];

  const handleEscalate = (orderId: string) => {
    setHospitalOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, escalated: true } : o))
    );
    toast.error('Emergency escalation dispatched to all regional blood banks and on-call coordinators!', {
      duration: 5000,
      icon: '🚨',
    });
  };

  const handleConfirmFulfillment = () => {
    if (selectedReqForConfirm) {
      setHospitalOrders((prev) =>
        prev.map((o) =>
          o.id === selectedReqForConfirm
            ? { ...o, status: 'FULFILLED', unitsDelivered: o.unitsRequested }
            : o
        )
      );
      toast.success('Fulfillment confirmed. Blood unit issued and request closed.');
      setIsConfirmOpen(false);
      setSelectedReqForConfirm(null);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreateOpen(false);
    toast.success('Clinical Blood Request submitted. Dispatched to regional blood banks!');
    setHospitalOrders((prev) => [
      {
        id: `ord-${Date.now()}`,
        patientName: 'Emergency Trauma Patient (IP-5021)',
        bloodGroup: 'O-',
        component: 'Whole Blood',
        unitsRequested: 2,
        unitsReserved: 1,
        unitsDelivered: 0,
        urgency: 'EMERGENCY',
        targetWard: 'Trauma Resuscitation Unit',
        targetTime: 'Immediate (< 1 Hour)',
        status: 'ALLOCATION_IN_PROGRESS',
        participatingBanks: [
          { name: 'Red Cross Central', reserved: 1, status: 'RESERVED_SAFE' },
        ],
        escalated: false,
      },
      ...prev,
    ]);
  };

  return (
    <div className="space-y-8 text-slate-100">
      {/* 1. Header with Verification Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white font-display">Hospital Blood Logistics</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Licensed Hospital Facility
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Welcome back, {user?.fullName || 'Hospital Facility'}! Coordinate clinical transfusion orders and multi-bank allocations
            </p>
          </div>
        </div>

        <Button variant="primary" onClick={() => setIsCreateOpen(true)} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Create Clinical Request
        </Button>
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

      {/* 3. Multi-Facility Requests & Allocation Tracking */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500" />
            Clinical Blood Orders & Multi-Bank Allocation Ledger
          </h3>
          <span className="text-xs text-slate-400">
            {hospitalOrders.filter((o) => o.status !== 'FULFILLED').length} active clinical requests
          </span>
        </div>

        <div className="space-y-4">
          {hospitalOrders.map((ord) => (
            <div
              key={ord.id}
              className={`p-6 rounded-3xl border transition-all space-y-5 ${
                ord.escalated
                  ? 'border-rose-500 bg-rose-950/20 shadow-xl shadow-rose-950/40 animate-pulse'
                  : ord.status === 'FULFILLED'
                  ? 'border-slate-800 bg-slate-950/40 opacity-70'
                  : 'border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl'
              }`}
            >
              {/* Top row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-white">{ord.patientName}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ord.urgency === 'EMERGENCY'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {ord.urgency}
                    </span>
                    {ord.escalated && (
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black uppercase tracking-wider">
                        🚨 Escalated to High Priority
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Required: <strong className="text-rose-400">{ord.unitsRequested} Units</strong> of{' '}
                    <strong className="text-white">{ord.bloodGroup}</strong> ({ord.component}) • Target: {ord.targetWard}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!ord.escalated && ord.status !== 'FULFILLED' && (
                    <button
                      onClick={() => handleEscalate(ord.id)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
                      title="Escalate if unanswered beyond threshold"
                    >
                      <AlertOctagon className="w-3.5 h-3.5" /> Emergency Escalation
                    </button>
                  )}
                  {ord.status !== 'FULFILLED' && (
                    <button
                      onClick={() => {
                        setSelectedReqForConfirm(ord.id);
                        setIsConfirmOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                    >
                      <Check className="w-3.5 h-3.5" /> Confirm Receipt & Close
                    </button>
                  )}
                </div>
              </div>

              {/* Allocation Breakdown across blood banks */}
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 text-xs">
                {ord.participatingBanks.map((bank, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-200 block">{bank.name}</span>
                      <span className="text-[10px] text-slate-400">Reserved: {bank.reserved} Units</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        bank.reserved > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500'
                      }`}
                    >
                      {bank.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Status footer */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" /> Required by: {ord.targetTime}
                </span>
                <span className="font-bold text-slate-300">
                  Total Delivered: {ord.unitsDelivered} / {ord.unitsRequested} Units
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Analytics & Logistics Overview Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-white font-display">Logistics Directory</h3>
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

        {/* Clinical Transfusion Analytics */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white font-display">Transfusion Analytics</h3>
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Fulfillment Success Rate</span>
              <span className="font-extrabold text-emerald-400 text-sm">96.4%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '96.4%' }} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-slate-400">Average Bank Response Time</span>
              <span className="font-bold text-white">18 Minutes</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-400">Zero-Loss FEFO Adherence</span>
              <span className="font-bold text-emerald-400">100%</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-400 leading-relaxed">
              Clinical compatibility cross-matching must be documented and signed by the attending pathologist prior to infusion.
            </div>
          </div>
        </div>
      </div>

      {/* 5. Create Clinical Request Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Clinical Patient Blood Order">
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Patient Name / IP Identifier *</label>
              <input
                type="text"
                defaultValue="Suma N. (IP-6102)"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Target Ward / OT *</label>
              <input
                type="text"
                defaultValue="Emergency OT 2"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Blood Group *</label>
              <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
                <option value="O_NEG">O Negative (O-) Universal</option>
                <option value="O_POS">O Positive (O+)</option>
                <option value="A_POS">A Positive (A+)</option>
                <option value="B_POS">B Positive (B+)</option>
                <option value="AB_POS">AB Positive (AB+)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Component *</label>
              <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
                <option value="PRBC">Packed Red Blood Cells (PRBC)</option>
                <option value="WHOLE_BLOOD">Whole Blood</option>
                <option value="PLATELETS">Single Donor Platelets (SDP)</option>
                <option value="PLASMA">Fresh Frozen Plasma (FFP)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Units Required *</label>
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
                <option value="EMERGENCY">EMERGENCY (Critical Surgeries)</option>
                <option value="NORMAL">NORMAL (Scheduled Transfusions)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Required By Timestamp *</label>
            <input
              type="datetime-local"
              defaultValue={new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 16)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Dispatch Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. Confirm Receipt & Close Modal */}
      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} title="Confirm Blood Delivery & Close Order">
        <div className="space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            Record the successful receipt of the cold-chain blood units from the courier. Closing the request marks all allocated units as safely transferred.
          </p>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Verified Clinical Batch Number</label>
            <input
              type="text"
              defaultValue="BATCH-LL-2026-9041"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Receiving Transfusion Nurse / Doctor</label>
            <input
              type="text"
              defaultValue={user?.fullName || 'Dr. Transfusion Officer'}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Back
            </Button>
            <Button variant="primary" onClick={handleConfirmFulfillment} className="bg-emerald-600 hover:bg-emerald-500">
              Confirm Receipt
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default HospitalDashboard;
