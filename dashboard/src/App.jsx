import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
import { OrdersPage } from './pages/OrdersPage.jsx';
import { VendorsPage } from './pages/VendorsPage.jsx';
import { VendorProfilePage } from './pages/VendorProfilePage.jsx';
import { ProductsPage } from './pages/ProductsPage.jsx';
import { PayoutsPage } from './pages/PayoutsPage.jsx';
import { ContentPage } from './pages/ContentPage.jsx';
import { CouponsPage } from './pages/CouponsPage.jsx';
import { ReviewsPage } from './pages/ReviewsPage.jsx';
import { AnalyticsPage } from './pages/AnalyticsPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';
import { useApp } from './context/AppContext.jsx';

function RequireAuth() {
  const { token } = useApp();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function VendorHome() {
  const { vendorId } = useApp();
  if (!vendorId) return <Navigate to="/login" replace />;
  return <VendorProfilePage />;
}

function App() {
  const { role, vendorId } = useApp();
  const isVendor = role === 'vendor';
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={isVendor ? <VendorHome /> : <OverviewPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            {!isVendor && <Route path="/vendors" element={<VendorsPage />} />}
            {!isVendor && <Route path="/vendors/:id" element={<VendorProfilePage />} />}
            <Route path="/vendor/profile" element={<VendorHome />} />
            <Route path="/products" element={<ProductsPage />} />
            {isVendor ? null : <Route path="/payouts" element={<PayoutsPage />} />}
            {isVendor ? null : <Route path="/content" element={<ContentPage />} />}
            {isVendor ? null : <Route path="/coupons" element={<CouponsPage />} />}
            {isVendor ? null : <Route path="/reviews" element={<ReviewsPage />} />}
            {isVendor ? null : <Route path="/users" element={<UsersPage />} />}
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<Navigate to={isVendor ? '/vendor/profile' : '/'} replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
