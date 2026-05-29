import axios from 'axios';
import { requestSecurityGate } from './services/securityGate.js';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

const REAUTH_TOKEN_KEY = 'sp_reauth_token';

export function getReauthToken() {
  return typeof window !== 'undefined' ? window.sessionStorage.getItem(REAUTH_TOKEN_KEY) : null;
}

export function setReauthToken(token) {
  if (typeof window === 'undefined') return;
  if (!token) {
    window.sessionStorage.removeItem(REAUTH_TOKEN_KEY);
    return;
  }
  window.sessionStorage.setItem(REAUTH_TOKEN_KEY, token);
}

export function clearReauthToken() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(REAUTH_TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getReauthToken();
  const method = String(config.method || '').toLowerCase();
  const hasExplicitHeader = !!config.headers?.['x-reauth-token'];
  if (token && method !== 'delete' && !hasExplicitHeader) {
    config.headers = config.headers || {};
    config.headers['x-reauth-token'] = token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    const original = error?.config;

    if (status === 401) {
      clearReauthToken();
      return Promise.reject(error);
    }

    if (status !== 428 || code !== 'REAUTH_REQUIRED' || !original || original.__reauthRetried) {
      return Promise.reject(error);
    }

    if (typeof window === 'undefined') return Promise.reject(error);

    const method = String(original.method || '').toLowerCase();
    const isDelete = method === 'delete';
    const isSettingsPath = String(original.url || '').includes('/settings');

    let previousError = '';
    for (let attempts = 0; attempts < 3; attempts += 1) {
      const authRequest = await requestSecurityGate({
        reason: isDelete ? 'delete' : (isSettingsPath ? 'settings' : 'generic'),
        title: isDelete ? 'Authorize Deletion' : (isSettingsPath ? 'Unlock Settings' : 'Security Check'),
        message: isDelete
          ? 'Enter your password to confirm this delete action.'
          : 'Enter your password to continue.',
        actionLabel: isDelete ? 'Delete' : 'Unlock',
        tone: isDelete ? 'danger' : 'primary',
        serverError: previousError,
      });

      if (!authRequest?.confirmed || !authRequest?.password) {
        return Promise.reject(error);
      }

      try {
        const reauthResponse = await api.post('/auth/reauth', { password: authRequest.password });
        const token = reauthResponse?.data?.token;
        if (!token) return Promise.reject(error);

        if (!isDelete) {
          setReauthToken(token);
        }

        original.__reauthRetried = true;
        original.headers = original.headers || {};
        original.headers['x-reauth-token'] = token;
        return api(original);
      } catch (reauthError) {
        const statusCode = reauthError?.response?.status;
        if (statusCode === 401) {
          previousError = 'Incorrect password. Please try again.';
          clearReauthToken();
          continue;
        }
        clearReauthToken();
        return Promise.reject(reauthError);
      }
    }

    clearReauthToken();
    return Promise.reject(error);
  }
);

export default api;