import { useEffect, useState } from 'react';
import api from '../api.js';
import { Plus, Trash2, Edit2, Save, X, Upload, Search, Building2, MapPin, FileCheck, Handshake, Eye, Download } from 'lucide-react';
import FileViewer from './FileViewer';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState('');
  const [viewer, setViewer] = useState(null);
  const [docDescriptions, setDocDescriptions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); loadRecruiters(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/clients');
      setClients(r.data);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecruiters() {
    const r = await api.get('/recruiters');
    setRecruiters(r.data);
  }

  function startEdit(c) {
    const mainLocation = c?.mainLocation || c?.address || c?.locations?.[0] || '';
    const siteLocations = Array.isArray(c?.siteLocations) && c.siteLocations.length
      ? c.siteLocations
      : (c?.sites || []).map((shortName, idx) => ({
          shortName,
          fullAddress: (c?.locations || [])[idx + 1] || '',
        }));

    setForm({
      id: c?.id,
      name: c?.name || '',
      phone: c?.phone || '',
      address: c?.address || '',
      paysBreak: !!c?.paysBreak,
      paidBreakMinutes: c?.paidBreakMinutes ?? 0,
      mainLocation,
      siteLocations,
      connectVia: c?.connectVia || 'DIRECT',
      recruiterId: c?.recruiterId ? String(c.recruiterId) : '',
      recruiterAddress: c?.recruiterAddress || '',
      payRate: c?.payRate || '',
      payRateType: c?.payRateType || 'HOURLY',
      contractLength: c?.contractLength || '',
      serviceDesc: c?.serviceDesc || '',
    });
  }

  async function save() {
    const siteLocations = (form.siteLocations || [])
      .map((s) => ({
        shortName: String(s?.shortName || '').trim(),
        fullAddress: String(s?.fullAddress || '').trim(),
      }))
      .filter((s) => s.shortName || s.fullAddress);
    const sites = siteLocations.map((s) => s.shortName).filter(Boolean);
    const recruiter = recruiters.find(r => String(r.id) === String(form.recruiterId));

    const payload = {
      ...form,
      address: form.address || null,
      recruiterId: form.connectVia === 'MIDDLE_PARTY' ? Number(form.recruiterId) || null : null,
      recruiterAddress: form.connectVia === 'MIDDLE_PARTY' ? (recruiter?.address || form.recruiterAddress || '') : null,
      paysBreak: !!form.paysBreak,
      paidBreakMinutes: Math.max(0, Number(form.paidBreakMinutes) || 0),
      mainLocation: form.mainLocation,
      siteLocations,
      sites,
      payRate: Number(form.payRate),
    };
    if (form.id) {
      await api.put(`/clients/${form.id}`, payload);
    } else {
      await api.post('/clients', payload);
    }
    setForm(null);
    load();
  }

  function addSiteRow() {
    setForm({ ...form, siteLocations: [...(form.siteLocations || []), { shortName: '', fullAddress: '' }] });
  }

  function updateSiteRow(index, key, value) {
    const next = [...(form.siteLocations || [])];
    next[index] = { ...(next[index] || {}), [key]: value };
    setForm({ ...form, siteLocations: next });
  }

  function removeSiteRow(index) {
    const next = (form.siteLocations || []).filter((_, i) => i !== index);
    setForm({ ...form, siteLocations: next });
  }

  async function remove(id) {
    await api.delete(`/clients/${id}`);
    load();
  }

  async function uploadContract(id, file) {
    const fd = new FormData();
    fd.append('file', file);
    await api.post(`/clients/${id}/contract`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    load();
  }

  async function uploadDocument(clientId, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('description', docDescriptions[clientId] || '');
    await api.post(`/clients/${clientId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setDocDescriptions(prev => ({ ...prev, [clientId]: '' }));
    load();
  }

  async function removeDocument(clientId, docId) {
    await api.delete(`/clients/${clientId}/documents/${docId}`);
    load();
  }

  function openDocument(clientId, doc) {
    const filename = doc.filePath.split('/').pop();
    setViewer({
      url: `/api/files/clients/${clientId}/${filename}`,
      filename: doc.filename,
      mime: doc.mimeType,
    });
  }

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your client relationships and contracts</p>
        </div>
        <button onClick={() => startEdit(null)} className="premium-btn-primary">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Search clients by name..." 
          className="premium-input pl-10"
        />
      </div>

      {form && (
        <div className="form-card animate-slide-up mb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-900 text-lg">{form.id ? 'Edit Client' : 'New Client'}</h3>
            <button onClick={() => setForm(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client Name</label>
              <input placeholder="e.g. Acme Corporation" className="premium-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number</label>
              <input placeholder="e.g. +1 647 000 0000" className="premium-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Main Location</label>
              <input placeholder="e.g. Toronto HQ" className="premium-input" value={form.mainLocation} onChange={e => setForm({...form, mainLocation: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client Address</label>
              <input placeholder="e.g. 123 Main St, Toronto, ON" className="premium-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600">Sites (Short Name + Full Address)</label>
                <button type="button" onClick={addSiteRow} className="premium-btn-secondary !py-1.5 !px-2.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Site
                </button>
              </div>
              <div className="space-y-2">
                {(form.siteLocations || []).map((site, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <input
                      className="premium-input md:col-span-3"
                      placeholder="Short Name"
                      value={site.shortName || ''}
                      onChange={e => updateSiteRow(idx, 'shortName', e.target.value)}
                    />
                    <input
                      className="premium-input md:col-span-8"
                      placeholder="Full Address"
                      value={site.fullAddress || ''}
                      onChange={e => updateSiteRow(idx, 'fullAddress', e.target.value)}
                    />
                    <button type="button" onClick={() => removeSiteRow(idx)} className="premium-btn-danger !py-2 !px-2 md:col-span-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Connection Type</label>
              <select className="premium-select" value={form.connectVia} onChange={e => setForm({...form, connectVia: e.target.value})}>
                <option value="DIRECT">Direct Client</option>
                <option value="MIDDLE_PARTY">Via Recruiter / Middle Party</option>
              </select>
            </div>
            {form.connectVia === 'MIDDLE_PARTY' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Recruiter</label>
                  <select className="premium-select" value={form.recruiterId} onChange={e => setForm({...form, recruiterId: e.target.value})}>
                    <option value="">Select Recruiter</option>
                    {recruiters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Recruiter Address</label>
                  <input
                    placeholder="Auto-filled from recruiter"
                    className="premium-input"
                    value={recruiters.find(r => String(r.id) === String(form.recruiterId))?.address || form.recruiterAddress}
                    onChange={e => setForm({...form, recruiterAddress: e.target.value})}
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pay Rate</label>
              <input type="number" placeholder="0.00" className="premium-input" value={form.payRate} onChange={e => setForm({...form, payRate: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Rate Type</label>
              <select className="premium-select" value={form.payRateType} onChange={e => setForm({...form, payRateType: e.target.value})}>
                <option value="HOURLY">Per Hour</option>
                <option value="ANNUAL">Per Year</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pays For Break</label>
              <select className="premium-select" value={form.paysBreak ? 'YES' : 'NO'} onChange={e => setForm({...form, paysBreak: e.target.value === 'YES'})}>
                <option value="NO">No</option>
                <option value="YES">Yes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Break Minutes To Deduct</label>
              <input
                type="number"
                min="0"
                className="premium-input"
                value={form.paidBreakMinutes}
                onChange={e => setForm({...form, paidBreakMinutes: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contract Length</label>
              <input placeholder="e.g. 6 months" className="premium-input" value={form.contractLength} onChange={e => setForm({...form, contractLength: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Service Description</label>
              <input placeholder="e.g. Software Development" className="premium-input" value={form.serviceDesc} onChange={e => setForm({...form, serviceDesc: e.target.value})} />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={save} className="premium-btn-primary">
              <Save className="w-4 h-4" /> Save Client
            </button>
            <button onClick={() => setForm(null)} className="premium-btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="form-card empty-state py-16">
          <Building2 className="w-12 h-12 mb-3 text-slate-300" />
          <p className="text-lg font-semibold text-slate-700">No clients found</p>
          <p className="text-sm text-slate-400 mt-1">Add your first client to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 text-base">{c.name}</h3>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${c.connectVia === 'DIRECT' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20' : 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/20'}`}>
                        {c.connectVia === 'DIRECT' ? 'Direct' : 'Recruiter'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.mainLocation || c.address || c.locations?.[0] || 'No main location'}</span>
                      {c.address && <span>Address: {c.address}</span>}
                      {c.phone && <span>{c.phone}</span>}
                      {!!(c.sites?.length || c.locations?.length) && <span>Sites: {(c.sites?.length ? c.sites : (c.locations || []).slice(1)).join(', ') || '—'}</span>}
                      <span className="flex items-center gap-1">${c.payRate} / {c.payRateType?.toLowerCase()}</span>
                      {c.paysBreak && <span>Break deduction: {c.paidBreakMinutes || 0} min</span>}
                      {c.contractLength && <span>{c.contractLength}</span>}
                    </div>
                    {c.connectVia === 'MIDDLE_PARTY' && (
                      <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <Handshake className="w-3 h-3" /> {c.recruiter?.name || 'Recruiter'}{c.recruiter?.address ? ` - ${c.recruiter.address}` : ''}
                      </div>
                    )}
                    {c.serviceDesc && <p className="text-xs text-slate-400 mt-2">{c.serviceDesc}</p>}

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-600 mb-2">Client Documents</p>
                      <div className="flex flex-col md:flex-row gap-2 md:items-center mb-2">
                        <input
                          className="premium-input md:max-w-sm"
                          placeholder="Document description"
                          value={docDescriptions[c.id] || ''}
                          onChange={e => setDocDescriptions(prev => ({ ...prev, [c.id]: e.target.value }))}
                        />
                        <label className="premium-btn-secondary cursor-pointer whitespace-nowrap">
                          <Upload className="w-4 h-4" /> Upload Document
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp"
                            onChange={e => uploadDocument(c.id, e.target.files[0])}
                          />
                        </label>
                      </div>

                      {c.documents?.length ? (
                        <div className="space-y-1.5">
                          {c.documents.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">{doc.filename}</p>
                                <p className="text-[11px] text-slate-500 truncate">{doc.description || 'No description'}</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => openDocument(c.id, doc)} className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-md transition-colors" title="Preview">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <a href={`/api/files/clients/${c.id}/${doc.filePath.split('/').pop()}?download=1`} className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-md transition-colors" title="Download">
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button onClick={() => removeDocument(c.id, doc.id)} className="p-1.5 hover:bg-red-100 text-red-600 rounded-md transition-colors" title="Delete document">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">No documents uploaded yet.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {c.contractDocPath ? (
                      <button 
                        onClick={() => setViewer({ url: `/api/files/${c.id}/${c.contractDocPath.split('/').pop()}`, filename: 'Contract', mime: 'application/pdf' })}
                        className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                        title="View Contract"
                      >
                        <FileCheck className="w-4 h-4" />
                      </button>
                    ) : (
                      <label className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer" title="Upload Contract">
                        <Upload className="w-4 h-4" />
                        <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => uploadContract(c.id, e.target.files[0])} />
                      </label>
                    )}
                    <button onClick={() => startEdit(c)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(c.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewer && <FileViewer {...viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}