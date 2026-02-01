const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const config = require('../config');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, role = 'customer', vendorId, name, phone } = req.body || {};

  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!['admin', 'vendor', 'customer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (role === 'vendor' && !vendorId) {
    return res.status(400).json({ error: 'vendorId is required for vendor accounts' });
  }

  const db = req.app.locals.db;

  // Check if email already exists
  const existing = db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const userId = uuid();

    db.run(
      'INSERT INTO users (id, email, password_hash, role, vendor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, email, hash, role, vendorId || null, new Date().toISOString()],
    );

    // Auto-login by generating token
    const token = jwt.sign({ sub: userId, role, vendorId: vendorId || null }, config.jwtSecret);

    return res.status(201).json({
      ok: true,
      token,
      userId,
      role,
      vendorId: vendorId || null,
      message: 'Registration successful'
    });
  } catch (e) {
    console.error('Registration error:', e);
    return res.status(500).json({ error: 'Could not register user' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = req.app.locals.db;
  const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ sub: user.id, role: user.role, vendorId: user.vendor_id }, config.jwtSecret);
  res.json({ token, userId: user.id, role: user.role, vendorId: user.vendor_id });
});

module.exports = router;
