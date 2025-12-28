import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, ShoppingBag } from 'lucide-react';
import { useApiClient } from '../lib/api.js';
import { formatCurrency, formatDateTime } from '../lib/formatters.js';
import { StatCard } from '../components/StatCard.jsx';
import { StatusPill } from '../components/StatusPill.jsx';

export function OverviewPage() {
  const api = useApiClient();
  const overview = useQuery({
    queryKey: ['overview', api.base],
    queryFn: () => api.get('/admin/overview'),
  });
  const orders = useQuery({
    queryKey: ['orders', api.base],
    queryFn: () => api.get('/orders').then((d) => d.orders || []),
  });

  const metrics = overview.data || { revenue: 0, orders: 0, vendors: 0, vendorStats: [] };

  return (
    <div className="stack gap-lg">
      <div className="grid cards-3">
        <StatCard
          label="Revenue"
          value={formatCurrency(metrics.revenue)}
          hint="Gross across all vendors"
          icon={TrendingUp}
          tone="accent"
        />
        <StatCard label="Orders" value={metrics.orders} hint="Lifetime orders" icon={ShoppingBag} />
        <StatCard label="Vendors" value={metrics.vendors} hint="Active vendors" icon={Users} />
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Live</p>
              <h3>Recent orders</h3>
            </div>
            {orders.isFetching ? <span className="pill">Refreshing…</span> : null}
          </div>
          <div className="table">
            <div className="table-head">
              <span>Order</span>
              <span>Total</span>
              <span>Status</span>
              <span>Payment</span>
              <span>Placed</span>
            </div>
            {(orders.data || []).slice(0, 6).map((order) => (
              <div key={order.id} className="table-row">
                <span className="mono">{order.id.slice(0, 8)}</span>
                <span>{formatCurrency(order.total)}</span>
                <span>
                  <StatusPill value={order.status} />
                </span>
                <span>
                  <StatusPill value={order.payment_status} />
                </span>
                <span>{formatDateTime(order.created_at || order.createdAt)}</span>
              </div>
            ))}
            {!orders.isLoading && (orders.data || []).length === 0 ? (
              <div className="empty">No orders yet.</div>
            ) : null}
            {orders.isLoading ? <div className="empty">Loading orders…</div> : null}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Vendors</p>
              <h3>Performance</h3>
            </div>
            <p className="muted xs">Revenue + orders per vendor</p>
          </div>
          <div className="table">
            <div className="table-head">
              <span>Vendor</span>
              <span>Orders</span>
              <span>Revenue</span>
            </div>
            {(metrics.vendorStats || []).map((stat) => (
              <div key={stat.vendor.id} className="table-row">
                <span>{stat.vendor.name}</span>
                <span>{stat.orders}</span>
                <span>{formatCurrency(stat.revenue)}</span>
              </div>
            ))}
            {!overview.isLoading && (metrics.vendorStats || []).length === 0 ? (
              <div className="empty">No vendor data.</div>
            ) : null}
            {overview.isLoading ? <div className="empty">Loading metrics…</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
