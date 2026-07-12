const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');

// Disk-backed SQLite via better-sqlite3: synchronous, real transactions, WAL
// concurrency, and no full-file rewrite per statement (unlike the previous
// sql.js in-memory engine that serialized the whole DB on every write).
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Back-compat shim so the parameter-less DDL/seed calls in this file keep
// working with `db.run('<sql>')`.
db.run = (sql) => db.exec(sql);

// Schema init runs synchronously at module load (the helper function
// declarations below are hoisted, so they're callable here).
{
  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rating REAL DEFAULT 0,
      tags TEXT DEFAULT '',
      logo_url TEXT
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','vendor','customer')),
      vendor_id TEXT,
      created_at TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      sizes TEXT,
      colors TEXT,
      category_id TEXT,
      image_url TEXT,
      gallery TEXT,
      is_featured INTEGER DEFAULT 0,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_email TEXT,
      customer_phone TEXT,
      shipping_address TEXT,
      total REAL NOT NULL,
      payment_status TEXT,
      status TEXT DEFAULT 'pending',
      session_id TEXT,
      created_at TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      color TEXT,
      size TEXT,
      line_total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      vendor_id TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT,
      sort_order INTEGER DEFAULT 0
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS promos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      image_url TEXT,
      cta TEXT,
      link TEXT,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS featured_blocks (
      id TEXT PRIMARY KEY,
      title TEXT,
      type TEXT NOT NULL,
      items TEXT,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      paid_at TEXT,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      min_purchase REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      expiry_date TEXT,
      vendor_id TEXT
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      details TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vendor_tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
  `);

  // Generic key/value store for app-wide settings (e.g. home page toggles)
  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  seedIfNeeded();
  ensureColumns();
  normalizeMedia();
}

// One-time cleanup: rewrite stored media URLs that point at our own upload host
// (any absolute URL whose path contains "/uploads/") down to a relative path,
// so they resolve against whatever host currently serves the API instead of a
// stale hardcoded origin. External URLs (e.g. Unsplash) are left untouched.
function normalizeMedia() {
  const done = get("SELECT value FROM app_settings WHERE key = 'media_normalized'");
  if (done && done.value === '1') return;

  const toRel = (v) => {
    if (!v) return v;
    try {
      const u = new URL(v);
      return u.pathname.includes('/uploads/') ? u.pathname + u.search : v;
    } catch (e) {
      return v; // already relative / not a URL
    }
  };

  all('SELECT id, image_url, gallery FROM products').forEach((p) => {
    let gallery = p.gallery;
    try {
      gallery = JSON.stringify((p.gallery ? JSON.parse(p.gallery) : []).map(toRel));
    } catch (e) {
      /* leave as-is */
    }
    run('UPDATE products SET image_url = ?, gallery = ? WHERE id = ?', [toRel(p.image_url), gallery, p.id]);
  });
  all('SELECT id, logo_url, cover_image_url FROM vendors').forEach((v) => {
    run('UPDATE vendors SET logo_url = ?, cover_image_url = ? WHERE id = ?', [toRel(v.logo_url), toRel(v.cover_image_url), v.id]);
  });
  all('SELECT id, image_url FROM categories').forEach((c) => {
    run('UPDATE categories SET image_url = ? WHERE id = ?', [toRel(c.image_url), c.id]);
  });
  all('SELECT id, image_url FROM promos').forEach((c) => {
    run('UPDATE promos SET image_url = ? WHERE id = ?', [toRel(c.image_url), c.id]);
  });

  run(
    "INSERT INTO app_settings (key, value) VALUES ('media_normalized', '1') ON CONFLICT(key) DO UPDATE SET value = '1'",
  );
  console.log('Normalized stored media URLs to relative paths.');
}

// Resolved immediately — kept so `await db.ready` in index.js still works.
const ready = Promise.resolve();

// better-sqlite3 writes straight to disk, so explicit persistence is a no-op.
function persist() {}

function seedIfNeeded() {
  const existing = get('SELECT COUNT(*) as count FROM vendors');
  if (existing && existing.count > 0) return;

  const vendors = [
    {
      id: 'v-atelier',
      name: 'Atelier Nova',
      description: 'Minimal silhouettes with bold cuts.',
      rating: 4.7,
      tags: JSON.stringify(['Womenswear', 'Evening']),
    },
    {
      id: 'v-street',
      name: 'Street Thread',
      description: 'Casual streetwear staples.',
      rating: 4.5,
      tags: JSON.stringify(['Unisex', 'Streetwear']),
    },
    {
      id: 'v-tailor',
      name: 'Tailor & Co.',
      description: 'Tailored essentials for every day.',
      rating: 4.8,
      tags: JSON.stringify(['Menswear', 'Formal']),
    },
  ];
  const products = [
    {
      id: 'p-slipdress',
      vendor_id: 'v-atelier',
      name: 'Silk Slip Dress',
      description: 'Bias-cut midi with adjustable straps.',
      price: 89,
      sizes: JSON.stringify(['XS', 'S', 'M', 'L']),
      colors: JSON.stringify(['Ivory', 'Onyx']),
    },
    {
      id: 'p-denim',
      vendor_id: 'v-street',
      name: 'Relaxed Indigo Denim',
      description: 'Mid-rise denim with a soft wash.',
      price: 64,
      sizes: JSON.stringify(['28', '30', '32', '34', '36']),
      colors: JSON.stringify(['Indigo', 'Charcoal']),
    },
    {
      id: 'p-blazer',
      vendor_id: 'v-tailor',
      name: 'Structured Wool Blazer',
      description: 'Single-breasted blazer with peak lapels.',
      price: 129,
      sizes: JSON.stringify(['44', '46', '48', '50']),
      colors: JSON.stringify(['Navy', 'Camel']),
    },
    {
      id: 'p-hoodie',
      vendor_id: 'v-street',
      name: 'Heavyweight Hoodie',
      description: 'Brushed fleece with oversized hood.',
      price: 55,
      sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
      colors: JSON.stringify(['Stone', 'Black']),
    },
  ];

  const vendorStmt = db.prepare(
    'INSERT INTO vendors (id, name, description, rating, tags) VALUES (?, ?, ?, ?, ?)',
  );
  vendors.forEach((v) => vendorStmt.run([v.id, v.name, v.description, v.rating, v.tags]));

  const productStmt = db.prepare(
    'INSERT INTO products (id, vendor_id, name, description, price, sizes, colors, stock_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  products.forEach((p) =>
    productStmt.run([p.id, p.vendor_id, p.name, p.description, p.price, p.sizes, p.colors, p.stock || 15]),
  );

  // Seed coupons
  const existingCoupons = get('SELECT COUNT(*) as count FROM coupons');
  if (!existingCoupons || existingCoupons.count === 0) {
    run("INSERT INTO coupons (id, code, discount_type, discount_value, min_purchase, vendor_id) VALUES ('c-lavish10', 'LAVISH10', 'percentage', 10, 0, NULL)");
    run("INSERT INTO coupons (id, code, discount_type, discount_value, min_purchase, vendor_id) VALUES ('c-welcome20', 'WELCOME20', 'fixed', 20, 100, NULL)");
  }

  // Seed vendor tags
  const existingTags = get('SELECT COUNT(*) as count FROM vendor_tags');
  if (!existingTags || existingTags.count === 0) {
    const tags = [
      'Womenswear', 'Menswear', 'Streetwear', 'Accessories', 'Evening', 'Athleisure', 'Denim', 'Footwear', 'Luxury'
    ];
    tags.forEach((tag, i) => {
      // creating pseudo-random uuid-like string for simplicity in sync context or import uuid if available. 
      // db.js imports 'run' helper which works. But we need UUIDs.
      // Since this is initialization and we can't easily import uuid inside this scope if not already available (it IS available at top level `initSqlJs` context... wait, top level `db.js` has no `uuid` import? No, `routes/vendors.js` has it. `db.js` does NOT.
      // I need to add `const { v4: uuid } = require('uuid');` to `db.js` top level first or just use random string.
      // I'll add the import in a separate step or just use timestamp+index for seed.
      const id = 'tag-' + Math.random().toString(36).substr(2, 9);
      const stmt = db.prepare('INSERT INTO vendor_tags (id, name, sort_order) VALUES (?, ?, ?)');
      stmt.run([id, tag, i]);
    });
  }

  console.log('Seeded vendors and products into SQLite (sql.js)');
}

function ensureColumns() {
  const statements = [
    "ALTER TABLE products ADD COLUMN category_id TEXT",
    "ALTER TABLE products ADD COLUMN image_url TEXT",
    "ALTER TABLE products ADD COLUMN gallery TEXT",
    "ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0",
    "ALTER TABLE products ADD COLUMN tags TEXT",
    "ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0",
    "ALTER TABLE products ADD COLUMN views INTEGER DEFAULT 0",
    "ALTER TABLE products ADD COLUMN clicks INTEGER DEFAULT 0",
    "ALTER TABLE products ADD COLUMN shares INTEGER DEFAULT 0",
    "ALTER TABLE products ADD COLUMN likes INTEGER DEFAULT 0",
    "ALTER TABLE products ADD COLUMN carts INTEGER DEFAULT 0",
    "ALTER TABLE orders ADD COLUMN session_id TEXT",
    "ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'",
    "ALTER TABLE orders ADD COLUMN customer_phone TEXT",
    "ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'pending'",
    "ALTER TABLE users ADD COLUMN thawani_customer_id TEXT",
    "ALTER TABLE orders ADD COLUMN coupon_code TEXT",
    "ALTER TABLE vendors ADD COLUMN logo_url TEXT",
    "ALTER TABLE vendors ADD COLUMN cover_image_url TEXT",
    "ALTER TABLE vendors ADD COLUMN is_featured INTEGER DEFAULT 0",
    "ALTER TABLE vendors ADD COLUMN featured_order INTEGER DEFAULT 0",
    "ALTER TABLE products ADD COLUMN featured_order INTEGER DEFAULT 0",
    "ALTER TABLE vendors ADD COLUMN views INTEGER DEFAULT 0",
    "ALTER TABLE vendors ADD COLUMN clicks INTEGER DEFAULT 0",
    "ALTER TABLE vendors ADD COLUMN shares INTEGER DEFAULT 0",
    "ALTER TABLE coupons ADD COLUMN id TEXT",
    "ALTER TABLE coupons ADD COLUMN vendor_id TEXT",
    "ALTER TABLE promos ADD COLUMN location TEXT DEFAULT 'home'",
    // --- Advanced ads / campaign fields on promos ---
    "ALTER TABLE promos ADD COLUMN start_at TEXT",
    "ALTER TABLE promos ADD COLUMN end_at TEXT",
    "ALTER TABLE promos ADD COLUMN priority INTEGER DEFAULT 0",
    "ALTER TABLE promos ADD COLUMN vendor_id TEXT",
    "ALTER TABLE promos ADD COLUMN pricing_model TEXT DEFAULT 'flat'",
    "ALTER TABLE promos ADD COLUMN rate REAL DEFAULT 0",
    "ALTER TABLE promos ADD COLUMN budget REAL DEFAULT 0",
    "ALTER TABLE promos ADD COLUMN impressions INTEGER DEFAULT 0",
    "ALTER TABLE promos ADD COLUMN clicks INTEGER DEFAULT 0",
  ];
  statements.forEach((sql) => {
    try {
      db.run(sql);
    } catch (e) {
      // column may already exist
    }
  });

  // Migrate users table check constraint
  try {
    const existingTable = get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
    if (existingTable && existingTable.sql && !existingTable.sql.includes("'customer'")) {
      run("CREATE TABLE users_temp AS SELECT * FROM users");
      run("DROP TABLE users");
      run(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin','vendor','customer')),
          vendor_id TEXT,
          created_at TEXT NOT NULL,
          thawani_customer_id TEXT
        )
      `);
      run("INSERT INTO users SELECT id, email, password_hash, role, vendor_id, created_at, thawani_customer_id FROM users_temp");
      run("DROP TABLE users_temp");
      console.log("Migrated users table to allow 'customer' role.");
    }
  } catch (e) {
    console.error("Error migrating users table constraint", e);
  }
}

// Coerce bind values that better-sqlite3 rejects: booleans -> 0/1, and any
// omitted (undefined) field -> NULL (matches COALESCE-style partial updates).
function sanitize(params) {
  return (params || []).map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

function all(query, params = []) {
  return db.prepare(query).all(...sanitize(params));
}

function get(query, params = []) {
  return db.prepare(query).get(...sanitize(params));
}

function run(query, params = []) {
  db.prepare(query).run(...sanitize(params));
}

// Statement executor for use inside a transaction (kept for API parity).
function execRaw(query, params = []) {
  db.prepare(query).run(...sanitize(params));
}

// Run a set of writes atomically. better-sqlite3 manages BEGIN/COMMIT/ROLLBACK
// and rolls back automatically if `work` throws. `work` receives an
// `exec(query, params)` helper.
function transaction(work) {
  db.transaction(() => work(execRaw))();
}

module.exports = {
  ready,
  all,
  get,
  run,
  persist,
  execRaw,
  transaction,
};
