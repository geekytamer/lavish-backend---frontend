const express = require('express');
const { v4: uuid } = require('uuid');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const vendorId = req.query.vendorId;
    const rows = vendorId
      ? db.all('SELECT * FROM payouts WHERE vendor_id = ? ORDER BY datetime(created_at) DESC', [vendorId])
      : db.all('SELECT * FROM payouts ORDER BY datetime(created_at) DESC');
    res.json({ payouts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth(['admin']), (req, res) => {
  const { vendorId, amount, status = 'pending' } = req.body || {};
  if (!vendorId || amount == null) return res.status(400).json({ error: 'vendorId and amount are required' });
  try {
    const db = req.app.locals.db;
    const id = uuid();
    const now = new Date().toISOString();
    db.run('INSERT INTO payouts (id, vendor_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?)', [
      id,
      vendorId,
      Number(amount),
      status,
      now,
    ]);
    const payout = db.get('SELECT * FROM payouts WHERE id = ?', [id]);
    res.status(201).json({ payout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth(['admin']), (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status required' });
  try {
    const db = req.app.locals.db;
    const paidAt = status === 'paid' ? new Date().toISOString() : null;
    db.run('UPDATE payouts SET status = ?, paid_at = COALESCE(?, paid_at) WHERE id = ?', [status, paidAt, req.params.id]);
    const payout = db.get('SELECT * FROM payouts WHERE id = ?', [req.params.id]);
    if (!payout) return res.status(404).json({ error: 'Not found' });
    res.json({ payout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
