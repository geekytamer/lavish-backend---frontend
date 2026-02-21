import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Trash2, Plus, Images, Edit, Search } from 'lucide-react';
import { useApiClient } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.jsx';
import { validateImage } from '../lib/images.js';
import { Modal } from '../components/Modal.jsx';
import { StatCard } from '../components/StatCard.jsx';

export function ProductsPage() {
  const api = useApiClient();
  const { role, vendorId } = useApp();
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    vendorId: '',
    categoryId: '',
    name: '',
    price: '',
    description: '',
    imageUrl: '',
    gallery: [],
    sizes: '',
    colors: '',
    tags: '',
    stockQuantity: '',
  });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

  const products = useQuery({
    queryKey: ['products', api.base, role, vendorId],
    queryFn: () =>
      role === 'vendor' && vendorId
        ? api.get(`/products?vendorId=${vendorId}`).then((d) => d.products || [])
        : api.get('/products').then((d) => d.products || []),
  });
  const vendors = useQuery({
    queryKey: ['vendors', api.base],
    queryFn: () => api.get('/vendors').then((d) => d.vendors || []),
    enabled: role !== 'vendor',
  });
  const categories = useQuery({
    queryKey: ['categories', api.base],
    queryFn: () => api.get('/content/categories').then((d) => d.categories || []),
  });

  const saveProduct = useMutation({
    mutationFn: async () => {
      const uploadedUrls = [];
      for (const file of pendingFiles) {
        await validateImage(file);
        const res = await api.upload('/upload', file);
        uploadedUrls.push(res.file?.url || res.file?.path);
      }
      const payload = {
        vendorId: role === 'vendor' ? vendorId : form.vendorId,
        categoryId: form.categoryId || null,
        name: form.name,
        description: form.description,
        price: Number(form.price),
        stockQuantity: Number(form.stockQuantity),
        imageUrl: form.imageUrl || uploadedUrls[0] || '',
        gallery: [...form.gallery, ...uploadedUrls],
        sizes: form.sizes ? form.sizes.split(',').map((s) => s.trim()).filter(Boolean) : [],
        colors: form.colors ? form.colors.split(',').map((c) => c.trim()).filter(Boolean) : [],
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };
      if (editing) {
        return api.patch(`/products/${editing.id}`, payload);
      }
      return api.post('/products', payload);
    },
    onSuccess: () => {
      resetForm();
      qc.invalidateQueries({ queryKey: ['products', api.base, role, vendorId] });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: (id) => api.del(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', api.base] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payloadVendorId = role === 'vendor' ? vendorId : form.vendorId;
    setForm((f) => ({ ...f, vendorId: payloadVendorId || '' }));
    saveProduct.mutate();
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPendingFiles(files);
    setPreviewUrls(files.map((file) => URL.createObjectURL(file)));
  };

  const startNew = () => {
    resetForm();
    setForm((f) => ({ ...f, vendorId: role === 'vendor' ? vendorId : '' }));
    setShowModal(true);
  };

  const startEdit = (product) => {
    setEditing(product);
    setForm({
      vendorId: role === 'vendor' ? vendorId : product.vendor_id || product.vendorId || '',
      categoryId: product.category_id || product.categoryId || '',
      name: product.name || '',
      price: product.price || '',
      description: product.description || '',
      imageUrl: product.imageUrl || product.image_url || '',
      gallery: product.gallery || [],
      sizes: (product.sizes || []).join(','),
      colors: (product.colors || []).join(','),
      tags: (product.tags || []).join(','),
      stockQuantity: product.stock_quantity || 0,
    });
    setPendingFiles([]);
    setPreviewUrls(product.gallery || []);
    setShowModal(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setEditing(null);
    setForm({
      vendorId: role === 'vendor' ? vendorId : '',
      categoryId: '',
      name: '',
      price: '',
      description: '',
      imageUrl: '',
      gallery: [],
      sizes: '',
      colors: '',
      tags: '',
      stockQuantity: '',
    });
    setPendingFiles([]);
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowModal(false);
  };
  const insights = useMemo(() => {
    const list = products.data || [];
    const lowStock = list.filter(p => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) < 5).length;
    const outOfStock = list.filter(p => (p.stock_quantity || 0) === 0).length;
    const totalValue = list.reduce((sum, p) => sum + (Number(p.price || 0) * (p.stock_quantity || 0)), 0);
    return { count: list.length, lowStock, outOfStock, totalValue };
  }, [products.data]);

  const filteredProducts = (products.data || []).filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="stack gap-lg">
      <div className="grid cards-4 gap-md">
        <StatCard label="Active SKUs" value={insights.count} hint="Catalog size" />
        <StatCard label="Low Stock" value={insights.lowStock} hint="Needs refill soon" highlight={insights.lowStock > 0} tone="amber" />
        <StatCard label="Out of Stock" value={insights.outOfStock} hint="Immediate action" highlight={insights.outOfStock > 0} tone="danger" />
        <StatCard label="Inv. Value" value={formatCurrency(insights.totalValue)} hint="Gross stock price" />
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Products</p>
            <h3>Catalog</h3>
          </div>
          <div className="inline gap-md">
            <div className="search-box">
              <Search size={16} className="muted" />
              <input
                className="search-input"
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn primary small" onClick={startNew}>
              <Plus size={14} /> New
            </button>
          </div>
        </div>
        <div className="table">
          <div className="table-head">
            <span>Product</span>
            <span>Vendor</span>
            <span>Category</span>
            <span>Price</span>
            <span>Stock</span>
            <span>Gallery</span>
            <span>Sizes</span>
            <span>Colors</span>
            <span>Tags</span>
            <span />
            <span />
          </div>
          {filteredProducts.map((product) => (
            <div key={product.id} className="table-row">
              <span>
                <div className="mono pill subtle">{product.id}</div>
                <div>{product.name}</div>
              </span>
              <span>{product.vendor_id || product.vendorId}</span>
              <span>{product.category_id || product.categoryId || '—'}</span>
              <span>{formatCurrency(product.price)}</span>
              <span>
                {product.stock_quantity === 0 ? (
                  <span className="pill danger">Out of stock</span>
                ) : product.stock_quantity < 5 ? (
                  <span className="pill amber">Low: {product.stock_quantity}</span>
                ) : (
                  <span className="pill success">{product.stock_quantity} in stock</span>
                )}
              </span>
              <span className="tags">
                {(product.gallery || []).slice(0, 3).map((url) => (
                  <img key={url} src={url} alt="" className="thumb" />
                ))}
              </span>
              <span className="tags">
                {(product.sizes || []).map((s) => (
                  <span key={s} className="pill subtle">
                    {s}
                  </span>
                ))}
              </span>
              <span className="tags">
                {(product.colors || []).map((c) => (
                  <span key={c} className="pill info">
                    {c}
                  </span>
                ))}
              </span>
              <span className="tags">
                {(product.tags || []).map((t) => (
                  <span key={t} className="pill subtle">
                    {t}
                  </span>
                ))}
              </span>
              <span>
                <button className="icon-btn" onClick={() => startEdit(product)}>
                  <Edit size={14} />
                </button>
              </span>
              <span>
                <button
                  className="icon-btn danger"
                  onClick={() => {
                    if (window.confirm('Delete this product?')) deleteProduct.mutate(product.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
          {products.isLoading ? <div className="empty">Loading products...</div> : null}
          {!products.isLoading && (products.data || []).length === 0 ? (
            <div className="empty">No products yet.</div>
          ) : null}
        </div>
      </div>

      <Modal
        open={showModal}
        title={editing ? 'Edit product' : 'New product'}
        onClose={resetForm}
        footer={
          <>
            <button className="btn ghost" onClick={resetForm}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleSubmit} disabled={saveProduct.isPending}>
              <Plus size={14} />
              {saveProduct.isPending ? 'Saving...' : 'Save product'}
            </button>
          </>
        }
      >
        {role === 'vendor' ? (
          <p className="muted">Vendor: {vendorId || 'unknown'}</p>
        ) : (
          <label className="label">
            Vendor
            <select
              className="input"
              required
              value={form.vendorId}
              onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
            >
              <option value="">Select vendor</option>
              {(vendors.data || []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="label">
          Category
          <select
            className="input"
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          >
            <option value="">Unassigned</option>
            {(categories.data || []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Name
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label className="label">
          Price
          <input
            className="input"
            type="number"
            step="0.01"
            required
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </label>
        <label className="label">
          Stock Quantity
          <input
            className="input"
            type="number"
            min="0"
            required
            value={form.stockQuantity}
            onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))}
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
          Image URL
          <input
            className="input"
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            placeholder="https://..."
          />
          <div className="inline">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
            <button
              type="button"
              className="upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={saveProduct.isPending}
            >
              <Images size={16} />
              Select images
            </button>
            {pendingFiles.length ? (
              <span className="muted xs">{pendingFiles.length} selected · uploads on save</span>
            ) : null}
          </div>
          {form.imageUrl ? (
            <div className="preview">
              <img src={form.imageUrl} alt="Product" />
            </div>
          ) : null}
          {previewUrls.length ? (
            <div className="gallery-grid">
              {previewUrls.map((url) => (
                <img key={url} src={url} alt="" className="thumb" />
              ))}
            </div>
          ) : null}
        </label>
        <label className="label">
          Sizes (comma-separated)
          <input
            className="input"
            value={form.sizes}
            onChange={(e) => setForm((f) => ({ ...f, sizes: e.target.value }))}
          />
        </label>
        <label className="label">
          Colors (comma-separated)
          <input
            className="input"
            value={form.colors}
            onChange={(e) => setForm((f) => ({ ...f, colors: e.target.value }))}
          />
        </label>
        <label className="label">
          Tags (comma-separated)
          <input
            className="input"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          />
        </label>
        {saveProduct.isError ? (
          <p className="error">
            {saveProduct.error?.data?.error || saveProduct.error?.message || 'Could not save product.'}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
