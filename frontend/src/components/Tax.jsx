import { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import { Search, RefreshCw, PencilLine, ChevronUp, ChevronDown, Download } from 'lucide-react';

function formatDateRange(start, end) {
  if (!start || !end) return 'Unknown period';
  return `${String(start).slice(5, 10)} -> ${String(end).slice(5, 10)}`;
}

function safeNumber(value) {
  const parsed = parseFloat(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function Tax() {
  const [invoices, setInvoices] = useState([]);
  const [filters, setFilters] = useState({ search: '' });
  const [inputs, setInputs] = useState({});
  const [editOpen, setEditOpen] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem('taxPageInputs');
    if (!saved) return;
    try {
      setInputs(JSON.parse(saved));
    } catch {
      setInputs({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('taxPageInputs', JSON.stringify(inputs));
  }, [inputs]);

  useEffect(() => {
    setLoading(true);
    api.get('/invoices', { params: { status: 'PAID' } })
      .then((r) => {
        setInvoices(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, []);

  const visibleInvoices = useMemo(() => {
    const search = String(filters.search || '').trim().toLowerCase();
    if (!search) return invoices;

    return invoices.filter((inv) => {
      const invoiceNum = String(inv.invoiceNum || '').toLowerCase();
      const period = formatDateRange(inv.periodStart, inv.periodEnd).toLowerCase();
      const client = String(inv.client?.name || '').toLowerCase();
      return invoiceNum.includes(search) || period.includes(search) || client.includes(search);
    });
  }, [filters.search, invoices]);

  function updateInput(invoiceId, field, value) {
    setInputs((prev) => ({
      ...prev,
      [invoiceId]: {
        ...prev[invoiceId],
        [field]: value,
      },
    }));
  }

  function resetInputs(invoiceId) {
    setInputs((prev) => {
      const next = { ...prev };
      delete next[invoiceId];
      return next;
    });
  }

  function toggleEdit(invoiceId) {
    setEditOpen((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  }

  function downloadInvoice(invoiceId) {
    window.open(`/api/invoices/${invoiceId}/pdf?download=1`, '_blank', 'noopener,noreferrer');
  }

  function downloadPaystatement(invoiceId) {
    window.open(`/api/invoices/${invoiceId}/paystatement?download=1`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tax</h1>
          <p className="text-sm text-slate-500 mt-1">Manage paid invoice tax allocations and split percentages.</p>
        </div>
      </div>

      <div className="form-card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Search Paid Invoices</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search invoice #, period, or client"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="premium-input pl-10"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-start md:justify-end">
            <button
              type="button"
              onClick={() => setFilters({ search: '' })}
              className="premium-btn-secondary"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="premium-btn-secondary"
            >
              <RefreshCw className="w-4 h-4" /> Reload
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading paid invoices...</div>
      ) : visibleInvoices.length === 0 ? (
        <div className="form-card py-12 text-center text-slate-500">
          No paid invoices found. Only invoices with status <strong>PAID</strong> appear here.
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleInvoices.map((invoice) => {
            const state = inputs[invoice.id] || {};
            const ei = safeNumber(state.ei);
            const cpp = safeNumber(state.cpp);
            const hst = safeNumber(state.hst);
            const total = Number(invoice.total || 0);
            const splitTotal = ei + cpp + hst;
            const isEditing = !!editOpen[invoice.id];
            const formatPct = (value) => (total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '0%');

            return (
              <div key={invoice.id} className="form-card border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Invoice</p>
                    <h2 className="text-lg font-bold text-slate-900">#{invoice.invoiceNum}</h2>
                    <p className="text-sm text-slate-600 mt-1">Period: {formatDateRange(invoice.periodStart, invoice.periodEnd)}</p>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-3">
                    <div className="text-left sm:text-right">
                      <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Invoice Total</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">${total.toFixed(2)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
                      <button
                        type="button"
                        onClick={() => downloadInvoice(invoice.id)}
                        className="premium-btn-secondary !py-2 !px-3"
                      >
                        <Download className="w-4 h-4" /> Invoice
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadPaystatement(invoice.id)}
                        className="premium-btn-secondary !py-2 !px-3"
                        disabled={!invoice.payStatementPath}
                      >
                        <Download className="w-4 h-4" /> Paystatement
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleEdit(invoice.id)}
                        className="premium-btn-primary !py-2 !px-3"
                      >
                        <PencilLine className="w-4 h-4" /> {isEditing ? 'Close' : 'Edit'}
                        {isEditing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {isEditing ? (
                  <>
                    <div className="grid gap-4 lg:grid-cols-3">
                      {[
                        { key: 'cpp', label: 'CPP', value: cpp },
                        { key: 'ei', label: 'EI', value: ei },
                        { key: 'hst', label: 'HST', value: hst },
                      ].map((field) => (
                        <div key={field.key} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</span>
                            <span className="text-xs font-semibold text-slate-500">{formatPct(field.value)}</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={String(field.value || '')}
                            onChange={(e) => updateInput(invoice.id, field.key, e.target.value)}
                            className="premium-input w-full"
                            placeholder="0.00"
                          />
                          <div className="mt-2 text-xs text-slate-500">
                            ${field.value.toFixed(2)} of ${total.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-slate-700">Split total</p>
                          <p className="text-xl font-semibold text-slate-900">${splitTotal.toFixed(2)}</p>
                        </div>
                        <div className="text-sm text-slate-500">
                          {splitTotal > total ? (
                            <span className="text-amber-600">This split exceeds invoice total by ${(splitTotal - total).toFixed(2)}</span>
                          ) : (
                            <span>{(total - splitTotal).toFixed(2)} remaining</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => resetInputs(invoice.id)}
                        className="premium-btn-secondary"
                      >
                        Reset Inputs
                      </button>
                      <div className="text-sm text-slate-500">
                        Enter CPP, EI and HST values to calculate how this invoice is split.
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'CPP', value: cpp },
                      { label: 'EI', value: ei },
                      { label: 'HST', value: hst },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">{item.label}</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">${item.value.toFixed(2)}</p>
                        <p className="text-sm text-slate-500 mt-1">{formatPct(item.value)} of invoice</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
