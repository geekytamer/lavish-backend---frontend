import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Store,
  Package,
  Wallet,
  Megaphone,
  LogOut,
  Link2,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

const adminNav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: Receipt },
  { to: '/vendors', label: 'Vendors', icon: Store },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/payouts', label: 'Payouts', icon: Wallet },
  { to: '/content', label: 'Content', icon: Megaphone },
];

const vendorNav = [
  { to: '/vendor/profile', label: 'My brand', icon: Store },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/orders', label: 'Orders', icon: Receipt },
];

const titles = {
  '/': 'Overview',
  '/orders': 'Orders',
  '/vendors': 'Vendors',
  '/products': 'Products',
  '/payouts': 'Payouts',
  '/content': 'Content',
};

export default function Layout() {
  const { logout, role, apiBase, setApiBase } = useApp();
  const [draftBase, setDraftBase] = useState(apiBase);
  const [savedAt, setSavedAt] = useState('');
  const location = useLocation();

  useEffect(() => {
    setDraftBase(apiBase);
  }, [apiBase]);

  const title = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/vendors/') && path !== '/vendors') return 'Vendor Profile';
    return titles[path] || 'Dashboard';
  }, [location.pathname]);

  const handleSaveBase = () => {
    setApiBase(draftBase.trim() || apiBase);
    setSavedAt('saved');
    setTimeout(() => setSavedAt(''), 1600);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <div className="brand-mark">LF</div>
          <div>
            <div className="brand-title">Lavish Fashion</div>
            <div className="brand-subtitle">Commerce Command</div>
          </div>
        </Link>
        <nav className="nav">
          {(role === 'vendor' ? vendorNav : adminNav).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <p>API calls target the configured base URL. Adjust anytime in the header.</p>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Lavish Fashion · Admin</p>
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="topbar-actions">
            <div className="api-control">
              <label className="label">
                <Link2 size={14} /> API base
              </label>
              <div className="api-row">
                <input
                  className="input"
                  value={draftBase}
                  onChange={(e) => setDraftBase(e.target.value)}
                  placeholder="http://localhost:4000/api"
                  spellCheck="false"
                />
                <button className="btn ghost" onClick={handleSaveBase}>
                  Apply
                </button>
              </div>
              <p className="muted xs">
                Currently <strong>{apiBase}</strong> {savedAt ? '· saved' : ''}
              </p>
            </div>
            <div className="user-chip">
              <div>
                <div className="chip-title">Signed in</div>
                <div className="chip-subtitle">{role || 'role not set'}</div>
              </div>
              <button className="icon-btn" onClick={logout} title="Log out">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
