const express = require('express');

const router = express.Router();

router.get('/overview', (_req, res) => {
  try {
    const db = _req.app.locals.db;
    const totals = db.get('SELECT COUNT(*) as count, SUM(total) as revenue FROM orders') || {
      count: 0,
      revenue: 0,
    };
    const vendors = db.all('SELECT * FROM vendors');
    const vendorStats = vendors.map((vendor) => {
      const row =
        db.get(
          `SELECT COUNT(*) as orders, SUM(line_total) as revenue FROM order_items WHERE vendor_id = ?`,
          [vendor.id],
        ) || {};
      return {
        vendor,
        orders: row.orders || 0,
        revenue: row.revenue || 0,
      };
    });
    res.json({
      revenue: totals.revenue || 0,
      orders: totals.count || 0,
      vendors: vendorStats.length,
      vendorStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
