/* Strip host from stored media URLs to relative paths */
const { resolve } = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = resolve(__dirname, '..', 'data.sqlite');

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('DB not found at', DB_PATH);
    process.exit(1);
  }
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  const toRelative = (value) => {
    if (!value) return '';
    try {
      const u = new URL(value);
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return value.startsWith('/') ? value : `/${value}`;
    }
  };

  const products = db.exec('SELECT id, image_url, gallery FROM products')[0] || { values: [] };
  const updates = [];
  products.values.forEach((row) => {
    const id = row[0];
    const imageUrl = row[1];
    const gallery = row[2];
    const cleanImage = toRelative(imageUrl);
    let cleanGallery = '[]';
    try {
      const arr = gallery ? JSON.parse(gallery) : [];
      cleanGallery = JSON.stringify(arr.map(toRelative));
    } catch (e) {
      cleanGallery = '[]';
    }
    db.run('UPDATE products SET image_url = ?, gallery = ? WHERE id = ?', [cleanImage, cleanGallery, id]);
    updates.push(id);
  });

  if (updates.length) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log(`Normalized media URLs for ${updates.length} products`);
  } else {
    console.log('No products to update');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
