import React, { useState } from 'react';
import { useBloodRequests } from '../hooks/useBloodRequests';
import { useAuth } from '../hooks/useAuth';
import { Activity, Plus, Check, X, Award } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHead, TableRow, TableCell, TableBody } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useForm } from 'react-hook-form';

const BLOOD_GROUP_MAP: Record<string, string> = {
  'A+': 'A_POS',
  'A-': 'A_NEG',
  'B+': 'B_POS',
  'B-': 'B_NEG',
  'AB+': 'AB_POS',
  'AB-': 'AB_NEG',
  'O+': 'O_POS',
  'O-': 'O_NEG',
};

export const BloodRequests: React.FC = () => {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: requests = [], createRequest, approveRequest, rejectRequest, fulfillRequest, cancelRequest, isCreatingRequest } = useBloodRequests({
    status: statusFilter || undefined,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      bloodGroup: 'O+',
      units: 1,
      urgency: 'NORMAL',
      locationName: 'City Center Area',
      latitude: 28.6139,
      longitude: 77.209,
    }
  });

  const onCreateSubmit = async (values: any) => {
    try {
      await createRequest({
        bloodGroup: BLOOD_GROUP_MAP[values.bloodGroup] || 'O_POS',
        unitsRequired: Number(values.units),
        urgency: values.urgency,
        locationName: values.locationName,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
      });
      setIsCreateOpen(false);
      reset();
    } catch {
      // handled
    }
  };

  const isPatientOrHospital = user?.role === 'PATIENT' || user?.role === 'HOSPITAL';
  const isAdmin = user?.role === 'ADMIN';
  const isStorageManager = user?.role === 'BLOOD_BANK' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-display">Blood Requests Ledger</h2>
            <p className="text-xs text-slate-400">File requests, manage matching compatibility sweeps, and check fulfillment reserves</p>
          </div>
        </div>

        {isPatientOrHospital && (
          <Button variant="primary" onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Request Blood
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/10 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Search Filters</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-56 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-rose-500/30"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="FULFILLED">FULFILLED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      {/* Grid List Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/10 overflow-hidden">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Requester</TableCell>
              <TableCell>Group</TableCell>
              <TableCell>Bags Needed</TableCell>
              <TableCell>Urgency</TableCell>
              <TableCell>Status</TableCell>
              <TableCell className="text-right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="font-semibold text-white">{req.requesterName || 'Hospital Center'}</TableCell>
                <TableCell className="font-bold text-rose-400">{req.bloodGroup}</TableCell>
                <TableCell className="text-slate-300">{req.units} bags</TableCell>
                <TableCell>
                  <Badge variant={req.urgency === 'EMERGENCY' ? 'danger' : 'neutral'}>
                    {req.urgency}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={
                    req.status === 'FULFILLED' ? 'success' :
                    req.status === 'PENDING' ? 'neutral' :
                    req.status === 'APPROVED' ? 'info' : 'danger'
                  }>
                    {req.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {isAdmin && req.status === 'PENDING' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => approveRequest(req.id)} className="text-emerald-500 hover:text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => rejectRequest(req.id)} className="text-rose-500 hover:text-rose-400">
                        <X className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </>
                  )}
                  {isStorageManager && req.status === 'APPROVED' && (
                    <Button variant="primary" size="sm" onClick={() => fulfillRequest(req.id)} className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" /> Allocate Stock
                    </Button>
                  )}
                  {user?.id === req.requesterId && (req.status === 'PENDING' || req.status === 'APPROVED') && (
                    <Button variant="outline" size="sm" onClick={() => cancelRequest(req.id)}>
                      Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-12">
                  No blood request records matches the selected filter status options.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* File Request Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="File Blood Request">
        <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Blood Group Required</label>
            <select
              {...register('bloodGroup')}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-rose-500/30"
            >
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <Input
            label="Required Units (Bags)"
            type="number"
            {...register('units', { required: 'Required units count is mandatory', min: { value: 1, message: 'Must request at least 1 bag' } })}
            error={errors.units?.message}
          />

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Urgency Level</label>
            <select
              {...register('urgency')}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-rose-500/30"
            >
              <option value="NORMAL">NORMAL (7 days limit)</option>
              <option value="EMERGENCY">EMERGENCY (24 hours matching broadcast)</option>
            </select>
          </div>

          <Input
            label="Location Name (e.g. City Hospital or Landmark)"
            {...register('locationName', { required: 'Location name is required' })}
            error={errors.locationName?.message}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Location Latitude"
              type="number"
              step="any"
              {...register('latitude', { required: 'Coord latitude is required' })}
              error={errors.latitude?.message}
            />
            <Input
              label="Location Longitude"
              type="number"
              step="any"
              {...register('longitude', { required: 'Coord longitude is required' })}
              error={errors.longitude?.message}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isCreatingRequest}>Submit Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default BloodRequests;
