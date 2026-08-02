import React from 'react';
import { useBloodBankDashboardData } from '../../hooks/useDashboardData';
import { Database, Plus, RefreshCw, Megaphone, CheckSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const BloodBankDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading } = useBloodBankDashboardData();

  const quickActions = [
    { label: 'Register Blood Stock', href: '/inventory', desc: 'Add new collected blood units to storage logs.', icon: <Plus className="w-5 h-5" /> },
    { label: 'Scan Expired Batches', href: '/inventory', desc: 'Run sweeper check to identify expired storage items.', icon: <RefreshCw className="w-5 h-5" /> },
    { label: 'Launch Camp Drive', href: '/camps', desc: 'Settle scheduling details for campaign drives.', icon: <Megaphone className="w-5 h-5" /> },
    { label: 'Fulfill Requests', href: '/requests', desc: 'Check compatibilities and allocate reserved bags.', icon: <CheckSquare className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-600/10 text-rose-500 flex items-center justify-center">
          <Database className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">Blood Bank Portal</h2>
          <p className="text-xs text-slate-400">Welcome back, {user?.fullName || 'Blood Bank'}! Settle stock records and scan allocations</p>
        </div>
      </div>

      {/* Metrics Grid */}
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
              <span className={`block text-xs font-semibold ${
                m.changeType === 'success' ? 'text-emerald-500' :
                m.changeType === 'warning' ? 'text-amber-500' :
                'text-slate-400'
              }`}>
                {m.change}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Main Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-white font-display">Logistics Action Items</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {quickActions.map((action, idx) => (
              <Link
                key={idx}
                to={action.href}
                className="p-5 rounded-2xl border border-slate-800/60 bg-slate-900/10 hover:bg-slate-900/30 hover:border-rose-500/20 transition-all flex gap-4 group"
              >
                <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-800 border border-slate-700/80 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {action.icon}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{action.label}</h4>
                  <p className="text-xs text-slate-500 leading-normal">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white font-display">Storage Sweeps</h3>
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
    </div>
  );
};
export default BloodBankDashboard;
