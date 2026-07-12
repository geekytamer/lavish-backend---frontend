import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Trash2, UserRound, Edit, Images, Search } from 'lucide-react';
import { useState } from 'react';
import { useApiClient } from '../lib/api.js';
import { validateImage, IMAGE_SPECS } from '../lib/images.js';
import { Modal } from '../components/Modal.jsx';



export function VendorsPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', rating: '', tags: '', email: '', password: '', logo_url: '', cover_image_url: '' });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);
  const [pendingLogo, setPendingLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [pendingCover, setPendingCover] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [imageError, setImageError] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [search, setSearch] = useState('');
  const [customTag, setCustomTag] = useState('');

  const handleLogoSelect = async (file) => {
    if (!file) return;
    setImageError('');
    try {
      await validateImage(file, { ...IMAGE_SPECS.logo, label: 'Logo' });
      setPendingLogo(file);
      setLogoPreview(URL.createObjectURL(file));
    } catch (err) {
      setImageError(err.message);
    }
  };

  const handleCoverSelect = async (file) => {
    if (!file) return;
    setImageError('');
    try {
      await validateImage(file, { ...IMAGE_SPECS.cover, label: 'Header image' });
      setPendingCover(file);
      setCoverPreview(URL.createObjectURL(file));
    } catch (err) {
      setImageError(err.message);
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const vendors = useQuery({
    queryKey: ['vendors', api.base],
    queryFn: () => api.get('/vendors').then((d) => d.vendors || []),
  });

  const tagsQuery = useQuery({
    queryKey: ['vendor-tags', api.base],
    queryFn: () => api.get('/content/vendor-tags').then((d) => d.tags || []),
  });

  const availableTags = tagsQuery.data || [];

  const saveVendor = useMutation({
    mutationFn: async () => {
      let logoUrl = form.logo_url;
      if (pendingLogo) {
        const res = await api.upload('/upload', pendingLogo);
        logoUrl = res.file?.url || res.file?.path;
      }
      let coverUrl = form.cover_image_url;
      if (pendingCover) {
        const res = await api.upload('/upload', pendingCover);
        coverUrl = res.file?.url || res.file?.path;
      }
      const payload = {
        name: form.name,
        description: form.description,
        rating: Number(form.rating) || 0,
        tags: selectedTags,
        logo_url: logoUrl,
        cover_image_url: coverUrl,
      };
      if (editing) {
        return api.patch(`/vendors/${editing.id}`, payload);
      }
      return api.post('/vendors', { ...payload, email: form.email, password: form.password });
    },
    onSuccess: () => {
      if (!editing) {
        setLastCreated({ email: form.email, password: form.password, name: form.name });
      }
      resetForm(false); // don't close modal yet if we want to show success, or handle differently
      qc.invalidateQueries({ queryKey: ['vendors', api.base] });
    },
  });

  const removeVendor = useMutation({
    mutationFn: (id) => api.del(`/vendors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors', api.base] }),
  });

  const resetForm = (close = true) => {
    setEditing(null);
    setForm({ name: '', description: '', rating: '', tags: '', email: '', password: '', logo_url: '', cover_image_url: '' });
    setPendingLogo(null);
    setLogoPreview(null);
    setPendingCover(null);
    setCoverPreview(null);
    setImageError('');
    setSelectedTags([]);
    if (close) {
      setShowModal(false);
      setLastCreated(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveVendor.mutate();
  };

  const filteredVendors = (vendors.data || []).filter((v) =>
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.id?.toLowerCase().includes(search.toLowerCase()) ||
    (v.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="stack gap-lg" >
      <div className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Vendors</p>
            <h3>All vendors</h3>
          </div>
          <div className="inline gap-md">
            <div className="search-box">
              <Search size={16} className="muted" />
              <input
                className="search-input"
                placeholder="Search brands or tags..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              className="btn primary small"
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              <Plus size={14} /> New
            </button>
          </div>
        </div>
        <div className="table">
          <div className="table-head">
            <span />
            <span>Name</span>
            <span>Rating</span>
            <span>Tags</span>
            <span>Profile</span>
            <span />
            <span />
          </div>
          {filteredVendors.map((vendor) => (
            <div key={vendor.id} className="table-row">
              <span>
                <div className="avatar small" style={{ overflow: 'hidden' }}>
                  {vendor.logo_url ? <img src={vendor.logo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : vendor.name?.[0]}
                </div>
              </span>
              <span>
                <div className="mono pill subtle">{vendor.id}</div>
                <div>{vendor.name}</div>
              </span>
              <span>{vendor.rating?.toFixed ? vendor.rating.toFixed(1) : vendor.rating || 0}</span>
              <span className="tags">
                {(vendor.tags || []).map((tag) => (
                  <span key={tag} className="pill info">
                    {tag}
                  </span>
                ))}
              </span>
              <span>
                <Link className="btn ghost small" to={`/vendors/${vendor.id}`}>
                  <UserRound size={14} />
                  View
                </Link>
              </span>
              <span>
                <button
                  className="icon-btn"
                  onClick={() => {
                    setEditing(vendor);
                    setForm({
                      name: vendor.name || '',
                      description: vendor.description || '',
                      rating: vendor.rating || '',
                      logo_url: vendor.logo_url || '',
                      cover_image_url: vendor.cover_image_url || '',
                    });
                    setSelectedTags(vendor.tags || []);
                    setShowModal(true);
                  }}
                  title="Edit vendor"
                >
                  <Edit size={14} />
                </button>
              </span>
              <span>
                <button
                  className="icon-btn danger"
                  onClick={() => {
                    if (window.confirm('Delete this vendor?')) removeVendor.mutate(vendor.id);
                  }}
                  title="Delete vendor"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
          {vendors.isLoading ? <div className="empty">Loading vendors...</div> : null}
          {!vendors.isLoading && (vendors.data || []).length === 0 ? (
            <div className="empty">No vendors found.</div>
          ) : null}
        </div>
      </div>

      <Modal
        open={showModal}
        title={lastCreated ? 'Vendor created' : editing ? 'Edit vendor' : 'New vendor'}
        onClose={() => resetForm(true)}
        footer={
          lastCreated ? (
            <button className="btn primary" onClick={() => resetForm(true)}>
              Done
            </button>
          ) : (
            <>
              <button className="btn ghost" onClick={() => resetForm(true)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSubmit} disabled={saveVendor.isPending}>
                <Plus size={14} />
                {saveVendor.isPending ? 'Saving...' : 'Save vendor'}
              </button>
            </>
          )
        }
      >
        {lastCreated ? (
          <div className="stack gap-sm">
            <p className="success">Vendor account for <strong>{lastCreated.name}</strong> has been created successfully.</p>
            <div className="card subtle">
              <p className="eyebrow">Credentials</p>
              <p>Email: <strong>{lastCreated.email}</strong></p>
              <p>Password: <strong>{lastCreated.password}</strong></p>
              <p className="muted xs">These details have been sent to the vendor via email.</p>
            </div>
          </div>
        ) : (
          <>
            <label className="label">
              Store Logo
              <div className="inline gap-md">
                <button className="upload-btn" onClick={() => document.getElementById('logo-file').click()}>
                  <Images size={14} /> Select Logo
                </button>
                {(logoPreview || form.logo_url) && <img src={logoPreview || form.logo_url} className="avatar" />}
                <input
                  id="logo-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => handleLogoSelect(e.target.files[0])}
                />
              </div>
              <span className="muted xs">{IMAGE_SPECS.logo.hint}</span>
            </label>
            <label className="label">
              Brand Header Image
              <div className="inline gap-md">
                <button className="upload-btn" onClick={() => document.getElementById('cover-file').click()}>
                  <Images size={14} /> Select Header
                </button>
                <input
                  id="cover-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => handleCoverSelect(e.target.files[0])}
                />
              </div>
              {(coverPreview || form.cover_image_url) && (
                <div
                  className="preview"
                  style={{ aspectRatio: '3 / 1', width: '100%', overflow: 'hidden', borderRadius: 12, marginTop: 8 }}
                >
                  <img
                    src={coverPreview || form.cover_image_url}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
              <span className="muted xs">{IMAGE_SPECS.cover.hint} Shown as the banner on the brand profile.</span>
            </label>
            {imageError ? <p className="error">{imageError}</p> : null}
            <label className="label">
              Name
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            {!editing && (
              <>
                <label className="label">
                  Vendor Email
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="store-admin@example.com"
                    required
                  />
                </label>
                <label className="label">
                  Temporary Password (sent via email)
                  <input
                    className="input"
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="SecurePass123!"
                    required
                  />
                </label>
              </>
            )}
            <label className="label">
              Rating
              <input
                className="input"
                type="number"
                step="0.1"
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
              />
            </label>
            <label className="label">
              Description
              <textarea
                className="input"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="label">
              Tags
              {selectedTags.length > 0 && (
                <div className="flex-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {selectedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="pill primary clickable"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleTag(tag);
                      }}
                      style={{ border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {tag}
                      <span style={{ opacity: 0.6, fontSize: '14px', lineHeight: 1 }}>×</span>
                    </button>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select 
                  className="input" 
                  style={{ flex: '1 1 150px' }}
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !selectedTags.includes(val)) {
                      setSelectedTags([...selectedTags, val]);
                    }
                  }}
                >
                  <option value="" disabled>Select global tag...</option>
                  {availableTags.map(t => (
                     <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
                
                <div style={{ display: 'flex', gap: '8px', flex: '1 1 200px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="or type custom tag..."
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = customTag.trim();
                        if (val && !selectedTags.includes(val)) {
                          setSelectedTags([...selectedTags, val]);
                        }
                        setCustomTag('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => {
                      const val = customTag.trim();
                      if (val && !selectedTags.includes(val)) {
                        setSelectedTags([...selectedTags, val]);
                      }
                      setCustomTag('');
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </label>
            {saveVendor.isError ? <p className="error">Could not save vendor.</p> : null}
          </>
        )}
      </Modal>
    </div >
  );
}
