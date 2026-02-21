const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/:entityType/:id/:action', (req, res) => {
    const { entityType, id, action } = req.params;
    const db = req.app.locals.db;

    const validEntities = ['products', 'vendors'];
    const validActions = ['views', 'clicks', 'shares', 'likes', 'carts'];

    if (!validEntities.includes(entityType)) return res.status(400).json({ error: 'invalid entity' });
    if (!validActions.includes(action)) return res.status(400).json({ error: 'invalid action' });

    if (entityType === 'vendors' && (action === 'likes' || action === 'carts')) {
        return res.status(400).json({ error: 'invalid action for vendors' });
    }

    try {
        const table = entityType;
        // validEntities and validActions are strict allowlists, so this is safe from SQL injection
        db.run(`UPDATE ${table} SET ${action} = COALESCE(${action}, 0) + 1 WHERE id = ?`, [id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', requireAuth(['admin', 'vendor']), (req, res) => {
    const db = req.app.locals.db;
    const vendorId = req.user?.role === 'vendor' ? req.user.vendorId : req.query.vendorId;

    try {
        let productsQuery = 'SELECT id, name, views, clicks, shares, likes, carts FROM products';
        let vendorsQuery = 'SELECT id, name, views, clicks, shares FROM vendors';
        const params = [];

        if (vendorId) {
            productsQuery += ' WHERE vendor_id = ?';
            vendorsQuery += ' WHERE id = ?';
            params.push(vendorId);
        }

        const products = db.all(productsQuery, params);
        const vendors = db.all(vendorsQuery, vendorId ? [vendorId] : []);

        res.json({
            products,
            vendors
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
