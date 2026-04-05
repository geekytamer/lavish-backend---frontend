const express = require('express');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth(['admin']), (req, res) => {
    try {
        const db = req.app.locals.db;
        const users = db.all('SELECT id, email, role, vendor_id, created_at FROM users ORDER BY created_at DESC');
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireAuth(['admin']), async (req, res) => {
    const { email, password, role = 'customer', vendorId } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!['admin', 'vendor', 'customer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    if (role === 'vendor' && !vendorId) {
        return res.status(400).json({ error: 'vendorId is required for vendor role' });
    }

    try {
        const db = req.app.locals.db;
        const existing = db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const hash = await bcrypt.hash(password, 10);
        const userId = uuid();

        db.run(
            'INSERT INTO users (id, email, password_hash, role, vendor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, email, hash, role, vendorId || null, new Date().toISOString()],
        );

        const created = db.get('SELECT id, email, role, vendor_id, created_at FROM users WHERE id = ?', [userId]);
        res.status(201).json({ user: created });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/:id', requireAuth(['admin']), async (req, res) => {
    const { email, password, role, vendorId } = req.body || {};
    try {
        const db = req.app.locals.db;

        // Optionally update password if provided
        if (password && password.trim() !== '') {
            const hash = await bcrypt.hash(password, 10);
            db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
        }

        db.run(
            'UPDATE users SET email = COALESCE(?, email), role = COALESCE(?, role), vendor_id = COALESCE(?, vendor_id) WHERE id = ?',
            [
                email || null,
                role || null,
                role === 'vendor' ? vendorId || null : null,
                req.params.id
            ]
        );

        const updated = db.get('SELECT id, email, role, vendor_id, created_at FROM users WHERE id = ?', [req.params.id]);
        res.json({ user: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', requireAuth(['admin']), (req, res) => {
    try {
        const db = req.app.locals.db;
        db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
