import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLE_DASHBOARDS } from '../constants';
import { useNotifications } from '../hooks/useNotifications';
import {
  HomeIcon,
  UserIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  QueueListIcon,
  ClipboardDocumentCheckIcon,
  InboxIcon,
  MapIcon,
  ShieldExclamationIcon,
  BellIcon,
} from '@heroicons/react/24/outline';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isBellOpen, setIsBellOpen] = useState(false);

  const { data: notifications = [], unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const recentNotifs = notifications.slice(0, 3);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Helper to determine active route styles
  const isActive = (path: string) => location.pathname === path;

  // Sidebar Links based on roles
  const getNavLinks = () => {
    const commonLinks = [
      { name: 'Dashboard', path: ROLE_DASHBOARDS[user?.role || 'DONOR'], icon: HomeIcon },
      { name: 'Emergency Map', path: '/emergency-map', icon: MapIcon },
    ];

    const roleLinks: Record<string, { name: string; path: string; icon: any }[]> = {
      ADMIN: [
        { name: 'Inventory Management', path: '/inventory', icon: QueueListIcon },
        { name: 'All Requests', path: '/requests', icon: InboxIcon },
        { name: 'Camps Manager', path: '/camps', icon: MapIcon },
        { name: 'Admin Management', path: '/admin/management', icon: ShieldExclamationIcon },
      ],
      BLOOD_BANK: [
        { name: 'Inventory Stock', path: '/inventory', icon: QueueListIcon },
        { name: 'Blood Donations', path: '/donations', icon: ClipboardDocumentCheckIcon },
      ],
      DONOR: [
        { name: 'Donation History', path: '/donations', icon: ClipboardDocumentCheckIcon },
        { name: 'Medical Eligibility', path: '/eligibility', icon: ClipboardDocumentCheckIcon },
        { name: 'Camps Near Me', path: '/camps', icon: MapIcon },
      ],
      HOSPITAL: [
        { name: 'Blood Requests', path: '/requests', icon: InboxIcon },
      ],
      PATIENT: [
        { name: 'My Blood Requests', path: '/requests', icon: InboxIcon },
      ],
    };

    return [...commonLinks, ...(roleLinks[user?.role || 'DONOR'] || [])];
  };

  const navLinks = getNavLinks();

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans">
      {/* 1. Backdrop for mobile drawer sidebar */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}

      {/* 2. Responsive Sidebar Wrapper */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 border-r border-slate-800/60 transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-0 lg:translate-x-0'}
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isSidebarOpen ? 'w-64 lg:w-auto' : ''}
        `}
      >
        {/* Sidebar Header Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/60">
          <Link to="/" className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-rose-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-rose-600/30">
              L
            </div>
            {!isCollapsed && (
              <span className="text-xl font-bold tracking-tight text-white font-display">
                Life<span className="text-rose-500">Link</span>
              </span>
            )}
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-200"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center space-x-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group
                ${
                  isActive(link.path)
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }
              `}
              title={isCollapsed ? link.name : ''}
            >
              <link.icon
                className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105
                  ${isActive(link.path) ? 'text-rose-500' : 'text-slate-400 group-hover:text-slate-200'}
                `}
              />
              {!isCollapsed && <span>{link.name}</span>}
            </Link>
          ))}
        </nav>

        {/* Sidebar Footer Logged-in profile */}
        <div className="p-4 border-t border-slate-800/60 space-y-1.5">
          <Link
            to="/profile"
            onClick={() => setIsSidebarOpen(false)}
            className={`flex items-center space-x-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group
              ${
                isActive('/profile')
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }
            `}
            title={isCollapsed ? 'Profile' : ''}
          >
            <UserIcon
              className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105
                ${isActive('/profile') ? 'text-rose-500' : 'text-slate-400 group-hover:text-slate-200'}
              `}
            />
            {!isCollapsed && <span>Profile</span>}
          </Link>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-sm font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-200 group`}
            title={isCollapsed ? 'Sign Out' : ''}
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5 shrink-0 group-hover:scale-105" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* 3. Main Workspace Container */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        
        {/* Top Navbar */}
        <header className="h-16 bg-slate-900/40 backdrop-blur-md border-b border-slate-800/40 sticky top-0 z-30 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-slate-200 focus:outline-none"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:block text-slate-400 hover:text-slate-200 focus:outline-none"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold tracking-tight hidden sm:block">
              Rakthayatra Platform
            </h1>
          </div>

          {/* User Badge Details */}
          <div className="flex items-center space-x-4">
            {/* Bell notification widget */}
            <div className="relative">
              <button
                onClick={() => setIsBellOpen(!isBellOpen)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-xl relative focus:outline-none"
              >
                <BellIcon className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
              {isBellOpen && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-800/80 flex justify-between items-center bg-slate-950/20">
                    <span className="text-xs font-bold text-white font-display">Notifications ({unreadCount})</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllAsRead()}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-wider"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/40">
                    {recentNotifs.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          markAsRead(notif.id);
                          setIsBellOpen(false);
                        }}
                        className={`p-4 cursor-pointer hover:bg-slate-800/30 transition-colors text-left space-y-1 ${
                          notif.read ? 'opacity-60' : ''
                        }`}
                      >
                        <h4 className="text-xs font-bold text-slate-200 leading-snug">{notif.title}</h4>
                        <p className="text-[10px] text-slate-400 leading-normal">{notif.body}</p>
                      </div>
                    ))}
                    {recentNotifs.length === 0 && (
                      <div className="text-center py-6 text-slate-500 text-xs italic">No new alerts.</div>
                    )}
                  </div>
                  <Link
                    to="/notifications"
                    onClick={() => setIsBellOpen(false)}
                    className="block text-center py-3 bg-slate-950/40 text-xs font-bold text-slate-400 hover:text-slate-200 border-t border-slate-800/80"
                  >
                    View All Alerts
                  </Link>
                </div>
              )}
            </div>

            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-slate-200">{user?.fullName}</p>
              <p className="text-xs text-rose-500 font-bold">{user?.role}</p>
            </div>
            
            {/* User Avatar Circle */}
            <div className="w-10 h-10 bg-slate-800 border border-slate-700/80 rounded-xl flex items-center justify-center text-rose-500 font-bold text-sm select-none shadow-md shadow-slate-950/20">
              {user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Content Outlet Container */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          <Outlet />
        </main>

        {/* Platform Footer */}
        <footer className="border-t border-slate-800/40 py-4 px-6 md:px-8 bg-slate-900/10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <p>&copy; 2026 LifeLink platform. All rights reserved.</p>
            <p>Built with compliance of DPDP guidelines.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};
export default DashboardLayout;
