const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const db = require('./db');
const config = require('./config');
const storage = require('./services/storage');

const vendorRoutes = require('./routes/vendors');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const productRoutes = require('./routes/products');
const paymentRoutes = require('./routes/payments');
const payoutRoutes = require('./routes/payouts');
const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');
const uploadRoutes = require('./routes/upload');

async function start() {
  await db.ready;
  const app = express();

  app.locals.db = db;
  storage.ensureUploadsDir();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(compression());
  app.use(morgan('dev'));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/vendors', vendorRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/payouts', payoutRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/upload', uploadRoutes);

  // Open vendor deep link (share URL)
  app.get('/open/vendor/:id', (req, res) => {
    const vendorId = req.params.id;
    const deepLink = `lavish://vendor/${encodeURIComponent(vendorId)}`;
    const androidStore = config.appStoreAndroidUrl;
    const iosStore = config.appStoreIosUrl;

    res.set('Content-Type', 'text/html');
    res.send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Opening store</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; line-height: 1.5; }
            a { color: #7c3aed; }
          </style>
          <script>
            (function() {
              var deepLink = ${JSON.stringify(deepLink)};
              var androidStore = ${JSON.stringify(androidStore)};
              var iosStore = ${JSON.stringify(iosStore)};
              var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
              window.location.href = deepLink;
              setTimeout(function() {
                var target = isIOS ? iosStore : androidStore;
                if (target) window.location.href = target;
              }, 1200);
            })();
          </script>
        </head>
        <body>
          <p>Opening vendor…</p>
          <p><a href="${deepLink}">Tap here if not redirected</a></p>
        </body>
      </html>
    `);
  });

  // Simple landing/fallback so deep link redirects have a page to land on
  app.get('/', (req, res) => {
    const { status, order_id: orderId, session_id: sessionId } = req.query || {};
    if (status && orderId) {
      const params = [`status=${encodeURIComponent(status)}`, `order_id=${encodeURIComponent(orderId)}`];
      if (sessionId) params.push(`session_id=${encodeURIComponent(sessionId)}`);
      const target = `${config.appDeepLink}?${params.join('&')}`;
      return res.send(
        `<html><body>
          <p>Payment status: <strong>${status}</strong></p>
          <p>Order: ${orderId}</p>
          <p><a href="${target}">Open in app</a></p>
        </body></html>`,
      );
    }
    res.send('Lavish backend is running.');
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  app.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
