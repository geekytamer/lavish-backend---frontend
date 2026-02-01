const express = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get all addresses for the authenticated user
router.get('/', requireAuth(['customer', 'admin', 'vendor']), (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = req.user.id;
        const addresses = db.all('SELECT * FROM addresses WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        res.json({ addresses });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a new address
router.post('/', requireAuth(['customer', 'admin', 'vendor']), (req, res) => {
    const { label, details, phone, city, isDefault = false } = req.body || {};
    if (!label || !details || !phone || !city) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const db = req.app.locals.db;
        const userId = req.user.id;
        const id = `addr-${uuid().slice(0, 8)}`;
        const now = new Date().toISOString();

        // If this is set as default, unset others
        if (isDefault) {
            db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
        }

        db.run(
            'INSERT INTO addresses (id, user_id, label, details, phone, city, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, userId, label, details, phone, city, isDefault ? 1 : 0, now],
        );

        const created = db.get('SELECT * FROM addresses WHERE id = ?', [id]);
        res.status(201).json({ address: created });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update an address
router.patch('/:id', requireAuth(['customer', 'admin', 'vendor']), (req, res) => {
    const { label, details, phone, city, isDefault } = req.body || {};
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const db = req.app.locals.db;
        const existing = db.get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [id, userId]);
        if (!existing) return res.status(404).json({ error: 'Address not found' });

        if (isDefault) {
            db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
        }

        db.run(
            `UPDATE addresses 
       SET label = COALESCE(?, label), 
           details = COALESCE(?, details), 
           phone = COALESCE(?, phone), 
           city = COALESCE(?, city), 
           is_default = COALESCE(?, is_default)
       WHERE id = ? AND user_id = ?`,
            [label, details, phone, city, isDefault !== undefined ? (isDefault ? 1 : 0) : null, id, userId],
        );

        const updated = db.get('SELECT * FROM addresses WHERE id = ?', [id]);
        res.json({ address: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete an address
router.delete('/:id', requireAuth(['customer', 'admin', 'vendor']), (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const db = req.app.locals.db;
        const existing = db.get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [id, userId]);
        if (!existing) return res.status(404).json({ error: 'Address not found' });

        db.run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
