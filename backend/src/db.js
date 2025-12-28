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
      tags TEXT DEFAULT ''
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','vendor')),
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
    'INSERT INTO products (id, vendor_id, name, description, price, sizes, colors) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  products.forEach((p) =>
    productStmt.run([p.id, p.vendor_id, p.name, p.description, p.price, p.sizes, p.colors]),
  );
  productStmt.free();

  console.log('Seeded vendors and products into SQLite (sql.js)');
}

function ensureColumns() {
  const statements = [
    "ALTER TABLE products ADD COLUMN category_id TEXT",
    "ALTER TABLE products ADD COLUMN image_url TEXT",
    "ALTER TABLE products ADD COLUMN gallery TEXT",
    "ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0",
    "ALTER TABLE orders ADD COLUMN session_id TEXT",
    "ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'",
    "ALTER TABLE orders ADD COLUMN customer_phone TEXT",
    "ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'pending'",
  ];
  statements.forEach((sql) => {
    try {
      db.run(sql);
    } catch (e) {
      // column may already exist
    }
  });
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
