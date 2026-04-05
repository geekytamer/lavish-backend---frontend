import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Edit, Trash2, Search, UserRound } from 'lucide-react';
import { useApiClient } from '../lib/api.js';
import { Modal } from '../components/Modal.jsx';
import { formatDateTime } from '../lib/formatters.jsx';

export function UsersPage() {
    const api = useApiClient();
    const qc = useQueryClient();
    const [form, setForm] = useState({ email: '', password: '', role: 'customer', vendorId: '' });
    const [editing, setEditing] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');

    const usersQuery = useQuery({
        queryKey: ['users', api.base],
        queryFn: () => api.get('/users').then((d) => d.users || []),
    });

    const vendorsQuery = useQuery({
        queryKey: ['vendors', api.base],
        queryFn: () => api.get('/vendors').then((d) => d.vendors || []),
    });

    const vendors = vendorsQuery.data || [];

    const saveUser = useMutation({
        mutationFn: async () => {
            const payload = {
                email: form.email,
                password: form.password,
                role: form.role,
                vendorId: form.vendorId,
            };
            if (editing) {
                return api.patch(`/users/${editing.id}`, payload);
            }
            return api.post('/users', payload);
        },
        onSuccess: () => {
            resetForm();
            qc.invalidateQueries({ queryKey: ['users', api.base] });
        },
    });

    const removeUser = useMutation({
        mutationFn: (id) => api.del(`/users/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['users', api.base] }),
    });

    const resetForm = () => {
        setEditing(null);
        setForm({ email: '', password: '', role: 'customer', vendorId: '' });
        setShowModal(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        saveUser.mutate();
    };

    const users = usersQuery.data || [];
    const filteredUsers = users.filter((u) =>
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.role?.toLowerCase().includes(search.toLowerCase()) ||
        u.id?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="stack gap-lg">
            <div className="card">
                <div className="card-head">
                    <div>
                        <p className="eyebrow">Accounts</p>
                        <h3>All Users</h3>
                    </div>
                    <div className="inline gap-md">
                        <div className="search-box">
                            <Search size={16} className="muted" />
                            <input
                                className="search-input"
                                placeholder="Search email or role..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            className="btn primary small"
                            onClick={() => {
                                resetForm();
                                setShowModal(true);
                            }}
                        >
                            <Plus size={14} /> New User
                        </button>
                    </div>
                </div>
                <div className="table">
                    <div className="table-head">
                        <span>Email</span>
                        <span>Role</span>
                        <span>Vendor Reference</span>
                        <span>Created At</span>
                        <span />
                    </div>
                    {filteredUsers.map((user) => (
                        <div key={user.id} className="table-row">
                            <span className="mono">
                                <div className="inline gap-sm">
                                    <UserRound size={14} className="muted" />
                                    {user.email}
                                </div>
                            </span>
                            <span>
                                <span className={`pill ${user.role === 'admin' ? 'danger' : user.role === 'vendor' ? 'primary' : 'subtle'}`}>
                                    {user.role}
                                </span>
                            </span>
                            <span className="muted xs">
                                {user.role === 'vendor' ? (user.vendor_id || 'Missing') : '—'}
                            </span>
                            <span className="muted xs">{formatDateTime(user.created_at)}</span>
                            <span className="inline gap-sm">
                                <button
                                    className="icon-btn"
                                    onClick={() => {
                                        setEditing(user);
                                        setForm({
                                            email: user.email || '',
                                            password: '', // do not populate password
                                            role: user.role || 'customer',
                                            vendorId: user.vendor_id || '',
                                        });
                                        setShowModal(true);
                                    }}
                                    title="Edit user"
                                >
                                    <Edit size={14} />
                                </button>
                                <button
                                    className="icon-btn danger"
                                    onClick={() => {
                                        if (window.confirm('Delete this user permanently?')) removeUser.mutate(user.id);
                                    }}
                                    title="Delete user"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </span>
                        </div>
                    ))}
                    {usersQuery.isLoading ? <div className="empty">Loading users...</div> : null}
                    {!usersQuery.isLoading && filteredUsers.length === 0 ? (
                        <div className="empty">No users found.</div>
                    ) : null}
                </div>
            </div>

            <Modal
                open={showModal}
                title={editing ? 'Edit user' : 'New user'}
                onClose={resetForm}
                footer={
                    <>
                        <button className="btn ghost" onClick={resetForm}>
                            Cancel
                        </button>
                        <button className="btn primary" onClick={handleSubmit} disabled={saveUser.isPending}>
                            {saveUser.isPending ? 'Saving...' : 'Save user'}
                        </button>
                    </>
                }
            >
                <div className="stack gap-md">
                    <label className="label">
                        Email
                        <input
                            type="email"
                            className="input"
                            value={form.email}
                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                            required
                        />
                    </label>
                    <label className="label">
                        {editing ? 'New Password (leave blank to keep current)' : 'Password'}
                        <input
                            type="text"
                            className="input"
                            value={form.password}
                            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                            placeholder={editing ? "Leave blank to keep unchanged" : "SecurePass123!"}
                            required={!editing}
                        />
                    </label>
                    <label className="label">
                        Role
                        <select
                            className="input"
                            value={form.role}
                            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                        >
                            <option value="customer">Customer</option>
                            <option value="vendor">Vendor</option>
                            <option value="admin">Admin</option>
                        </select>
                    </label>

                    {form.role === 'vendor' && (
                        <label className="label">
                            Linked Vendor Account
                            <select
                                className="input"
                                value={form.vendorId}
                                onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
                            >
                                <option value="">-- Select Vendor --</option>
                                {vendors.map((v) => (
                                    <option key={v.id} value={v.id}>{v.name} ({v.id})</option>
                                ))}
                            </select>
                            <span className="muted xs mt-xs">Required for vendor role to access store dashboard.</span>
                        </label>
                    )}

                    {saveUser.isError && <p className="error">Failed to save user. Ensure email is unique.</p>}
                </div>
            </Modal>
        </div>
    );
}
