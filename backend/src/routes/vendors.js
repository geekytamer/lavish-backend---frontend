const express = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function parseVendor(row) {
  return row
    ? {
        ...row,
        tags: row.tags ? JSON.parse(row.tags) : [],
      }
    : null;
}

router.get('/', (_req, res) => {
  try {
    const db = _req.app.locals.db;
    const rows = db.all('SELECT * FROM vendors');
    res.json({ vendors: rows.map(parseVendor) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth(['admin']), (req, res) => {
  const { name, description = '', rating = 0, tags = [], id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const db = req.app.locals.db;
    const vendorId = id || `v-${uuid().slice(0, 8)}`;
    db.run(
      'INSERT INTO vendors (id, name, description, rating, tags) VALUES (?, ?, ?, ?, ?)',
      [vendorId, name, description, Number(rating) || 0, JSON.stringify(tags || [])],
    );
    const created = db.get('SELECT * FROM vendors WHERE id = ?', [vendorId]);
    res.status(201).json({ vendor: parseVendor(created) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth(['admin']), (req, res) => {
  const { name, description, rating, tags } = req.body || {};
  try {
    const db = req.app.locals.db;
    db.run(
      'UPDATE vendors SET name = COALESCE(?, name), description = COALESCE(?, description), rating = COALESCE(?, rating), tags = COALESCE(?, tags) WHERE id = ?',
      [name, description, rating == null ? null : Number(rating), tags ? JSON.stringify(tags) : null, req.params.id],
    );
    const updated = db.get('SELECT * FROM vendors WHERE id = ?', [req.params.id]);
    if (!updated) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ vendor: parseVendor(updated) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth(['admin']), (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.get('SELECT id FROM vendors WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Vendor not found' });
    db.run('DELETE FROM vendors WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/orders', requireAuth(['admin', 'vendor']), (req, res) => {
  try {
    const db = req.app.locals.db;
    const vendorId = req.params.id;
    if (req.user?.role === 'vendor' && req.user.vendorId !== vendorId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = db.all(
      `SELECT oi.*, 
              o.customer_email, o.customer_phone, o.shipping_address, o.created_at,
              o.status as order_status, o.payment_status, o.total as order_total,
              p.name as product_name, p.description as product_description, p.image_url as product_image_url
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.vendor_id = ?
       ORDER BY datetime(o.created_at) DESC`,
      [vendorId],
    );
    const grouped = {};
    rows.forEach((row) => {
      const orderId = row.order_id;
      if (!grouped[orderId]) {
        grouped[orderId] = {
          id: orderId,
          created_at: row.created_at,
          status: row.order_status,
          payment_status: row.payment_status,
          customer_email: row.customer_email,
          customer_phone: row.customer_phone,
          shipping_address: row.shipping_address,
          items: [],
          subtotal: 0,
        };
      }
      grouped[orderId].items.push({
        id: row.id,
        product_id: row.product_id,
        product_name: row.product_name,
        product_description: row.product_description,
        product_image_url: row.product_image_url,
        quantity: row.quantity,
        color: row.color,
        size: row.size,
        line_total: row.line_total,
        status: row.status,
      });
      grouped[orderId].subtotal += row.line_total || 0;
    });
    res.json({ orders: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/receipts', (req, res) => {
  try {
    const db = req.app.locals.db;
    const vendorId = req.params.id;
    const orders = db.all(
      `SELECT o.id, o.created_at, o.status, o.payment_status,
              SUM(oi.line_total) as subtotal
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.vendor_id = ?
       GROUP BY o.id
       ORDER BY datetime(o.created_at) DESC`,
      [vendorId],
    );
    const total = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    res.json({ receipts: orders, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/profile', (req, res) => {
  try {
    const db = req.app.locals.db;
    const vendorId = req.params.id;
    const vendor = parseVendor(db.get('SELECT * FROM vendors WHERE id = ?', [vendorId]));
    if (!vendor) return res.status(404).json({ error: 'Not found' });
    const products = db.all('SELECT * FROM products WHERE vendor_id = ?', [vendorId]);
    const receipts = db.all(
      `SELECT o.id, o.created_at, o.status, o.payment_status,
              SUM(oi.line_total) as subtotal
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.vendor_id = ?
       GROUP BY o.id
       ORDER BY datetime(o.created_at) DESC`,
      [vendorId],
    );
    const payouts = db.all('SELECT * FROM payouts WHERE vendor_id = ? ORDER BY datetime(created_at) DESC', [vendorId]);
    const stats = {
      orders: receipts.length,
      revenue: receipts.reduce((sum, r) => sum + (r.subtotal || 0), 0),
    };
    res.json({ vendor, products, receipts, payouts, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
