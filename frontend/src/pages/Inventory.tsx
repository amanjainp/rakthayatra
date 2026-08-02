import React, { useState } from 'react';
import { useInventory } from '../hooks/useInventory';
import { useAuth } from '../hooks/useAuth';
import { Database, Plus, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHead, TableRow, TableCell, TableBody } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useForm } from 'react-hook-form';

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: inventory = [], addStock, sweepExpiry, isAddingStock, isSweepingExpiry } = useInventory({
    bloodGroup: bloodGroupFilter || undefined,
    status: statusFilter || undefined,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      bloodGroup: 'O+',
      units: 1,
      expiryDate: new Date(Date.now() + 35 * 86400 * 1000).toISOString().split('T')[0],
    }
  });

  const onAddSubmit = async (values: any) => {
    try {
      await addStock({
        bloodGroup: values.bloodGroup,
        units: Number(values.units),
        expiryDate: new Date(values.expiryDate).toISOString(),
      });
      setIsAddOpen(false);
      reset();
    } catch {
      // toast inside hook
    }
  };

  const handleSweep = async () => {
    await sweepExpiry();
  };

  const filteredInventory = inventory.filter(item => 
    item.bloodBankName?.toLowerCase().includes(search.toLowerCase()) ||
    item.bloodGroup.toLowerCase().includes(search.toLowerCase())
  );

  const canAddStock = user?.role === 'BLOOD_BANK' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-display">Blood Inventory</h2>
            <p className="text-xs text-slate-400">Monitor blood bags availability, track reservations, and sweep expired batches</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canAddStock && (
            <Button variant="primary" onClick={() => setIsAddOpen(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Register Stock
            </Button>
          )}
          {canAddStock && (
            <Button variant="outline" onClick={handleSweep} isLoading={isSweepingExpiry} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Sweeper Expiry
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/10 flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:w-72">
          <Input
            placeholder="Search blood bank..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={bloodGroupFilter}
            onChange={(e) => setBloodGroupFilter(e.target.value)}
            className="w-full md:w-40 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-rose-500/30"
          >
            <option value="">All Blood Groups</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-40 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-rose-500/30"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="RESERVED">RESERVED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
        </div>
      </div>

      {/* Spreadsheet grid table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/10 overflow-hidden">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Blood Bank / Location</TableCell>
              <TableCell>Blood Group</TableCell>
              <TableCell>Units (Bags)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Expiry Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredInventory.map((item) => {
              const isExpired = new Date(item.expiryDate).getTime() < Date.now();
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold text-white">{item.bloodBankName || 'Centrex Lab'}</TableCell>
                  <TableCell className="font-bold text-rose-400">{item.bloodGroup}</TableCell>
                  <TableCell className="text-slate-300">{item.units} bags</TableCell>
                  <TableCell>
                    <Badge variant={
                      item.status === 'AVAILABLE' ? 'success' :
                      item.status === 'RESERVED' ? 'warning' : 'danger'
                    }>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 flex items-center gap-1.5">
                    {new Date(item.expiryDate).toLocaleDateString()}
                    {isExpired && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />}
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredInventory.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-12">
                  No inventory records matching active filter options.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Register Stock Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Register Blood Stock">
        <form onSubmit={handleSubmit(onAddSubmit)} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Blood Group</label>
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
            label="Units (Bags)"
            type="number"
            {...register('units', { required: 'Count is required', min: { value: 1, message: 'Must be at least 1 unit' } })}
            error={errors.units?.message}
          />

          <Input
            label="Expiry Date"
            type="date"
            {...register('expiryDate', { required: 'Expiry date is required' })}
            error={errors.expiryDate?.message}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isAddingStock}>Submit Registry</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default Inventory;
