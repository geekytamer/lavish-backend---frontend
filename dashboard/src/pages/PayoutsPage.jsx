import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { CheckCircle, Plus, RefreshCw } from 'lucide-react';
import { useApiClient, buildQuery } from '../lib/api.js';
import { formatCurrency, formatDateTime } from '../lib/formatters.jsx';
import { StatusPill } from '../components/StatusPill.jsx';

export function PayoutsPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const [filterVendor, setFilterVendor] = useState('');
  const [form, setForm] = useState({ vendorId: '', amount: '', status: 'pending' });

  const vendors = useQuery({
    queryKey: ['vendors', api.base],
    queryFn: () => api.get('/vendors').then((d) => d.vendors || []),
  });
  const payouts = useQuery({
    queryKey: ['payouts', api.base, filterVendor],
    queryFn: () =>
      api.get(`/payouts${buildQuery({ vendorId: filterVendor || undefined })}`).then((d) => d.payouts || []),
  });

  const totals = useMemo(() => {
    const pending = (payouts.data || [])
      .filter((p) => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const paid = (payouts.data || [])
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { pending, paid };
  }, [payouts.data]);

  const createPayout = useMutation({
    mutationFn: () => api.post('/payouts', { vendorId: form.vendorId, amount: Number(form.amount), status: form.status }),
    onSuccess: () => {
      setForm({ vendorId: '', amount: '', status: 'pending' });
      qc.invalidateQueries({ queryKey: ['payouts', api.base] });
    },
  });

  const markPaid = useMutation({
    mutationFn: (id) => api.patch(`/payouts/${id}`, { status: 'paid' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payouts', api.base] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createPayout.mutate();
  };

  return (
    <div className="stack gap-lg">
      <div className="grid two">
        <div className="card stat accent">
          <p className="muted xs">Pending</p>
          <div className="stat-value">{formatCurrency(totals.pending)}</div>
          <p className="muted">Awaiting release</p>
        </div>
        <div className="card stat">
          <p className="muted xs">Paid</p>
          <div className="stat-value">{formatCurrency(totals.paid)}</div>
          <p className="muted">Completed payouts</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Payouts</p>
            <h3>History</h3>
          </div>
          <div className="inline">
            <select className="input" value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)}>
              <option value="">All vendors</option>
              {(vendors.data || []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            <button className="icon-btn" onClick={() => payouts.refetch()}>
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <div className="table">
          <div className="table-head">
            <span>Payout</span>
            <span>Vendor</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Created</span>
            <span />
          </div>
          {(payouts.data || []).map((p) => (
            <div key={p.id} className="table-row">
              <span className="mono">{p.id.slice(0, 8)}</span>
              <span>{p.vendor_id || p.vendorId}</span>
              <span>{formatCurrency(p.amount)}</span>
              <span>
                <StatusPill value={p.status} />
              </span>
              <span>{formatDateTime(p.created_at)}</span>
              <span>
                {p.status !== 'paid' ? (
                  <button className="btn ghost small" onClick={() => markPaid.mutate(p.id)}>
                    <CheckCircle size={14} />
                    Mark paid
                  </button>
                ) : null}
              </span>
            </div>
          ))}
          {payouts.isLoading ? <div className="empty">Loading payouts…</div> : null}
          {!payouts.isLoading && (payouts.data || []).length === 0 ? (
            <div className="empty">No payouts yet.</div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Create</p>
            <h3>New payout</h3>
          </div>
        </div>
        <form className="grid form two" onSubmit={handleSubmit}>
          <label className="label">
            Vendor
            <select
              className="input"
              required
              value={form.vendorId}
              onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
            >
              <option value="">Select vendor</option>
              {(vendors.data || []).map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Amount
            <input
              className="input"
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </label>
          <label className="label">
            Status
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <div className="full">
            <button className="btn primary" type="submit" disabled={createPayout.isPending}>
              <Plus size={14} />
              {createPayout.isPending ? 'Saving…' : 'Create payout'}
            </button>
            {createPayout.isError ? <p className="error">Unable to create payout.</p> : null}
          </div>
        </form>
      </div>
    </div>
  );
}
