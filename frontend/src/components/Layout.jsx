import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Users, Receipt, Clock, FileText, LogOut, Menu, X,
  ChevronRight, Briefcase, Handshake, Settings, BellRing, Route, Activity
} from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../api.js';
import { clearReauthToken } from '../api.js';

function formatDateOnly(value) {
  if (!value) return '';
  const iso = String(value).slice(0, 10);
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return String(value);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/recruiters', label: 'Recruiters', icon: Handshake },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/timesheets', label: 'Timesheets', icon: Clock },
  { to: '/resources', label: 'Resources', icon: Briefcase },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/reports', label: 'Reports', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingMileage, setPendingMileage] = useState([]);

  async function loadPendingMileage() {
    try {
      const response = await api.get('/mileage');
      const pending = response.data.filter((entry) => entry.startOdometer == null || entry.endOdometer == null);
      setPendingMileage(pending);
    } catch {
      setPendingMileage([]);
    }
  }

  useEffect(() => {
    setOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!location.pathname.startsWith('/settings')) {
      clearReauthToken();
    }
  }, [location.pathname]);

  useEffect(() => {
    loadPendingMileage();

    const refreshNotifications = () => {
      loadPendingMileage();
    };

    window.addEventListener('mileage-notifications-changed', refreshNotifications);
    return () => window.removeEventListener('mileage-notifications-changed', refreshNotifications);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    nav('/login');
  };

  const openResources = (entry = null) => {
    setNotificationsOpen(false);
    if (!entry) {
      nav('/resources');
      return;
    }

    const params = new URLSearchParams({
      clientId: String(entry.clientId),
      date: String(entry.date).slice(0, 10),
    });
    nav(`/resources?${params.toString()}`);
  };

  const notificationBell = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setNotificationsOpen((value) => !value)}
        className="relative w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm flex items-center justify-center transition-all duration-200"
        title="Notifications"
      >
        <BellRing className="w-5 h-5" />
        {pendingMileage.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
            {pendingMileage.length}
          </span>
        )}
      </button>

      {notificationsOpen && (
        <div className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/80 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Notification Center</h3>
            <p className="text-xs text-slate-500 mt-0.5">Important updates and actions across the app</p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {pendingMileage.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellRing className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No notifications</p>
                <p className="text-xs text-slate-400 mt-1">New alerts and reminders will appear here automatically</p>
              </div>
            ) : (
              pendingMileage.map((entry) => (
                <button
                  key={`${entry.clientId}-${String(entry.date).slice(0, 10)}`}
                  type="button"
                  onClick={() => openResources(entry)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <Route className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{entry.client?.name || 'Client'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Mileage entry needs attention for {formatDateOnly(entry.date)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {pendingMileage.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
              <button type="button" onClick={openResources} className="premium-btn-secondary w-full justify-center !py-2">
                Review Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col md:flex-row bg-slate-50">
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">Business Manager</span>
        </div>
        <div className="flex items-center gap-2">
          {notificationBell}
          <button onClick={() => setOpen(!open)} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <aside className={`fixed md:static inset-y-0 left-0 z-30 bg-slate-900 text-white w-64 md:h-full flex-shrink-0 flex flex-col transform transition-transform duration-300 ease-out md:transform-none ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800/60">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold tracking-tight leading-tight truncate">{user?.businessName || 'My Business'}</h2>
                <p className="text-[11px] text-slate-400 mt-1 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}>
              {({ isActive }) => (
                <div className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}>
                  <l.icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                  <span className="flex-1">{l.label}</span>
                  <ChevronRight className={`w-4 h-4 transition-all duration-200 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0'}`} />
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800/60">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all duration-200">
            <LogOut className="w-[18px] h-[18px]" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-slate-900/50 z-20 md:hidden" onClick={() => setOpen(false)} />}

      <div className="hidden md:block fixed top-5 right-6 z-40">
        {notificationBell}
      </div>

      <main className="flex-1 min-w-0 pt-14 md:pt-0 h-full overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}