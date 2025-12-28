const express = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { resolveUrl } = require('../lib/url');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const totalRow = db.get('SELECT COUNT(*) as count FROM orders');
    const orderRows = db.all(
      `SELECT * FROM orders ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    const ids = orderRows.map((o) => o.id);
    let items = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      items = db.all(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, ids);
    }
    const groupedByOrder = {};
    items.forEach((item) => {
      groupedByOrder[item.order_id] = groupedByOrder[item.order_id] || [];
      groupedByOrder[item.order_id].push(item);
    });
    const formatted = orderRows.map((row) => {
      const receipts = {};
      (groupedByOrder[row.id] || []).forEach((item) => {
        receipts[item.vendor_id] = receipts[item.vendor_id] || { items: [], subtotal: 0, status: item.status };
        receipts[item.vendor_id].items.push(item);
        receipts[item.vendor_id].subtotal += item.line_total;
      });
      return { ...row, vendorReceipts: receipts };
    });
    const total = totalRow?.count || 0;
    res.json({ orders: formatted, total, hasMore: offset + orderRows.length < total, nextOffset: offset + orderRows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { items = [], shippingAddress = '', customerEmail = '', customerPhone = '', id: clientOrderId } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items are required' });
  }
  if (items.length > 50) return res.status(400).json({ error: 'Too many line items' });
  for (const item of items) {
    if (!item.productId) return res.status(400).json({ error: 'productId required' });
    if (item.quantity !== undefined && Number(item.quantity) <= 0) {
      return res.status(400).json({ error: 'quantity must be positive' });
    }
  }
  const id = uuid();
  const orderId = typeof clientOrderId === 'string' && clientOrderId.trim() ? clientOrderId.trim() : id;
  const now = new Date().toISOString();

  try {
    const db = req.app.locals.db;
    const placeholders = items.map(() => '?').join(',');
    const rows = db.all(
      `SELECT id, vendor_id, price FROM products WHERE id IN (${placeholders})`,
      items.map((i) => i.productId),
    );
    if (!rows || rows.length !== items.length) {
      return res.status(400).json({ error: 'One or more products not found' });
    }
    const productMap = Object.fromEntries(rows.map((r) => [r.id, r]));
    const vendorReceipts = {};
    items.forEach((item) => {
      const product = productMap[item.productId];
      const quantity = item.quantity || 1;
      const lineTotal = product.price * quantity;
      vendorReceipts[product.vendor_id] = vendorReceipts[product.vendor_id] || {
        subtotal: 0,
        items: [],
      };
      vendorReceipts[product.vendor_id].subtotal += lineTotal;
      vendorReceipts[product.vendor_id].items.push({
        ...item,
        vendorId: product.vendor_id,
        lineTotal,
      });
    });
    const total = Object.values(vendorReceipts).reduce((sum, v) => sum + v.subtotal, 0);
    try {
      db.run(
        `INSERT INTO orders (id, customer_email, customer_phone, shipping_address, total, payment_status, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, customerEmail, customerPhone, shippingAddress, total, 'initiated', 'pending', now],
      );

      Object.values(vendorReceipts).forEach((receipt) => {
        receipt.items.forEach((it) =>
          db.run(
            `INSERT INTO order_items (order_id, product_id, quantity, color, size, line_total, status, vendor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, it.productId, it.quantity || 1, it.color || null, it.size || null, it.lineTotal, 'pending', it.vendorId],
          ),
        );
      });
      return res.status(201).json({
        order: {
          id: orderId,
          customerEmail,
          customerPhone,
          shippingAddress,
          total,
          paymentStatus: 'initiated',
          status: 'pending',
          createdAt: now,
          vendorReceipts,
        },
      });
    } catch (error) {
      console.error('Failed to create order', error);
      return res.status(500).json({ error: error.message || 'Failed to create order' });
    }
  } catch (err) {
    console.error('Unexpected error creating order', err);
    return res.status(500).json({ error: err.message || 'Failed to create order' });
  }
});

router.get('/products', (req, res) => {
  try {
    const db = req.app.locals.db;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const vendorFilter = req.query.vendorId ? 'WHERE vendor_id = ?' : '';
    const args = req.query.vendorId ? [req.query.vendorId] : [];
    const totalRow = db.get(`SELECT COUNT(*) as count FROM products ${vendorFilter}`, args);
    const rows = db.all(
      `SELECT * FROM products ${vendorFilter} LIMIT ? OFFSET ?`,
      req.query.vendorId ? [req.query.vendorId, limit, offset] : [limit, offset],
    );
    const parsed = rows.map((row) => ({
      ...row,
      sizes: row.sizes ? JSON.parse(row.sizes) : [],
      colors: row.colors ? JSON.parse(row.colors) : [],
      imageUrl: resolveUrl(
        req,
        row.imageUrl ||
          row.image_url ||
          fallbackImages[row.id] ||
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=60',
      ),
    }));
    const total = totalRow?.count || 0;
    res.json({
      products: parsed,
      total,
      hasMore: offset + rows.length < total,
      nextOffset: offset + rows.length,
    });
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

router.get('/:id', (req, res) => {
  const orderId = req.params.id;
  try {
    const db = req.app.locals.db;
    const orderRow = db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!orderRow) return res.status(404).json({ error: 'Not found' });
    const items = db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    const vendorReceipts = {};
    items.forEach((item) => {
      vendorReceipts[item.vendor_id] = vendorReceipts[item.vendor_id] || { items: [], subtotal: 0, status: item.status };
      vendorReceipts[item.vendor_id].items.push(item);
      vendorReceipts[item.vendor_id].subtotal += item.line_total;
    });
    res.json({
      order: {
        ...orderRow,
        items,
        vendorReceipts,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', requireAuth(['admin', 'vendor']), (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });
  const db = req.app.locals.db;
  const orderId = req.params.id;
  const orderRow = db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!orderRow) return res.status(404).json({ error: 'Not found' });

  try {
    if (req.user.role === 'vendor') {
      db.run('UPDATE order_items SET status = ? WHERE order_id = ? AND vendor_id = ?', [status, orderId, req.user.vendorId]);
    } else {
      db.run('UPDATE order_items SET status = ? WHERE order_id = ?', [status, orderId]);
      db.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    }
    const updatedOrder = db.get('SELECT * FROM orders WHERE id = ?', [orderId]) || orderRow;
    const items = db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    res.json({ order: { ...updatedOrder, items } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
