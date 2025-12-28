/* Seed an admin user and one vendor user per existing vendor. */
const bcrypt = require('bcryptjs');
const { ready, all, get, run } = require('../src/db');
const { v4: uuid } = require('uuid');

const ADMIN_EMAIL = 'admin@lavish.test';
const ADMIN_PASSWORD = 'changeme123';
const VENDOR_PASSWORD = 'vendor123';

async function ensureUser({ email, password, role, vendorId = null }) {
  const existing = get('SELECT id, email FROM users WHERE email = ?', [email]);
  if (existing) {
    console.log(`✓ User exists: ${email}`);
    return existing.id;
  }
  const hash = await bcrypt.hash(password, 10);
  const id = uuid();
  run(
    'INSERT INTO users (id, email, password_hash, role, vendor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, email, hash, role, vendorId, new Date().toISOString()],
  );
  console.log(`+ Created ${role} user: ${email}${vendorId ? ` (vendor ${vendorId})` : ''}`);
  return id;
}

async function main() {
  await ready;
  await ensureUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' });

  const vendors = all('SELECT id, name FROM vendors');
  for (const vendor of vendors) {
    await ensureUser({
      email: `${vendor.id}@lavish.test`,
      password: VENDOR_PASSWORD,
      role: 'vendor',
      vendorId: vendor.id,
    });
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
