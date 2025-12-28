import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Lock, LogIn, Mail } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { DEFAULT_API_BASE } from '../lib/config.js';

export function AuthPage() {
  const navigate = useNavigate();
  const { login, apiBase, setApiBase, isAuthed } = useApp();
  const [form, setForm] = useState({
    email: '',
    password: '',
    api: apiBase || DEFAULT_API_BASE,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthed) navigate('/');
  }, [isAuthed, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email: form.email, password: form.password, baseOverride: form.api });
      setApiBase(form.api.trim() || DEFAULT_API_BASE);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-hero">
          <p className="eyebrow">Lavish Fashion</p>
          <h1>Dashboard access</h1>
          <p className="muted">
            Log in with your admin or vendor credentials. The API base can be changed or passed as
            <code className="chip">?api=</code> in the URL.
          </p>
          <div className="pill info">Default · {DEFAULT_API_BASE}</div>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="label">
            <Mail size={14} /> Email
          </label>
          <input
            className="input"
            type="email"
            required
            placeholder="admin@lavish.test"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />

          <label className="label">
            <Lock size={14} /> Password
          </label>
          <input
            className="input"
            type="password"
            required
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />

          <label className="label">
            <Link2 size={14} /> API base URL
          </label>
          <input
            className="input"
            value={form.api}
            onChange={(e) => setForm((f) => ({ ...f, api: e.target.value }))}
            placeholder="http://localhost:4000/api"
            spellCheck="false"
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn primary" disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
