import { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import {
  BarChart3,
  DollarSign,
  Receipt,
  Clock3,
  Wallet,
  TrendingUp,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

function toDateOnly(value) {
  return String(value || '').slice(0, 10);
}

function inRange(dateValue, startDate, endDate) {
  const d = toDateOnly(dateValue);
  if (!d) return false;
  if (startDate && d < startDate) return false;
  if (endDate && d > endDate) return false;
  return true;
}

function monthKey(dateValue) {
  const d = new Date(String(dateValue));
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key) {
  const [year, month] = String(key || '').split('-').map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

function currency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function StatCard({ title, value, subtitle, icon: Icon, tone }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className={`stat-icon ${tone}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
        {subtitle ? <p className="text-xs text-slate-400 mt-1">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export default function Reports() {
  const [filters, setFilters] = useState({ clientId: '', startDate: '', endDate: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [mileage, setMileage] = useState([]);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadClients() {
    const r = await api.get('/clients');
    setClients(r.data || []);
  }

  async function loadData(activeFilters = filters) {
    setLoading(true);
    try {
      const invoiceParams = {};
      if (activeFilters.clientId) invoiceParams.clientId = activeFilters.clientId;
      if (activeFilters.startDate) invoiceParams.periodStart = activeFilters.startDate;
      if (activeFilters.endDate) invoiceParams.periodEnd = activeFilters.endDate;

      const rowParams = {};
      if (activeFilters.clientId) rowParams.clientId = activeFilters.clientId;
      if (activeFilters.startDate) rowParams.startDate = activeFilters.startDate;
      if (activeFilters.endDate) rowParams.endDate = activeFilters.endDate;

      const mileageParams = {};
      if (activeFilters.clientId) mileageParams.clientId = activeFilters.clientId;

      const [i, e, t, m] = await Promise.all([
        api.get('/invoices', { params: invoiceParams }),
        api.get('/expenses', { params: rowParams }),
        api.get('/timesheets', { params: rowParams }),
        api.get('/mileage', { params: mileageParams }),
      ]);

      const mileageRows = Array.isArray(m.data) ? m.data : [];
      const mileageFiltered = mileageRows.filter((x) => inRange(x.date, activeFilters.startDate, activeFilters.endDate));

      setInvoices(Array.isArray(i.data) ? i.data : []);
      setExpenses(Array.isArray(e.data) ? e.data : []);
      setTimesheets(Array.isArray(t.data) ? t.data : []);
      setMileage(mileageFiltered);
    } finally {
      setLoading(false);
    }
  }

  const analytics = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, x) => sum + Number(x.total || 0), 0);
    const totalCollected = invoices.reduce((sum, x) => sum + Number(x.amountPaid || 0), 0);
    const outstanding = invoices.reduce((sum, x) => {
      const balance = Number(x.total || 0) - Number(x.amountPaid || 0);
      return sum + Math.max(0, balance);
    }, 0);

    const totalExpenses = expenses.reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const totalHours = timesheets.reduce((sum, x) => sum + Number(x.totalHours || 0), 0);
    const totalMileage = mileage.reduce((sum, x) => sum + Number(x.mileage || 0), 0);

    const statusCounts = {
      PENDING: invoices.filter((x) => x.status === 'PENDING').length,
      PARTIAL: invoices.filter((x) => x.status === 'PARTIAL').length,
      PAID: invoices.filter((x) => x.status === 'PAID').length,
    };

    const monthMap = new Map();
    for (const inv of invoices) {
      const key = monthKey(inv.createdDate || inv.periodStart);
      if (!key) continue;
      const current = monthMap.get(key) || { key, invoiced: 0, collected: 0 };
      current.invoiced += Number(inv.total || 0);
      current.collected += Number(inv.amountPaid || 0);
      monthMap.set(key, current);
    }

    const monthlyTrend = Array.from(monthMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6)
      .map((x) => ({
        ...x,
        label: monthLabel(x.key),
        invoiced: Number(x.invoiced.toFixed(2)),
        collected: Number(x.collected.toFixed(2)),
      }));

    const clientMap = new Map();
    for (const inv of invoices) {
      const cid = inv.clientId;
      const name = inv.client?.name || `Client ${cid}`;
      if (!clientMap.has(cid)) {
        clientMap.set(cid, {
          clientId: cid,
          name,
          invoiced: 0,
          collected: 0,
          outstanding: 0,
          hours: 0,
          expenses: 0,
        });
      }
      const row = clientMap.get(cid);
      row.invoiced += Number(inv.total || 0);
      row.collected += Number(inv.amountPaid || 0);
      row.outstanding += Math.max(0, Number(inv.total || 0) - Number(inv.amountPaid || 0));
    }

    for (const ex of expenses) {
      const cid = ex.clientId;
      const name = ex.client?.name || `Client ${cid}`;
      if (!clientMap.has(cid)) {
        clientMap.set(cid, { clientId: cid, name, invoiced: 0, collected: 0, outstanding: 0, hours: 0, expenses: 0 });
      }
      clientMap.get(cid).expenses += Number(ex.amount || 0);
    }

    for (const ts of timesheets) {
      const cid = ts.clientId;
      const name = ts.client?.name || `Client ${cid}`;
      if (!clientMap.has(cid)) {
        clientMap.set(cid, { clientId: cid, name, invoiced: 0, collected: 0, outstanding: 0, hours: 0, expenses: 0 });
      }
      clientMap.get(cid).hours += Number(ts.totalHours || 0);
    }

    const clientRows = Array.from(clientMap.values())
      .map((x) => ({
        ...x,
        invoiced: Number(x.invoiced.toFixed(2)),
        collected: Number(x.collected.toFixed(2)),
        outstanding: Number(x.outstanding.toFixed(2)),
        hours: Number(x.hours.toFixed(2)),
        expenses: Number(x.expenses.toFixed(2)),
      }))
      .sort((a, b) => b.invoiced - a.invoiced);

    const topRevenueClients = clientRows.slice(0, 5).map((x) => ({ name: x.name, value: x.invoiced }));

    const avgHourlyYield = totalHours > 0 ? totalInvoiced / totalHours : 0;

    return {
      totalInvoiced,
      totalCollected,
      outstanding,
      totalExpenses,
      totalHours,
      totalMileage,
      statusCounts,
      monthlyTrend,
      clientRows,
      topRevenueClients,
      avgHourlyYield,
    };
  }, [invoices, expenses, timesheets, mileage]);

  const statusPie = [
    { name: 'Pending', value: analytics.statusCounts.PENDING, color: '#f59e0b' },
    { name: 'Partial', value: analytics.statusCounts.PARTIAL, color: '#8b5cf6' },
    { name: 'Paid', value: analytics.statusCounts.PAID, color: '#10b981' },
  ].filter((x) => x.value > 0);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Business performance snapshots powered by your invoices, expenses, timesheets, and mileage.</p>
        </div>
      </div>

      <div className="form-card py-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-700 font-semibold">
            <Filter className="w-4 h-4 text-slate-500" /> Filters
          </div>
          <button onClick={() => setShowFilters((v) => !v)} className="premium-btn-secondary !py-1.5 !px-3 text-xs">
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
        {showFilters && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client</label>
              <select className="premium-select" value={filters.clientId} onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}>
                <option value="">All Clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">From</label>
              <input type="date" className="premium-input" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">To</label>
              <input type="date" className="premium-input" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadData} className="premium-btn-secondary h-[42px] flex-1">
                <Filter className="w-4 h-4" /> Apply
              </button>
              <button
                onClick={() => {
                  const next = { clientId: '', startDate: '', endDate: '' };
                  setFilters(next);
                  loadData(next);
                }}
                className="premium-btn-secondary h-[42px]"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard title="Invoiced" value={currency(analytics.totalInvoiced)} subtitle={`${invoices.length} invoices`} icon={DollarSign} tone="bg-gradient-to-br from-indigo-500 to-violet-600" />
        <StatCard title="Collected" value={currency(analytics.totalCollected)} subtitle="Amount paid so far" icon={Wallet} tone="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <StatCard title="Outstanding" value={currency(analytics.outstanding)} subtitle="Remaining balances" icon={TrendingUp} tone="bg-gradient-to-br from-amber-500 to-orange-600" />
        <StatCard title="Expenses" value={currency(analytics.totalExpenses)} subtitle={`${expenses.length} expense entries`} icon={Receipt} tone="bg-gradient-to-br from-rose-500 to-red-600" />
        <StatCard title="Hours Logged" value={analytics.totalHours.toFixed(2)} subtitle={`Avg yield ${currency(analytics.avgHourlyYield)}/hr`} icon={Clock3} tone="bg-gradient-to-br from-sky-500 to-blue-600" />
        <StatCard title="Mileage" value={`${analytics.totalMileage.toFixed(1)} km`} subtitle={`${mileage.length} mileage rows`} icon={BarChart3} tone="bg-gradient-to-br from-cyan-500 to-indigo-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 form-card">
          <div className="mb-4">
            <h3 className="font-bold text-slate-900 text-sm">Monthly Invoiced vs Collected</h3>
            <p className="text-xs text-slate-500 mt-1">Latest 6 months based on invoice creation and payment records.</p>
          </div>
          <div className="h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">Loading chart...</div>
            ) : analytics.monthlyTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">No data for selected filters.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthlyTrend} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip formatter={(value) => currency(value)} />
                  <Bar dataKey="invoiced" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="collected" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="form-card">
          <div className="mb-4">
            <h3 className="font-bold text-slate-900 text-sm">Invoice Status Mix</h3>
            <p className="text-xs text-slate-500 mt-1">Count of pending, partial, and paid invoices.</p>
          </div>
          <div className="h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">Loading chart...</div>
            ) : statusPie.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">No invoices for selected filters.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={92} innerRadius={56}>
                    {statusPie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs mt-2">
            {statusPie.map((entry) => (
              <div key={entry.name} className="rounded-lg border border-slate-200 px-2 py-1.5 text-center">
                <p className="font-semibold" style={{ color: entry.color }}>{entry.name}</p>
                <p className="text-slate-600 mt-0.5">{entry.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="form-card overflow-hidden p-0 mb-6">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Client Performance</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{analytics.clientRows.length} clients</span>
        </div>
        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Client</th>
                <th className="text-right">Invoiced</th>
                <th className="text-right">Collected</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Hours</th>
                <th className="text-right">Expenses</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading...</td></tr>
              ) : analytics.clientRows.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">No report data for selected filters.</td></tr>
              ) : (
                analytics.clientRows.map((row) => (
                  <tr key={row.clientId}>
                    <td className="font-medium text-slate-900">{row.name}</td>
                    <td className="text-right">{currency(row.invoiced)}</td>
                    <td className="text-right">{currency(row.collected)}</td>
                    <td className="text-right">{currency(row.outstanding)}</td>
                    <td className="text-right">{row.hours.toFixed(2)}</td>
                    <td className="text-right">{currency(row.expenses)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="form-card">
        <div className="mb-4">
          <h3 className="font-bold text-slate-900 text-sm">Top 5 Clients by Invoiced Amount</h3>
          <p className="text-xs text-slate-500 mt-1">Quick ranking to show where most billed revenue comes from.</p>
        </div>
        <div className="h-72">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">Loading chart...</div>
          ) : analytics.topRevenueClients.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">No data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.topRevenueClients} layout="vertical" margin={{ top: 8, right: 10, left: 20, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={180} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                <Tooltip formatter={(value) => currency(value)} />
                <Bar dataKey="value" fill="#0ea5e9" radius={[0, 6, 6, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
