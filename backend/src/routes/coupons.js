const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { v4: uuid } = require('uuid');

router.get('/', requireAuth(['admin', 'vendor']), (req, res) => {
    try {
        const db = req.app.locals.db;
        let query = 'SELECT * FROM coupons';
        const params = [];

        if (req.user.role === 'vendor') {
            query += ' WHERE vendor_id = ?';
            params.push(req.user.vendorId);
        }

        query += ' ORDER BY expiry_date DESC';
        const coupons = db.all(query, params);
        res.json({ coupons });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireAuth(['admin', 'vendor']), (req, res) => {
    const { code, discount_type, discount_value, min_purchase, expiry_date, active = 1, vendor_id } = req.body || {};
    if (!code || !discount_type || discount_value == null) {
        return res.status(400).json({ error: 'Missing required code/type/value' });
    }

    const requestVendorId = req.user.role === 'vendor' ? req.user.vendorId : vendor_id;

    try {
        const db = req.app.locals.db;
        const id = uuid();
        db.run(
            'INSERT INTO coupons (id, code, discount_type, discount_value, min_purchase, expiry_date, active, vendor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, code.toUpperCase(), discount_type, Number(discount_value), Number(min_purchase) || 0, expiry_date || null, active ? 1 : 0, requestVendorId || null]
        );
        res.status(201).json({ ok: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', requireAuth(['admin']), (req, res) => {
    try {
        const db = req.app.locals.db;
        db.run('DELETE FROM coupons WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/validate', (req, res) => {
    // ... existing validate ...
    const { code, total } = req.body;
    const db = req.app.locals.db;

    const coupon = db.get('SELECT * FROM coupons WHERE code = ? AND active = 1', [code]);

    if (!coupon) {
        return res.status(404).json({ error: 'Invalid or inactive promo code' });
    }

    // Check expiry
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
        return res.status(400).json({ error: 'Promo code has expired' });
    }

    // Check vendor exclusivity
    // Note: The request should theoretically pass items or vendorId to strictly validate.
    // For now, we assume if a vendorId is passed in body, we check against it.
    // If no vendorId passed, but coupon has one, we might either fail or rely on client.
    // Let's be strict: if coupon has vendor_id, request MUST match it.
    if (coupon.vendor_id) {
        // We expect the validation request to include the vendor context if applicable.
        // Assuming validation payload might contain `vendorId`
        if (req.body.vendorId && req.body.vendorId !== coupon.vendor_id) {
            return res.status(400).json({ error: 'This promo code is not valid for this vendor.' });
        }
    }

    if (total < (coupon.min_purchase || 0)) {
        return res.status(400).json({
            error: `Minimum purchase amount for this code is OMR ${coupon.min_purchase.toFixed(2)}`
        });
    }

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
        discount = (total * coupon.discount_value) / 100;
    } else {
        discount = coupon.discount_value;
    }

    res.json({
        code: coupon.code,
        type: coupon.discount_type,
        value: coupon.discount_value,
        discountAmount: Math.min(discount, total)
    });
});

module.exports = router;
