import { useEffect, useState } from 'react';
import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { registerSecurityGatePresenter } from '../services/securityGate.js';

export default function SecurityGateModalHost() {
  const [request, setRequest] = useState(null);
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    const unregister = registerSecurityGatePresenter((options) => new Promise((resolve) => {
      setPassword('');
      setLocalError('');
      setRequest({
        title: options?.title || 'Security Check',
        message: options?.message || 'Please enter your password to continue.',
        actionLabel: options?.actionLabel || 'Continue',
        tone: options?.tone || 'primary',
        reason: options?.reason || 'generic',
        serverError: options?.serverError || '',
        resolve,
      });
    }));

    return unregister;
  }, []);

  useEffect(() => {
    if (!request) return;
    setLocalError(request?.serverError || '');
  }, [request]);

  function closeModal() {
    if (!request) return;
    request.resolve({ confirmed: false, password: '' });
    setRequest(null);
    setPassword('');
    setLocalError('');
  }

  function submit(e) {
    e.preventDefault();
    if (!password.trim()) {
      setLocalError('Password is required.');
      return;
    }

    if (!request) return;
    request.resolve({ confirmed: true, password });
    setRequest(null);
    setPassword('');
    setLocalError('');
  }

  if (!request) return null;

  const isDanger = request.tone === 'danger';

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit} className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDanger ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
              {isDanger ? <ShieldAlert className="w-5 h-5" /> : <LockKeyhole className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{request.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{request.message}</p>
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
            <input
              type="password"
              autoFocus
              className="premium-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (localError) setLocalError('');
              }}
              placeholder="Enter your account password"
            />
          </div>

          {localError && (
            <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {localError}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="premium-btn-secondary">Cancel</button>
            <button type="submit" className={isDanger ? 'premium-btn-danger' : 'premium-btn-primary'}>
              {request.actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
