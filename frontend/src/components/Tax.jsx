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

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function splitPaidGrossAndHst(invoice) {
  const paidTotal = Number(invoice?.amountPaid || 0);
  if (!Number.isFinite(paidTotal) || paidTotal <= 0) return { total: 0, gross: 0, hst: 0 };

  const invoiceTotal = Number(invoice?.total || 0);
  const invoiceHst = Number(invoice?.hst13pct || 0);

  let hst = 0;
  if (Number.isFinite(invoiceTotal) && invoiceTotal > 0 && Number.isFinite(invoiceHst) && invoiceHst > 0) {
    const paidRatio = Math.min(1, Math.max(0, paidTotal / invoiceTotal));
    hst = roundMoney(invoiceHst * paidRatio);
  } else {
    // Fallback for legacy rows that may not have hst13pct populated.
    hst = roundMoney(paidTotal * 0.13);
  }

  hst = Math.min(hst, roundMoney(paidTotal));
  const gross = roundMoney(Math.max(0, paidTotal - hst));
  return { total: roundMoney(paidTotal), gross, hst };
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
        const paidTotal = Number(inv.amountPaid || 0);
        const { gross, hst } = splitPaidGrossAndHst(inv);
        const cpp = Number(inv.taxCpp || 0);
        const ei = Number(inv.taxEi || 0);
        acc.totalPay += paidTotal;
        acc.gross += gross;
        acc.cpp += cpp;
        acc.ei += ei;
        acc.hst += hst;
        acc.netIncome += (gross - cpp - ei);
        return acc;
      },
      { totalPay: 0, gross: 0, cpp: 0, ei: 0, hst: 0, netIncome: 0 }
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
          <p className="text-xs text-slate-400 mt-1">Based on generated invoice HST amount</p>
        </div>
        <div className="stat-card border-amber-100">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Total Pay (Timesheet, Incl. HST)</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{currency(totals.totalPay)}</p>
          <p className="text-xs text-slate-400 mt-1">Timesheet invoices only. Includes gross paid, HST, CPP, and EI</p>
        </div>
        <div className="stat-card border-cyan-100 sm:col-span-2">
          <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wider">Gross Paid (Excl. HST)</p>
          <p className="text-2xl font-bold text-cyan-700 mt-1">{currency(totals.gross)}</p>
        </div>
        <div className="stat-card border-emerald-100 sm:col-span-2">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Net Income</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{currency(totals.netIncome)}</p>
          <p className="text-xs text-slate-400 mt-1">(Gross paid - HST - CPP - EI)</p>
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
            const paidTotal = Number(invoice.amountPaid || 0);
            const split = splitPaidGrossAndHst(invoice);
            const gross = expenseInvoice ? paidTotal : split.gross;
            const cpp   = expenseInvoice ? 0 : Number(invoice.taxCpp       || 0);
            const ei    = expenseInvoice ? 0 : Number(invoice.taxEi        || 0);
            const hst   = expenseInvoice ? 0 : split.hst;
            const net   = expenseInvoice ? gross : Math.max(0, roundMoney(gross - cpp - ei));

            return (
              <div key={invoice.id} className="form-card border-slate-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Invoice</p>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 border ${expenseInvoice ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
                        {expenseInvoice ? 'Expense' : 'Timesheet'}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">#{invoice.invoiceNum}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{invoice.client?.name}</p>
                    <p className="text-sm text-slate-500 mt-0.5">Period: {formatDateRange(invoice.periodStart, invoice.periodEnd)}</p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2">
                    <div className="text-left sm:text-right">
                      <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Total Amount (Incl. HST)</p>
                      <p className="text-2xl font-bold text-slate-900">{currency(paidTotal)}</p>
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
