const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '..', 'data.sqlite');

let db;

const ready = (async () => {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');
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

  seedIfNeeded();
  ensureColumns();
  persist();
})();

function persist() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

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
  vendorStmt.free();

  const productStmt = db.prepare(
    'INSERT INTO products (id, vendor_id, name, description, price, sizes, colors, stock_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  products.forEach((p) =>
    productStmt.run([p.id, p.vendor_id, p.name, p.description, p.price, p.sizes, p.colors, p.stock || 15]),
  );
  productStmt.free();

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
      stmt.free();
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
    "ALTER TABLE vendors ADD COLUMN views INTEGER DEFAULT 0",
    "ALTER TABLE vendors ADD COLUMN clicks INTEGER DEFAULT 0",
    "ALTER TABLE vendors ADD COLUMN shares INTEGER DEFAULT 0",
    "ALTER TABLE coupons ADD COLUMN id TEXT",
    "ALTER TABLE coupons ADD COLUMN vendor_id TEXT",
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

function all(query, params = []) {
  const stmt = db.prepare(query);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(query, params = []) {
  return all(query, params)[0];
}

function run(query, params = []) {
  const stmt = db.prepare(query);
  stmt.run(params);
  stmt.free();
  persist();
}

module.exports = {
  ready,
  all,
  get,
  run,
  persist,
};
