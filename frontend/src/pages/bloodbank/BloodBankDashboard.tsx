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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

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

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [selectedUnitForQr, setSelectedUnitForQr] = useState<BloodUnitItem | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

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
      expiryDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], // FEFO critical!
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

  // Incoming Clinical Requests Queue
  const [incomingRequests, setIncomingRequests] = useState([
    {
      id: 'in-req-1',
      hospitalName: 'Bowring Teaching Hospital',
      patientRef: 'IP-4412 (Emergency Trauma)',
      bloodGroup: 'O+',
      component: 'PRBC',
      unitsRequested: 2,
      urgency: 'EMERGENCY',
      status: 'PENDING_REVIEW',
    },
    {
      id: 'in-req-2',
      hospitalName: 'St. John’s Medical Centre',
      patientRef: 'IP-9011 (Elective Surgery)',
      bloodGroup: 'B+',
      component: 'Whole Blood',
      unitsRequested: 1,
      urgency: 'NORMAL',
      status: 'PENDING_REVIEW',
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

  const handleRequestAction = (id: string, action: 'RESERVE' | 'REJECT') => {
    setIncomingRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: action === 'RESERVE' ? 'RESERVED_SAFE' : 'REJECTED' } : r
      )
    );
    toast.success(action === 'RESERVE' ? 'Units reserved under FEFO lock!' : 'Request rejected.');
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
              Welcome back, {user?.fullName || 'Blood Bank Officer'}! Manage QR-traceable units, FEFO alerts, and hospital allocations
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
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all whitespace-nowrap shadow-md shadow-amber-500/20"
        >
          Inspect QR Passport
        </button>
      </div>

      {/* 4. Blood Unit Records with QR Traceability Ledger */}
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
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1"
                >
                  <QrCode className="w-3 h-3 text-rose-400" /> QR Code
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Incoming Requests Queue from Hospitals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white font-display flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-rose-500" />
            Incoming Clinical Blood Orders & Reservations
          </h3>
          <span className="text-xs text-slate-400">
            {incomingRequests.filter((r) => r.status === 'PENDING_REVIEW').length} pending review
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {incomingRequests.map((req) => (
            <div
              key={req.id}
              className={`p-5 rounded-2xl border transition-all space-y-3 ${
                req.status === 'RESERVED_SAFE'
                  ? 'border-emerald-500/30 bg-emerald-950/10'
                  : req.status === 'REJECTED'
                  ? 'border-slate-800 bg-slate-950/40 opacity-50'
                  : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
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
                    <span className="text-xs font-bold text-white">{req.hospitalName}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Patient Reference: <strong className="text-slate-200">{req.patientRef}</strong>
                  </p>
                  <p className="text-xs text-slate-300">
                    Requisition: <strong className="text-rose-400 font-bold">{req.unitsRequested} Units</strong> of{' '}
                    <strong className="text-white">{req.bloodGroup}</strong> ({req.component})
                  </p>
                </div>

                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    req.status === 'RESERVED_SAFE'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : req.status === 'REJECTED'
                      ? 'bg-rose-500/10 text-rose-400'
                      : 'bg-slate-800 text-amber-400'
                  }`}
                >
                  {req.status}
                </span>
              </div>

              {req.status === 'PENDING_REVIEW' && (
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => handleRequestAction(req.id, 'REJECT')}
                    className="px-3 py-1 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleRequestAction(req.id, 'RESERVE')}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1 shadow-md shadow-rose-600/30"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept & Reserve Stock
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. Quick Actions Grid */}
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

      {/* 7. QR Traceability Modal */}
      <Modal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} title="Blood Bag Digital QR Traceability Passport">
        {selectedUnitForQr && (
          <div className="space-y-5 text-xs text-slate-200">
            {/* Visual QR Code Generator Simulation */}
            <div className="p-6 rounded-2xl bg-white flex flex-col items-center justify-center text-slate-950 space-y-3 shadow-2xl">
              <div className="w-40 h-40 border-4 border-slate-900 rounded-xl p-2 flex items-center justify-center relative bg-white">
                <QrCode className="w-36 h-36 text-slate-900" />
              </div>
              <span className="font-mono font-black text-sm tracking-widest">{selectedUnitForQr.unitId}</span>
              <span className="text-[10px] text-slate-600 font-bold">DIGITAL COLD-CHAIN IDENTIFIER</span>
            </div>

            {/* Passport Details */}
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

      {/* 8. Register Blood Stock Modal */}
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

      {/* 9. Inter-Bank Transfer Modal */}
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
