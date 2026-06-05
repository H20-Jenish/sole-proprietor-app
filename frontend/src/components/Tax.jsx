import { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import { Search, RefreshCw, Download } from 'lucide-react';

function formatDateRange(start, end) {
  if (!start || !end) return 'Unknown period';
  return `${String(start).slice(5, 10)} \u2192 ${String(end).slice(5, 10)}`;
}

function currency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function pct(value, base) {
  if (!base || base <= 0) return '0.0%';
  return `${((Number(value || 0) / base) * 100).toFixed(1)}%`;
}

function TaxTile({ label, amount, base, color }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1">{currency(amount)}</p>
      <p className="text-sm text-slate-500 mt-1">{pct(amount, base)} of gross</p>
    </div>
  );
}

function isExpenseInvoice(invoice) {
  return Array.isArray(invoice?.items) && invoice.items.some((item) => !!item.expenseId && !item.timesheetId);
}

export default function Tax() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/invoices', { params: { status: 'PAID' } })
      .then((r) => setInvoices(Array.isArray(r.data) ? r.data : []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      return (
        String(inv.invoiceNum || '').includes(q) ||
        formatDateRange(inv.periodStart, inv.periodEnd).toLowerCase().includes(q) ||
        String(inv.client?.name || '').toLowerCase().includes(q)
      );
    });
  }, [invoices, search]);

  const totals = useMemo(() => {
    return visible.reduce(
      (acc, inv) => {
        if (isExpenseInvoice(inv)) return acc;
        acc.gross      += Number(inv.amountPaid  || 0);
        acc.cpp        += Number(inv.taxCpp       || 0);
        acc.ei         += Number(inv.taxEi        || 0);
        acc.hst        += Number(inv.taxHst       || 0);
        acc.netIncome  += Number(inv.taxNetIncome || 0);
        return acc;
      },
      { gross: 0, cpp: 0, ei: 0, hst: 0, netIncome: 0 }
    );
  }, [visible]);

  function downloadInvoice(id) {
    window.open(`/api/invoices/${id}/pdf?download=1`, '_blank', 'noopener,noreferrer');
  }

  function downloadPaystatement(id) {
    window.open(`/api/invoices/${id}/paystatement?download=1`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tax</h1>
          <p className="text-sm text-slate-500 mt-1">CPP, EI, HST and net income breakdown for paid invoices.</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="stat-card border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Paid</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{currency(totals.gross)}</p>
        </div>
        <div className="stat-card border-sky-100">
          <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider">CPP Total</p>
          <p className="text-2xl font-bold text-sky-700 mt-1">{currency(totals.cpp)}</p>
        </div>
        <div className="stat-card border-indigo-100">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">EI Total</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{currency(totals.ei)}</p>
        </div>
        <div className="stat-card border-violet-100">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider">HST Total</p>
          <p className="text-2xl font-bold text-violet-700 mt-1">{currency(totals.hst)}</p>
        </div>
        <div className="stat-card border-emerald-100 sm:col-span-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Net Income</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{currency(totals.netIncome)}</p>
          <p className="text-xs text-slate-400 mt-1">{pct(totals.netIncome, totals.gross)} of gross paid</p>
        </div>
      </div>

      {/* Search / Reload bar */}
      <div className="form-card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Invoice #, period, or client"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="premium-input pl-10"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-start md:justify-end">
            <button type="button" onClick={() => setSearch('')} className="premium-btn-secondary">Clear</button>
            <button type="button" onClick={load} className="premium-btn-secondary">
              <RefreshCw className="w-4 h-4" /> Reload
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading paid invoices…</div>
      ) : visible.length === 0 ? (
        <div className="form-card py-12 text-center text-slate-500">
          No paid invoices found. Mark invoices as <strong>PAID</strong> from the Invoices page to see tax data here.
        </div>
      ) : (
        <div className="grid gap-4">
          {visible.map((invoice) => {
            const expenseInvoice = isExpenseInvoice(invoice);
            const gross = Number(invoice.amountPaid || 0);
            const cpp   = expenseInvoice ? 0 : Number(invoice.taxCpp       || 0);
            const ei    = expenseInvoice ? 0 : Number(invoice.taxEi        || 0);
            const hst   = expenseInvoice ? 0 : Number(invoice.taxHst       || 0);
            const net   = expenseInvoice ? gross : Number(invoice.taxNetIncome || 0);

            return (
              <div key={invoice.id} className="form-card border-slate-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Invoice</p>
                    <h2 className="text-lg font-bold text-slate-900">#{invoice.invoiceNum}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{invoice.client?.name}</p>
                    <p className="text-sm text-slate-500 mt-0.5">Period: {formatDateRange(invoice.periodStart, invoice.periodEnd)}</p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <div className="text-left sm:text-right">
                      <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Gross Paid</p>
                      <p className="text-2xl font-bold text-slate-900">{currency(gross)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => downloadInvoice(invoice.id)}
                        className="premium-btn-secondary !py-1.5 !px-3 text-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadPaystatement(invoice.id)}
                        disabled={!invoice.payStatementPath}
                        className="premium-btn-secondary !py-1.5 !px-3 text-xs disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" /> Paystatement
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tax tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <TaxTile label="CPP" amount={cpp} base={gross} color="bg-sky-50 border-sky-200" />
                  <TaxTile label="EI"  amount={ei}  base={gross} color="bg-indigo-50 border-indigo-200" />
                  <TaxTile label="HST" amount={hst} base={gross} color="bg-violet-50 border-violet-200" />
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs uppercase tracking-wide font-semibold text-emerald-600">Net Income</p>
                    <p className="text-xl font-bold text-emerald-800 mt-1">{currency(net)}</p>
                    <p className="text-sm text-emerald-600 mt-1">{pct(net, gross)} of gross</p>
                  </div>
                </div>

                {expenseInvoice && (
                  <p className="mt-3 text-xs text-slate-400 italic">
                    Expense invoices do not use CPP, EI, or HST.
                  </p>
                )}

                {!expenseInvoice && cpp === 0 && ei === 0 && hst === 0 && net === 0 && (
                  <p className="mt-3 text-xs text-slate-400 italic">
                    No tax data recorded. Enter CPP, EI and HST when recording payment on the Invoices page.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
