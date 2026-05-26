import { useEffect, useState } from 'react';
import api from '../api.js';
import { Plus, Trash2, Edit2, Save, X, Search, Handshake, MapPin, Mail, Phone, Upload, Eye, Download } from 'lucide-react';
import FileViewer from './FileViewer';

export default function Recruiters() {
  const [recruiters, setRecruiters] = useState([]);
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState('');
  const [viewer, setViewer] = useState(null);
  const [docDescriptions, setDocDescriptions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/recruiters');
      setRecruiters(r.data);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(r) {
    setForm({
      id: r?.id,
      name: r?.name || '',
      address: r?.address || '',
      email: r?.email || '',
      phone: r?.phone || '',
      fax: r?.fax || '',
      notes: r?.notes || '',
    });
  }

  async function save() {
    if (!form.name.trim() || !form.address.trim()) return;
    if (form.id) await api.put(`/recruiters/${form.id}`, form);
    else await api.post('/recruiters', form);
    setForm(null);
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this recruiter? Clients linked to this recruiter will be unlinked.')) return;
    await api.delete(`/recruiters/${id}`);
    load();
  }

  async function uploadDocument(recruiterId, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('description', docDescriptions[recruiterId] || '');
    await api.post(`/recruiters/${recruiterId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setDocDescriptions(prev => ({ ...prev, [recruiterId]: '' }));
    load();
  }

  async function removeDocument(recruiterId, docId) {
    if (!confirm('Delete this document?')) return;
    await api.delete(`/recruiters/${recruiterId}/documents/${docId}`);
    load();
  }

  function openDocument(recruiterId, doc) {
    const filename = doc.filePath.split('/').pop();
    setViewer({
      url: `/api/files/recruiters/${recruiterId}/${filename}`,
      filename: doc.filename,
      mime: doc.mimeType,
    });
  }

  const filtered = recruiters.filter(r => {
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q)
      || (r.email || '').toLowerCase().includes(q)
      || (r.phone || '').toLowerCase().includes(q)
      || (r.fax || '').toLowerCase().includes(q);
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Recruiters</h1>
          <p className="text-sm text-slate-500 mt-1">Maintain recruiter contacts and billing addresses</p>
        </div>
        <button onClick={() => startEdit(null)} className="premium-btn-primary">
          <Plus className="w-4 h-4" /> Add Recruiter
        </button>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recruiters..."
          className="premium-input pl-10"
        />
      </div>

      {form && (
        <div className="form-card animate-slide-up mb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-900 text-lg">{form.id ? 'Edit Recruiter' : 'New Recruiter'}</h3>
            <button onClick={() => setForm(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Recruiter Name</label>
              <input className="premium-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
              <input className="premium-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fax</label>
              <input className="premium-input" value={form.fax} onChange={e => setForm({ ...form, fax: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Address</label>
              <input className="premium-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
              <input type="email" className="premium-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
              <input className="premium-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={save} className="premium-btn-primary">
              <Save className="w-4 h-4" /> Save Recruiter
            </button>
            <button onClick={() => setForm(null)} className="premium-btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="form-card empty-state py-16">
          <Handshake className="w-12 h-12 mb-3 text-slate-300" />
          <p className="text-lg font-semibold text-slate-700">No recruiters found</p>
          <p className="text-sm text-slate-400 mt-1">Add your first recruiter to assign it to clients</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base">{r.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {r.address}</span>
                      {r.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {r.email}</span>}
                      {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {r.phone}</span>}
                      {r.fax && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> Fax: {r.fax}</span>}
                    </div>
                    {r.notes && <p className="text-xs text-slate-400 mt-2">{r.notes}</p>}
                    <p className="text-xs text-slate-400 mt-2">Linked clients: {r._count?.clients || 0}</p>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-600 mb-2">Recruiter Documents</p>
                      <div className="flex flex-col md:flex-row gap-2 md:items-center mb-2">
                        <input
                          className="premium-input md:max-w-sm"
                          placeholder="Document description"
                          value={docDescriptions[r.id] || ''}
                          onChange={e => setDocDescriptions(prev => ({ ...prev, [r.id]: e.target.value }))}
                        />
                        <label className="premium-btn-secondary cursor-pointer whitespace-nowrap">
                          <Upload className="w-4 h-4" /> Upload Document
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp"
                            onChange={e => uploadDocument(r.id, e.target.files[0])}
                          />
                        </label>
                      </div>

                      {r.documents?.length ? (
                        <div className="space-y-1.5">
                          {r.documents.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">{doc.filename}</p>
                                <p className="text-[11px] text-slate-500 truncate">{doc.description || 'No description'}</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => openDocument(r.id, doc)} className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-md transition-colors" title="Preview">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <a href={`/api/files/recruiters/${r.id}/${doc.filePath.split('/').pop()}?download=1`} className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-md transition-colors" title="Download">
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button onClick={() => removeDocument(r.id, doc.id)} className="p-1.5 hover:bg-red-100 text-red-600 rounded-md transition-colors" title="Delete document">
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
                    <button onClick={() => startEdit(r)} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-lg transition-colors" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(r.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Delete">
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
