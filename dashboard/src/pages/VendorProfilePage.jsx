import { useParams, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useApiClient } from '../lib/api.js';
import { formatCurrency, formatDateTime, weeklyBuckets } from '../lib/formatters.js';
import { StatusPill } from '../components/StatusPill.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export function VendorProfilePage() {
  const { id: routeId } = useParams();
  const { role, vendorId } = useApp();
  const resolvedId = routeId || vendorId;
  if (!resolvedId) return <Navigate to="/login" replace />;
  const api = useApiClient();
  const qc = useQueryClient();
  const [payoutAmount, setPayoutAmount] = useState('');

  const profile = useQuery({
    queryKey: ['vendor-profile', api.base, resolvedId],
    queryFn: () => api.get(`/vendors/${resolvedId}/profile`),
  });
  const data = profile.data || { vendor: {}, stats: {}, products: [], receipts: [], payouts: [] };

  const weekly = useMemo(() => weeklyBuckets(data.receipts), [data.receipts]);
  const weeklyMax = useMemo(
    () => Math.max(...weekly.map((w) => Number(w.total || 0)), 1),
    [weekly],
  );

  const createPayout = useMutation({
    mutationFn: () => api.post('/payouts', { vendorId: resolvedId, amount: Number(payoutAmount || 0) }),
    onSuccess: () => {
      setPayoutAmount('');
      qc.invalidateQueries({ queryKey: ['vendor-profile', api.base, resolvedId] });
      qc.invalidateQueries({ queryKey: ['payouts', api.base] });
    },
  });

  return (
    <div className="stack gap-lg">
      <div className="card">
        <div className="card-head">
          <div className="inline gap-sm">
            {role === 'vendor' ? null : (
              <Link className="btn ghost small" to="/vendors">
                <ArrowLeft size={14} />
                Back
              </Link>
            )}
            <div>
              <p className="eyebrow">Vendor</p>
              <h3>{data.vendor.name || resolvedId}</h3>
              <p className="muted">{data.vendor.description}</p>
            </div>
          </div>
          <div className="inline">
            <div className="pill subtle mono">{resolvedId}</div>
            <div className="pill info">{data.vendor.rating ? `${data.vendor.rating.toFixed(1)}★` : 'Unrated'}</div>
          </div>
        </div>
        <div className="grid cards-3">
          <StatCard label="Orders" value={data.stats.orders || 0} hint="Across all time" />
          <StatCard label="Receipts" value={formatCurrency(data.stats.revenue || 0)} hint="Gross subtotal" />
          <StatCard label="Products" value={data.products.length} hint="Active SKUs" />
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Receipts</p>
              <h3>Orders for this vendor</h3>
            </div>
          </div>
          <div className="table">
            <div className="table-head">
              <span>Order</span>
              <span>Subtotal</span>
              <span>Status</span>
              <span>Payment</span>
              <span>Date</span>
            </div>
            {(data.receipts || []).map((r) => (
              <div key={r.id} className="table-row">
                <span className="mono">{r.id.slice(0, 8)}</span>
                <span>{formatCurrency(r.subtotal)}</span>
                <span>
                  <StatusPill value={r.status} />
                </span>
                <span>
                  <StatusPill value={r.payment_status} />
                </span>
                <span>{formatDateTime(r.created_at)}</span>
              </div>
            ))}
            {!profile.isLoading && (data.receipts || []).length === 0 ? (
              <div className="empty">No receipts yet.</div>
            ) : null}
            {profile.isLoading ? <div className="empty">Loading receipts…</div> : null}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Products</p>
              <h3>Catalog</h3>
            </div>
          </div>
          <div className="list">
            {(data.products || []).map((product) => (
              <div key={product.id} className="list-item">
                <div className="list-title">{product.name}</div>
                <p className="muted xs">{product.description}</p>
                <div className="muted xs">{formatCurrency(product.price)}</div>
              </div>
            ))}
            {!profile.isLoading && (data.products || []).length === 0 ? (
              <div className="empty">No products for this vendor.</div>
            ) : null}
            {profile.isLoading ? <div className="empty">Loading products…</div> : null}
          </div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Payouts</p>
              <h3>History</h3>
            </div>
          </div>
          <div className="table">
            <div className="table-head">
              <span>Payout</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Created</span>
            </div>
            {(data.payouts || []).map((payout) => (
              <div key={payout.id} className="table-row">
                <span className="mono">{payout.id.slice(0, 8)}</span>
                <span>{formatCurrency(payout.amount)}</span>
                <span>
                  <StatusPill value={payout.status} />
                </span>
                <span>{formatDateTime(payout.created_at)}</span>
              </div>
            ))}
            {!profile.isLoading && (data.payouts || []).length === 0 ? (
              <div className="empty">No payouts yet.</div>
            ) : null}
          </div>
          <form className="inline gap-sm" onSubmit={(e) => e.preventDefault()}>
            <input
              className="input"
              type="number"
              step="0.01"
              placeholder="Amount"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
            />
            <button
              className="btn primary"
              onClick={() => createPayout.mutate()}
              disabled={createPayout.isPending || !payoutAmount}
            >
              <Plus size={14} />
              Quick payout
            </button>
            {createPayout.isError ? <p className="error">Failed to create payout.</p> : null}
          </form>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <p className="eyebrow">Weekly receipts</p>
              <h3>Momentum</h3>
            </div>
          </div>
          <div className="bars">
            {weekly.map((w) => (
              <div key={w.week} className="bar">
                <div
                  className="bar-fill"
                  style={{ height: `${Math.max(8, Math.round((Number(w.total || 0) / weeklyMax) * 100))}%` }}
                />
                <span className="muted xs">{w.week}</span>
                <span className="muted xs">{formatCurrency(w.total)}</span>
              </div>
            ))}
            {weekly.length === 0 ? <div className="empty">No weekly data.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
