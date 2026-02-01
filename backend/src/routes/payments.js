const express = require('express');
const config = require('../config');
const https = require('https');

const router = express.Router();

const { sendOrderConfirmation, sendSaleNotification } = require('../services/email');

function buildThawaniUrl(path) {
  return `https://uatcheckout.thawani.om${path}`;
}

async function updateOrderStatus(db, orderId, paymentStatus, orderStatus, sessionId) {
  if (!db) return;
  try {
    const normalizedStatus = paymentStatus || orderStatus || 'pending';
    const normalizedOrderStatus = orderStatus || paymentStatus || 'pending';
    const normalizedSession = sessionId ?? null;

    // Check if it was already paid to avoid duplicate emails
    const existing = db.get('SELECT payment_status FROM orders WHERE id = ?', [orderId]);
    const wasAlreadyPaid = existing?.payment_status === 'paid';

    db.run('UPDATE orders SET payment_status = ?, status = ?, session_id = COALESCE(?, session_id) WHERE id = ?', [
      normalizedStatus,
      normalizedOrderStatus,
      normalizedSession,
      orderId,
    ]);
    db.run('UPDATE order_items SET status = ? WHERE order_id = ?', [normalizedOrderStatus, orderId]);

    // Send Emails if newly paid
    if (normalizedStatus === 'paid' && !wasAlreadyPaid) {
      const order = db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
      const items = db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

      if (order && order.customer_email) {
        // 1. Order confirmation for Customer
        await sendOrderConfirmation({
          email: order.customer_email,
          orderId: order.id,
          total: order.total,
          items: items,
          shippingAddress: order.shipping_address
        });

        // 2. Sales notification for Vendors
        const vendorIds = [...new Set(items.map(i => i.vendor_id))];
        for (const vId of vendorIds) {
          const vendor = db.get('SELECT name, email FROM vendors WHERE id = ?', [vId]);
          if (vendor && vendor.email) {
            const vendorItems = items.filter(i => i.vendor_id === vId);
            await sendSaleNotification({
              vendorEmail: vendor.email,
              vendorName: vendor.name,
              orderId: order.id,
              items: vendorItems
            });
          }
        }
      }
    }
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
router.get('/thawani/return/success', async (req, res) => {
  const orderId = req.query.order_id || req.query.client_reference_id || req.query.session_id;
  const sessionId = req.query.session_id;
  if (!orderId) return res.status(400).send('Missing order id');
  const db = req.app?.locals?.db;
  if (!db) console.warn('Missing db on success return');
  await updateOrderStatus(db, orderId, 'paid', 'paid', sessionId);
  redirectToApp(res, orderId, 'paid', sessionId);
});

// Cancel URL handler
router.get('/thawani/return/cancel', async (req, res) => {
  const orderId = req.query.order_id || req.query.client_reference_id || req.query.session_id;
  const sessionId = req.query.session_id;
  if (!orderId) return res.status(400).send('Missing order id');
  const db = req.app?.locals?.db;
  if (!db) console.warn('Missing db on cancel return');
  await updateOrderStatus(db, orderId, 'cancelled', 'cancelled', sessionId);
  redirectToApp(res, orderId, 'cancelled', sessionId);
});

const cleanRef = (str) => (str || '').replace(/[^a-zA-Z0-9 ]/g, '');

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

  // Look up customer for saved cards
  const user = db.get('SELECT thawani_customer_id FROM users WHERE email = ?', [order.customer_email]);
  const customerId = user?.thawani_customer_id;

  const baseUrl = (config.publicUrl || '').replace(/\/$/, '') || 'http://localhost:4000';
  const successUrl = `${baseUrl}/api/payments/thawani/return/success?order_id=${encodeURIComponent(orderId)}`;
  const cancelUrl = `${baseUrl}/api/payments/thawani/return/cancel?order_id=${encodeURIComponent(orderId)}`;
  const payload = JSON.stringify({
    client_reference_id: cleanRef(orderId),
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
    customer_id: customerId, // Include if exists
    // If we want to allow saving NEW cards during regular checkout, we can also add:
    save_card_on_success: !!customerId,
    metadata: {
      orderId: orderId, // Store original in metadata
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
      'thawani-api-key': config.thawaniSecret,
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
// Helper to create Thawani Customer
function getOrCreateThawaniCustomer(db, user) {
  return new Promise((resolve, reject) => {
    if (user.thawani_customer_id) return resolve(user.thawani_customer_id);

    const match = db.get('SELECT thawani_customer_id FROM users WHERE id = ?', [user.id]);
    if (match && match.thawani_customer_id) return resolve(match.thawani_customer_id);

    // Create new customer in Thawani
    const payload = JSON.stringify({
      client_customer_id: user.id,
      email: user.email,
    });

    const options = {
      method: 'POST',
      hostname: 'uatcheckout.thawani.om',
      path: '/api/v1/customers',
      headers: {
        'Content-Type': 'application/json',
        'thawani-api-key': config.thawaniSecret,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const customerId = parsed.data?.id;
          if (customerId) {
            db.run('UPDATE users SET thawani_customer_id = ? WHERE id = ?', [customerId, user.id]);
            resolve(customerId);
          } else {
            console.error('Failed to create Thawani customer. Response:', data);
            reject(new Error(`Thawani Error: ${parsed.description || 'Failed to create payment profile'}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Create a Setup Session (for saving card)
router.post('/thawani/setup-session', async (req, res) => {
  const userId = req.body.userId; // In real app, get from auth token
  if (!userId) return res.status(401).json({ error: 'User required' });

  const db = req.app.locals.db;
  const user = db.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    const customerId = await getOrCreateThawaniCustomer(db, user);

    // Create Setup Session
    const baseUrl = (config.publicUrl || '').replace(/\/$/, '') || 'http://localhost:4000';
    const setupRef = `setup ${userId} ${Date.now()}`;
    const payload = JSON.stringify({
      client_reference_id: cleanRef(setupRef),
      mode: 'payment', // Thawani might not have explicit 'setup' mode in V1, often we do a 0 or 1 OMR auth or just "save card" flag
      customer_id: customerId,
      products: [
        {
          name: 'Card Verification',
          quantity: 1,
          unit_amount: 100, // 0.100 OMR charge
        }
      ],
      success_url: `${baseUrl}/api/payments/thawani/return/success?mode=setup`,
      cancel_url: `${baseUrl}/api/payments/thawani/return/cancel?mode=setup`,
      save_card_on_success: true,
      metadata: {
        customer_id: customerId
      }
    });

    const options = {
      method: 'POST',
      hostname: 'uatcheckout.thawani.om',
      path: '/api/v1/checkout/session',
      headers: {
        'Content-Type': 'application/json',
        'thawani-api-key': config.thawaniSecret,
      },
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (c) => (data += c));
      response.on('end', () => {
        const parsed = JSON.parse(data);
        const sessionId = parsed?.data?.session_id;
        if (sessionId) {
          const paymentUrl = `${buildThawaniUrl(`/pay/${sessionId}?key=${config.thawaniPublishable}`)}`;
          res.json({ sessionId, paymentUrl });
        } else {
          res.status(400).json({ error: 'Failed to create setup session', details: parsed });
        }
      });
    });
    request.write(payload);
    request.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List Payment Methods (Mock implementation/Proxy to Thawani)
router.get('/payment-methods', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(401).json({ error: 'User required' });

  const db = req.app.locals.db;
  const user = db.get('SELECT thawani_customer_id FROM users WHERE id = ?', [userId]);

  if (!user || !user.thawani_customer_id) {
    return res.json({ methods: [] });
  }

  // Fetch cards from Thawani
  const options = {
    method: 'GET',
    hostname: 'uatcheckout.thawani.om',
    path: `/api/v1/payment_methods?customer_id=${user.thawani_customer_id}`,
    headers: { 'thawani-api-key': config.thawaniSecret, 'Accept': 'application/json' }
  };

  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', (c) => (data += c));
    response.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        // Return mapped cards
        res.json({ methods: parsed.data || [] });
      } catch (e) {
        res.json({ methods: [] }); // Fallback
      }
    });
  });
  request.end();
});


module.exports = router;
