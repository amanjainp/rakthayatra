import React, { useState } from 'react';
import {
  Building,
  Plus,
  AlertOctagon,
  Clock,
  ShieldCheck,
  Flame,
  Radio,
  Users,
  MapPin,
  CheckCircle2,
  Phone,
  Send,
  Trash2,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
  useHospitalRequisitions,
  useCreateHospitalRequisition,
  useDeleteHospitalRequisition,
  useEmergencyBroadcast,
  useRegisteredFacilities,
  useActiveDonorsForFacility,
  HospitalRequisition,
} from '../../hooks/useRealtimeLogistics';

export const HospitalDashboard: React.FC = () => {

  // Real database hooks
  const { data: requisitions = [], isLoading: isReqLoading } = useHospitalRequisitions();
  const { data: bloodBanks = [] } = useRegisteredFacilities('BLOOD_BANK');
  const createRequisition = useCreateHospitalRequisition();
  const deleteRequisition = useDeleteHospitalRequisition();
  const emergencyBroadcast = useEmergencyBroadcast();

  // Modals state
  const [isRequisitionOpen, setIsRequisitionOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HospitalRequisition | null>(null);

  // Requisition Form state
  const [targetBankId, setTargetBankId] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O_POS');
  const [unitsRequired, setUnitsRequired] = useState(2);
  const [urgency, setUrgency] = useState<'NORMAL' | 'EMERGENCY'>('NORMAL');
  const [message, setMessage] = useState('');

  // Emergency Broadcast Form state
  const [broadcastRadius, setBroadcastRadius] = useState(50);
  const [broadcastGroup, setBroadcastGroup] = useState('O_POS');
  const [broadcastUnits, setBroadcastUnits] = useState(3);
  const [broadcastMsg, setBroadcastMsg] = useState('');

  // Active Donors Map Radius
  const [mapRadius, setMapRadius] = useState(50);
  const { data: activeDonors = [] } = useActiveDonorsForFacility(mapRadius);

  const handleCreateRequisitionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBankId) return;

    try {
      await createRequisition.mutateAsync({
        targetBloodBankId: targetBankId,
        bloodGroup,
        unitsRequired: Number(unitsRequired),
        urgency,
        message,
      });

      setIsRequisitionOpen(false);
      setMessage('');
    } catch {
      // Handled by createRequisition onError toast
    }
  };

  const handleEmergencyBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await emergencyBroadcast.mutateAsync({
        bloodGroup: broadcastGroup,
        unitsRequired: Number(broadcastUnits),
        radiusKm: Number(broadcastRadius),
        message: broadcastMsg,
      });

      setIsBroadcastOpen(false);
      setBroadcastMsg('');
    } catch {
      // Handled by emergencyBroadcast onError toast
    }
  };

  return (
    <div className="space-y-8 text-slate-100 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-white font-display">
                Hospital Clinical Operations
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Accredited Center
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Direct blood bank requisitions, 100km emergency donor radar, and live transfusion tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsBroadcastOpen(true)}
            className="flex items-center gap-2 border-rose-500/30 text-rose-300 hover:bg-rose-950/20"
          >
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            Emergency SOS Radar
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              if (bloodBanks.length > 0 && !targetBankId) {
                setTargetBankId(bloodBanks[0].id);
              }
              setIsRequisitionOpen(true);
            }}
            className="flex items-center gap-2 shadow-lg shadow-rose-600/30"
          >
            <Plus className="w-4 h-4" />
            Raise Blood Requisition
          </Button>
        </div>
      </div>

      {/* 2. Top Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Active Requisitions</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-display">
            {requisitions.filter((r) => r.status === 'PENDING' || r.status === 'APPROVED').length}
          </div>
          <span className="text-[10px] text-slate-500">Awaiting or in allocation</span>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Fulfilled Units</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-display">
            {requisitions.reduce((acc, curr) => acc + (curr.allocatedUnits || 0), 0)}
          </div>
          <span className="text-[10px] text-slate-500">Received from partner banks</span>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Partner Blood Banks</span>
            <Building className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-display">{bloodBanks.length}</div>
          <span className="text-[10px] text-slate-500">Connected in network</span>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Active Donors in Radius</span>
            <Users className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-display">{activeDonors.length}</div>
          <span className="text-[10px] text-slate-500">Within {mapRadius} km ready to donate</span>
        </div>
      </div>

      {/* 3. Requisitions Ledger */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-500" />
              Hospital Requisitions Ledger
            </h3>
            <p className="text-xs text-slate-400">
              Live hospital blood orders sent directly to registered blood banks
            </p>
          </div>
          <span className="text-xs text-slate-500">Auto-synced via real-time DB</span>
        </div>

        {isReqLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading requisitions...</div>
        ) : requisitions.length === 0 ? (
          <div className="p-10 rounded-2xl border border-slate-800 bg-slate-900/20 text-center space-y-3">
            <AlertOctagon className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-300">No active requisitions raised yet</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Raise a direct blood requisition ticket to any registered blood bank to reserve units.
            </p>
            <Button
              variant="outline"
              onClick={() => setIsRequisitionOpen(true)}
              className="text-xs"
            >
              Raise Requisition
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/30">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="py-3 px-4">Ticket Ref</th>
                  <th className="py-3 px-4">Target Blood Bank</th>
                  <th className="py-3 px-4">Blood Group</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Urgency</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Blood Bank Response</th>
                  <th className="py-3 px-4">Date Raised</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {requisitions.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-rose-400">
                      #{req.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">
                        {req.targetBloodBank?.name || req.allocatedBloodBank?.name || 'Broadcast Pool'}
                      </div>
                      {req.targetBloodBank?.phone && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {req.targetBloodBank.phone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                        {req.bloodGroup.replace('_', '+')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-white">{req.allocatedUnits}</span> /{' '}
                      {req.unitsRequired} Units
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.urgency === 'EMERGENCY'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {req.urgency}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === 'FULFILLED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : req.status === 'APPROVED'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : req.status === 'CANCELLED'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-400">
                      {req.responseNotes || (
                        <span className="italic text-slate-600">Awaiting bank review...</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(req)}
                        disabled={deleteRequisition.isPending}
                        title="Delete Requisition"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors inline-flex items-center gap-1.5 text-xs border border-transparent hover:border-rose-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span className="text-[11px] font-semibold text-rose-400">Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Real-Time Emergency Map for Hospital (Shows ACTIVE DONORS within Radius) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
              <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
              Active Voluntary Donors within Emergency Radius
            </h3>
            <p className="text-xs text-slate-400">
              Real-time map showing verified donors who have marked themselves as Active (not other hospitals)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Radius:</span>
            {[10, 25, 50, 100].map((r) => (
              <button
                key={r}
                onClick={() => setMapRadius(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
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
              Found <strong className="text-rose-400">{activeDonors.length} active donors</strong> within{' '}
              {mapRadius} km
            </span>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Live Radar Active
            </span>
          </div>

          {activeDonors.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No active donors currently registered within {mapRadius} km. Try expanding radius to 100 km.
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
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold text-[10px]">
                        {donor.bloodGroup.replace('_', '+')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{donor.distanceKm} km from hospital</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active & Eligible
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBroadcastGroup(donor.bloodGroup);
                      setIsBroadcastOpen(true);
                    }}
                    className="text-[10px] py-1 px-2.5 shrink-0"
                  >
                    Alert
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Modal: Raise Requisition to Blood Bank */}
      <Modal
        isOpen={isRequisitionOpen}
        onClose={() => setIsRequisitionOpen(false)}
        title="Raise Blood Requisition to Blood Bank"
      >
        <form onSubmit={handleCreateRequisitionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Target Blood Bank</label>
            <select
              value={targetBankId}
              onChange={(e) => setTargetBankId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              required
            >
              {bloodBanks.map((bb) => (
                <option key={bb.id} value={bb.id}>
                  {bb.name} • {bb.city} ({bb.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Blood Group Required</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              >
                {['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG'].map(
                  (bg) => (
                    <option key={bg} value={bg}>
                      {bg.replace('_', '+')}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Units Count</label>
              <input
                type="number"
                min="1"
                max="20"
                value={unitsRequired}
                onChange={(e) => setUnitsRequired(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Urgency</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                  urgency === 'NORMAL'
                    ? 'border-indigo-500 bg-indigo-950/20 text-white'
                    : 'border-slate-800 text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="urgency"
                  checked={urgency === 'NORMAL'}
                  onChange={() => setUrgency('NORMAL')}
                  className="hidden"
                />
                <span className="font-bold">Normal (Elective/Routine)</span>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                  urgency === 'EMERGENCY'
                    ? 'border-rose-500 bg-rose-950/30 text-rose-300'
                    : 'border-slate-800 text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="urgency"
                  checked={urgency === 'EMERGENCY'}
                  onChange={() => setUrgency('EMERGENCY')}
                  className="hidden"
                />
                <span className="font-bold flex items-center gap-1">
                  <Flame className="w-4 h-4 text-rose-500" /> Emergency (Immediate)
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Clinical Notes / Patient Case Ref (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Patient undergoing emergency cardiovascular surgery in OT-2."
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsRequisitionOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={createRequisition.isPending}
              className="flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {createRequisition.isPending ? 'Sending Requisition...' : 'Dispatch Requisition Ticket'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 6. Modal: Emergency SOS Broadcast to Donors */}
      <Modal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        title="Broadcast Emergency Donor SOS (100km Radar)"
      >
        <form onSubmit={handleEmergencyBroadcastSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
            <strong>When blood banks have no stock:</strong> This will broadcast real-time in-app
            and push notifications directly to voluntary active donors registered within your selected
            radius.
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-300 font-semibold">Broadcast Radius Distance</label>
              <span className="font-mono font-bold text-rose-400 text-sm">{broadcastRadius} km</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={broadcastRadius}
              onChange={(e) => setBroadcastRadius(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>5 km (Immediate local)</span>
              <span>50 km (City-wide)</span>
              <span>100 km (Inter-district)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Blood Group Needed</label>
              <select
                value={broadcastGroup}
                onChange={(e) => setBroadcastGroup(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
              >
                {['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG'].map(
                  (bg) => (
                    <option key={bg} value={bg}>
                      {bg.replace('_', '+')}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Required Units</label>
              <input
                type="number"
                min="1"
                max="20"
                value={broadcastUnits}
                onChange={(e) => setBroadcastUnits(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Emergency Message to Donors</label>
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder="Urgent trauma requirement at hospital. Donors can report directly to Blood Center on Ground Floor."
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsBroadcastOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={emergencyBroadcast.isPending}
              className="bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {emergencyBroadcast.isPending
                ? 'Broadcasting to Donors...'
                : `Broadcast to ${broadcastRadius}km Radius`}
            </Button>
          </div>
        </form>
      </Modal>
      {/* 7. Modal: Delete Requisition Confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Blood Requisition"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <p className="text-sm">
            Are you sure you want to delete requisition{' '}
            <span className="font-mono font-bold text-rose-400">
              #{deleteTarget?.id.slice(0, 8)}
            </span>{' '}
            for{' '}
            <span className="font-bold text-white">
              {deleteTarget?.unitsRequired} Units of {deleteTarget?.bloodGroup.replace('_', '+')}
            </span>
            ?
          </p>
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
            ⚠️ This will permanently remove the requisition from the ledger and participating blood banks. This action cannot be undone.
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteRequisition.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={deleteRequisition.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteRequisition.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                } catch {
                  // Handled by onError toast
                }
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleteRequisition.isPending ? 'Deleting...' : 'Delete Requisition'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HospitalDashboard;
