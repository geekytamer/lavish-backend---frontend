const express = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// categories CRUD
router.get('/categories', (req, res) => {
  const db = req.app.locals.db;
  const rows = db.all('SELECT * FROM categories ORDER BY sort_order');
  res.json({ categories: rows });
});

router.post('/categories', requireAuth(['admin']), (req, res) => {
  const { name, imageUrl, sortOrder = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = req.app.locals.db;
  db.run('INSERT INTO categories (id, name, image_url, sort_order) VALUES (?, ?, ?, ?)', [uuid(), name, imageUrl || '', sortOrder]);
  res.status(201).json({ ok: true });
});

router.patch('/categories/:id', requireAuth(['admin']), (req, res) => {
  const { name, imageUrl, sortOrder } = req.body || {};
  const db = req.app.locals.db;
  db.run(
    'UPDATE categories SET name = COALESCE(?, name), image_url = COALESCE(?, image_url), sort_order = COALESCE(?, sort_order) WHERE id = ?',
    [name, imageUrl, sortOrder, req.params.id],
  );
  res.json({ ok: true });
});

router.delete('/categories/:id', requireAuth(['admin']), (req, res) => {
  const db = req.app.locals.db;
  db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// promos
router.get('/promos', (req, res) => {
  const db = req.app.locals.db;
  const rows = db.all('SELECT * FROM promos WHERE active = 1 ORDER BY sort_order');
  res.json({ promos: rows });
});

router.post('/promos', requireAuth(['admin']), (req, res) => {
  const { title, subtitle, imageUrl, cta, link, sortOrder = 0, active = true, location = 'home' } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  const db = req.app.locals.db;
  db.run(
    'INSERT INTO promos (id, title, subtitle, image_url, cta, link, sort_order, active, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [uuid(), title, subtitle || '', imageUrl || '', cta || '', link || '', sortOrder, active ? 1 : 0, location],
  );
  res.status(201).json({ ok: true });
});

router.patch('/promos/:id', requireAuth(['admin']), (req, res) => {
  const { title, subtitle, imageUrl, cta, link, sortOrder, active, location } = req.body || {};
  const db = req.app.locals.db;
  db.run(
    'UPDATE promos SET title = COALESCE(?, title), subtitle = COALESCE(?, subtitle), image_url = COALESCE(?, image_url), cta = COALESCE(?, cta), link = COALESCE(?, link), sort_order = COALESCE(?, sort_order), active = COALESCE(?, active), location = COALESCE(?, location) WHERE id = ?',
    [title, subtitle, imageUrl, cta, link, sortOrder, active == null ? null : (active ? 1 : 0), location, req.params.id],
  );
  res.json({ ok: true });
});

router.delete('/promos/:id', requireAuth(['admin']), (req, res) => {
  const db = req.app.locals.db;
  db.run('DELETE FROM promos WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// featured blocks
router.get('/featured', (req, res) => {
  const db = req.app.locals.db;
  const rows = db.all('SELECT * FROM featured_blocks WHERE active = 1 ORDER BY sort_order');
  res.json({ blocks: rows.map((b) => ({ ...b, items: b.items ? JSON.parse(b.items) : [] })) });
});

router.post('/featured', requireAuth(['admin']), (req, res) => {
  const { title, type, items = [], sortOrder = 0, active = true } = req.body || {};
  if (!type) return res.status(400).json({ error: 'type required' });
  const db = req.app.locals.db;
  db.run(
    'INSERT INTO featured_blocks (id, title, type, items, sort_order, active) VALUES (?, ?, ?, ?, ?, ?)',
    [uuid(), title || '', type, JSON.stringify(items), sortOrder, active ? 1 : 0],
  );
  res.status(201).json({ ok: true });
});

router.patch('/featured/:id', requireAuth(['admin']), (req, res) => {
  const { title, type, items, sortOrder, active } = req.body || {};
  const db = req.app.locals.db;
  db.run(
    'UPDATE featured_blocks SET title = COALESCE(?, title), type = COALESCE(?, type), items = COALESCE(?, items), sort_order = COALESCE(?, sort_order), active = COALESCE(?, active) WHERE id = ?',
    [title, type, items ? JSON.stringify(items) : null, sortOrder, active == null ? null : (active ? 1 : 0), req.params.id],
  );
  res.json({ ok: true });
});

router.delete('/featured/:id', requireAuth(['admin']), (req, res) => {
  const db = req.app.locals.db;
  db.run('DELETE FROM featured_blocks WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// home bundle
router.get('/home', (req, res) => {
  const db = req.app.locals.db;
  const promos = db.all('SELECT * FROM promos WHERE active = 1 ORDER BY sort_order');
  const categories = db.all('SELECT * FROM categories ORDER BY sort_order');
  const featured = db.all('SELECT * FROM featured_blocks WHERE active = 1 ORDER BY sort_order').map((b) => ({ ...b, items: b.items ? JSON.parse(b.items) : [] }));
  const vendorTags = db.all('SELECT * FROM vendor_tags ORDER BY sort_order');
  res.json({ promos, categories, featured, vendorTags });
});

// vendor tags
router.get('/vendor-tags', (req, res) => {
  const db = req.app.locals.db;
  const rows = db.all('SELECT * FROM vendor_tags ORDER BY sort_order');
  res.json({ tags: rows });
});

router.post('/vendor-tags', requireAuth(['admin']), (req, res) => {
  const { name, sortOrder = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = req.app.locals.db;
  db.run('INSERT INTO vendor_tags (id, name, sort_order) VALUES (?, ?, ?)', [uuid(), name, sortOrder]);
  res.status(201).json({ ok: true });
});

router.patch('/vendor-tags/:id', requireAuth(['admin']), (req, res) => {
  const { name, sortOrder } = req.body || {};
  const db = req.app.locals.db;
  db.run(
    'UPDATE vendor_tags SET name = COALESCE(?, name), sort_order = COALESCE(?, sort_order) WHERE id = ?',
    [name, sortOrder, req.params.id],
  );
  res.json({ ok: true });
});

router.delete('/vendor-tags/:id', requireAuth(['admin']), (req, res) => {
  const db = req.app.locals.db;
  db.run('DELETE FROM vendor_tags WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
