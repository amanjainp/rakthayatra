import React from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { Bell, Check, ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const Notifications: React.FC = () => {
  const { data: notifications = [], unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-display">Notification Center</h2>
            <p className="text-xs text-slate-400">View compatibility matches, emergency broadcasts, and account logs</p>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAllAsRead()} className="flex items-center gap-2">
            <Check className="w-4 h-4" /> Mark all as read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            onClick={() => !notif.read && markAsRead(notif.id)}
            className={`p-5 rounded-2xl border transition-all flex gap-4 cursor-pointer relative group ${
              notif.read
                ? 'bg-slate-900/10 border-slate-800/60 opacity-75 hover:bg-slate-900/20'
                : 'bg-slate-900/30 border-rose-500/20 shadow-lg shadow-rose-950/5 hover:border-rose-500/40'
            }`}
          >
            {/* Unread circle indicator */}
            {!notif.read && (
              <span className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            )}

            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              notif.read ? 'bg-slate-800 text-slate-400' : 'bg-rose-500/10 text-rose-500'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>

            <div className="space-y-1 pr-6">
              <h3 className={`text-sm font-bold leading-snug font-display ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                {notif.title}
              </h3>
              <p className="text-xs text-slate-400 leading-normal">{notif.body}</p>
              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                {new Date(notif.createdAt).toLocaleTimeString()} - {new Date(notif.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="text-center py-16 border border-slate-800 border-dashed rounded-3xl text-slate-500">
            You do not have any notification records in your feed log.
          </div>
        )}
      </div>
    </div>
  );
};
export default Notifications;
