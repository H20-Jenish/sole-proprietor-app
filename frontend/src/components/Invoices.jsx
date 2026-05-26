import { useEffect, useState } from 'react';
import api from '../api.js';
import { 
  Plus, Trash2, Download, CheckCircle, Eye, FileText, Filter, 
  Calendar, DollarSign, Building2, Receipt, ArrowRight
} from 'lucide-react';

function formatDateOnly(value) {
  if (!value) return '—';
  const iso = String(value).slice(0, 10);
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso || '—';
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function downloadPdf(id) {
  window.open(`/api/invoices/${id}/pdf?download=1`, '_blank', 'noopener,noreferrer');
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ clientId: '', billRecruiter: false, periodStart: '', periodEnd: '' });
  const [filters, setFilters] = useState({ clientId: '', status: '', periodStart: '', periodEnd: '' });
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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
      if (filters.status) params.status = filters.status;
      if (filters.periodStart) params.periodStart = filters.periodStart;
      if (filters.endDate) params.periodEnd = filters.periodEnd;
      const r = await api.get('/invoices', { params });
      setInvoices(r.data);
    } finally {
      setLoading(false);
    }
  }

  async function create(e) {
    e.preventDefault();
    setGenerating(true);
    try {
      const payload = {
        clientId: form.clientId,
        recruiterId: form.billRecruiter ? selectedClient?.recruiterId : null,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
      };
      await api.post('/invoices', payload);
      setForm({ clientId: '', billRecruiter: false, periodStart: '', periodEnd: '' });
      load();
    } finally {
      setGenerating(false);
    }
  }

  async function markPaid(id) {
    await api.put(`/invoices/${id}/status`, { status: 'PAID' });
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this invoice?')) return;
    await api.delete(`/invoices/${id}`);
    load();
  }

  function openPdf(id) {
    setPdfUrl(`/api/invoices/${id}/pdf`);
  }

  const selectedClient = clients.find(c => String(c.id) === String(form.clientId));
  const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">Generate and manage client invoices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Invoices</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{invoices.length}</p>
        </div>
        <div className="stat-card border-amber-100">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">${totalPending.toFixed(2)}</p>
        </div>
        <div className="stat-card border-emerald-100">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Collected</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">${totalPaid.toFixed(2)}</p>
        </div>
      </div>

      <form onSubmit={create} className="form-card mb-8">
        <h3 className="font-bold text-slate-900 mb-4 text-sm">Generate New Invoice</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <select required className="premium-select" value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value, billRecruiter: false})}>
              <option value="">Select Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {selectedClient?.connectVia === 'MIDDLE_PARTY' && selectedClient?.recruiterId && (
            <label className="flex items-center gap-2.5 px-1 py-2.5 text-sm text-slate-700 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={form.billRecruiter} onChange={e => setForm({...form, billRecruiter: e.target.checked})} />
              <span>Bill Recruiter ({selectedClient?.recruiter?.name || 'linked'})</span>
            </label>
          )}
          <div>
            <input required type="date" className="premium-input" value={form.periodStart} onChange={e => setForm({...form, periodStart: e.target.value})} />
          </div>
          <div>
            <input required type="date" className="premium-input" value={form.periodEnd} onChange={e => setForm({...form, periodEnd: e.target.value})} />
          </div>
          <button disabled={generating} className="premium-btn-primary h-[42px]">
            {generating ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Plus className="w-4 h-4" /> Generate</>
            )}
          </button>
        </div>
      </form>

      <div className="filter-bar mb-6">
        <div>
          <select className="premium-select" value={filters.clientId} onChange={e => setFilters({...filters, clientId: e.target.value})}>
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <select className="premium-select" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
        <div>
          <input type="date" className="premium-input" value={filters.periodStart} onChange={e => setFilters({...filters, periodStart: e.target.value})} />
        </div>
        <div>
          <input type="date" className="premium-input" value={filters.periodEnd} onChange={e => setFilters({...filters, periodEnd: e.target.value})} />
        </div>
        <button onClick={load} className="premium-btn-secondary h-[42px]">
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      <div className="form-card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-900 text-sm">Invoice Records</h3>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{invoices.length}</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Period</th>
                <th>Payment Received</th>
                <th className="text-right">Hours</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state py-12">
                    <FileText className="w-10 h-10 mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No invoices yet</p>
                    <p className="text-xs text-slate-400 mt-1">Generate your first invoice above</p>
                  </div>
                </td></tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-bold text-slate-900">#{inv.invoiceNum}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{inv.client?.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-600">{inv.periodStart?.slice(0,10)}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300" />
                        <span className="text-slate-600">{inv.periodEnd?.slice(0,10)}</span>
                      </div>
                    </td>
                    <td className="text-slate-600">{formatDateOnly(inv.paidDate)}</td>
                    <td className="text-right font-medium">{Number(inv.totalHours).toFixed(2)}</td>
                    <td className="text-right font-bold text-slate-900">${Number(inv.total).toFixed(2)}</td>
                    <td>
                      <span className={inv.status === 'PAID' ? 'status-paid' : 'status-pending'}>
                        {inv.status === 'PAID' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openPdf(inv.id)} className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => downloadPdf(inv.id)} className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                        {inv.status !== 'PAID' && (
                          <button onClick={() => markPaid(inv.id)} className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors" title="Mark Paid">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => remove(inv.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Delete">
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

      {pdfUrl && (
        <div className="modal-overlay" onClick={() => setPdfUrl(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-slate-900">Invoice Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <a href={`${pdfUrl}?download=1`} className="premium-btn-secondary text-xs py-2 px-3">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button onClick={() => setPdfUrl(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <span className="text-sm font-medium text-slate-500">Close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <iframe src={pdfUrl} title="Invoice" className="w-full h-[70vh] rounded-lg shadow-sm bg-white" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}