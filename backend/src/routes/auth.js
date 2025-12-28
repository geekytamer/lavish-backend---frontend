const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const config = require('../config');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, role = 'vendor', vendorId } = req.body || {};
  if (!email || !password || !role) return res.status(400).json({ error: 'email, password, role required' });
  const hash = await bcrypt.hash(password, 10);
  const db = req.app.locals.db;
  try {
    db.run(
      'INSERT INTO users (id, email, password_hash, role, vendor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [uuid(), email, hash, role, vendorId || null, new Date().toISOString()],
    );
    return res.status(201).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: 'Could not register user' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const db = req.app.locals.db;
  const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.id, role: user.role, vendorId: user.vendor_id }, config.jwtSecret);
  res.json({ token, role: user.role, vendorId: user.vendor_id });
});

module.exports = router;
