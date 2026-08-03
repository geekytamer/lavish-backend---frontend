import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Edit, Trash2, Pause, Play, Save } from 'lucide-react';
import { useApiClient } from '../lib/api.js';
import { IMAGE_SPECS } from '../lib/images.js';
import { Modal } from '../components/Modal.jsx';
import { CuratedPicker } from '../components/CuratedPicker.jsx';
import { useImageCropper } from '../components/ImageCropper.jsx';

const PRICING_LABELS = { cpm: 'CPM', cpc: 'CPC', flat: 'Flat' };
const STATUS_TONES = { active: 'success', scheduled: 'info', paused: 'subtle', expired: 'danger' };

const emptyPromo = {
  title: '', subtitle: '', imageUrl: '', cta: '', link: '', sortOrder: 0, location: 'home',
  startAt: '', endAt: '', priority: 0, vendorId: '', pricingModel: 'flat', rate: 0, budget: 0, active: true,
};

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

// The <input type="datetime-local"> gives/takes wall-clock time in the admin's
// timezone. We store absolute UTC instants so scheduling is unambiguous.
function localToUtc(local) {
  if (!local) return '';
  const d = new Date(local); // parses datetime-local as local time
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function utcToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContentPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const content = useQuery({
    queryKey: ['content', api.base],
    queryFn: () => api.get('/content/home'),
  });
  const campaigns = useQuery({
    queryKey: ['admin-promos', api.base],
    queryFn: () => api.get('/content/promos/all').then((d) => d.promos || []),
  });
  const vendorsQuery = useQuery({
    queryKey: ['vendors', api.base],
    queryFn: () => api.get('/vendors').then((d) => d.vendors || []),
  });
  const productsQuery = useQuery({
    queryKey: ['products-all', api.base],
    queryFn: () => api.get('/products').then((d) => d.products || []),
  });
  const homeConfig = useQuery({
    queryKey: ['home-settings', api.base],
    queryFn: () => api.get('/content/home-settings'),
  });

  // Local (editable) state for the home layout, seeded from the server.
  const [featuredBrandIds, setFeaturedBrandIds] = useState([]);
  const [featuredProductIds, setFeaturedProductIds] = useState([]);
  const [newArrivalsEnabled, setNewArrivalsEnabled] = useState(true);
  const [homeDirty, setHomeDirty] = useState(false);
  const [syncedHome, setSyncedHome] = useState(null);

  // Seed editable state from the server response (adjust-during-render pattern:
  // resets the form whenever fresh server data arrives, without an effect).
  if (homeConfig.data && homeConfig.data !== syncedHome) {
    setSyncedHome(homeConfig.data);
    setFeaturedBrandIds((homeConfig.data.featuredVendors || []).map((v) => v.id));
    setFeaturedProductIds((homeConfig.data.featuredProducts || []).map((p) => p.id));
    setNewArrivalsEnabled(homeConfig.data.settings?.newArrivalsEnabled !== false);
    setHomeDirty(false);
  }

  const saveHome = useMutation({
    mutationFn: async () => {
      await api.post('/content/featured-brands', { ids: featuredBrandIds });
      await api.post('/content/featured-products', { ids: featuredProductIds });
      await api.patch('/content/home-settings', { newArrivalsEnabled });
    },
    onSuccess: () => {
      setHomeDirty(false);
      qc.invalidateQueries({ queryKey: ['home-settings', api.base] });
    },
  });
  const [categoryForm, setCategoryForm] = useState({ name: '', imageUrl: '', sortOrder: 0 });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [promoForm, setPromoForm] = useState(emptyPromo);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);

  const createCategory = useMutation({
    mutationFn: () =>
      editingCategory
        ? api.patch(`/content/categories/${editingCategory.id}`, categoryForm)
        : api.post('/content/categories', categoryForm),
    onSuccess: () => {
      setCategoryForm({ name: '', imageUrl: '', sortOrder: 0 });
      setEditingCategory(null);
      setShowCategoryModal(false);
      qc.invalidateQueries({ queryKey: ['content', api.base] });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id) => api.del(`/content/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content', api.base] }),
  });

  const invalidatePromos = () => {
    qc.invalidateQueries({ queryKey: ['content', api.base] });
    qc.invalidateQueries({ queryKey: ['admin-promos', api.base] });
  };

  const createPromo = useMutation({
    mutationFn: () => {
      const payload = {
        ...promoForm,
        startAt: localToUtc(promoForm.startAt),
        endAt: localToUtc(promoForm.endAt),
      };
      return editingPromo
        ? api.patch(`/content/promos/${editingPromo.id}`, payload)
        : api.post('/content/promos', payload);
    },
    onSuccess: () => {
      setPromoForm(emptyPromo);
      setEditingPromo(null);
      setShowPromoModal(false);
      invalidatePromos();
    },
  });

  const deletePromo = useMutation({
    mutationFn: (id) => api.del(`/content/promos/${id}`),
    onSuccess: invalidatePromos,
  });

  const togglePromoActive = useMutation({
    mutationFn: ({ id, active }) => api.patch(`/content/promos/${id}`, { active }),
    onSuccess: invalidatePromos,
  });

  const { cropFile, cropperModal } = useImageCropper();

  const uploadCategoryImage = useMutation({
    mutationFn: async (file) => {
      const res = await api.upload('/upload', file);
      return res.file?.url || res.file?.path;
    },
    onSuccess: (url) => setCategoryForm((f) => ({ ...f, imageUrl: url || f.imageUrl })),
  });

  const uploadPromoImage = useMutation({
    mutationFn: async (file) => {
      const res = await api.upload('/upload', file);
      return res.file?.url || res.file?.path;
    },
    onSuccess: (url) => setPromoForm((f) => ({ ...f, imageUrl: url || f.imageUrl })),
  });

  const handleCategoryImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const cropped = await cropFile(file, { aspect: IMAGE_SPECS.category.aspect, cropShape: 'rect', label: 'Category image' });
      uploadCategoryImage.mutate(cropped);
    } catch {
      /* cancelled */
    }
  };

  const handlePromoImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const cropped = await cropFile(file, { aspect: IMAGE_SPECS.banner.aspect, cropShape: 'rect', label: 'Ad banner' });
      uploadPromoImage.mutate(cropped);
    } catch {
      /* cancelled */
    }
  };

  const handleCategorySubmit = (e) => {
    e.preventDefault();
    createCategory.mutate();
  };

  const handlePromoSubmit = (e) => {
    e.preventDefault();
    createPromo.mutate();
  };

  const [tagForm, setTagForm] = useState({ name: '', sortOrder: 0 });
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);

  const createTag = useMutation({
    mutationFn: () =>
      editingTag
        ? api.patch(`/content/vendor-tags/${editingTag.id}`, tagForm)
        : api.post('/content/vendor-tags', tagForm),
    onSuccess: () => {
      setTagForm({ name: '', sortOrder: 0 });
      setEditingTag(null);
      setShowTagModal(false);
      qc.invalidateQueries({ queryKey: ['content', api.base] });
    },
  });

  const deleteTag = useMutation({
    mutationFn: (id) => api.del(`/content/vendor-tags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content', api.base] }),
  });

  const handleDeleteTag = (id) => {
    if (window.confirm('Delete this tag?')) deleteTag.mutate(id);
  };

  const handleTagSubmit = (e) => {
    e.preventDefault();
    createTag.mutate();
  };

  const promos = campaigns.data || [];
  const categories = content.data?.categories || [];
  const vendorTags = content.data?.vendorTags || [];
  const vendors = vendorsQuery.data || [];
  const products = productsQuery.data || [];

  const markHomeDirty = (setter) => (val) => {
    setter(val);
    setHomeDirty(true);
  };

  return (
    <div className="stack gap-lg">
      {/* Home page layout */}
      <div className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Storefront</p>
            <h3>Home Page</h3>
            <p className="muted xs">Curate what shoppers see on the app home screen.</p>
          </div>
          <button
            className="btn primary small"
            onClick={() => saveHome.mutate()}
            disabled={saveHome.isPending || !homeDirty}
          >
            <Save size={14} /> {saveHome.isPending ? 'Saving…' : homeDirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
        <div className="grid two gap-lg">
          <div className="stack gap-sm">
            <label className="label">Featured brands</label>
            <p className="muted xs">Pick and order the brands in the “Featured brands” row. Leave empty to show all brands.</p>
            <CuratedPicker
              options={vendors}
              value={featuredBrandIds}
              onChange={markHomeDirty(setFeaturedBrandIds)}
              getLabel={(v) => v.name}
              emptyHint="No featured brands — the app shows all brands."
            />
          </div>
          <div className="stack gap-sm">
            <label className="label">Featured items</label>
            <p className="muted xs">Pick and order the products in the “Featured items” row. Leave empty to hide the section.</p>
            <CuratedPicker
              options={products}
              value={featuredProductIds}
              onChange={markHomeDirty(setFeaturedProductIds)}
              getLabel={(p) => p.name}
              emptyHint="No featured items — the section is hidden."
            />
          </div>
        </div>
        <div className="section-divider" />
        <label className="switch">
          <input
            type="checkbox"
            checked={newArrivalsEnabled}
            onChange={(e) => markHomeDirty(setNewArrivalsEnabled)(e.target.checked)}
          />
          <span>
            <strong>New arrivals</strong> — automatically show the latest products
            <span className="muted xs" style={{ display: 'block' }}>
              When on, the newest products appear in a “New arrivals” section.
            </span>
          </span>
        </label>
        {saveHome.isError ? <p className="error">Couldn’t save the home layout.</p> : null}
      </div>

      <div className="grid two gap-lg">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Content</p>
              <h3>Categories</h3>
            </div>
            <button
              className="btn primary small"
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: '', imageUrl: '', sortOrder: 0 });
                setShowCategoryModal(true);
              }}
            >
              <Plus size={14} /> New
            </button>
          </div>
          <div className="table">
            <div className="table-head">
              <span>Name</span>
              <span>Image</span>
              <span>Sort</span>
              <span />
            </div>
            {categories.map((category) => (
              <div key={category.id} className="table-row">
                <span>{category.name}</span>
                <span className="mono">{category.image_url || category.imageUrl || '—'}</span>
                <span>{category.sort_order ?? category.sortOrder ?? 0}</span>
                <span className="inline gap-sm">
                  <button
                    className="icon-btn"
                    onClick={() => {
                      setEditingCategory(category);
                      setCategoryForm({
                        name: category.name || '',
                        imageUrl: category.image_url || category.imageUrl || '',
                        sortOrder: category.sort_order ?? category.sortOrder ?? 0,
                      });
                      setShowCategoryModal(true);
                    }}
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() => {
                      if (window.confirm('Delete this category?')) deleteCategory.mutate(category.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
            {content.isLoading ? <div className="empty">Loading categories...</div> : null}
            {!content.isLoading && categories.length === 0 ? (
              <div className="empty">No categories found.</div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Settings</p>
              <h3>Vendor Tags</h3>
            </div>
            <button
              className="btn primary small"
              onClick={() => {
                setEditingTag(null);
                setTagForm({ name: '', sortOrder: 0 });
                setShowTagModal(true);
              }}
            >
              <Plus size={14} /> New
            </button>
          </div>
          <div className="table">
            <div className="table-head">
              <span>Name</span>
              <span>Sort</span>
              <span />
            </div>
            {vendorTags.map((tag) => (
              <div key={tag.id} className="table-row">
                <span>{tag.name}</span>
                <span>{tag.sort_order ?? tag.sortOrder ?? 0}</span>
                <span className="inline gap-sm">
                  <button
                    className="icon-btn"
                    onClick={() => {
                      setEditingTag(tag);
                      setTagForm({
                        name: tag.name || '',
                        sortOrder: tag.sort_order ?? tag.sortOrder ?? 0,
                      });
                      setShowTagModal(true);
                    }}
                  >
                    <Edit size={14} />
                  </button>
                  <button className="icon-btn danger" onClick={() => handleDeleteTag(tag.id)}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
            {!content.isLoading && vendorTags.length === 0 ? <div className="empty">No tags found.</div> : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Monetization</p>
            <h3>Ad Campaigns</h3>
            <p className="muted xs">Scheduled, priced banner ads served to the app. Only live campaigns are shown to shoppers.</p>
          </div>
          <button
            className="btn primary small"
            onClick={() => {
              setEditingPromo(null);
              setPromoForm(emptyPromo);
              setShowPromoModal(true);
            }}
          >
            <Plus size={14} /> New campaign
          </button>
        </div>
        <div className="table">
          <div className="table-head">
            <span>Campaign</span>
            <span>Status</span>
            <span>Advertiser</span>
            <span>Placement</span>
            <span>Flight</span>
            <span>Pricing</span>
            <span>Performance</span>
            <span />
          </div>
          {promos.map((promo) => {
            const impressions = promo.impressions || 0;
            const clicks = promo.clicks || 0;
            const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0';
            return (
              <div key={promo.id} className="table-row">
                <span>
                  <div>{promo.title}</div>
                  <div className="muted xs">{promo.subtitle}</div>
                </span>
                <span>
                  <span className={`pill ${STATUS_TONES[promo.status] || 'subtle'}`}>{promo.status}</span>
                </span>
                <span className="xs">{promo.advertiser || <span className="muted">House</span>}</span>
                <span className="pill subtle mono xs">{promo.location || 'home'}</span>
                <span className="xs">{fmtDate(promo.start_at)} → {fmtDate(promo.end_at)}</span>
                <span className="xs">
                  <span className="pill info xs">{PRICING_LABELS[promo.pricing_model] || 'Flat'}</span>
                  {promo.rate ? <span className="muted"> · {promo.rate}</span> : null}
                </span>
                <span className="xs" title={`${impressions} impressions · ${clicks} clicks`}>
                  {impressions.toLocaleString()} imp · {ctr}% CTR
                </span>
                <span className="inline gap-sm">
                  <button
                    className="icon-btn"
                    title={promo.active ? 'Pause' : 'Resume'}
                    onClick={() => togglePromoActive.mutate({ id: promo.id, active: !promo.active })}
                  >
                    {promo.active ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => {
                      setEditingPromo(promo);
                      setPromoForm({
                        title: promo.title || '',
                        subtitle: promo.subtitle || '',
                        imageUrl: promo.image_url || promo.imageUrl || '',
                        cta: promo.cta || '',
                        link: promo.link || '',
                        sortOrder: promo.sort_order ?? promo.sortOrder ?? 0,
                        location: promo.location || 'home',
                        startAt: utcToLocalInput(promo.start_at),
                        endAt: utcToLocalInput(promo.end_at),
                        priority: promo.priority ?? 0,
                        vendorId: promo.vendor_id || '',
                        pricingModel: promo.pricing_model || 'flat',
                        rate: promo.rate ?? 0,
                        budget: promo.budget ?? 0,
                        active: !!promo.active,
                      });
                      setShowPromoModal(true);
                    }}
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() => {
                      if (window.confirm('Delete this campaign?')) deletePromo.mutate(promo.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            );
          })}
          {campaigns.isLoading ? <div className="empty">Loading campaigns...</div> : null}
          {!campaigns.isLoading && promos.length === 0 ? <div className="empty">No campaigns yet.</div> : null}
        </div>
      </div>

      <Modal
        open={showCategoryModal}
        title={editingCategory ? 'Edit category' : 'New category'}
        onClose={() => setShowCategoryModal(false)}
        footer={
          <>
            <button className="btn ghost" onClick={() => setShowCategoryModal(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleCategorySubmit} disabled={createCategory.isPending}>
              {createCategory.isPending ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <label className="label">
          Name
          <input
            className="input"
            required
            value={categoryForm.name}
            onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label className="label">
          Image URL
          <input
            className="input"
            value={categoryForm.imageUrl}
            onChange={(e) => setCategoryForm((f) => ({ ...f, imageUrl: e.target.value }))}
          />
          <div className="inline">
            <input type="file" accept="image/*" onChange={handleCategoryImage} />
            {uploadCategoryImage.isPending ? <span className="muted xs">Uploading…</span> : null}
            {uploadCategoryImage.isError ? (
              <span className="error xs">{uploadCategoryImage.error.message}</span>
            ) : null}
          </div>
          {categoryForm.imageUrl ? (
            <div className="preview">
              <img src={categoryForm.imageUrl} alt="Category" />
            </div>
          ) : null}
        </label>
        <label className="label">
          Sort order
          <input
            className="input"
            type="number"
            value={categoryForm.sortOrder}
            onChange={(e) => setCategoryForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
          />
        </label>
        {createCategory.isError ? <p className="error">Unable to save category.</p> : null}
      </Modal>

      <Modal
        open={showTagModal}
        title={editingTag ? 'Edit Tag' : 'New Tag'}
        onClose={() => setShowTagModal(false)}
        footer={
          <>
            <button className="btn ghost" onClick={() => setShowTagModal(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleTagSubmit} disabled={createTag.isPending}>
              {createTag.isPending ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <label className="label">
          Name
          <input
            className="input"
            required
            value={tagForm.name}
            onChange={(e) => setTagForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label className="label">
          Sort order
          <input
            className="input"
            type="number"
            value={tagForm.sortOrder}
            onChange={(e) => setTagForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
          />
        </label>
      </Modal>

      <Modal
        open={showPromoModal}
        title={editingPromo ? 'Edit campaign' : 'New campaign'}
        onClose={() => setShowPromoModal(false)}
        footer={
          <>
            <button className="btn ghost" onClick={() => setShowPromoModal(false)}>
              Cancel
            </button>
            <button className="btn primary" onClick={handlePromoSubmit} disabled={createPromo.isPending}>
              {createPromo.isPending ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <label className="label">
          Title
          <input
            className="input"
            required
            value={promoForm.title}
            onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label className="label">
          Subtitle
          <input
            className="input"
            value={promoForm.subtitle}
            onChange={(e) => setPromoForm((f) => ({ ...f, subtitle: e.target.value }))}
          />
        </label>
        <label className="label">
          Banner Location
          <select
            className="input"
            value={promoForm.location}
            onChange={(e) => setPromoForm((f) => ({ ...f, location: e.target.value }))}
          >
            <option value="home">Home Page</option>
            <option value="brands">Brands Page</option>
          </select>
        </label>
        <label className="label">
          Banner image
          <input
            className="input"
            value={promoForm.imageUrl}
            onChange={(e) => setPromoForm((f) => ({ ...f, imageUrl: e.target.value }))}
          />
          <div className="inline">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePromoImage} />
            {uploadPromoImage.isPending ? <span className="muted xs">Uploading…</span> : null}
            {uploadPromoImage.isError ? <span className="error xs">{uploadPromoImage.error.message}</span> : null}
          </div>
          <span className="muted xs">{IMAGE_SPECS.banner.hint}</span>
          {promoForm.imageUrl ? (
            <div className="preview" style={{ aspectRatio: '16 / 9', width: '100%', overflow: 'hidden', borderRadius: 12, marginTop: 8 }}>
              <img src={promoForm.imageUrl} alt="Ad banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : null}
        </label>
        <label className="label">
          CTA label
          <input
            className="input"
            value={promoForm.cta}
            onChange={(e) => setPromoForm((f) => ({ ...f, cta: e.target.value }))}
          />
        </label>
        <div className="grid two gap-md">
          <label className="label">
            Link Type
            <select
              className="input"
              value={promoForm.link.split(':')[0] || ''}
              onChange={(e) => {
                const type = e.target.value;
                const rest = promoForm.link.includes(':') ? promoForm.link.split(':').slice(1).join(':') : '';
                setPromoForm(f => ({ ...f, link: type ? `${type}:${rest}` : '' }));
              }}
            >
              <option value="">None</option>
              <option value="store">Store</option>
              <option value="product">Product</option>
              <option value="tag">Tag</option>
            </select>
          </label>
          <label className="label">
            Target Value
            <input
              className="input"
              value={promoForm.link.includes(':') ? promoForm.link.split(':').slice(1).join(':') : promoForm.link}
              onChange={(e) => {
                const val = e.target.value;
                const type = promoForm.link.includes(':') ? promoForm.link.split(':')[0] : '';
                setPromoForm(f => ({ ...f, link: type ? `${type}:${val}` : val }));
              }}
              disabled={!promoForm.link.includes(':')}
              placeholder={promoForm.link.startsWith('store') ? 'Vendor ID (e.g. v-...)' : promoForm.link.startsWith('product') ? 'Product ID (e.g. p-...)' : promoForm.link.startsWith('tag') ? 'Tag text' : ''}
            />
          </label>
        </div>
        <div className="section-divider" />
        <p className="eyebrow">Advertiser & monetization</p>
        <label className="label">
          Advertiser (brand)
          <select
            className="input"
            value={promoForm.vendorId}
            onChange={(e) => setPromoForm((f) => ({ ...f, vendorId: e.target.value }))}
          >
            <option value="">House ad (no advertiser)</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <span className="muted xs">Shown as “Sponsored by …” in the app and used for revenue attribution.</span>
        </label>
        <div className="grid two gap-md">
          <label className="label">
            Pricing model
            <select
              className="input"
              value={promoForm.pricingModel}
              onChange={(e) => setPromoForm((f) => ({ ...f, pricingModel: e.target.value }))}
            >
              <option value="flat">Flat (fixed fee)</option>
              <option value="cpm">CPM (per 1,000 views)</option>
              <option value="cpc">CPC (per click)</option>
            </select>
          </label>
          <label className="label">
            Rate (OMR)
            <input
              className="input"
              type="number"
              step="0.001"
              min="0"
              value={promoForm.rate}
              onChange={(e) => setPromoForm((f) => ({ ...f, rate: Number(e.target.value) }))}
            />
          </label>
        </div>
        <label className="label">
          Budget cap (OMR)
          <input
            className="input"
            type="number"
            step="0.001"
            min="0"
            value={promoForm.budget}
            onChange={(e) => setPromoForm((f) => ({ ...f, budget: Number(e.target.value) }))}
          />
        </label>

        <div className="section-divider" />
        <p className="eyebrow">Scheduling & priority</p>
        <div className="grid two gap-md">
          <label className="label">
            Starts
            <input
              className="input"
              type="datetime-local"
              value={promoForm.startAt}
              onChange={(e) => setPromoForm((f) => ({ ...f, startAt: e.target.value }))}
            />
          </label>
          <label className="label">
            Ends
            <input
              className="input"
              type="datetime-local"
              value={promoForm.endAt}
              onChange={(e) => setPromoForm((f) => ({ ...f, endAt: e.target.value }))}
            />
          </label>
        </div>
        <div className="grid two gap-md">
          <label className="label">
            Priority
            <input
              className="input"
              type="number"
              value={promoForm.priority}
              onChange={(e) => setPromoForm((f) => ({ ...f, priority: Number(e.target.value) }))}
            />
            <span className="muted xs">Higher shows first.</span>
          </label>
          <label className="label">
            Status
            <label className="inline gap-sm" style={{ marginTop: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={promoForm.active}
                onChange={(e) => setPromoForm((f) => ({ ...f, active: e.target.checked }))}
              />
              <span>{promoForm.active ? 'Live (respects schedule)' : 'Paused'}</span>
            </label>
          </label>
        </div>
        <p className="muted xs">Leave dates empty to run immediately with no end. A campaign only serves while live and within its flight window.</p>
        {createPromo.isError ? <p className="error">Unable to save campaign.</p> : null}
      </Modal>
      {cropperModal}
    </div>
  );
}
