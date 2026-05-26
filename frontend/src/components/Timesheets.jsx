import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { Plus, Trash2, Search, Clock, Calendar, MapPin, Filter, Timer, Download, Edit2, X, BellRing } from 'lucide-react';

function formatDateOnly(value) {
  if (!value) return '';
  const iso = String(value).slice(0, 10);
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDayOfWeek(value) {
  if (!value) return '';
  const iso = String(value).slice(0, 10);
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
}

export default function Timesheets() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ clientId: '', location: '', date: '', startTime: '', endTime: '' });
  const [filters, setFilters] = useState({ clientId: '', startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true);
  const [mileageNotice, setMileageNotice] = useState('');
  const [mileageTarget, setMileageTarget] = useState(null);

  useEffect(() => { loadClients(); load(); }, []);

  async function loadClients() {
    const r = await api.get('/clients');
    setClients(r.data);
  }

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filters.clientId) params.clientId = filters.clientId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const r = await api.get('/timesheets', { params });
      setRows(r.data);
    } finally {
      setLoading(false);
    }
  }

  async function add(e) {
    e.preventDefault();
    const target = { clientId: form.clientId, date: form.date };
    const response = form.id ? await api.put(`/timesheets/${form.id}`, form) : await api.post('/timesheets', form);
    if (response.data?.mileageReminderNeeded) {
      const clientName = clients.find((client) => String(client.id) === String(form.clientId))?.name || 'this client';
      setMileageNotice(`Mileage entry created for ${clientName} on ${formatDateOnly(form.date)}. Update the odometer values in Resources.`);
      setMileageTarget(target);
      window.dispatchEvent(new Event('mileage-notifications-changed'));
    } else {
      setMileageNotice('');
      setMileageTarget(null);
      window.dispatchEvent(new Event('mileage-notifications-changed'));
    }
    setForm({ clientId: '', location: '', date: '', startTime: '', endTime: '' });
    load();
  }

  function startEdit(row) {
    setForm({
      id: row.id,
      clientId: String(row.clientId),
      location: row.location || '',
      date: String(row.date).slice(0, 10),
      startTime: row.startTime || '',
      endTime: row.endTime || '',
    });
  }

  async function remove(id) {
    if (!confirm('Delete this timesheet entry?')) return;
    await api.delete(`/timesheets/${id}`);
    load();
  }

  async function downloadExcel() {
    const params = new URLSearchParams();
    if (filters.clientId) params.set('clientId', filters.clientId);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    window.open(`/api/timesheets/export?${params.toString()}`, '_blank');
  }

  const totalHours = rows.reduce((s, r) => s + Number(r.totalHours), 0);
  const selectedClient = clients.find(c => String(c.id) === String(form.clientId));
  const siteShortNames = Array.isArray(selectedClient?.siteLocations)
    ? selectedClient.siteLocations.map((s) => s?.shortName).filter(Boolean)
    : [];
  const locationOptions = (siteShortNames.length
    ? siteShortNames
    : [selectedClient?.mainLocation, ...((selectedClient?.locations || []).filter(Boolean))]
  ).filter((value, index, self) => value && self.indexOf(value) === index);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Timesheets</h1>
          <p className="text-sm text-slate-500 mt-1">Log and review your billable hours</p>
        </div>
      </div>

      {mileageNotice && (
        <div className="form-card border-amber-200 bg-amber-50/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <BellRing className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h2 className="font-bold text-amber-900">Mileage reminder</h2>
                <p className="text-sm text-amber-800 mt-1">{mileageNotice}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!mileageTarget?.clientId || !mileageTarget?.date) {
                  navigate('/resources');
                  return;
                }
                navigate(`/resources?clientId=${encodeURIComponent(mileageTarget.clientId)}&date=${encodeURIComponent(mileageTarget.date)}`);
              }}
              className="premium-btn-secondary !py-2 !px-3 text-xs whitespace-nowrap"
            >
              Update Mileage
            </button>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client</label>
          <select className="premium-select" value={filters.clientId} onChange={e => setFilters({...filters, clientId: e.target.value})}>
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">From</label>
          <input type="date" className="premium-input" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">To</label>
          <input type="date" className="premium-input" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
        </div>
        <button onClick={load} className="premium-btn-secondary h-[42px]">
          <Filter className="w-4 h-4" /> Apply
        </button>
      </div>

      <form onSubmit={add} className="form-card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm">{form.id ? 'Edit Time Entry' : 'Log Time Entry'}</h3>
          {form.id && (
            <button type="button" onClick={() => setForm({ clientId: '', location: '', date: '', startTime: '', endTime: '' })} className="premium-btn-secondary !py-1.5 !px-3 text-xs">
              <X className="w-3.5 h-3.5" /> Cancel Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <select required className="premium-select" value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}>
              <option value="">Select Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <input
              required
              list="client-sites"
              placeholder="Location / Site"
              className="premium-input"
              value={form.location}
              onChange={e => setForm({...form, location: e.target.value})}
            />
            <datalist id="client-sites">
              {locationOptions.map(site => <option key={site} value={site} />)}
            </datalist>
          </div>
          <div>
            <input required type="date" className="premium-input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input required type="time" className="premium-input pl-9" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
            </div>
          </div>
          <div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input required type="time" className="premium-input pl-9" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
            </div>
          </div>
          <button className="premium-btn-primary h-[42px]">
            {form.id ? <><Edit2 className="w-4 h-4" /> Update Entry</> : <><Plus className="w-4 h-4" /> Log Entry</>}
          </button>
        </div>
      </form>

      <div className="form-card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-900 text-sm">Time Entries</h3>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{rows.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={downloadExcel} className="premium-btn-secondary !py-2 !px-3 text-xs">
              <Download className="w-3.5 h-3.5" /> Download Excel
            </button>
            <div className="text-sm font-semibold text-slate-700">
              Total: <span className="text-slate-900">{totalHours.toFixed(2)} hrs</span>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="premium-table timesheet-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Client</th>
                <th>Location</th>
                <th>Start</th>
                <th>End</th>
                <th className="text-right">Hours</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state py-12">
                    <Clock className="w-10 h-10 mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No timesheet entries</p>
                    <p className="text-xs text-slate-400 mt-1">Log your first entry above</p>
                  </div>
                </td></tr>
              ) : (
                rows.map(r => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800">{formatDateOnly(r.date)}</span>
                      </div>
                    </td>
                    <td className="text-slate-600 font-medium">{formatDayOfWeek(r.date)}</td>
                    <td className="font-semibold text-slate-900">{r.client?.name}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-800">{r.location}</span>
                      </div>
                    </td>
                    <td className="font-mono text-sm text-slate-800">{r.startTime}</td>
                    <td className="font-mono text-sm text-slate-800">{r.endTime}</td>
                    <td className="text-right font-bold text-slate-900 text-base">{Number(r.totalHours).toFixed(2)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(r)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(r.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}