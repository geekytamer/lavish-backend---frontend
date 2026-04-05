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
  Tag,
  MessageSquare,
  Activity,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

const adminNav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: Receipt },
  { to: '/vendors', label: 'Vendors', icon: Store },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/payouts', label: 'Payouts', icon: Wallet },
  { to: '/content', label: 'Content', icon: Megaphone },
  { to: '/coupons', label: 'Coupons', icon: Tag },
  { to: '/reviews', label: 'Reviews', icon: MessageSquare },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: Activity },
];

const vendorNav = [
  { to: '/vendor/profile', label: 'My brand', icon: Store },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/orders', label: 'Orders', icon: Receipt },
  { to: '/analytics', label: 'Analytics', icon: Activity },
];

const titles = {
  '/': 'Overview',
  '/orders': 'Orders',
  '/vendors': 'Vendors',
  '/products': 'Products',
  '/payouts': 'Payouts',
  '/content': 'Content',
  '/users': 'Users',
  '/analytics': 'Analytics',
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
        <div style={{ marginTop: 'auto' }}>
          <button className="nav-link danger-hover" onClick={logout} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{role === 'admin' ? 'Administration' : 'Vendor Dashboard'}</p>
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="topbar-actions">
            <div className="api-control" style={{ opacity: 0.6 }}>
              {/* Hidden or subtle API control */}
            </div>
            <div className="user-chip">
              <div className="avatar">{role?.[0]?.toUpperCase()}</div>
              <div>
                <div className="chip-subtitle" style={{ fontSize: '14px' }}>{role === 'admin' ? 'Store Admin' : 'Vendor Partner'}</div>
              </div>
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
