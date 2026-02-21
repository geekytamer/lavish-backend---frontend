import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshCw, Printer } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(new Set());

  const toggleExpand = (id) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

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

  const printReceipt = (order) => {
    const win = window.open('', '_blank');
    const itemsHtml = (order.items || []).map(it => `
      <tr>
        <td>${it.quantity}x ${it.product_name || 'Item'} (${it.color || ''}/${it.size || ''})</td>
        <td style="text-align: right;">${formatCurrency(it.line_total)}</td>
      </tr>
    `).join('');

    win.document.write(`
      <html>
        <head>
          <title>Receipt - ${order.id.slice(0, 8)}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
            .brand { font-size: 24px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px 0; border-bottom: 1px solid #eee; }
            .total-row { font-weight: bold; font-size: 18px; }
            .footer { margin-top: 40px; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">LAVISH FASHION</div>
            <p>Order ID: ${order.id}</p>
            <p>Date: ${formatDateTime(order.created_at || order.createdAt)}</p>
          </div>
          <div class="customer">
            <p><strong>Shipping to:</strong></p>
            <p>${order.customer_email}<br/>${order.shipping_address || order.shippingAddress}</p>
          </div>
          <table>
            <thead>
              <tr><th>Item</th><th style="text-align: right;">Price</th></tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr class="total-row">
                <td>Total</td>
                <td style="text-align: right;">${formatCurrencyStr(order.total)}</td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            Thank you for shopping with Lavish Fashion.
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
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
            <span />
            <span>Order</span>
            <span>Customer</span>
            <span>Address</span>
            <span>Total</span>
            <span>Status</span>
            <span>Payment</span>
            <span>Placed</span>
          </div>
          {(orders.data || []).map((order) => {
            const isExpanded = expanded.has(order.id);
            const subtotal = order.subtotal || order.total || 0;
            const customer = order.customer_email || '—';
            const address = order.shipping_address || order.shippingAddress || '—';

            // Format line items for detailed view
            const items = order.items || [];

            return (
              <div key={order.id} className="table-row-group">
                <div className={`table-row ${isExpanded ? 'active' : ''}`} onClick={() => toggleExpand(order.id)} style={{ cursor: 'pointer' }}>
                  <span>{isExpanded ? '−' : '+'}</span>
                  <span className="mono"><strong>{order.id.slice(0, 8).toUpperCase()}</strong></span>
                  <span>{customer}</span>
                  <span className="muted truncate">{address}</span>
                  <span>{formatCurrency(subtotal)}</span>
                  <span className="inline" onClick={(e) => e.stopPropagation()}>
                    <StatusPill value={order.status} />
                    {role === 'vendor' ? null : (
                      <select
                        className="input subtle small-select"
                        value={order.status || 'pending'}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        disabled={updating === order.id}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </span>
                  <span>
                    <StatusPill value={order.payment_status} />
                  </span>
                  <span>{formatDateTime(order.created_at || order.createdAt)}</span>
                </div>

                {isExpanded && (
                  <div className="order-details-pane">
                    <div className="grid two gap-lg">
                      <div className="stack gap-sm">
                        <p className="eyebrow">Order Items</p>
                        <div className="list">
                          {items.map((item, idx) => (
                            <div key={idx} className="list-item inline between">
                              <div className="inline gap-sm">
                                <span className="pill subtle mono">{item.quantity}x</span>
                                <div>
                                  <div className="font-bold">{item.product_name || 'Generic Item'}</div>
                                  <div className="muted xs">{item.color} / {item.size}</div>
                                </div>
                              </div>
                              <div className="mono">{formatCurrency(item.line_total)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="stack gap-sm">
                        <p className="eyebrow">Shipping & Contact</p>
                        <div className="card subtle">
                          <p><strong>Customer:</strong> {order.customer_email}</p>
                          <p><strong>Phone:</strong> {order.customer_phone || 'N/A'}</p>
                          <p><strong>Address:</strong><br /> {address}</p>
                        </div>
                        {order.coupon_code && (
                          <div className="pill info self-start">
                            Promo Used: {order.coupon_code} (-{formatCurrency(order.discount_amount)})
                          </div>
                        )}
                        <button className="btn ghost small self-start mt-md" onClick={() => printReceipt(order)}>
                          <Printer size={14} /> Print Receipt
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
