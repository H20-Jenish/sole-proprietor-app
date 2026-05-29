import { useEffect, useState } from 'react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext';
import { Save, Settings as SettingsIcon, Shield, Download, Upload, RefreshCw, Trash2 } from 'lucide-react';

export default function Settings() {
  const { applyUser } = useAuth();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    hstNumber: '',
    businessName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBackup, setSavingBackup] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [deleteBusyFile, setDeleteBusyFile] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [backup, setBackup] = useState({
    intervalMinutes: 360,
    autoEnabled: true,
    lastSnapshotAt: null,
    minIntervalMinutes: 120,
    maxIntervalMinutes: 480,
    snapshots: [],
  });
  const [restoreSnapshotFileName, setRestoreSnapshotFileName] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const r = await api.get('/settings');
      setForm(prev => ({
        ...prev,
        name: r.data.name || '',
        phone: r.data.phone || '',
        hstNumber: r.data.hstNumber || '',
        businessName: r.data.businessName || '',
        email: r.data.email || '',
      }));

      const b = await api.get('/settings/backup');
      setBackup({
        intervalMinutes: b.data.intervalMinutes || 360,
        autoEnabled: b.data.autoEnabled !== false,
        lastSnapshotAt: b.data.lastSnapshotAt || null,
        minIntervalMinutes: b.data.minIntervalMinutes || 120,
        maxIntervalMinutes: b.data.maxIntervalMinutes || 480,
        snapshots: Array.isArray(b.data.snapshots) ? b.data.snapshots : [],
      });
    } catch (error) {
      setErr(error?.response?.data?.error || 'Unable to load settings. Password confirmation is required.');
    } finally {
      setLoading(false);
    }
  }

  async function reloadBackup() {
    try {
      const b = await api.get('/settings/backup');
      setBackup({
        intervalMinutes: b.data.intervalMinutes || 360,
        autoEnabled: b.data.autoEnabled !== false,
        lastSnapshotAt: b.data.lastSnapshotAt || null,
        minIntervalMinutes: b.data.minIntervalMinutes || 120,
        maxIntervalMinutes: b.data.maxIntervalMinutes || 480,
        snapshots: Array.isArray(b.data.snapshots) ? b.data.snapshots : [],
      });
    } catch (error) {
      setErr(error?.response?.data?.error || 'Unable to refresh backups. Password confirmation is required.');
    }
  }

  async function deleteSnapshot(fileName) {
    if (!fileName) return;

    setErr('');
    setOk('');
    setDeleteBusyFile(fileName);
    try {
      await api.delete(`/settings/backup/snapshots/${encodeURIComponent(fileName)}`);
      await reloadBackup();
      setOk('Snapshot deleted successfully.');
    } catch (error) {
      setErr(error?.response?.data?.error || 'Failed to delete snapshot');
    } finally {
      setDeleteBusyFile('');
    }
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    setSaving(true);

    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        hstNumber: form.hstNumber,
        businessName: form.businessName,
        email: form.email,
      };

      if (form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      const r = await api.put('/settings', payload);
      applyUser(prev => ({ ...prev, ...r.data }));
      setForm(prev => ({ ...prev, currentPassword: '', newPassword: '' }));
      setOk('Settings updated successfully.');
    } catch (error) {
      setErr(error?.response?.data?.error || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  }

  async function saveBackupConfig() {
    setErr('');
    setOk('');
    setSavingBackup(true);
    try {
      const r = await api.put('/settings/backup', {
        intervalMinutes: Number(backup.intervalMinutes),
        autoEnabled: !!backup.autoEnabled,
      });
      setBackup(prev => ({
        ...prev,
        intervalMinutes: r.data.intervalMinutes,
        autoEnabled: r.data.autoEnabled,
        lastSnapshotAt: r.data.lastSnapshotAt,
        minIntervalMinutes: r.data.minIntervalMinutes,
        maxIntervalMinutes: r.data.maxIntervalMinutes,
      }));
      setOk(`Backup schedule updated successfully. Auto-prune keeps up to 25 snapshots; newest 10 are protected.`);
    } catch (error) {
      setErr(error?.response?.data?.error || 'Failed to update backup schedule');
    } finally {
      setSavingBackup(false);
    }
  }

  async function createSnapshotNow() {
    setErr('');
    setOk('');
    setSnapshotBusy(true);
    try {
      await api.post('/settings/backup/snapshot');
      await reloadBackup();
      setOk('Snapshot created successfully.');
    } catch (error) {
      setErr(error?.response?.data?.error || 'Failed to create snapshot');
    } finally {
      setSnapshotBusy(false);
    }
  }

  function downloadSnapshot(fileName) {
    window.open(`/api/settings/backup/download/${encodeURIComponent(fileName)}`, '_blank');
  }

  async function restoreFromSnapshot() {
    if (!restoreSnapshotFileName) return;
    if (!confirm('Restore from selected snapshot? This will overwrite current data and files.')) return;
    setErr('');
    setOk('');
    setRestoreBusy(true);
    try {
      await api.post('/settings/backup/restore/snapshot', { fileName: restoreSnapshotFileName });
      await reloadBackup();
      setOk('Restore completed from snapshot. Please refresh the app.');
    } catch (error) {
      setErr(error?.response?.data?.error || 'Failed to restore from snapshot');
    } finally {
      setRestoreBusy(false);
    }
  }

  async function restoreFromUpload() {
    if (!uploadFile) return;
    if (!confirm('Restore from uploaded backup file? This will overwrite current data and files.')) return;
    setErr('');
    setOk('');
    setRestoreBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      await api.post('/settings/backup/restore/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadFile(null);
      await reloadBackup();
      setOk('Restore completed from uploaded backup. Please refresh the app.');
    } catch (error) {
      setErr(error?.response?.data?.error || 'Failed to restore from uploaded backup');
    } finally {
      setRestoreBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-slate-500">Loading settings...</div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your business profile and account details</p>
        </div>
      </div>

      <form onSubmit={save} className="form-card max-w-5xl">
        <div className="flex items-center gap-2 mb-5">
          <SettingsIcon className="w-4 h-4 text-slate-400" />
          <h3 className="font-bold text-slate-900 text-sm">Business Profile</h3>
        </div>

        {err && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
            <Shield className="w-4 h-4" />
            <span>{err}</span>
          </div>
        )}

        {ok && (
          <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
            {ok}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name</label>
            <input className="premium-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
            <input type="email" className="premium-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number</label>
            <input className="premium-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Business Name</label>
            <input className="premium-input" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">HST Number</label>
            <input className="premium-input" value={form.hstNumber} onChange={e => setForm({ ...form, hstNumber: e.target.value })} />
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100">
          <h4 className="text-sm font-semibold text-slate-800 mb-3">Change Password (optional)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Password</label>
              <input
                type="password"
                className="premium-input"
                value={form.currentPassword}
                onChange={e => setForm({ ...form, currentPassword: e.target.value })}
                placeholder="Required to set a new password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
              <input
                type="password"
                className="premium-input"
                value={form.newPassword}
                onChange={e => setForm({ ...form, newPassword: e.target.value })}
                placeholder="At least 8 characters"
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button disabled={saving} className="premium-btn-primary">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      <div className="form-card max-w-5xl mt-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Backup & Restore</h3>
            <p className="text-xs text-slate-500 mt-1">Auto snapshots are stored in a dedicated backup volume with timestamps.</p>
          </div>
          <button type="button" onClick={createSnapshotNow} disabled={snapshotBusy} className="premium-btn-secondary">
            <RefreshCw className="w-4 h-4" /> {snapshotBusy ? 'Creating...' : 'Create Snapshot Now'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Auto Backup Interval (minutes)</label>
            <input
              type="number"
              min={backup.minIntervalMinutes}
              max={backup.maxIntervalMinutes}
              className="premium-input h-[42px]"
              value={backup.intervalMinutes}
              onChange={e => setBackup({ ...backup, intervalMinutes: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Automation</label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700 px-3 h-[42px] bg-slate-50 border border-slate-200 rounded-lg w-full">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={backup.autoEnabled}
                onChange={e => setBackup({ ...backup, autoEnabled: e.target.checked })}
              />
              Auto snapshot enabled
            </label>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Action</label>
            <button type="button" onClick={saveBackupConfig} disabled={savingBackup} className="premium-btn-primary w-full h-[42px]">
              <Save className="w-4 h-4" /> {savingBackup ? 'Saving...' : 'Save Backup Settings'}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 mb-5">Allowed range: {backup.minIntervalMinutes} to {backup.maxIntervalMinutes} minutes.</p>

        <div className="text-xs text-slate-500 mb-5">
          Last snapshot: {backup.lastSnapshotAt ? new Date(backup.lastSnapshotAt).toLocaleString() : 'Never'}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Available Snapshots</h4>
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {(backup.snapshots || []).length === 0 ? (
                <p className="text-xs text-slate-500">No snapshots yet.</p>
              ) : (
                (backup.snapshots || []).map((s) => (
                  <div key={s.fileName} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-slate-100 bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{s.fileName}</p>
                      <p className="text-[11px] text-slate-500">{new Date(s.createdAt).toLocaleString()} • {(Number(s.fileSize) / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" className="premium-btn-secondary !py-1.5 !px-2.5 text-xs" onClick={() => downloadSnapshot(s.fileName)}>
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                      <button
                        type="button"
                        disabled={!s.canDelete || deleteBusyFile === s.fileName}
                        className={`premium-btn-danger !py-1.5 !px-2.5 text-xs ${!s.canDelete ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => deleteSnapshot(s.fileName)}
                        title={s.canDelete ? 'Delete snapshot' : 'Newest 10 snapshots are protected'}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {deleteBusyFile === s.fileName ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Newest 10 snapshots are protected from manual deletion.</p>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Restore</h4>

            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Restore From Existing Snapshot</label>
            <div className="flex items-center gap-2 mb-4">
              <select
                className="premium-select"
                value={restoreSnapshotFileName}
                onChange={e => setRestoreSnapshotFileName(e.target.value)}
              >
                <option value="">Select snapshot</option>
                {(backup.snapshots || []).map((s) => <option key={s.fileName} value={s.fileName}>{s.fileName}</option>)}
              </select>
              <button type="button" disabled={!restoreSnapshotFileName || restoreBusy} onClick={restoreFromSnapshot} className="premium-btn-danger whitespace-nowrap">
                {restoreBusy ? 'Restoring...' : 'Restore Snapshot'}
              </button>
            </div>

            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Restore From Downloaded Backup File (.tar.gz)</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".tar.gz,.gz"
                className="premium-input"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
              />
              <button type="button" disabled={!uploadFile || restoreBusy} onClick={restoreFromUpload} className="premium-btn-danger whitespace-nowrap">
                <Upload className="w-4 h-4" /> {restoreBusy ? 'Restoring...' : 'Upload & Restore'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Restore will overwrite current database records and uploaded files.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
