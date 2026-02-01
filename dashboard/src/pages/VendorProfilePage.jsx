import { useParams, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Edit, Camera, Save, X } from 'lucide-react';
import { useApiClient } from '../lib/api.js';
import { formatCurrency, formatDateTime, weeklyBuckets } from '../lib/formatters.js';
import { StatusPill } from '../components/StatusPill.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Modal } from '../components/Modal.jsx';

const VENDOR_CATEGORIES = [
  'Womenswear',
  'Menswear',
  'Streetwear',
  'Accessories',
  'Evening',
  'Athleisure',
  'Denim',
  'Footwear',
  'Luxury',
];

export function VendorProfilePage() {
  const { id: routeId } = useParams();
  // ...
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', tags: [], logo_url: '' });
  const [pendingLogo, setPendingLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const startEdit = () => {
    setEditForm({
      name: data.vendor.name || '',
      description: data.vendor.description || '',
      tags: data.vendor.tags || [],
      logo_url: data.vendor.logo_url || '',
    });
    setShowEditModal(true);
  };

  const updateVendor = useMutation({
    mutationFn: async (payload) => {
      let logoUrl = payload.logo_url;
      if (pendingLogo) {
        const res = await api.upload('/upload', pendingLogo);
        logoUrl = res.file?.url || res.file?.path;
      }
      return api.patch(`/vendors/${resolvedId}`, { ...payload, logo_url: logoUrl });
    },
    onSuccess: () => {
      setShowEditModal(false);
      setPendingLogo(null);
      setLogoPreview(null);
      qc.invalidateQueries({ queryKey: ['vendor-profile', api.base, resolvedId] });
    },
  });

  const toggleTag = (tag) => {
    setEditForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };
  const { role, vendorId } = useApp();
  const resolvedId = routeId || vendorId;
  if (!resolvedId) return <Navigate to="/login" replace />;
  const api = useApiClient();
  const qc = useQueryClient();
  const [payoutAmount, setPayoutAmount] = useState('');

  const profile = useQuery({
    queryKey: ['vendor-profile', api.base, resolvedId],
    queryFn: () => api.get(`/vendors/${resolvedId}/profile`),
  });
  const data = profile.data || { vendor: {}, stats: {}, products: [], receipts: [], payouts: [] };

  const weekly = useMemo(() => weeklyBuckets(data.receipts), [data.receipts]);
  const weeklyMax = useMemo(
    () => Math.max(...weekly.map((w) => Number(w.total || 0)), 1),
    [weekly],
  );

  const createPayout = useMutation({
    mutationFn: () => api.post('/payouts', { vendorId: resolvedId, amount: Number(payoutAmount || 0) }),
    onSuccess: () => {
      setPayoutAmount('');
      qc.invalidateQueries({ queryKey: ['vendor-profile', api.base, resolvedId] });
      qc.invalidateQueries({ queryKey: ['payouts', api.base] });
    },
  });

  return (
    <div className="stack gap-lg">
      <div className="card vendor-hero">
        <div className="grid two gap-xl align-center">
          <div>
            <div className="inline between">
              <p className="eyebrow">Partner Entity</p>
              {role === 'vendor' && (
                <button className="btn ghost small" onClick={startEdit}>
                  <Edit size={14} /> Edit Brand
                </button>
              )}
            </div>
            <div className="inline gap-lg align-center mt-sm">
              <div className="avatar large" style={{ width: '80px', height: '80px', fontSize: '24px' }}>
                {data.vendor.logo_url ? <img src={data.vendor.logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : (data.vendor.name || resolvedId)[0]}
              </div>
              <div>
                <h1 className="display" style={{ fontSize: '32px' }}>{data.vendor.name || resolvedId}</h1>
                <div className="inline gap-md mt-xs">
                  <div className="pill info">{data.vendor.rating ? `${data.vendor.rating.toFixed(1)} ★ Rating` : 'New Partner'}</div>
                  <div className="pill success">Active Status</div>
                </div>
              </div>
            </div>
            <p className="description mt-md">{data.vendor.description || 'No description provided.'}</p>
            <div className="flex-wrap mt-md" style={{ display: 'flex', gap: '6px' }}>
              {(data.vendor.tags || []).map(t => <span key={t} className="pill subtle mono xs">{t}</span>)}
            </div>
          </div>
          <div className="grid cards-3 gap-md">
            <StatCard label="Orders" value={data.stats.orders || 0} hint="Total transactions" />
            <StatCard label="Revenue" value={formatCurrency(data.stats.revenue || 0)} hint="Gross sales" />
            <StatCard label="Balance Due" value={formatCurrency(data.stats.balance || 0)} hint="Unpaid amount" highlight={Number(data.stats.balance) > 0} />
            <StatCard label="Items Sold" value={data.stats.itemsSold || 0} hint="Total units" />
            <StatCard label="Avg. Order" value={formatCurrency(data.stats.aov || 0)} hint="Per receipt" />
            <StatCard label="Paid Out" value={formatCurrency(data.stats.totalPaid || 0)} hint="Completed payouts" />
          </div>
        </div>
      </div>

      <Modal
        open={showEditModal}
        title="Edit Brand Profile"
        onClose={() => setShowEditModal(false)}
        footer={
          <>
            <button className="btn ghost" onClick={() => setShowEditModal(false)}>Cancel</button>
            <button className="btn primary" onClick={() => updateVendor.mutate(editForm)} disabled={updateVendor.isPending}>
              <Save size={14} /> {updateVendor.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="stack gap-md">
          <label className="label">
            Store Logo
            <div className="inline gap-md">
              <button className="upload-btn" onClick={() => document.getElementById('vendor-logo-file').click()}>
                <Camera size={14} /> Change Logo
              </button>
              {(logoPreview || editForm.logo_url) && (
                <img src={logoPreview || editForm.logo_url} className="avatar" style={{ width: '60px', height: '60px' }} />
              )}
              <input
                id="vendor-logo-file"
                type="file"
                hidden
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setPendingLogo(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }
                }}
              />
            </div>
          </label>
          <label className="label">
            Display Name
            <input
              className="input"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="label">
            Bio / Description
            <textarea
              className="input"
              rows={3}
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="label">
            Brand Categorization
            <div className="flex-wrap mt-xs" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {VENDOR_CATEGORIES.map((tag) => {
                const active = editForm.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`pill ${active ? 'primary' : 'subtle'} clickable`}
                    onClick={() => toggleTag(tag)}
                    style={{ border: 'none' }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </label>
        </div>
      </Modal>

      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Receipts</p>
              <h3>Orders for this vendor</h3>
            </div>
          </div>
          <div className="table">
            <div className="table-head">
              <span>Order</span>
              <span>Subtotal</span>
              <span>Status</span>
              <span>Payment</span>
              <span>Date</span>
            </div>
            {(data.receipts || []).map((r) => (
              <div key={r.id} className="table-row">
                <span className="mono">{r.id.slice(0, 8)}</span>
                <span>{formatCurrency(r.subtotal)}</span>
                <span>
                  <StatusPill value={r.status} />
                </span>
                <span>
                  <StatusPill value={r.payment_status} />
                </span>
                <span>{formatDateTime(r.created_at)}</span>
              </div>
            ))}
            {!profile.isLoading && (data.receipts || []).length === 0 ? (
              <div className="empty">No receipts yet.</div>
            ) : null}
            {profile.isLoading ? <div className="empty">Loading receipts…</div> : null}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Products</p>
              <h3>Catalog</h3>
            </div>
          </div>
          <div className="list">
            {(data.products || []).map((product) => (
              <div key={product.id} className="list-item">
                <div className="list-title">{product.name}</div>
                <p className="muted xs">{product.description}</p>
                <div className="muted xs">{formatCurrency(product.price)}</div>
              </div>
            ))}
            {!profile.isLoading && (data.products || []).length === 0 ? (
              <div className="empty">No products for this vendor.</div>
            ) : null}
            {profile.isLoading ? <div className="empty">Loading products…</div> : null}
          </div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Payouts</p>
              <h3>History</h3>
            </div>
          </div>
          <div className="table">
            <div className="table-head">
              <span>Payout</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Created</span>
            </div>
            {(data.payouts || []).map((payout) => (
              <div key={payout.id} className="table-row">
                <span className="mono">{payout.id.slice(0, 8)}</span>
                <span>{formatCurrency(payout.amount)}</span>
                <span>
                  <StatusPill value={payout.status} />
                </span>
                <span>{formatDateTime(payout.created_at)}</span>
              </div>
            ))}
            {!profile.isLoading && (data.payouts || []).length === 0 ? (
              <div className="empty">No payouts yet.</div>
            ) : null}
          </div>
          <form className="inline gap-sm" onSubmit={(e) => e.preventDefault()}>
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Amount"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
            />
            <button
              className="btn primary"
              onClick={() => createPayout.mutate()}
              disabled={createPayout.isPending || !payoutAmount}
            >
              <Plus size={14} />
              Quick payout
            </button>
            {createPayout.isError ? <p className="error">Failed to create payout.</p> : null}
          </form>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Weekly receipts</p>
              <h3>Momentum</h3>
            </div>
          </div>
          <div className="bars">
            {weekly.map((w) => (
              <div key={w.week} className="bar">
                <div
                  className="bar-fill"
                  style={{ height: `${Math.max(8, Math.round((Number(w.total || 0) / weeklyMax) * 100))}%` }}
                />
                <span className="muted xs">{w.week}</span>
                <span className="muted xs">{formatCurrency(w.total)}</span>
              </div>
            ))}
            {weekly.length === 0 ? <div className="empty">No weekly data.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
