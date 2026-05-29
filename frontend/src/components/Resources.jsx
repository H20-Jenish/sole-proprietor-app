import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CarFront, Calendar, Route, BellRing, Edit2, Trash2, X, Download, Plus, Car } from 'lucide-react';
import api from '../api.js';

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

function toInputDate(value) {
  return String(value || '').slice(0, 10);
}

export default function Resources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [carValuations, setCarValuations] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ clientId: '', date: '', startOdometer: '', endOdometer: '', purpose: '' });
  const [carForm, setCarForm] = useState({ carModel: '', modelYear: '', clientId: '', valuationMonth: '', totalValuation: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCar, setSavingCar] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [highlightedKey, setHighlightedKey] = useState('');
  const [isMileageModalOpen, setIsMileageModalOpen] = useState(false);
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [editingCarId, setEditingCarId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [mileageResponse, clientResponse, valuationResponse] = await Promise.all([
        api.get('/mileage'),
        api.get('/clients'),
        api.get('/car-valuations'),
      ]);
      setEntries(mileageResponse.data);
      setClients(clientResponse.data);
      setCarValuations(valuationResponse.data);
    } catch (loadError) {
      setError(loadError?.response?.data?.error || 'Failed to load mileage entries');
    } finally {
      setLoading(false);
    }
  }

  const computedMileage = useMemo(() => {
    if (form.startOdometer === '' || form.endOdometer === '') return '';
    const start = Number(form.startOdometer);
    const end = Number(form.endOdometer);
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '';
    return (end - start).toFixed(2);
  }, [form.startOdometer, form.endOdometer]);

  const pendingEntries = entries.filter((entry) => entry.startOdometer == null || entry.endOdometer == null);
  const completedEntries = entries.filter((entry) => entry.startOdometer != null && entry.endOdometer != null);
  const totalMileage = completedEntries.reduce((sum, entry) => sum + Number(entry.mileage || 0), 0);

  async function submitForm(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/mileage', {
        clientId: form.clientId,
        date: form.date,
        startOdometer: form.startOdometer,
        endOdometer: form.endOdometer,
        purpose: form.purpose,
      });
      setForm({ clientId: '', date: '', startOdometer: '', endOdometer: '', purpose: '' });
      setIsMileageModalOpen(false);
      await load();
      window.dispatchEvent(new Event('mileage-notifications-changed'));
    } catch (saveError) {
      setError(saveError?.response?.data?.error || 'Failed to save mileage entry');
    } finally {
      setSaving(false);
    }
  }

  function editEntry(entry) {
    setForm({
      clientId: String(entry.clientId),
      date: toInputDate(entry.date),
      startOdometer: entry.startOdometer == null ? '' : String(entry.startOdometer),
      endOdometer: entry.endOdometer == null ? '' : String(entry.endOdometer),
      purpose: entry.purpose || '',
    });
    setError('');
    setIsMileageModalOpen(true);
  }

  function resetForm() {
    setForm({ clientId: '', date: '', startOdometer: '', endOdometer: '', purpose: '' });
    setError('');
  }

  function resetCarForm() {
    setCarForm({ carModel: '', modelYear: '', clientId: '', valuationMonth: '', totalValuation: '' });
    setEditingCarId(null);
    setError('');
  }

  async function removeEntry(entry) {
    setError('');
    try {
      await api.delete(`/mileage/${entry.id}`);
      if (String(form.clientId) === String(entry.clientId) && form.date === toInputDate(entry.date)) {
        resetForm();
        setHighlightedKey('');
      }
      await load();
      window.dispatchEvent(new Event('mileage-notifications-changed'));
    } catch (deleteError) {
      setError(deleteError?.response?.data?.error || 'Failed to delete mileage entry');
    }
  }

  async function downloadExcel() {
    setError('');
    setDownloading(true);
    try {
      const response = await api.get('/mileage/export/xlsx', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mileage.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError?.response?.data?.error || 'Failed to download mileage Excel');
    } finally {
      setDownloading(false);
    }
  }

  async function submitCarValuation(e) {
    e.preventDefault();
    setSavingCar(true);
    setError('');
    try {
      const payload = {
        carModel: carForm.carModel,
        modelYear: Number(carForm.modelYear),
        clientId: Number(carForm.clientId),
        valuationMonth: carForm.valuationMonth,
        totalValuation: Number(carForm.totalValuation),
      };
      if (editingCarId) {
        await api.put(`/car-valuations/${editingCarId}`, payload);
      } else {
        await api.post('/car-valuations', payload);
      }
      resetCarForm();
      setIsCarModalOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError?.response?.data?.error || 'Failed to save car valuation');
    } finally {
      setSavingCar(false);
    }
  }

  function editCarValuation(valuation) {
    setCarForm({
      carModel: valuation.carModel || '',
      modelYear: valuation.modelYear == null ? '' : String(valuation.modelYear),
      clientId: valuation.clientId == null ? '' : String(valuation.clientId),
      valuationMonth: String(valuation.valuationMonth || '').slice(0, 7),
      totalValuation: valuation.totalValuation == null ? '' : String(valuation.totalValuation),
    });
    setEditingCarId(valuation.id);
    setError('');
    setIsCarModalOpen(true);
  }

  async function removeCarValuation(valuation) {
    setError('');
    try {
      await api.delete(`/car-valuations/${valuation.id}`);
      if (editingCarId === valuation.id) {
        resetCarForm();
        setIsCarModalOpen(false);
      }
      await load();
    } catch (deleteError) {
      setError(deleteError?.response?.data?.error || 'Failed to delete car valuation');
    }
  }

  useEffect(() => {
    const clientId = searchParams.get('clientId');
    const date = searchParams.get('date');
    if (!clientId || !date || entries.length === 0) return;

    const targetEntry = entries.find((entry) => String(entry.clientId) === String(clientId) && toInputDate(entry.date) === date);
    if (!targetEntry) return;

    editEntry(targetEntry);
    const targetKey = `${targetEntry.clientId}-${toInputDate(targetEntry.date)}`;
    setHighlightedKey(targetKey);

    const row = document.getElementById(`mileage-row-${targetKey}`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('clientId');
    nextParams.delete('date');
    setSearchParams(nextParams, { replace: true });
  }, [entries, searchParams, setSearchParams]);

  useEffect(() => {
    if (!highlightedKey) return undefined;
    const timeoutId = window.setTimeout(() => setHighlightedKey(''), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [highlightedKey]);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Resources</h1>
          <p className="text-sm text-slate-500 mt-1">Track mileage for commuting to work and other work-related travel</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { resetForm(); setIsMileageModalOpen(true); }} className="premium-btn-primary">
            <Plus className="w-4 h-4" /> Add Mileage
          </button>
          <button type="button" onClick={() => { resetCarForm(); setIsCarModalOpen(true); }} className="premium-btn-secondary">
            <Car className="w-4 h-4" /> Add Car Valuation
          </button>
          <button type="button" onClick={downloadExcel} disabled={downloading} className="premium-btn-secondary">
            <Download className="w-4 h-4" /> {downloading ? 'Downloading...' : 'Download Excel'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="stat-card border-amber-100">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Needs Update</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{pendingEntries.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Logged Trips</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{entries.length}</p>
        </div>
        <div className="stat-card border-emerald-100">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Mileage</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{totalMileage.toFixed(2)} km</p>
        </div>
      </div>

      {pendingEntries.length > 0 && (
        <div className="form-card border-amber-200 bg-amber-50/60">
          <div className="flex items-start gap-3">
            <BellRing className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h2 className="font-bold text-amber-900">Mileage updates needed</h2>
              <p className="text-sm text-amber-800 mt-1">Timesheet dates were added for these clients. Enter your starting odometer before commuting and your ending odometer after reaching home.</p>
            </div>
          </div>
        </div>
      )}

      {carValuations.length > 0 && (
        <div className="mb-8">
          <h3 className="font-bold text-slate-900 text-sm mb-3">Car Valuation</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {carValuations.map((valuation) => (
              <div key={valuation.id} className="form-card border-slate-200 relative group">
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => editCarValuation(valuation)}
                    className="p-1.5 rounded-md bg-white/90 border border-slate-200 text-slate-500 hover:text-slate-800"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCarValuation(valuation)}
                    className="p-1.5 rounded-md bg-white/90 border border-slate-200 text-slate-500 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{valuation.carModel}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{valuation.modelYear} · {valuation.client?.name || 'Client'}</p>
                    <p className="text-xs text-slate-400 mt-1">{String(valuation.valuationMonth).slice(0, 7)}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700">${Number(valuation.totalValuation).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="form-card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-900 text-sm">Mileage Entries</h3>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{entries.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Purpose</th>
                <th className="text-right">Start</th>
                <th className="text-right">End</th>
                <th className="text-right">Mileage</th>
                <th>Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state py-12">
                    <CarFront className="w-10 h-10 mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No mileage entries</p>
                    <p className="text-xs text-slate-400 mt-1">Timesheet entries will create reminders here automatically</p>
                  </div>
                </td></tr>
              ) : (
                [...pendingEntries, ...completedEntries].map((entry) => {
                  const pending = entry.startOdometer == null || entry.endOdometer == null;
                  return (
                    <tr
                      key={`${entry.clientId}-${entry.date}`}
                      id={`mileage-row-${entry.clientId}-${toInputDate(entry.date)}`}
                      className={highlightedKey === `${entry.clientId}-${toInputDate(entry.date)}` ? 'bg-amber-50/80' : ''}
                    >
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800">{formatDateOnly(entry.date)}</span>
                        </div>
                      </td>
                      <td className="font-semibold text-slate-900">{entry.client?.name}</td>
                      <td className="max-w-xs truncate">{entry.purpose || 'Work commute'}</td>
                      <td className="text-right">{entry.startOdometer == null ? '—' : Number(entry.startOdometer).toFixed(2)}</td>
                      <td className="text-right">{entry.endOdometer == null ? '—' : Number(entry.endOdometer).toFixed(2)}</td>
                      <td className="text-right font-semibold text-slate-900">{entry.mileage == null ? '—' : `${Number(entry.mileage).toFixed(2)} km`}</td>
                      <td>
                        <span className={pending ? 'status-pending' : 'status-paid'}>{pending ? 'Needs update' : 'Complete'}</span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => editEntry(entry)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeEntry(entry)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isMileageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="form-card w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={submitForm}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 text-base">Mileage Entry</h3>
                <button type="button" onClick={() => { setIsMileageModalOpen(false); resetForm(); }} className="premium-btn-secondary !py-1.5 !px-3 text-xs">
                  <X className="w-3.5 h-3.5" /> Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client</label>
                  <select required className="premium-select" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                    <option value="">Select Client</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
                  <input required type="date" className="premium-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Odometer</label>
                  <input type="number" step="0.01" min="0" className="premium-input" value={form.startOdometer} onChange={(e) => setForm({ ...form, startOdometer: e.target.value })} placeholder="Before commute" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Odometer</label>
                  <input type="number" step="0.01" min="0" className="premium-input" value={form.endOdometer} onChange={(e) => setForm({ ...form, endOdometer: e.target.value })} placeholder="After reaching home" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Calculated Mileage</label>
                  <div className="premium-input flex items-center text-slate-700 font-semibold min-h-[42px]">{computedMileage ? `${computedMileage} km` : 'Pending'}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Purpose</label>
                  <input className="premium-input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Commute to work or work-related travel" />
                </div>
                <button type="button" onClick={resetForm} className="premium-btn-secondary h-[42px] min-w-[110px]">
                  Reset
                </button>
                <button disabled={saving} className="premium-btn-primary h-[42px] min-w-[170px]">
                  <CarFront className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Mileage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="form-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={submitCarValuation}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 text-base">{editingCarId ? 'Edit Car Valuation' : 'Car Valuation'}</h3>
                <button type="button" onClick={() => { setIsCarModalOpen(false); resetCarForm(); }} className="premium-btn-secondary !py-1.5 !px-3 text-xs">
                  <X className="w-3.5 h-3.5" /> Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Car Model</label>
                  <input required className="premium-input" value={carForm.carModel} onChange={(e) => setCarForm({ ...carForm, carModel: e.target.value })} placeholder="e.g. Toyota Camry" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Model Year</label>
                  <input required type="number" min="1900" max="2100" className="premium-input" value={carForm.modelYear} onChange={(e) => setCarForm({ ...carForm, modelYear: e.target.value })} placeholder="e.g. 2022" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client Used For</label>
                  <select required className="premium-select" value={carForm.clientId} onChange={(e) => setCarForm({ ...carForm, clientId: e.target.value })}>
                    <option value="">Select Client</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Latest Year Month</label>
                  <input required type="month" className="premium-input" value={carForm.valuationMonth} onChange={(e) => setCarForm({ ...carForm, valuationMonth: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Total Valuation</label>
                  <input required type="number" min="0" step="0.01" className="premium-input" value={carForm.totalValuation} onChange={(e) => setCarForm({ ...carForm, totalValuation: e.target.value })} placeholder="e.g. 23500" />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={resetCarForm} className="premium-btn-secondary">
                  Reset
                </button>
                <button disabled={savingCar} className="premium-btn-primary">
                  <Car className="w-4 h-4" /> {savingCar ? 'Saving...' : (editingCarId ? 'Update Valuation' : 'Save Valuation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}