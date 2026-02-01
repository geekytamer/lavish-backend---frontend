#!/bin/bash
# Quick Start Script for Lavish Fashion Platform
# Run this script to start both backend and dashboard locally

set -e  # Exit on error

echo "🚀 Starting Lavish Fashion Development Environment..."
echo ""

# Check if we're in the correct directory
if [ ! -d "backend" ] || [ ! -d "dashboard" ]; then
    echo "❌ Error: Please run this script from the lavish-backend---frontend directory"
    exit 1
fi

# Backend Setup
echo "📦 Setting up Backend..."
cd backend

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Creating backend .env file..."
    cat > .env << 'EOF'
PORT=4000
PUBLIC_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=local_dev_secret_change_in_production

# Thawani credentials (use your actual keys if testing payments)
THAWANI_SECRET_KEY=your_thawani_secret_key
THAWANI_PUBLISHABLE_KEY=your_thawani_publishable_key

# Deep links
APP_DEEP_LINK=lavish://payment
APP_WEB_RETURN_URL=http://localhost:5173/payment-return

# Store URLs (for development)
APP_STORE_ANDROID_URL=https://play.google.com/store
APP_STORE_IOS_URL=https://apps.apple.com
EOF
    echo "✅ Backend .env created"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing backend dependencies..."
    npm install
fi

cd ..

# Dashboard Setup
echo ""
echo "🎨 Setting up Dashboard..."
cd dashboard

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Creating dashboard .env file..."
    cat > .env << 'EOF'
# Local development API
VITE_API_BASE_URL=http://localhost:4000/api
EOF
    echo "✅ Dashboard .env created"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dashboard dependencies..."
    npm install
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Start the backend:   cd backend && npm run dev"
echo "   2. Start the dashboard: cd dashboard && npm run dev"
echo ""
echo "🌐 URLs:"
echo "   Backend:   http://localhost:4000"
echo "   Dashboard: http://localhost:5173"
echo ""
echo "💡 Tip: Open two terminal windows to run both simultaneously"
