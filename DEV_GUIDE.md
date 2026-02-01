# 🚀 Development Environment - Quick Reference

## ✅ Currently Running

- **Backend API**: http://localhost:4000
- **Dashboard**: http://localhost:5173

---

## 📋 Common Commands

### Backend
```bash
cd backend

# Start development server
npm run dev

# Seed admin/vendor users
npm run seed:users

# View logs
tail -f logs/app.log  # if logging is configured
```

### Dashboard
```bash
cd dashboard

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🔑 Default Credentials

After running `npm run seed:users` in backend, you'll have:

### Admin Account
- Email: `admin@lavish.test`
- Password: `admin123`

### Vendor Account
- Email: `vendor@lavish.test`
- Password: `vendor123`

---

## 🧪 Testing the System

### 1. Test Dashboard Login
1. Open http://localhost:5173
2. Login with admin credentials
3. Navigate to Products, Orders, Vendors

### 2. Test API Endpoints
```bash
# Health check
curl http://localhost:4000/api/health

# Get products
curl http://localhost:4000/api/products

# Login (get token)
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lavish.test","password":"admin123"}'
```

### 3. Test Flutter App
Update `lib/config.dart`:
```dart
static const String apiBaseUrl = 'http://localhost:4000/api';
```

---

## 🛠️ Troubleshooting

### Backend won't start - Port in use
```bash
# Kill process on port 4000
lsof -ti:4000 | xargs kill -9

# Or use different port in backend/.env
PORT=4001
```

### Dashboard can't connect to backend
- Check backend is running on port 4000
- Verify `dashboard/.env` has correct API URL:
  ```
  VITE_API_BASE_URL=http://localhost:4000/api
  ```
- Check browser console for CORS errors

### CORS errors
Backend should allow `http://localhost:5173` (already configured in local .env)

### Database issues
```bash
# Reset database (WARNING: Deletes all data)
cd backend
rm data.sqlite
# Restart backend - it will recreate the database
```

---

## 📁 Important Files

### Backend Configuration
- `backend/.env` - Environment variables (port, secrets, etc.)
- `backend/src/index.js` - Main entry point
- `backend/src/db.js` - Database setup and schema
- `backend/data.sqlite` - SQLite database file (created on first run)

### Dashboard Configuration
- `dashboard/.env` - API URL configuration
- `dashboard/src/lib/config.js` - App constants
- `dashboard/src/context/AppContext.jsx` - Auth state management

---

## 🔄 Making Changes

### Backend Changes
- Code changes auto-reload on save (if using nodemon)
- Database schema changes require restart
- New routes: Add in `backend/src/routes/`
- New middleware: Add in `backend/src/middleware/`

### Dashboard Changes
- Vite automatically hot-reloads on save
- New pages: Add in `dashboard/src/pages/`
- New components: Add in `dashboard/src/components/`
- Update routes in `dashboard/src/App.jsx`

---

## 📊 Database Management

### View Database
```bash
cd backend
sqlite3 data.sqlite

# Then in SQLite shell:
.tables                    # List tables
SELECT * FROM users;       # View users
SELECT * FROM products;    # View products
.quit                      # Exit
```

### Backup Database
```bash
cp backend/data.sqlite backend/data.sqlite.backup
```

---

## 🚀 Production Deployment

### Backend (Digital Ocean Droplet)
Already deployed! Just push changes and restart:
```bash
# SSH into droplet
ssh root@your-droplet-ip

# Pull latest code
git pull

# Restart backend
pm2 restart lavish-backend
```

### Dashboard
Already configured for production:
```bash
cd dashboard
npm run build
# Upload dist/ folder to hosting
```

---

## 📞 Support

- Backend runs on: **Node.js v25.2.1**
- Dashboard runs on: **Vite 7.2.7 + React 19**
- Database: **SQLite (sql.js)**

**Status**: ✅ Both backend and dashboard are running successfully!
