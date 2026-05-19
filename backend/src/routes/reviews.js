const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth(['admin']), (req, res) => {
    try {
        const db = req.app.locals.db;
        const reviews = db.all('SELECT * FROM reviews ORDER BY created_at DESC');
        res.json({ reviews });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/product/:productId', (req, res) => {
    const db = req.app.locals.db;
    const reviews = db.all('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', [req.params.productId]);
    res.json({ reviews });
});

router.post('/', (req, res) => {
    const { productId, userId, userName, rating, comment } = req.body;
    const db = req.app.locals.db;

    if (!productId || !userId || !rating) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = `rev-${uuidv4().substring(0, 8)}`;
    const createdAt = new Date().toISOString();

    db.run(
        'INSERT INTO reviews (id, product_id, user_id, user_name, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, productId, userId, userName || 'Anonymous', parseInt(rating), comment || '', createdAt]
    );

    res.json({ id, createdAt });
});

router.delete('/:id', requireAuth(['admin']), (req, res) => {
    try {
        const db = req.app.locals.db;
        db.run('DELETE FROM reviews WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
