const express = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { resolveUrl } = require('../lib/url');
const { estimateSpend, derivePromoStatus, isServable } = require('../lib/ads');
const { rateLimit, firstSeen, clientId } = require('../lib/adGuard');

const router = express.Router();

// ---------------------------------------------------------------------------
// Serializers + settings helpers (home page curation)
// ---------------------------------------------------------------------------
function serializeVendor(row, req) {
  if (!row) return null;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    logo_url: resolveUrl(req, row.logo_url),
    cover_image_url: resolveUrl(req, row.cover_image_url),
  };
}

function serializeProduct(row, req) {
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
      row.image_url ||
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=60',
    ),
  };
}

function getSetting(db, key, fallback) {
  const row = db.get('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row ? row.value : fallback;
}

function setSetting(db, key, value) {
  db.run(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value)],
  );
}

function homeSettings(db) {
  return {
    newArrivalsEnabled: getSetting(db, 'new_arrivals_enabled', '1') !== '0',
  };
}

function featuredVendors(db, req) {
  return db
    .all('SELECT * FROM vendors WHERE is_featured = 1 ORDER BY featured_order ASC')
    .map((r) => serializeVendor(r, req));
}

function featuredProducts(db, req) {
  return db
    .all('SELECT * FROM products WHERE is_featured = 1 ORDER BY featured_order ASC')
    .map((row) => serializeProduct(row, req));
}

// Ad campaign lifecycle/spend logic lives in ../lib/ads (unit-tested).

// Public shape sent to the mobile app (no revenue/metric internals).
function publicPromo(row, db, req) {
  let sponsoredBy = null;
  if (row.vendor_id) {
    const v = db.get('SELECT name FROM vendors WHERE id = ?', [row.vendor_id]);
    sponsoredBy = v ? v.name : null;
  }
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    image_url: resolveUrl(req, row.image_url),
    cta: row.cta,
    link: row.link,
    location: row.location || 'home',
    vendor_id: row.vendor_id || null,
    sponsored_by: sponsoredBy,
  };
}

// Admin shape: full campaign record with derived status + performance metrics.
function adminPromo(row, db) {
  const impressions = row.impressions || 0;
  const clicks = row.clicks || 0;
  let advertiser = null;
  if (row.vendor_id) {
    const v = db.get('SELECT name FROM vendors WHERE id = ?', [row.vendor_id]);
    advertiser = v ? v.name : null;
  }
  const spend = estimateSpend(row);
  return {
    ...row,
    advertiser,
    status: derivePromoStatus(row),
    ctr: impressions > 0 ? clicks / impressions : 0,
    spend,
    budget_used: row.budget > 0 ? Math.min(spend / row.budget, 1) : null,
  };
}

// categories CRUD
router.get('/categories', (req, res) => {
  const db = req.app.locals.db;
  const rows = db
    .all('SELECT * FROM categories ORDER BY sort_order')
    .map((c) => ({ ...c, image_url: resolveUrl(req, c.image_url) }));
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
  const rows = db.all('SELECT * FROM promos ORDER BY priority DESC, sort_order ASC');
  const servable = rows.filter((r) => isServable(r)).map((r) => publicPromo(r, db, req));
  res.json({ promos: servable });
});

// Admin: full campaign list including paused / scheduled / expired, with metrics.
router.get('/promos/all', requireAuth(['admin']), (req, res) => {
  const db = req.app.locals.db;
  const rows = db.all('SELECT * FROM promos ORDER BY priority DESC, sort_order ASC');
  res.json({ promos: rows.map((r) => adminPromo(r, db)) });
});

// Impression / click tracking (public — called by the app when a banner is
// shown/tapped). Protected against inflation: per-IP rate limiting, only counts
// for campaigns that are actually live, and de-duplicates repeat events from the
// same client within a window.
const IMPRESSION_DEDUP_MS = 30 * 60 * 1000; // 30 min
const CLICK_DEDUP_MS = 10 * 60 * 1000; // 10 min

function trackEvent(req, res, { column, dedupMs, prefix }) {
  const db = req.app.locals.db;
  if (!rateLimit(req)) return res.status(429).json({ error: 'Too many requests' });
  const promo = db.get('SELECT * FROM promos WHERE id = ?', [req.params.id]);
  // Silently accept but don't count events for missing or non-live campaigns.
  if (!promo || !isServable(promo)) return res.json({ ok: true, counted: false });
  const key = `${prefix}:${req.params.id}:${clientId(req)}`;
  if (!firstSeen(key, dedupMs)) return res.json({ ok: true, counted: false, deduped: true });
  db.run(`UPDATE promos SET ${column} = COALESCE(${column}, 0) + 1 WHERE id = ?`, [req.params.id]);
  return res.json({ ok: true, counted: true });
}

router.post('/promos/:id/impression', (req, res) =>
  trackEvent(req, res, { column: 'impressions', dedupMs: IMPRESSION_DEDUP_MS, prefix: 'imp' }),
);

router.post('/promos/:id/click', (req, res) =>
  trackEvent(req, res, { column: 'clicks', dedupMs: CLICK_DEDUP_MS, prefix: 'clk' }),
);

