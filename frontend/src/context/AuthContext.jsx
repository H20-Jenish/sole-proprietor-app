import { createContext, useContext, useEffect, useState } from 'react';
import api, { clearReauthToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const r = await api.get('/auth/me');
    setUser(r.data);
    return r.data;
  };

  useEffect(() => {
    refreshUser()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    clearReauthToken();
    setUser(r.data.user);
    return r.data.user;
  };

  const signup = async (payload) => {
    const r = await api.post('/auth/signup', payload);
    clearReauthToken();
    setUser(r.data.user);
    return r.data.user;
  };

  const applyUser = (nextUser) => {
    setUser(nextUser);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    clearReauthToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser, applyUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}