// Use environment variable or fallback to production API
export const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.lavishlook.app/api';

export const STORAGE_KEYS = {
  apiBase: 'lavish.apiBase',
  token: 'lavish.jwt',
  role: 'lavish.role',
  vendorId: 'lavish.vendorId',
};
