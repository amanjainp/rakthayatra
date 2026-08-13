import React, { useState, useEffect } from 'react';
import { useDonations } from '../hooks/useDonations';
import { useAuth } from '../hooks/useAuth';
import { Plus, Heart, Award, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHead, TableRow, TableCell, TableBody } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useForm } from 'react-hook-form';
import { apiClient } from '../services/api';

export const Donations: React.FC = () => {
  const { user } = useAuth();
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [completeTargetId, setCompleteTargetId] = useState<string | null>(null);
  const [bloodBanks, setBloodBanks] = useState<{ id: string; name: string; city: string }[]>([]);

  useEffect(() => {
    const fetchBloodBanks = async () => {
      try {
        const res = await apiClient.get('/donations/blood-banks');
        if (res.data?.success && res.data?.data) {
          setBloodBanks(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch blood banks:', err);
      }
    };
    fetchBloodBanks();
  }, []);

  const { data: donations = [], bookAppointment, completeAppointment, cancelAppointment, isBooking } = useDonations(
    user?.role === 'DONOR' ? user.id : undefined
  );

  const { register: regBook, handleSubmit: handleBook, reset: resetBook } = useForm({
    defaultValues: {
      bloodBankId: '',
      donationDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    }
  });

  const { register: regComplete, handleSubmit: handleComplete, reset: resetComplete } = useForm({
    defaultValues: {
      unitsCollected: 1,
      bloodGroup: 'O+',
    }
  });

  const onBookSubmit = async (values: any) => {
    try {
      await bookAppointment({
        bloodBankId: values.bloodBankId,
        donationDate: new Date(values.donationDate).toISOString(),
      });
      setIsBookOpen(false);
      resetBook();
    } catch {
      // handled
    }
  };

  const onCompleteSubmit = async (values: any) => {
    try {
      if (!completeTargetId) return;
      await completeAppointment({
        id: completeTargetId,
        unitsCollected: Number(values.unitsCollected),
        bloodGroup: values.bloodGroup,
      });
      setCompleteTargetId(null);
      resetComplete();
    } catch {
      // handled
    }
  };

  const isDonor = user?.role === 'DONOR';
  const isBloodBank = user?.role === 'BLOOD_BANK' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-display">Donations & Appointments</h2>
            <p className="text-xs text-slate-400">Schedule appointments, track medical screening status, and view donation history</p>
          </div>
        </div>

        {isDonor && (
          <Button variant="primary" onClick={() => setIsBookOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Book Appointment
          </Button>
        )}
      </div>

      {/* Grid Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/10 overflow-hidden">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Donor Name</TableCell>
              <TableCell>Blood Bank Centre</TableCell>
              <TableCell>Scheduled Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Details</TableCell>
              <TableCell className="text-right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {donations.map((don) => (
              <TableRow key={don.id}>
                <TableCell className="font-semibold text-white">{don.donorName || 'Aman Jain'}</TableCell>
                <TableCell className="text-slate-300">{don.bloodBankName || 'Red Cross Noida'}</TableCell>
                <TableCell className="text-xs text-slate-400">
                  {new Date(don.donationDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant={
                    don.status === 'COMPLETED' ? 'success' :
                    don.status === 'PENDING' ? 'warning' : 'danger'
                  }>
                    {don.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {don.status === 'COMPLETED' ? (
                    <span className="font-semibold text-rose-400">
                      {don.unitsCollected} Bag ({don.bloodGroup})
                    </span>
                  ) : (
                    '--'
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {isBloodBank && don.status === 'PENDING' && (
                    <Button variant="primary" size="sm" onClick={() => setCompleteTargetId(don.id)}>
                      <Award className="w-3.5 h-3.5" /> Complete Donation
                    </Button>
                  )}
                  {isDonor && don.status === 'PENDING' && (
                    <Button variant="outline" size="sm" onClick={() => cancelAppointment(don.id)} className="text-rose-500">
                      <Trash2 className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {donations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-12">
                  No appointments scheduled.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Book Appointment Modal */}
      <Modal isOpen={isBookOpen} onClose={() => setIsBookOpen(false)} title="Book Appointment">
        <form onSubmit={handleBook(onBookSubmit)} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Blood Bank</label>
            <select
              {...regBook('bloodBankId', { required: 'Please select a blood bank' })}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-rose-500/30"
            >
              <option value="">Select a Blood Bank...</option>
              {bloodBanks.map((bb) => (
                <option key={bb.id} value={bb.id}>
                  {bb.name} ({bb.city})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Donation Date"
            type="date"
            {...regBook('donationDate')}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsBookOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" isLoading={isBooking}>Book Appointment</Button>
          </div>
        </form>
      </Modal>

      {/* Complete Appointment Modal */}
      <Modal isOpen={completeTargetId !== null} onClose={() => setCompleteTargetId(null)} title="Complete Donation Registration">
        <form onSubmit={handleComplete(onCompleteSubmit)} className="space-y-5">
          <Input
            label="Collected Bags Count"
            type="number"
            {...regComplete('unitsCollected')}
          />

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Blood Group Collected</label>
            <select
              {...regComplete('bloodGroup')}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-rose-500/30"
            >
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setCompleteTargetId(null)}>Cancel</Button>
            <Button variant="primary" type="submit">Verify & Complete</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default Donations;
