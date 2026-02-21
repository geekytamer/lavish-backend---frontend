const express = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { resolveUrl, toRelative } = require('../lib/url');

const router = express.Router();

function parseProduct(row, req) {
  if (!row) return null;
  let gallery = [];
  try {
    gallery = row.gallery ? JSON.parse(row.gallery) : [];
  } catch (e) {
    gallery = [];
  }
  return {
    ...row,
    sizes: row.sizes ? JSON.parse(row.sizes) : [],
    colors: row.colors ? JSON.parse(row.colors) : [],
    tags: row.tags ? JSON.parse(row.tags) : [],
    gallery: gallery.map((g) => resolveUrl(req, g)),
    imageUrl: resolveUrl(
      req,
      row.imageUrl ||
      row.image_url ||
      fallbackImages[row.id] ||
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=60',
    ),
  };
}

router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { vendorId } = req.query;
    let query = 'SELECT * FROM products';
    const params = [];

    if (vendorId) {
      query += ' WHERE vendor_id = ?';
      params.push(vendorId);
    }

    const rows = db.all(query, params);
    res.json({ products: rows.map((row) => parseProduct(row, req)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/vendor/:vendorId', (req, res) => {
  try {
    const db = req.app.locals.db;
    const rows = db.all('SELECT * FROM products WHERE vendor_id = ?', [req.params.vendorId]);
    res.json({ products: rows.map((row) => parseProduct(row, req)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth(['admin', 'vendor']), (req, res) => {
  const {
    id,
    vendorId,
    name,
    description = '',
    price,
    sizes = [],
    colors = [],
    categoryId = null,
    imageUrl = '',
    gallery = [],
    isFeatured = false,
    stockQuantity = 0,
    tags = [],
  } = req.body || {};
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
  const resolvedVendorId = req.user?.role === 'vendor' ? req.user.vendorId : vendorId;
  if (!resolvedVendorId) return res.status(400).json({ error: 'vendorId required' });

  try {
    const db = req.app.locals.db;
    const productId = id || `p-${uuid().slice(0, 8)}`;
    const cleanImage = toRelative(imageUrl);
    const cleanGallery = (gallery || []).map((g) => toRelative(g));
    db.run(
      `INSERT INTO products (id, vendor_id, name, description, price, sizes, colors, category_id, image_url, gallery, is_featured, stock_quantity, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        resolvedVendorId,
        name,
        description,
        Number(price),
        JSON.stringify(sizes || []),
        JSON.stringify(colors || []),
        categoryId,
        cleanImage,
        JSON.stringify(cleanGallery),
        isFeatured ? 1 : 0,
        Number(stockQuantity) || 0,
        JSON.stringify(tags || []),
      ],
    );
    const created = db.get('SELECT * FROM products WHERE id = ?', [productId]);
    res.status(201).json({ product: parseProduct(created, req) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth(['admin', 'vendor']), (req, res) => {
  const { name, description, price, sizes, colors, categoryId, imageUrl, gallery, isFeatured, vendorId, stockQuantity, tags } = req.body || {};
  try {
    const db = req.app.locals.db;
    const existing = db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    const ownerVendor = existing.vendor_id;
    if (req.user?.role === 'vendor' && req.user.vendorId !== ownerVendor) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const resolvedVendorId = req.user?.role === 'vendor' ? req.user.vendorId : vendorId || ownerVendor;
    const cleanImage = imageUrl == null ? null : toRelative(imageUrl);
    const cleanGallery = gallery ? JSON.stringify((gallery || []).map((g) => toRelative(g))) : null;
    db.run(
      `UPDATE products
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           price = COALESCE(?, price),
           sizes = COALESCE(?, sizes),
           colors = COALESCE(?, colors),
           category_id = COALESCE(?, category_id),
           image_url = COALESCE(?, image_url),
           gallery = COALESCE(?, gallery),
           is_featured = COALESCE(?, is_featured),
           vendor_id = COALESCE(?, vendor_id),
           stock_quantity = COALESCE(?, stock_quantity),
           tags = COALESCE(?, tags)
       WHERE id = ?`,
      [
        name,
        description,
        price == null ? null : Number(price),
        sizes ? JSON.stringify(sizes) : null,
        colors ? JSON.stringify(colors) : null,
        categoryId,
        cleanImage,
        cleanGallery,
        isFeatured == null ? null : isFeatured ? 1 : 0,
        resolvedVendorId,
        stockQuantity == null ? null : Number(stockQuantity),
        tags ? JSON.stringify(tags) : null,
        req.params.id,
      ],
    );
    const updated = db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json({ product: parseProduct(updated, req) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth(['admin', 'vendor']), (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    if (req.user?.role === 'vendor' && req.user.vendorId !== existing.vendor_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const fallbackImages = {
  'p-slipdress':
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=60',
  'p-denim':
    'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=800&q=60',
  'p-blazer':
    'https://images.unsplash.com/photo-1496747611180-206a5c8c46bc?auto=format&fit=crop&w=800&q=60',
  'p-hoodie':
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=60',
};

module.exports = router;
