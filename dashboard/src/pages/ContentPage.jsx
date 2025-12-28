import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Edit } from 'lucide-react';
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
  const [promoForm, setPromoForm] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    cta: '',
    link: '',
    sortOrder: 0,
  });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
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

  const createPromo = useMutation({
    mutationFn: () =>
      editingPromo ? api.patch(`/content/promos/${editingPromo.id}`, promoForm) : api.post('/content/promos', promoForm),
    onSuccess: () => {
      setPromoForm({ title: '', subtitle: '', imageUrl: '', cta: '', link: '', sortOrder: 0 });
      setEditingPromo(null);
      setShowPromoModal(false);
      qc.invalidateQueries({ queryKey: ['content', api.base] });
    },
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

  const promos = content.data?.promos || [];
  const categories = content.data?.categories || [];

  return (
    <div className="stack gap-lg">
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
              <span>
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
            <p className="eyebrow">Content</p>
            <h3>Promos</h3>
          </div>
          <button
            className="btn primary small"
            onClick={() => {
              setEditingPromo(null);
              setPromoForm({ title: '', subtitle: '', imageUrl: '', cta: '', link: '', sortOrder: 0 });
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
            <span>Sort</span>
            <span />
          </div>
          {promos.map((promo) => (
            <div key={promo.id} className="table-row">
              <span>{promo.title}</span>
              <span className="muted xs">{promo.subtitle}</span>
              <span>{promo.sort_order ?? promo.sortOrder ?? 0}</span>
              <span>
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
                    });
                    setShowPromoModal(true);
                  }}
                >
                  <Edit size={14} />
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
        <label className="label">
          Link
          <input
            className="input"
            value={promoForm.link}
            onChange={(e) => setPromoForm((f) => ({ ...f, link: e.target.value }))}
          />
        </label>
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
