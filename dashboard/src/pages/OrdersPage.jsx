import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useApiClient } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';
import { formatCurrency, formatDateTime } from '../lib/formatters.js';
import { StatusPill } from '../components/StatusPill.jsx';

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export function OrdersPage() {
  const api = useApiClient();
  const { role, vendorId } = useApp();
  const qc = useQueryClient();
  const orders = useQuery({
    queryKey: ['orders', api.base, role, vendorId],
    queryFn: () =>
      role === 'vendor' && vendorId
        ? api.get(`/vendors/${vendorId}/orders`).then((d) => d.orders || [])
        : api.get('/orders').then((d) => d.orders || []),
  });
  const [updating, setUpdating] = useState(null);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', api.base, role, vendorId] }),
  });

  const handleStatusChange = async (orderId, status) => {
    setUpdating(orderId);
    try {
      await updateStatus.mutateAsync({ id: orderId, status });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="stack gap-lg">
      <div className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Orders</p>
            <h3>{role === 'vendor' ? 'My orders' : 'All orders'}</h3>
          </div>
          <button className="icon-btn" onClick={() => orders.refetch()} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="table">
          <div className="table-head">
            <span>Order</span>
            <span>Customer</span>
            <span>Contact</span>
            <span>Address</span>
            <span>Total</span>
            <span>Status</span>
            <span>Payment</span>
            <span>Placed</span>
          </div>
          {(orders.data || []).map((order) => {
            const subtotal = order.subtotal || order.total || 0;
            const customer = order.customer_email || '—';
            const contact = order.customer_phone || '—';
            const address = order.shipping_address || order.shippingAddress || '—';
            return (
              <div key={order.id} className="table-row">
                <span className="mono">{order.id.slice(0, 8)}</span>
                <span>{customer}</span>
                <span>{contact}</span>
                <span className="muted">{address}</span>
                <span>{formatCurrency(subtotal)}</span>
                <span className="inline">
                  <StatusPill value={order.status} />
                  {role === 'vendor' ? null : (
                    <select
                      className="input subtle"
                      value={order.status || 'pending'}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      disabled={updating === order.id}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
                <span>
                  <StatusPill value={order.payment_status} />
                </span>
                <span>{formatDateTime(order.created_at || order.createdAt)}</span>
              </div>
            );
          })}
          {orders.isLoading ? <div className="empty">Loading orders…</div> : null}
          {!orders.isLoading && (orders.data || []).length === 0 ? (
            <div className="empty">No orders found.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
