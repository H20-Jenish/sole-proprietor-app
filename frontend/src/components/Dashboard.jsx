import { useEffect, useState } from 'react';
import api from '../api.js';
import { 
  Users, Receipt, Clock, FileText, TrendingUp, DollarSign, 
  ArrowUpRight, ArrowDownRight, Activity, Route
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({ clients: 0, expenses: 0, hours: 0, invoices: 0, pendingTotal: 0, paidTotal: 0, totalMileage: 0 });
  const [daily, setDaily] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [c, e, t, i, m] = await Promise.all([
        api.get('/clients'),
        api.get('/expenses'),
        api.get('/timesheets'),
        api.get('/invoices'),
        api.get('/mileage'),
      ]);
      
      const clients = c.data.length;
      const expenses = e.data.reduce((s, x) => s + Number(x.amount), 0);
      const hours = t.data.reduce((s, x) => s + Number(x.totalHours), 0);
      const invoices = i.data.length;
      const pendingTotal = i.data.filter(x => x.status === 'PENDING').reduce((s, x) => s + Number(x.total), 0);
      const paidTotal = i.data.filter(x => x.status === 'PAID').reduce((s, x) => s + Number(x.total), 0);
      const totalMileage = m.data.reduce((s, x) => s + Number(x.mileage || 0), 0);

      const map = {};
      t.data.forEach(x => {
        const key = x.date.slice(0, 10);
        map[key] = (map[key] || 0) + Number(x.totalHours);
      });
      const chart = Object.entries(map).sort().slice(-14).map(([k, v]) => ({
        date: k,
        hours: parseFloat(v.toFixed(1)),
        label: new Date(`${k}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));

      const activity = [
        ...i.data.slice(0, 3).map(x => ({ 
          type: 'invoice', 
          text: `Invoice #${x.invoiceNum} ${x.status === 'PAID' ? 'paid' : 'created'}`, 
          date: x.createdDate,
          status: x.status 
        })),
        ...e.data.slice(0, 3).map(x => ({ 
          type: 'expense', 
          text: `Expense $${Number(x.amount).toFixed(2)} for ${x.client?.name}`, 
          date: x.dateTime 
        })),
        ...t.data.slice(0, 3).map(x => ({
          type: 'timesheet',
          text: `Timesheet ${Number(x.totalHours).toFixed(2)} hrs for ${x.client?.name || 'Client'}${x.location ? ` at ${x.location}` : ''}`,
          date: x.createdAt || x.date,
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

      setStats({ clients, expenses, hours, invoices, pendingTotal, paidTotal, totalMileage });
      setDaily(chart);
      setRecentActivity(activity);
    } finally {
      setLoading(false);
    }
  }

  const StatCard = ({ title, value, subtext, icon: Icon, color, trend }) => (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <div className={`stat-icon ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Overview of your business at a glance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard title="Active Clients" value={stats.clients} icon={Users} color="bg-gradient-to-br from-blue-500 to-blue-600" subtext="Total registered clients" />
        <StatCard title="Total Expenses" value={`$${stats.expenses.toFixed(2)}`} icon={Receipt} color="bg-gradient-to-br from-rose-500 to-red-600" subtext="All time expenses" />
        <StatCard title="Hours Logged" value={stats.hours.toFixed(1)} icon={Clock} color="bg-gradient-to-br from-indigo-500 to-violet-600" subtext={`≈ ${(stats.hours / 8).toFixed(1)} work days`} />
        <StatCard title="Total Mileage" value={`${stats.totalMileage.toFixed(1)} km`} icon={Route} color="bg-gradient-to-br from-cyan-500 to-blue-600" subtext="Logged from resources" />
        <StatCard title="Invoices" value={stats.invoices} icon={FileText} color="bg-gradient-to-br from-emerald-500 to-teal-600" subtext="Generated invoices" />
        <StatCard title="Pending Revenue" value={`$${stats.pendingTotal.toFixed(2)}`} icon={TrendingUp} color="bg-gradient-to-br from-amber-500 to-orange-600" subtext="Awaiting payment" />
        <StatCard title="Paid Revenue" value={`$${stats.paidTotal.toFixed(2)}`} icon={DollarSign} color="bg-gradient-to-br from-green-500 to-emerald-600" subtext="Collected payments" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 form-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-slate-900">Daily Hours</h2>
              <p className="text-xs text-slate-500 mt-0.5">Timesheet hours for the latest 14 days with entries</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Activity className="w-3.5 h-3.5" />
              <span>Live data</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Bar dataKey="hours" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="form-card">
          <h2 className="font-bold text-slate-900 mb-1">Recent Activity</h2>
          <p className="text-xs text-slate-500 mb-5">Latest transactions and updates</p>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <div className="empty-state py-8">
                <Activity className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              recentActivity.map((act, i) => (
                <div key={i} className="flex items-start gap-3 group">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${act.type === 'invoice' ? (act.status === 'PAID' ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 font-medium truncate">{act.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(act.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}