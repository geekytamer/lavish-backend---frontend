import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_API_BASE, STORAGE_KEYS } from '../lib/config.js';

const AppContext = createContext(null);

const safeGet = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ?? fallback;
  } catch (e) {
    return fallback;
  }
};

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => safeGet(STORAGE_KEYS.token, ''));
  const [role, setRole] = useState(() => safeGet(STORAGE_KEYS.role, ''));
  const [vendorId, setVendorId] = useState(() => safeGet(STORAGE_KEYS.vendorId, ''));

  useEffect(() => {
    try {
      token ? localStorage.setItem(STORAGE_KEYS.token, token) : localStorage.removeItem(STORAGE_KEYS.token);
      role ? localStorage.setItem(STORAGE_KEYS.role, role) : localStorage.removeItem(STORAGE_KEYS.role);
      vendorId
        ? localStorage.setItem(STORAGE_KEYS.vendorId, vendorId)
        : localStorage.removeItem(STORAGE_KEYS.vendorId);
    } catch (e) {
      // ignore
    }
  }, [token, role, vendorId]);

  const login = async ({ email, password }) => {
    const res = await fetch(`${DEFAULT_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error || 'Login failed';
      throw new Error(message);
    }
    setToken(data.token);
    setRole(data.role || '');
    setVendorId(data.vendorId || '');
    return data;
  };

  const logout = () => {
    setToken('');
    setRole('');
    setVendorId('');
  };

  const value = useMemo(
    () => ({
      apiBase: DEFAULT_API_BASE,
      token,
      role,
      vendorId,
      login,
      logout,
      isAuthed: Boolean(token),
    }),
    [token, role, vendorId],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
