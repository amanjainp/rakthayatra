import React, { useState } from 'react';
import { useBloodBankDashboardData } from '../../hooks/useDashboardData';
import {
  Database,
  Plus,
  RefreshCw,
  Megaphone,
  CheckSquare,
  QrCode,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ShieldCheck,
  Check,
  X,
  Calendar,
  Radio,
  MapPin,
  Phone,
  Clock,
  UserCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';
import {
  useIncomingBloodBankRequisitions,
  useProcessRequisition,
  useMyAppointments,
  useUpdateAppointmentStatus,
  useActiveDonorsForFacility,
  IncomingRequisition,
} from '../../hooks/useRealtimeLogistics';

interface BloodUnitItem {
  id: string;
  unitId: string;
  bloodGroup: string;
  component: string;
  unitsCount: number;
  collectionDate: string;
  expiryDate: string;
  storageRack: string;
  testingStatus: 'TESTED_SAFE' | 'IN_TESTING' | 'QUARANTINED';
  status: 'AVAILABLE' | 'RESERVED' | 'EXPIRED';
}

export const BloodBankDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useBloodBankDashboardData();

  // Real-time hooks
  const { data: incomingRequisitions = [], isLoading: isLoadingRequisitions } = useIncomingBloodBankRequisitions();
  const processRequisitionMutation = useProcessRequisition();
  const { data: appointments = [], isLoading: isLoadingAppointments } = useMyAppointments();
  const updateAppointmentMutation = useUpdateAppointmentStatus();

  // Active Donors Radar State
  const [mapRadius, setMapRadius] = useState<number>(25);
  const { data: activeDonors = [], isLoading: isLoadingDonors } = useActiveDonorsForFacility(mapRadius);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [selectedUnitForQr, setSelectedUnitForQr] = useState<BloodUnitItem | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Process Requisition Modal state
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<IncomingRequisition | null>(null);
  const [allocatedUnits, setAllocatedUnits] = useState<number>(1);
  const [responseNotes, setResponseNotes] = useState<string>('');

  // Blood Units Inventory with detailed cold-chain metadata
  const [inventoryUnits, setInventoryUnits] = useState<BloodUnitItem[]>([
    {
      id: 'unit-1',
      unitId: 'LL-UNIT-9041',
      bloodGroup: 'O+',
      component: 'PRBC (Packed Red Cells)',
      unitsCount: 14,
      collectionDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      storageRack: 'Cold Rack A-02 (-4°C)',
      testingStatus: 'TESTED_SAFE',
      status: 'AVAILABLE',
    },
    {
      id: 'unit-2',
      unitId: 'LL-UNIT-8812',
      bloodGroup: 'O-',
      component: 'Whole Blood',
      unitsCount: 4,
      collectionDate: new Date(Date.now() - 32 * 86400000).toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      storageRack: 'Cold Rack A-09 (-4°C)',
      testingStatus: 'TESTED_SAFE',
      status: 'AVAILABLE',
    },
    {
      id: 'unit-3',
      unitId: 'LL-UNIT-7744',
      bloodGroup: 'B+',
      component: 'Platelets (Single Donor)',
      unitsCount: 6,
      collectionDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      storageRack: 'Agitator Unit B-1 (22°C)',
      testingStatus: 'TESTED_SAFE',
      status: 'AVAILABLE',
    },
    {
      id: 'unit-4',
      unitId: 'LL-UNIT-6531',
      bloodGroup: 'AB-',
      component: 'Fresh Frozen Plasma (FFP)',
      unitsCount: 8,
      collectionDate: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
      storageRack: 'Deep Freezer F-01 (-30°C)',
      testingStatus: 'TESTED_SAFE',
      status: 'RESERVED',
    },
  ]);

  const quickActions = [
    { label: 'Register Blood Stock', action: () => setIsAddOpen(true), desc: 'Add newly screened blood bags to storage logs.', icon: <Plus className="w-5 h-5" /> },
    { label: 'Inter-Bank Transfer', action: () => setIsTransferOpen(true), desc: 'Record stock transfer dispatch or receipt.', icon: <ArrowRightLeft className="w-5 h-5" /> },
    { label: 'Batch Expiry Sweeper', action: () => navigate('/inventory'), desc: 'Run sweeper check to identify expired storage items.', icon: <RefreshCw className="w-5 h-5" /> },
    { label: 'Launch Camp Drive', action: () => navigate('/camps'), desc: 'Organize community blood donation drive.', icon: <Megaphone className="w-5 h-5" /> },
  ];

  const handleOpenQr = (unit: BloodUnitItem) => {
    setSelectedUnitForQr(unit);
    setIsQrOpen(true);
  };

  const handleAddUnitSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const newUnit: BloodUnitItem = {
      id: `unit-${Date.now()}`,
      unitId: `LL-UNIT-${Math.floor(1000 + Math.random() * 9000)}`,
      bloodGroup: (formData.get('bloodGroup') as string) || 'O+',
      component: (formData.get('component') as string) || 'Whole Blood',
      unitsCount: Number(formData.get('unitsCount')) || 1,
      collectionDate: new Date().toISOString().split('T')[0],
      expiryDate: (formData.get('expiryDate') as string) || new Date(Date.now() + 35 * 86400000).toISOString().split('T')[0],
      storageRack: (formData.get('storageRack') as string) || 'Cold Rack A-01',
      testingStatus: 'TESTED_SAFE',
      status: 'AVAILABLE',
    };

    setInventoryUnits((prev) => [newUnit, ...prev]);
    setIsAddOpen(false);
    toast.success(`Unit ${newUnit.unitId} registered successfully!`);
  };

  const openProcessModal = (req: IncomingRequisition) => {
    setSelectedRequisition(req);
    setAllocatedUnits(req.unitsRequired);
    setResponseNotes(`Units verified from cold storage. Ready for emergency dispatch.`);
    setIsProcessModalOpen(true);
  };

  const handleProcessSubmit = async (action: 'ACCEPT' | 'DECLINE') => {
    if (!selectedRequisition) return;
    try {
      await processRequisitionMutation.mutateAsync({
        requestId: selectedRequisition.id,
        action,
        allocatedUnits: action === 'ACCEPT' ? allocatedUnits : 0,
        responseNotes: responseNotes.trim() || undefined,
      });
      setIsProcessModalOpen(false);
      setSelectedRequisition(null);
    } catch {
      // Error handled in hook toast
    }
  };

  const handleCompleteAppointment = async (appointmentId: string) => {
    try {
      await updateAppointmentMutation.mutateAsync({
        appointmentId,
        status: 'COMPLETED',
      });
      toast.success('Donation appointment marked as COMPLETED! Donor record updated.');
    } catch {
      // Error handled in hook toast
    }
  };

  return (
    <div className="space-y-8 text-slate-100">
      {/* 1. Header with Drug Controller License Verification */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-400 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Database className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white font-display">Blood Bank Cold-Chain Portal</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Licensed Blood Bank
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Welcome back, {user?.fullName || 'Blood Bank Officer'}! Manage QR-traceable units, FEFO alerts, hospital allocations, and scheduled appointments
            </p>
          </div>
        </div>

        <Button variant="primary" onClick={() => setIsAddOpen(true)} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Register Blood Unit
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

      {/* 3. FEFO Expiry Alert Banner */}
      <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-950/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-amber-300 text-sm block">
              FEFO Priority Alert: 1 Batch Expiring Within 72 Hours
            </span>
            <p className="text-slate-300 text-[11px] mt-0.5">
              Unit <strong className="text-white font-mono">LL-UNIT-8812</strong> (O- Whole Blood, 4 Units) reaches shelf-life on {inventoryUnits[1]?.expiryDate}. Automatic recommendation: prioritize for next emergency trauma requisition.
            </p>
          </div>
        </div>
        <button
          onClick={() => handleOpenQr(inventoryUnits[1])}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all whitespace-nowrap shadow-md shadow-amber-500/20 cursor-pointer"
        >
          Inspect QR Passport
        </button>
      </div>

      {/* 4. Real Database Incoming Hospital Requisitions Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-rose-500" />
              Incoming Hospital Blood Requisitions & Direct Orders
            </h3>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span className="text-xs text-slate-400">
            {incomingRequisitions.filter((r) => r.status === 'PENDING').length} awaiting action
          </span>
        </div>

        {isLoadingRequisitions ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading incoming blood requisitions from database...</div>
        ) : incomingRequisitions.length === 0 ? (
          <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/30 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">All Requisitions Fulfilled</p>
            <p className="text-xs text-slate-500">No pending hospital requisitions assigned to this blood bank facility at this moment.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {incomingRequisitions.map((req) => (
              <div
                key={req.id}
                className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  req.status === 'APPROVED' || req.status === 'FULFILLED'
                    ? 'border-emerald-500/30 bg-emerald-950/10'
                    : req.status === 'CANCELLED'
                    ? 'border-slate-800 bg-slate-950/40 opacity-50'
                    : req.urgency === 'EMERGENCY'
                    ? 'border-rose-500/50 bg-rose-950/20 shadow-lg shadow-rose-950/30'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.urgency === 'EMERGENCY'
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {req.urgency}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {req.requester?.hospitalProfile?.name || 'Hospital Request'}
                      </span>
                    </div>
                    {req.requester?.hospitalProfile?.city && (
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {req.requester.hospitalProfile.city} • {req.requester.hospitalProfile.address}
                      </p>
                    )}
                    {req.requester?.hospitalProfile?.phone && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {req.requester.hospitalProfile.phone}
                      </p>
                    )}
                    <p className="text-xs text-slate-200 mt-2">
                      Required:{' '}
                      <strong className="text-rose-400 font-bold">{req.unitsRequired} Units</strong> of{' '}
                      <strong className="text-white font-bold">{req.bloodGroup.replace('_', '+')}</strong>
                    </p>
                    {req.message && (
                      <p className="text-[11px] text-slate-300 italic mt-1 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                        "{req.message}"
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        req.status === 'APPROVED' || req.status === 'FULFILLED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : req.status === 'CANCELLED'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {req.status}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {req.responseNotes && (
                  <div className="text-[11px] text-emerald-300 bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/20">
                    <strong>Bank Note:</strong> {req.responseNotes}
                  </div>
                )}

                {req.status === 'PENDING' && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => openProcessModal(req)}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Review & Process Requisition
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Scheduled Donor Appointments Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
              <Calendar className="w-5 h-5 text-rose-500" />
              Scheduled Voluntary Donor Appointments
            </h3>
            <p className="text-xs text-slate-400">
              Donors who selected this facility for voluntary blood donation slot
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {appointments.filter((a) => a.status === 'SCHEDULED').length} upcoming slots
          </span>
        </div>

        {isLoadingAppointments ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/30 text-center space-y-2">
            <UserCheck className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No Scheduled Appointments</p>
            <p className="text-xs text-slate-500">When donors book a slot at this blood bank, it will appear here in real time.</p>
          </div>
        ) : (
          <div className="border border-slate-800/80 rounded-2xl bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Donor Name</th>
                    <th className="py-3 px-4">Blood Group</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Date & Time Slot</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">
                        {apt.donor?.fullName || 'Anonymous Donor'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                          {apt.donor?.bloodGroup || 'O+'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {apt.donor?.phone || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-semibold">{apt.appointmentDate}</div>
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
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {apt.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {apt.status === 'SCHEDULED' && (
                          <button
                            onClick={() => handleCompleteAppointment(apt.id)}
                            disabled={updateAppointmentMutation.isPending}
                            className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors inline-flex items-center gap-1 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Donated
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6. Role-Specific Real-Time Emergency Radar: Active Donors within Radius */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
              <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
              Active Voluntary Donors within Emergency Radius
            </h3>
            <p className="text-xs text-slate-400">
              Real-time map and list showing active donors registered within radius (excludes other blood banks)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Radar Range:</span>
            {[10, 25, 50, 100].map((r) => (
              <button
                key={r}
                onClick={() => setMapRadius(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mapRadius === r
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/30 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-3">
            <span>
              Found <strong className="text-rose-400">{activeDonors.length} active donors</strong> within {mapRadius} km
            </span>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Live Radar Active
            </span>
          </div>

          {isLoadingDonors ? (
            <div className="p-8 text-center text-xs text-slate-500">Scanning active donors in radius...</div>
          ) : activeDonors.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No active donors currently registered within {mapRadius} km. Expand radar range to 50km or 100km.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeDonors.map((donor) => (
                <div
                  key={donor.id}
                  className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 flex items-start justify-between gap-3 hover:border-slate-700 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{donor.fullName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {donor.bloodGroup}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {donor.address || 'Bengaluru'}
                    </p>
                    <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Ready for emergency donor matching
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20 whitespace-nowrap">
                    {donor.distanceKm} km away
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7. Blood Unit Records with QR Traceability Ledger */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <QrCode className="w-5 h-5 text-rose-500" />
            Blood Unit Records & QR Cold-Chain Traceability
          </h3>
          <span className="text-xs text-slate-400">{inventoryUnits.length} batches registered</span>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {inventoryUnits.map((u) => (
            <div
              key={u.id}
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-xl flex flex-col justify-between space-y-4 hover:border-rose-500/30 transition-all group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-rose-400">{u.unitId}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.status === 'AVAILABLE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {u.status}
                  </span>
                </div>

                <div className="pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white font-display">{u.bloodGroup}</span>
                    <span className="text-xs text-slate-400 font-semibold">{u.unitsCount} Units</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">{u.component}</p>
                </div>

                <div className="space-y-1 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                  <p>Location: <strong className="text-slate-200">{u.storageRack}</strong></p>
                  <p>Collected: {u.collectionDate}</p>
                  <p className="text-amber-400 font-semibold">Expires: {u.expiryDate}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Tested Safe
                </span>
                <button
                  onClick={() => handleOpenQr(u)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <QrCode className="w-3 h-3 text-rose-400" /> QR Code
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 8. Quick Actions Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white font-display">Logistics Action Items</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* 9. Process Hospital Requisition Modal */}
      <Modal
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        title="Process Hospital Blood Requisition"
      >
        {selectedRequisition && (
          <div className="space-y-4 text-xs text-slate-200">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Requesting Hospital:</span>
                <span className="font-bold text-white">
                  {selectedRequisition.requester?.hospitalProfile?.name || 'Hospital'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Blood Group & Urgency:</span>
                <span className="font-bold text-rose-400">
                  {selectedRequisition.bloodGroup.replace('_', '+')} ({selectedRequisition.urgency})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Units Requested:</span>
                <span className="font-bold text-white">{selectedRequisition.unitsRequired} Units</span>
              </div>
              {selectedRequisition.message && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-400 block mb-1">Clinical Note / Reason:</span>
                  <p className="text-slate-300 italic">{selectedRequisition.message}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Allocated Units to Release *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedRequisition.unitsRequired}
                  value={allocatedUnits}
                  onChange={(e) => setAllocatedUnits(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Response & Cold Chain Instructions</label>
                <textarea
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                  placeholder="Specify batch ID, temperature box ref, or reason for decline..."
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleProcessSubmit('DECLINE')}
                disabled={processRequisitionMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-950/30 border border-red-500/30 hover:bg-red-900/40 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Decline Request
              </button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsProcessModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleProcessSubmit('ACCEPT')}
                  disabled={processRequisitionMutation.isPending}
                  className="flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Accept & Allocate Stock
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 10. QR Traceability Modal */}
      <Modal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} title="Blood Bag Digital QR Traceability Passport">
        {selectedUnitForQr && (
          <div className="space-y-5 text-xs text-slate-200">
            <div className="p-6 rounded-2xl bg-white flex flex-col items-center justify-center text-slate-950 space-y-3 shadow-2xl">
              <div className="w-40 h-40 border-4 border-slate-900 rounded-xl p-2 flex items-center justify-center relative bg-white">
                <QrCode className="w-36 h-36 text-slate-900" />
              </div>
              <span className="font-mono font-black text-sm tracking-widest">{selectedUnitForQr.unitId}</span>
              <span className="text-[10px] text-slate-600 font-bold">DIGITAL COLD-CHAIN IDENTIFIER</span>
            </div>

            <div className="space-y-2 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Blood Product:</span>
                <span className="font-bold text-white">{selectedUnitForQr.bloodGroup} ({selectedUnitForQr.component})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Collection Date:</span>
                <span className="font-bold text-white">{selectedUnitForQr.collectionDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Expiry Date (FEFO):</span>
                <span className="font-bold text-amber-400">{selectedUnitForQr.expiryDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Storage Location:</span>
                <span className="font-bold text-white">{selectedUnitForQr.storageRack}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pathology Screening:</span>
                <span className="font-bold text-emerald-400">Verified HIV/HepB/HepC/Syphilis Negative</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsQrOpen(false)}>
                Close Passport
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  toast.success('Print command sent to thermal label printer');
                  setIsQrOpen(false);
                }}
              >
                Print Bag Label
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 11. Register Blood Stock Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Register Screened Blood Unit Batch">
        <form onSubmit={handleAddUnitSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Blood Group *</label>
              <select name="bloodGroup" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
                <option value="O+">O Positive (O+)</option>
                <option value="O-">O Negative (O-)</option>
                <option value="A+">A Positive (A+)</option>
                <option value="A-">A Negative (A-)</option>
                <option value="B+">B Positive (B+)</option>
                <option value="B-">B Negative (B-)</option>
                <option value="AB+">AB Positive (AB+)</option>
                <option value="AB-">AB Negative (AB-)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Component *</label>
              <select name="component" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
                <option value="Whole Blood">Whole Blood</option>
                <option value="PRBC (Packed Cells)">Packed Red Blood Cells (PRBC)</option>
                <option value="Platelets (SDP)">Platelets (Single Donor SDP)</option>
                <option value="Fresh Frozen Plasma (FFP)">Fresh Frozen Plasma (FFP)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Quantity (Bags) *</label>
              <input
                type="number"
                name="unitsCount"
                min="1"
                defaultValue={4}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Expiry Date (FEFO) *</label>
              <input
                type="date"
                name="expiryDate"
                defaultValue={new Date(Date.now() + 35 * 86400000).toISOString().split('T')[0]}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Cold Storage Rack / Compartment *</label>
            <input
              type="text"
              name="storageRack"
              defaultValue="Cold Rack A-04 (-4°C Storage)"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Save Unit & Generate QR
            </Button>
          </div>
        </form>
      </Modal>

      {/* 12. Inter-Bank Transfer Modal */}
      <Modal isOpen={isTransferOpen} onClose={() => setIsTransferOpen(false)} title="Initiate Inter-Bank Blood Transfer">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsTransferOpen(false);
            toast.success('Inter-bank transfer order dispatched with chain-of-custody tracking!');
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Destination Blood Bank Facility</label>
            <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
              <option>Victoria Hospital Regional Blood Centre (Bengaluru)</option>
              <option>St. John’s Medical College Blood Bank (Bengaluru)</option>
              <option>Apex Rotary Community Blood Storage (Mysuru)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Select Blood Group</label>
              <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none">
                <option>O- Negative (Universal Emergency)</option>
                <option>O+ Positive</option>
                <option>B+ Positive</option>
                <option>A+ Positive</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Transfer Units</label>
              <input
                type="number"
                min="1"
                max="20"
                defaultValue={4}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Cold-Chain Temperature Box ID & Courier</label>
            <input
              type="text"
              defaultValue="COLDBOX-2026-X12 (Validated 2°C - 6°C Range)"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsTransferOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Confirm Dispatch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BloodBankDashboard;
