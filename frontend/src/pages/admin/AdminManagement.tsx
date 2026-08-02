import React, { useState } from 'react';
import { useAdminManagement } from '../../hooks/useAdminManagement';
import { ShieldAlert, Users, Building, Database, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Table, TableHead, TableRow, TableCell, TableBody } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';

export const AdminManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'hospitals' | 'bloodbanks'>('users');
  const { users, isLoadingUsers, approveHospital, deleteUser } = useAdminManagement();

  const handleApprove = async (id: string) => {
    await approveHospital(id);
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Delete user profile record permanently?');
    if (confirm) {
      await deleteUser(id);
    }
  };

  const hospitalsList = users.filter(u => u.role === 'HOSPITAL');
  const bloodBanksList = users.filter(u => u.role === 'BLOOD_BANK');
  const standardUsersList = users.filter(u => u.role !== 'HOSPITAL' && u.role !== 'BLOOD_BANK');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">Administrative Center</h2>
          <p className="text-xs text-slate-400">Purge invalid profiles, verify hospital licenses, and monitor blood bank registries</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800/80 flex gap-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-bold tracking-wide transition-colors relative ${
            activeTab === 'users' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5" /> User Directory
        </button>
        <button
          onClick={() => setActiveTab('hospitals')}
          className={`pb-3 text-sm font-bold tracking-wide transition-colors relative ${
            activeTab === 'hospitals' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building className="w-4 h-4 inline mr-1.5" /> Hospital Approvals
        </button>
        <button
          onClick={() => setActiveTab('bloodbanks')}
          className={`pb-3 text-sm font-bold tracking-wide transition-colors relative ${
            activeTab === 'bloodbanks' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4 inline mr-1.5" /> Blood Banks Registry
        </button>
      </div>

      {/* Content Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/10 overflow-hidden">
        {isLoadingUsers ? (
          <div className="text-center py-12 text-slate-500">Loading directory...</div>
        ) : (
          <>
            {activeTab === 'users' && (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name / Title</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>System Role</TableCell>
                    <TableCell>Created Date</TableCell>
                    <TableCell className="text-right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {standardUsersList.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-white">{u.fullName}</TableCell>
                      <TableCell className="text-slate-300">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'ADMIN' ? 'danger' : 'neutral'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.role !== 'ADMIN' && (
                          <Button variant="outline" size="sm" onClick={() => handleDelete(u.id)} className="text-rose-500">
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {activeTab === 'hospitals' && (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Hospital Name</TableCell>
                    <TableCell>Verification Status</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Registry Date</TableCell>
                    <TableCell className="text-right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hospitalsList.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-white">{u.fullName}</TableCell>
                      <TableCell>
                        <Badge variant={u.isVerified ? 'success' : 'warning'}>
                          {u.isVerified ? 'VERIFIED' : 'PENDING'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">{u.email}</TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {!u.isVerified && (
                          <Button variant="primary" size="sm" onClick={() => handleApprove(u.id)}>
                            <CheckCircle className="w-3.5 h-3.5" /> Approve License
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleDelete(u.id)} className="text-rose-500">
                          <Trash2 className="w-3.5 h-3.5" /> Purge
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {hospitalsList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-12">
                        No pending hospital registrations.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}

            {activeTab === 'bloodbanks' && (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Blood Bank Centre Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Contact Email</TableCell>
                    <TableCell>Registry Date</TableCell>
                    <TableCell className="text-right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bloodBanksList.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-white">{u.fullName}</TableCell>
                      <TableCell>
                        <Badge variant="success">ACTIVE</Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">{u.email}</TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleDelete(u.id)} className="text-rose-500">
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bloodBanksList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-12">
                        No registered blood bank facilities in index.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default AdminManagement;
