import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Tag, Edit } from 'lucide-react';
import { useState } from 'react';
import { useApiClient } from '../lib/api.js';
import { Modal } from '../components/Modal.jsx';
import { formatCurrency } from '../lib/formatters.jsx';

export function CouponsPage() {
    const api = useApiClient();
    const qc = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        min_purchase: '0',
        expiry_date: '',
    });

    const coupons = useQuery({
        queryKey: ['coupons', api.base],
        queryFn: () => api.get('/coupons').then((d) => d.coupons || []),
    });

    const saveCoupon = useMutation({
        mutationFn: (payload) => {
            if (editing) return api.patch(`/coupons/${editing.id}`, payload);
            return api.post('/coupons', payload);
        },
        onSuccess: () => {
            setShowModal(false);
            setEditing(null);
            setForm({ code: '', discount_type: 'percentage', discount_value: '', min_purchase: '0', expiry_date: '' });
            qc.invalidateQueries({ queryKey: ['coupons', api.base] });
        },
    });

    const deleteCoupon = useMutation({
        mutationFn: (id) => api.del(`/coupons/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons', api.base] }),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveCoupon.mutate({
            ...form,
            discount_value: Number(form.discount_value),
            min_purchase: Number(form.min_purchase),
        });
    };

    return (
        <div className="stack gap-lg">
            <div className="card">
                <div className="card-head">
                    <div>
                        <p className="eyebrow">Marketing</p>
                        <h3>Promo Codes</h3>
                    </div>
                    <button className="btn primary small" onClick={() => {
                        setEditing(null);
                        setForm({ code: '', discount_type: 'percentage', discount_value: '', min_purchase: '0', expiry_date: '' });
                        setShowModal(true);
                    }}>
                        <Plus size={14} /> New Code
                    </button>
                </div>

                <div className="table">
                    <div className="table-head">
                        <span>Code</span>
                        <span>Discount</span>
                        <span>Min. Purchase</span>
                        <span>Expires</span>
                        <span>Status</span>
                        <span />
                    </div>
                    {(coupons.data || []).map((c) => (
                        <div key={c.id} className="table-row">
                            <span className="mono">
                                <Tag size={14} className="muted" /> <strong>{c.code}</strong>
                            </span>
                            <span>
                                {c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `OMR ${c.discount_value} OFF`}
                            </span>
                            <span>{formatCurrency(c.min_purchase)}</span>
                            <span>{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'Never'}</span>
                            <span>
                                <span className={`pill ${c.active ? 'success' : 'subtle'}`}>
                                    {c.active ? 'Active' : 'Inactive'}
                                </span>
                            </span>
                            <span className="inline gap-sm">
                                <button
                                    className="icon-btn"
                                    onClick={() => {
                                        setEditing(c);
                                        setForm({
                                            code: c.code || '',
                                            discount_type: c.discount_type || 'percentage',
                                            discount_value: c.discount_value || '',
                                            min_purchase: c.min_purchase || '0',
                                            expiry_date: c.expiry_date ? c.expiry_date.split('T')[0] : '',
                                        });
                                        setShowModal(true);
                                    }}
                                >
                                    <Edit size={14} />
                                </button>
                                <button
                                    className="icon-btn danger"
                                    onClick={() => {
                                        if (window.confirm('Delete this code?')) deleteCoupon.mutate(c.id);
                                    }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </span>
                        </div>
                    ))}
                    {coupons.isLoading && <div className="empty">Loading codes...</div>}
                    {!coupons.isLoading && coupons.data?.length === 0 && (
                        <div className="empty">No promo codes created yet.</div>
                    )}
                </div>
            </div>

            <Modal
                open={showModal}
                title={editing ? "Edit Promo Code" : "Create Promo Code"}
                onClose={() => {
                    setShowModal(false);
                    setEditing(null);
                }}
                footer={
                    <>
                        <button className="btn ghost" onClick={() => {
                            setShowModal(false);
                            setEditing(null);
                        }}>Cancel</button>
                        <button className="btn primary" onClick={handleSubmit} disabled={saveCoupon.isPending}>
                            {editing ? "Save Code" : "Create Code"}
                        </button>
                    </>
                }
            >
                <div className="stack gap-sm">
                    <label className="label">
                        Code
                        <input
                            className="input uppercase"
                            placeholder="SUMMER25"
                            value={form.code}
                            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                            required
                        />
                    </label>
                    <div className="grid two">
                        <label className="label">
                            Type
                            <select
                                className="input"
                                value={form.discount_type}
                                onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed Amount (OMR)</option>
                            </select>
                        </label>
                        <label className="label">
                            Value
                            <input
                                className="input"
                                type="number"
                                value={form.discount_value}
                                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                                required
                            />
                        </label>
                    </div>
                    <label className="label">
                        Min Purchase (OMR)
                        <input
                            className="input"
                            type="number"
                            value={form.min_purchase}
                            onChange={(e) => setForm({ ...form, min_purchase: e.target.value })}
                        />
                    </label>
                    <label className="label">
                        Expiry Date
                        <input
                            className="input"
                            type="date"
                            value={form.expiry_date}
                            onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                        />
                    </label>
                </div>
            </Modal>
        </div>
    );
}
