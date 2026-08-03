import { useParams, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, Plus, Edit, Camera, Save, X } from 'lucide-react';
import { useApiClient } from '../lib/api.js';
import { IMAGE_SPECS } from '../lib/images.js';
import { useImageCropper } from '../components/ImageCropper.jsx';
import { formatCurrency, formatDateTime, weeklyBuckets } from '../lib/formatters.jsx';
import { StatusPill } from '../components/StatusPill.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Modal } from '../components/Modal.jsx';

// dynamic vendor tags now sourced from api

export function VendorProfilePage() {
  const { id: routeId } = useParams();
  // ...
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', tags: [], logo_url: '', cover_image_url: '' });
  const [pendingLogo, setPendingLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [pendingCover, setPendingCover] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [imageError, setImageError] = useState('');
  const [customTag, setCustomTag] = useState('');

  const startEdit = () => {
    setEditForm({
      name: data.vendor.name || '',
      description: data.vendor.description || '',
      tags: data.vendor.tags || [],
      logo_url: data.vendor.logo_url || '',
      cover_image_url: data.vendor.cover_image_url || '',
    });
    setPendingLogo(null);
    setLogoPreview(null);
    setPendingCover(null);
    setCoverPreview(null);
    setImageError('');
    setCustomTag('');
    setShowEditModal(true);
  };

  const { cropFile, cropperModal } = useImageCropper();

  const handleLogoSelect = async (file) => {
    if (!file) return;
    setImageError('');
    try {
      const cropped = await cropFile(file, { aspect: IMAGE_SPECS.logo.aspect, cropShape: 'round', label: 'Logo' });
      setPendingLogo(cropped);
      setLogoPreview(URL.createObjectURL(cropped));
    } catch (err) {
      if (err.message !== 'cancelled') setImageError(err.message);
    }
  };

  const handleCoverSelect = async (file) => {
    if (!file) return;
    setImageError('');
    try {
      const cropped = await cropFile(file, { aspect: IMAGE_SPECS.cover.aspect, cropShape: 'rect', label: 'Header image' });
      setPendingCover(cropped);
      setCoverPreview(URL.createObjectURL(cropped));
    } catch (err) {
      if (err.message !== 'cancelled') setImageError(err.message);
    }
  };

  const updateVendor = useMutation({
    mutationFn: async (payload) => {
      let logoUrl = payload.logo_url;
      if (pendingLogo) {
        const res = await api.upload('/upload', pendingLogo);
        logoUrl = res.file?.url || res.file?.path;
      }
      let coverUrl = payload.cover_image_url;
      if (pendingCover) {
        const res = await api.upload('/upload', pendingCover);
        coverUrl = res.file?.url || res.file?.path;
      }
      return api.patch(`/vendors/${resolvedId}`, { ...payload, logo_url: logoUrl, cover_image_url: coverUrl });
    },
    onSuccess: () => {
      setShowEditModal(false);
      setPendingLogo(null);
      setLogoPreview(null);
      setPendingCover(null);
      setCoverPreview(null);
      qc.invalidateQueries({ queryKey: ['vendor-profile', api.base, resolvedId] });
    },
  });

  const toggleTag = (tag) => {
    setEditForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const addCustomTag = () => {
    const val = customTag.trim();
    if (!val) return;
    setEditForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(val) ? prev.tags : [...prev.tags, val],
    }));
    setCustomTag('');
  };
  const { role, vendorId } = useApp();
  const resolvedId = routeId || vendorId;
  const api = useApiClient();
  const qc = useQueryClient();
  const [payoutAmount, setPayoutAmount] = useState('');

  const profile = useQuery({
    queryKey: ['vendor-profile', api.base, resolvedId],
    queryFn: () => api.get(`/vendors/${resolvedId}/profile`),
  });

  const tagsQuery = useQuery({
    queryKey: ['vendor-tags', api.base],
    queryFn: () => api.get('/content/vendor-tags').then((d) => d.tags || []),
  });
  const availableTags = tagsQuery.data || [];

  const data = profile.data || { vendor: {}, stats: {}, products: [], receipts: [], payouts: [] };

  const weekly = weeklyBuckets(data.receipts);
  const weeklyMax = Math.max(...weekly.map((w) => Number(w.total || 0)), 1);

  const createPayout = useMutation({
    mutationFn: () => api.post('/payouts', { vendorId: resolvedId, amount: Number(payoutAmount || 0) }),
    onSuccess: () => {
      setPayoutAmount('');
      qc.invalidateQueries({ queryKey: ['vendor-profile', api.base, resolvedId] });
      qc.invalidateQueries({ queryKey: ['payouts', api.base] });
    },
  });

  if (!resolvedId) return <Navigate to="/login" replace />;

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
            Brand Header Image
            <div className="inline gap-md">
              <button className="upload-btn" onClick={() => document.getElementById('vendor-cover-file').click()}>
                <Camera size={14} /> Change Header
              </button>
              <input
                id="vendor-cover-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => handleCoverSelect(e.target.files[0])}
              />
            </div>
            {(coverPreview || editForm.cover_image_url) && (
              <div className="preview" style={{ aspectRatio: '3 / 1', width: '100%', overflow: 'hidden', borderRadius: 12, marginTop: 8 }}>
                <img src={coverPreview || editForm.cover_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <span className="muted xs">{IMAGE_SPECS.cover.hint} Shown as the banner on your brand page.</span>
          </label>

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
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => handleLogoSelect(e.target.files[0])}
              />
            </div>
            <span className="muted xs">{IMAGE_SPECS.logo.hint}</span>
          </label>

          {imageError ? <p className="error">{imageError}</p> : null}

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
            {editForm.tags.length > 0 && (
              <div className="flex-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: 8 }}>
                {editForm.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="pill primary clickable"
                    onClick={() => toggleTag(tag)}
                    style={{ border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {tag}
                    <span style={{ opacity: 0.6 }}>×</span>
                  </button>
                ))}
              </div>
            )}
            {availableTags.filter((t) => !editForm.tags.includes(t.name)).length > 0 && (
              <div className="flex-wrap mt-xs" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {availableTags
                  .filter((t) => !editForm.tags.includes(t.name))
                  .map((tagObj) => (
                    <button
                      key={tagObj.name}
                      type="button"
                      className="pill subtle clickable"
                      onClick={() => toggleTag(tagObj.name)}
                      style={{ border: 'none' }}
                    >
                      + {tagObj.name}
                    </button>
                  ))}
              </div>
            )}
            <div className="inline gap-sm" style={{ marginTop: 8 }}>
              <input
                className="input"
                placeholder="Add your own category…"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
              />
              <button type="button" className="btn ghost small" onClick={addCustomTag}>Add</button>
            </div>
          </label>

          {updateVendor.isError ? (
            <p className="error">{updateVendor.error?.message || 'Could not save changes.'}</p>
          ) : null}
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
          {role !== 'vendor' && (
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
          )}
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
      {cropperModal}
    </div>
  );
}
