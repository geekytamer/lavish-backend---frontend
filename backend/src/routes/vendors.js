const express = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');
const config = require('../config');

const router = express.Router();

const resend = new Resend(config.resendApiKey);

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

router.post('/', requireAuth(['admin']), async (req, res) => {
  const { name, email, password, description = '', tags = [], id, logo_url } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const db = req.app.locals.db;

    // 1. Check if user or vendor already exists
    const existingUser = db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const vendorId = id || `v-${uuid().slice(0, 8)}`;
    const userId = uuid();
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Create Vendor
    db.run(
      'INSERT INTO vendors (id, name, description, rating, tags, logo_url) VALUES (?, ?, ?, ?, ?, ?)',
      [vendorId, name, description, 5.0, JSON.stringify(tags || []), logo_url || null],
    );

    // 3. Create User
    db.run(
      'INSERT INTO users (id, email, password_hash, role, vendor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, email, hashedPassword, 'vendor', vendorId, new Date().toISOString()],
    );

    // 4. Send Credentials Email via Resend
    try {
      await resend.emails.send({
        from: 'Lavish Fashion <onboarding@resend.dev>', // Use verified domain in production
        to: email,
        subject: 'Welcome to Lavish - Your Vendor Credentials',
        html: `
          <h1>Welcome to Lavish, ${name}!</h1>
          <p>Your store has been successfully created. You can now log in to the vendor dashboard using the following credentials:</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${password}</p>
          <p>Please change your password after your first login.</p>
          <br/>
          <p>Best regards,<br/>The Lavish Team</p>
        `,
      });
      console.log(`[VENDORS] Credentials email sent to ${email}`);
    } catch (emailErr) {
      console.error('Failed to send vendor email:', emailErr);
      // We don't fail the whole request since the DB entries are made
    }

    const created = db.get('SELECT * FROM vendors WHERE id = ?', [vendorId]);
    res.status(201).json({
      vendor: parseVendor(created),
      message: 'Vendor created and credentials sent.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth(['admin']), (req, res) => {
  const { name, description, rating, tags, logo_url } = req.body || {};
  try {
    const db = req.app.locals.db;
    db.run(
      'UPDATE vendors SET name = COALESCE(?, name), description = COALESCE(?, description), rating = COALESCE(?, rating), tags = COALESCE(?, tags), logo_url = COALESCE(?, logo_url) WHERE id = ?',
      [name, description, rating == null ? null : Number(rating), tags ? JSON.stringify(tags) : null, logo_url || null, req.params.id],
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
    stats.itemsSold = db.get('SELECT SUM(quantity) as count FROM order_items WHERE vendor_id = ?', [vendorId]).count || 0;
    stats.aov = stats.orders > 0 ? stats.revenue / stats.orders : 0;
    stats.totalPaid = payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0);
    stats.balance = stats.revenue - stats.totalPaid;
    res.json({ vendor, products, receipts, payouts, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
