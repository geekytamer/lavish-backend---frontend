## Lavish Fashion – Multi-vendor shopper app

This repo contains the Lavish Fashion Flutter shopper (customer-only mobile app) and a lightweight Node.js backend to support multi-vendor commerce with vendor/admin dashboards (served via web/desktop), and Thawani payment stubs.

### Structure
- `flutter_app/` – Flutter storefront with customer cart/checkout and polished UI (wishlist, search, vendor filtering).
- `backend/` – Express API with SQLite (sql.js), multi-vendor order splitting, vendor receipts, and Thawani webhook placeholder.
- `dashboard/` – Lightweight web dashboard (open `dashboard/index.html`) showing admin/vendor metrics against the backend.

### Running the Flutter app (customers)
1) Install Flutter (already present at `C:\Users\Tamer\flutter`).  
2) From `flutter_app`, fetch deps:  
   `cmd.exe /C "C:\\Users\\Tamer\\flutter\\bin\\flutter.bat pub get"`  
3) Run in Chrome/mobile emulator:  
   `cmd.exe /C "C:\\Users\\Tamer\\flutter\\bin\\flutter.bat run"`  
   Configure the backend URL in `lib/config.dart` if it differs.

Highlights:
- Multi-vendor catalog with sample data and cart grouping per vendor.
- Checkout splits the order per vendor and triggers a Thawani session stub (skips network with placeholder keys).
- Customer app only; vendor and admin dashboards are intended for web/desktop (hook into the backend API or a web front-end).

### Running the backend
1) From `backend`, install deps: `npm install`
2) Start API: `npm start` (default `http://localhost:4000`)
3) SQLite database lives at `backend/data.sqlite` and seeds vendors/products on first run (uses `sql.js`, no native bindings).

Key endpoints:
- `GET /api/vendors` – vendors list; `GET /api/vendors/:id/orders`
- `GET /api/orders`, `POST /api/orders` – create multi-vendor order `{ items: [{ productId, quantity, color?, size? }], shippingAddress, customerEmail }`
- `GET /api/admin/overview` – admin metrics
- `POST /api/payments/thawani/webhook` – Thawani callback placeholder

Notes:
- Data now persists in SQLite (`backend/data.sqlite`). Schema and seeding in `backend/src/db.js`; add auth per role for production.
- Add real Thawani keys in `flutter_app/lib/config.dart` and implement payment status updates via the webhook.
- For web dashboards, start the backend then open `dashboard/index.html` in your browser; it reads live metrics from `http://localhost:4000/api`.
- Flutter app now attempts to use live backend APIs for vendors/products/orders with graceful fallback to local mock data if the API is offline, preventing crashes.
- Backend config is via env (.env), see `backend/.env.example`. Requests are size-limited and compressed; update `CORS_ORIGIN` for your deployment.
