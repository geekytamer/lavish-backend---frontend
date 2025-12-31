const express = require('express');
const config = require('../config');
const https = require('https');

const router = express.Router();

function buildThawaniUrl(path) {
  return `https://uatcheckout.thawani.om${path}`;
}

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

router.post('/thawani/session', (req, res) => {
  const { orderId, customerReference } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  const db = req.app?.locals?.db;
  if (!db) return res.status(500).json({ error: 'Database unavailable' });

  const order = db.get('SELECT id, total, shipping_address, customer_email, customer_phone FROM orders WHERE id = ?', [
    orderId,
  ]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const total = Number(order.total || 0);
  if (!Number.isFinite(total) || total <= 0) {
    return res.status(400).json({ error: 'Order total invalid' });
  }

  const baseUrl = (config.publicUrl || '').replace(/\/$/, '') || 'http://localhost:4000';
  const successUrl = `${baseUrl}/api/payments/thawani/return/success?order_id=${encodeURIComponent(orderId)}`;
  const cancelUrl = `${baseUrl}/api/payments/thawani/return/cancel?order_id=${encodeURIComponent(orderId)}`;
  const payload = JSON.stringify({
    client_reference_id: orderId,
    mode: 'payment',
    products: [
      {
        name: 'Lavish Fashion order',
        quantity: 1,
        unit_amount: Math.max(1, Math.round(total * 1000)),
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      customerRef: customerReference || order.shipping_address || order.customer_email || order.customer_phone,
    },
  });

  const options = {
    method: 'POST',
    hostname: 'uatcheckout.thawani.om',
    path: '/api/v1/checkout/session',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Thawani-Api-Key': config.thawaniSecret,
    },
  };

  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => (data += chunk));
    response.on('end', () => {
      try {
        if (response.statusCode >= 400) {
          return res
            .status(502)
            .json({ error: 'Thawani session creation failed', status: response.statusCode, body: data });
        }
        const parsed = JSON.parse(data);
        const sessionId = parsed?.data?.session_id || '';
        const paymentUrl = sessionId
          ? `${buildThawaniUrl(`/pay/${sessionId}?key=${config.thawaniPublishable}`)}`
          : '';
        return res.json({ sessionId, paymentUrl });
      } catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to parse Thawani response' });
      }
    });
  });

  request.on('error', (err) => res.status(500).json({ error: err.message || 'Thawani request failed' }));
  request.write(payload);
  request.end();
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
