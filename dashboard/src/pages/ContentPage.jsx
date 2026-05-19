import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useApiClient } from '../lib/api.js';
import { validateImage } from '../lib/images.js';
import { Modal } from '../components/Modal.jsx';

export function ContentPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const content = useQuery({
    queryKey: ['content', api.base],
    queryFn: () => api.get('/content/home'),
  });
  const [categoryForm, setCategoryForm] = useState({ name: '', imageUrl: '', sortOrder: 0 });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [promoForm, setPromoForm] = useState({ title: '', subtitle: '', imageUrl: '', cta: '', link: '', sortOrder: 0, location: 'home' });
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

  const createPromo = useMutation({
    mutationFn: () =>
      editingPromo ? api.patch(`/content/promos/${editingPromo.id}`, promoForm) : api.post('/content/promos', promoForm),
    onSuccess: () => {
      setPromoForm({ title: '', subtitle: '', imageUrl: '', cta: '', link: '', sortOrder: 0, location: 'home' });
      setEditingPromo(null);
      setShowPromoModal(false);
      qc.invalidateQueries({ queryKey: ['content', api.base] });
    },
  });

  const deletePromo = useMutation({
    mutationFn: (id) => api.del(`/content/promos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['content', api.base] }),
  });

  const uploadCategoryImage = useMutation({
    mutationFn: async (file) => {
      await validateImage(file);
      const res = await api.upload('/upload', file);
      return res.file?.url || res.file?.path;
    },
    onSuccess: (url) => setCategoryForm((f) => ({ ...f, imageUrl: url || f.imageUrl })),
  });

  const uploadPromoImage = useMutation({
    mutationFn: async (file) => {
      await validateImage(file);
      const res = await api.upload('/upload', file);
      return res.file?.url || res.file?.path;
    },
    onSuccess: (url) => setPromoForm((f) => ({ ...f, imageUrl: url || f.imageUrl })),
  });

  const handleCategoryImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadCategoryImage.mutate(file);
  };

  const handlePromoImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadPromoImage.mutate(file);
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

  const promos = content.data?.promos || [];
  const categories = content.data?.categories || [];
  const vendorTags = content.data?.vendorTags || [];

  return (
    <div className="stack gap-lg">
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
            <p className="eyebrow">Content</p>
            <h3>Promos</h3>
          </div>
          <button
            className="btn primary small"
            onClick={() => {
              setEditingPromo(null);
              setPromoForm({ title: '', subtitle: '', imageUrl: '', cta: '', link: '', sortOrder: 0, location: 'home' });
              setShowPromoModal(true);
            }}
          >
            <Plus size={14} /> New
          </button>
        </div>
        <div className="table">
          <div className="table-head">
            <span>Title</span>
            <span>Subtitle</span>
            <span>Location</span>
            <span>Sort</span>
            <span />
          </div>
          {promos.map((promo) => (
            <div key={promo.id} className="table-row">
              <span>{promo.title}</span>
              <span className="muted xs">{promo.subtitle}</span>
              <span className="pill subtle mono xs">{promo.location || 'home'}</span>
              <span>{promo.sort_order ?? promo.sortOrder ?? 0}</span>
              <span className="inline gap-sm">
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
                    });
                    setShowPromoModal(true);
                  }}
                >
                  <Edit size={14} />
                </button>
                <button
                  className="icon-btn danger"
                  onClick={() => {
                    if (window.confirm('Delete this promo?')) deletePromo.mutate(promo.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
          {content.isLoading ? <div className="empty">Loading promos...</div> : null}
          {!content.isLoading && promos.length === 0 ? <div className="empty">No promos yet.</div> : null}
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
        title={editingPromo ? 'Edit promo' : 'New promo'}
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
          Image URL
          <input
            className="input"
            value={promoForm.imageUrl}
            onChange={(e) => setPromoForm((f) => ({ ...f, imageUrl: e.target.value }))}
          />
          <div className="inline">
            <input type="file" accept="image/*" onChange={handlePromoImage} />
            {uploadPromoImage.isPending ? <span className="muted xs">Uploading…</span> : null}
            {uploadPromoImage.isError ? <span className="error xs">{uploadPromoImage.error.message}</span> : null}
          </div>
          {promoForm.imageUrl ? (
            <div className="preview">
              <img src={promoForm.imageUrl} alt="Promo" />
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
        <label className="label">
          Sort order
          <input
            className="input"
            type="number"
            value={promoForm.sortOrder}
            onChange={(e) => setPromoForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
          />
        </label>
        {createPromo.isError ? <p className="error">Unable to save promo.</p> : null}
      </Modal>
    </div>
  );
}
