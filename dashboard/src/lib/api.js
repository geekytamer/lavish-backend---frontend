import { useCallback, useMemo } from 'react';
import { DEFAULT_API_BASE } from './config.js';
import { useApp } from '../context/AppContext.jsx';

const normalizeBase = (value) => {
  if (!value) return DEFAULT_API_BASE;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const buildHeaders = (token, extra = {}) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...extra,
});

const parseResponse = async (res) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
};

export function createApiClient({ apiBase = DEFAULT_API_BASE, token }) {
  const base = normalizeBase(apiBase);

  const request = async (path, options = {}) => {
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: buildHeaders(token, options.headers),
    });
    const data = await parseResponse(res);
    if (!res.ok) {
      const message = data?.error || res.statusText || 'Request failed';
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  };

  const get = (path) => request(path, { method: 'GET' });
  const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) });
  const patch = (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body || {}) });
  const del = (path) => request(path, { method: 'DELETE' });
  const upload = async (path, file, field = 'file') => {
    const form = new FormData();
    form.append(field, file);
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await parseResponse(res);
    if (!res.ok) {
      const message = data?.error || res.statusText || 'Upload failed';
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  };

  return { base, token, request, get, post, patch, del, upload };
}

export function useApiClient() {
  const { apiBase, token } = useApp();
  return useMemo(() => createApiClient({ apiBase, token }), [apiBase, token]);
}

export const buildQuery = (params = {}) => {
  const defined = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!defined.length) return '';
  const query = new URLSearchParams(Object.fromEntries(defined));
  return `?${query.toString()}`;
};
