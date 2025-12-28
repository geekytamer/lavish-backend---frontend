const express = require('express');
const config = require('../config');
const https = require('https');

const router = express.Router();

function updateOrderStatus(db, orderId, paymentStatus, orderStatus, sessionId) {
  if (!db) return;
  try {
    const normalizedStatus = paymentStatus || orderStatus || 'pending';
    const normalizedOrderStatus = orderStatus || paymentStatus || 'pending';
    const normalizedSession = sessionId ?? null;
    db.run('UPDATE orders SET payment_status = ?, status = ?, session_id = COALESCE(?, session_id) WHERE id = ?', [
      normalizedStatus,
      normalizedOrderStatus,
      normalizedSession,
      orderId,
    ]);
    db.run('UPDATE order_items SET status = ? WHERE order_id = ?', [normalizedOrderStatus, orderId]);
  } catch (err) {
    console.error('Failed to update order status', { orderId, error: err?.message || err });
  }
}

function redirectToApp(res, orderId, status, sessionId) {
  const params = `status=${encodeURIComponent(status)}&order_id=${encodeURIComponent(orderId)}${sessionId ? `&session_id=${encodeURIComponent(sessionId)}` : ''}`;
  const target = `${config.appDeepLink}?${params}`;
  const fallback = `${config.appWebReturn}?${params}`;
  res.set('Content-Type', 'text/html');
  res.send(
    `<html><body>
      <script>
        (function() {
          var target = ${JSON.stringify(target)};
          var fallback = ${JSON.stringify(fallback)};
          window.location.href = target;
          setTimeout(function() { window.location.href = fallback; }, 1500);
        })();
      </script>
      <p>Redirecting back to app...</p>
      <p><a href="${target}">Tap here if not redirected</a></p>
      <p><a href="${fallback}">Open in browser</a></p>
    </body></html>`,
  );
}

// Success URL handler (no webhook needed)
router.get('/thawani/return/success', (req, res) => {
  const orderId = req.query.order_id || req.query.client_reference_id || req.query.session_id;
  const sessionId = req.query.session_id;
  if (!orderId) return res.status(400).send('Missing order id');
  const db = req.app?.locals?.db;
  if (!db) console.warn('Missing db on success return');
  updateOrderStatus(db, orderId, 'paid', 'paid', sessionId);
  redirectToApp(res, orderId, 'paid', sessionId);
});

// Cancel URL handler
router.get('/thawani/return/cancel', (req, res) => {
  const orderId = req.query.order_id || req.query.client_reference_id || req.query.session_id;
  const sessionId = req.query.session_id;
  if (!orderId) return res.status(400).send('Missing order id');
  const db = req.app?.locals?.db;
  if (!db) console.warn('Missing db on cancel return');
  updateOrderStatus(db, orderId, 'cancelled', 'cancelled', sessionId);
  redirectToApp(res, orderId, 'cancelled', sessionId);
});

// Optional status check (still available)
router.post('/thawani/status', (req, res) => {
  const { sessionId, orderId } = req.body || {};
  if (!sessionId || !orderId) return res.status(400).json({ error: 'sessionId and orderId required' });

  const options = {
    method: 'GET',
    hostname: 'checkout.thawani.om',
    path: `/api/v1/checkout/session/${sessionId}`,
    headers: {
      'Thawani-Api-Key': config.thawaniSecret,
      Accept: 'application/json',
    },
  };

  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => (data += chunk));
    response.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const status =
          parsed.data?.payment_status ||
          parsed.data?.status ||
          parsed.data?.paymentStatus ||
          parsed.data?.status_text ||
          'pending';
        const db = req.app.locals.db;
        updateOrderStatus(db, orderId, status, status, sessionId);
        return res.json({ status });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    });
  });

  request.on('error', (err) => res.status(500).json({ error: err.message }));
  request.end();
});

module.exports = router;
