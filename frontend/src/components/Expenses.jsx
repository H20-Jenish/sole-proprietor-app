import { useEffect, useState } from 'react';
import api from '../api.js';
import { Plus, Trash2, Search, Download, Eye, Receipt, Filter, Calendar, DollarSign, Image, Edit2, X } from 'lucide-react';
import FileViewer from './FileViewer';

function getReceiptMeta(receiptPath, clientId) {
  if (!receiptPath || !clientId) return null;
  const filename = String(receiptPath).split('/').pop() || 'receipt';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeByExt = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  const mime = mimeByExt[ext] || 'application/octet-stream';
  return {
    filename,
    mime,
    url: `/api/files/${clientId}/${filename}`,
  };
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ clientId: '', date: '', amount: '', desc: '', receipt: null });
  const [filters, setFilters] = useState({ clientId: '', startDate: '', endDate: '' });
  const [viewer, setViewer] = useState(null);
  const [loading, setLoading] = useState(true);

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
      const r = await api.get('/expenses', { params });
      setExpenses(r.data);
    } finally {
      setLoading(false);
    }
  }

  async function add(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append('clientId', form.clientId);
    fd.append('date', form.date);
    fd.append('amount', form.amount);
    fd.append('desc', form.desc);
    if (form.receipt) fd.append('receipt', form.receipt);
    if (form.id) {
      await api.put(`/expenses/${form.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    } else {
      await api.post('/expenses', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    setForm({ clientId: '', date: '', amount: '', desc: '', receipt: null });
    load();
  }

  function startEdit(x) {
    setForm({
      id: x.id,
      clientId: String(x.clientId),
      date: String(x.dateTime).slice(0, 10),
      amount: String(x.amount),
      desc: x.desc || '',
      receipt: null,
    });
  }

  async function remove(id) {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    load();
  }

  async function exportXLSX() {
    const params = {};
    if (filters.clientId) params.clientId = filters.clientId;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    const r = await api.get('/expenses/export', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.xlsx';
    a.click();
  }

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track and manage business expenses</p>
        </div>
        <button onClick={exportXLSX} className="premium-btn-success">
          <Download className="w-4 h-4" /> Export XLSX
        </button>
      </div>

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
          <Filter className="w-4 h-4" /> Apply Filters
        </button>
      </div>

      <form onSubmit={add} className="form-card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm">{form.id ? 'Edit Expense' : 'Log New Expense'}</h3>
          {form.id && (
            <button type="button" onClick={() => setForm({ clientId: '', date: '', amount: '', desc: '', receipt: null })} className="premium-btn-secondary !py-1.5 !px-3 text-xs">
              <X className="w-3.5 h-3.5" /> Cancel Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-1">
            <select required className="premium-select" value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}>
              <option value="">Select Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <input required type="date" className="premium-input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <div className="md:col-span-1">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input required type="number" step="0.01" placeholder="0.00" className="premium-input pl-9" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
            </div>
          </div>
          <div className="md:col-span-2">
            <input required placeholder="What was this expense for?" className="premium-input" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
          </div>
          <div className="md:col-span-1">
            <label className="premium-btn-secondary w-full cursor-pointer">
              <Image className="w-4 h-4" /> 
              <span className="text-xs">{form.receipt ? '1 file' : 'Receipt'}</span>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setForm({...form, receipt: e.target.files[0]})} />
            </label>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="premium-btn-primary">
            {form.id ? <><Edit2 className="w-4 h-4" /> Update Expense</> : <><Plus className="w-4 h-4" /> Add Expense</>}
          </button>
        </div>
      </form>

      <div className="form-card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-900 text-sm">Expense Records</h3>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{expenses.length}</span>
          </div>
          <div className="text-sm font-semibold text-slate-700">
            Total: <span className="text-slate-900">${totalAmount.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Description</th>
                <th className="text-right">Amount</th>
                <th>Receipt</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state py-12">
                    <Receipt className="w-10 h-10 mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No expenses found</p>
                    <p className="text-xs text-slate-400 mt-1">Add your first expense above</p>
                  </div>
                </td></tr>
              ) : (
                expenses.map(x => (
                  <tr key={x.id}>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(x.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-medium text-slate-900">{x.client?.name}</span>
                    </td>
                    <td className="max-w-xs truncate">{x.desc}</td>
                    <td className="text-right font-semibold text-slate-900">${Number(x.amount).toFixed(2)}</td>
                    <td>
                      {x.receiptImagePath ? (
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          <button
                            onClick={() => {
                              const file = getReceiptMeta(x.receiptImagePath, x.clientId);
                              if (!file) return;
                              setViewer(file);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <span className="text-slate-300">|</span>
                          <a
                            href={`${getReceiptMeta(x.receiptImagePath, x.clientId)?.url}?download=1`}
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(x)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(x.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Delete">
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

      {viewer && <FileViewer {...viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}