router.post('/promos', requireAuth(['admin']), (req, res) => {
  const {
    title, subtitle, imageUrl, cta, link, sortOrder = 0, active = true, location = 'home',
    startAt = null, endAt = null, priority = 0, vendorId = null,
    pricingModel = 'flat', rate = 0, budget = 0,
  } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  const db = req.app.locals.db;
  db.run(
    `INSERT INTO promos
       (id, title, subtitle, image_url, cta, link, sort_order, active, location,
        start_at, end_at, priority, vendor_id, pricing_model, rate, budget, impressions, clicks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    [
      uuid(), title, subtitle || '', imageUrl || '', cta || '', link || '', sortOrder,
      active ? 1 : 0, location, startAt || null, endAt || null, Number(priority) || 0,
      vendorId || null, pricingModel || 'flat', Number(rate) || 0, Number(budget) || 0,
    ],
  );
  res.status(201).json({ ok: true });
});

router.patch('/promos/:id', requireAuth(['admin']), (req, res) => {
  const {
    title, subtitle, imageUrl, cta, link, sortOrder, active, location,
    startAt, endAt, priority, vendorId, pricingModel, rate, budget,
  } = req.body || {};
  const db = req.app.locals.db;
  // sql.js throws on `undefined` bindings, so a partial PATCH must coerce
  // omitted fields to null.
  const nz = (v) => (v === undefined ? null : v);
  db.run(
    `UPDATE promos SET
       title = COALESCE(?, title),
       subtitle = COALESCE(?, subtitle),
       image_url = COALESCE(?, image_url),
       cta = COALESCE(?, cta),
       link = COALESCE(?, link),
       sort_order = COALESCE(?, sort_order),
       active = COALESCE(?, active),
       location = COALESCE(?, location),
       start_at = COALESCE(?, start_at),
       end_at = COALESCE(?, end_at),
       priority = COALESCE(?, priority),
       vendor_id = COALESCE(?, vendor_id),
       pricing_model = COALESCE(?, pricing_model),
       rate = COALESCE(?, rate),
       budget = COALESCE(?, budget)
     WHERE id = ?`,
    [
      nz(title), nz(subtitle), nz(imageUrl), nz(cta), nz(link), nz(sortOrder),
      active == null ? null : (active ? 1 : 0), nz(location),
      nz(startAt), nz(endAt), priority == null ? null : Number(priority),
      nz(vendorId), nz(pricingModel), rate == null ? null : Number(rate),
      budget == null ? null : Number(budget), req.params.id,
    ],
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
  const promos = db
    .all('SELECT * FROM promos ORDER BY priority DESC, sort_order ASC')
    .filter((r) => isServable(r))
    .map((r) => publicPromo(r, db, req));
  const categories = db
    .all('SELECT * FROM categories ORDER BY sort_order')
    .map((c) => ({ ...c, image_url: resolveUrl(req, c.image_url) }));
  const featured = db.all('SELECT * FROM featured_blocks WHERE active = 1 ORDER BY sort_order').map((b) => ({ ...b, items: b.items ? JSON.parse(b.items) : [] }));
  const vendorTags = db.all('SELECT * FROM vendor_tags ORDER BY sort_order');
  res.json({
    promos,
    categories,
    featured,
    vendorTags,
    featuredVendors: featuredVendors(db, req),
    featuredProducts: featuredProducts(db, req),
    homeSettings: homeSettings(db),
  });
});

// ---------------------------------------------------------------------------
// Home page curation (admin): pick & order featured brands / products, toggle
// the auto "New arrivals" section.
// ---------------------------------------------------------------------------
router.get('/home-settings', requireAuth(['admin']), (req, res) => {
  const db = req.app.locals.db;
  res.json({
    settings: homeSettings(db),
    featuredVendors: featuredVendors(db, req),
    featuredProducts: featuredProducts(db, req),
  });
});

router.patch('/home-settings', requireAuth(['admin']), (req, res) => {
  const db = req.app.locals.db;
  const { newArrivalsEnabled } = req.body || {};
  if (newArrivalsEnabled != null) {
    setSetting(db, 'new_arrivals_enabled', newArrivalsEnabled ? '1' : '0');
  }
  res.json({ ok: true, settings: homeSettings(db) });
});

// Replace the full featured-brands selection with an ordered list of vendor ids.
// Atomic: either the whole new selection applies or nothing changes.
router.post('/featured-brands', requireAuth(['admin']), (req, res) => {
  const db = req.app.locals.db;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  db.transaction((exec) => {
    exec('UPDATE vendors SET is_featured = 0, featured_order = 0');
    ids.forEach((id, i) => {
      exec('UPDATE vendors SET is_featured = 1, featured_order = ? WHERE id = ?', [i, id]);
    });
  });
  res.json({ ok: true, featuredVendors: featuredVendors(db, req) });
});

// Replace the full featured-products selection with an ordered list of product ids.
router.post('/featured-products', requireAuth(['admin']), (req, res) => {
  const db = req.app.locals.db;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  db.transaction((exec) => {
    exec('UPDATE products SET is_featured = 0, featured_order = 0');
    ids.forEach((id, i) => {
      exec('UPDATE products SET is_featured = 1, featured_order = ? WHERE id = ?', [i, id]);
    });
  });
  res.json({ ok: true, featuredProducts: featuredProducts(db, req) });
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
