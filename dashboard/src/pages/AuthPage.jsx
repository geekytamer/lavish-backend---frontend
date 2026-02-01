import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogIn, Mail } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

export function AuthPage() {
  const navigate = useNavigate();
  const { login, isAuthed } = useApp();
  const [form, setForm] = useState({
    email: '',
    password: '',
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
      await login({ email: form.email, password: form.password });
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
          <h1>Dashboard</h1>
          <p className="muted">
            Sign in with your admin or vendor credentials to manage your store.
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="label">
            <Mail size={14} /> Email
          </label>
          <input
            className="input"
            type="email"
            required
            placeholder="your@email.com"
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
