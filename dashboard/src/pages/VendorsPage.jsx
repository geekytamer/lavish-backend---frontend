import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Trash2, UserRound, Edit } from 'lucide-react';
import { useState } from 'react';
import { useApiClient } from '../lib/api.js';
import { Modal } from '../components/Modal.jsx';

export function VendorsPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', rating: '', tags: '' });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const vendors = useQuery({
    queryKey: ['vendors', api.base],
    queryFn: () => api.get('/vendors').then((d) => d.vendors || []),
  });

  const saveVendor = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        description: form.description,
        rating: Number(form.rating) || 0,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };
      if (editing) {
        return api.patch(`/vendors/${editing.id}`, payload);
      }
      return api.post('/vendors', payload);
    },
    onSuccess: () => {
      resetForm();
      qc.invalidateQueries({ queryKey: ['vendors', api.base] });
    },
  });

  const removeVendor = useMutation({
    mutationFn: (id) => api.del(`/vendors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors', api.base] }),
  });

  const resetForm = () => {
    setEditing(null);
    setForm({ name: '', description: '', rating: '', tags: '' });
    setShowModal(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveVendor.mutate();
  };

  return (
    <div className="stack gap-lg">
      <div className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Vendors</p>
            <h3>All vendors</h3>
          </div>
          <button
            className="btn primary small"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <Plus size={14} /> New
          </button>
        </div>
        <div className="table">
          <div className="table-head">
            <span>Name</span>
            <span>Rating</span>
            <span>Tags</span>
            <span>Profile</span>
            <span />
            <span />
          </div>
          {(vendors.data || []).map((vendor) => (
            <div key={vendor.id} className="table-row">
              <span>
                <div className="mono pill subtle">{vendor.id}</div>
                <div>{vendor.name}</div>
              </span>
              <span>{vendor.rating?.toFixed ? vendor.rating.toFixed(1) : vendor.rating || 0}</span>
              <span className="tags">
                {(vendor.tags || []).map((tag) => (
                  <span key={tag} className="pill info">
                    {tag}
                  </span>
                ))}
              </span>
              <span>
                <Link className="btn ghost small" to={`/vendors/${vendor.id}`}>
                  <UserRound size={14} />
                  View
                </Link>
              </span>
              <span>
                <button
                  className="icon-btn"
                  onClick={() => {
                    setEditing(vendor);
                    setForm({
                      name: vendor.name || '',
                      description: vendor.description || '',
                      rating: vendor.rating || '',
                      tags: (vendor.tags || []).join(','),
                    });
                    setShowModal(true);
                  }}
                  title="Edit vendor"
                >
                  <Edit size={14} />
                </button>
              </span>
              <span>
                <button
                  className="icon-btn danger"
                  onClick={() => {
                    if (window.confirm('Delete this vendor?')) removeVendor.mutate(vendor.id);
                  }}
                  title="Delete vendor"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
          {vendors.isLoading ? <div className="empty">Loading vendors...</div> : null}
          {!vendors.isLoading && (vendors.data || []).length === 0 ? (
            <div className="empty">No vendors found.</div>
          ) : null}
        </div>
      </div>

      <Modal
        open={showModal}
        title={editing ? 'Edit vendor' : 'New vendor'}
        onClose={resetForm}
        footer={
          <>
            <button className="btn ghost" onClick={resetForm}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleSubmit} disabled={saveVendor.isPending}>
              <Plus size={14} />
              {saveVendor.isPending ? 'Saving...' : 'Save vendor'}
            </button>
          </>
        }
      >
        <label className="label">
          Name
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <label className="label">
          Rating
          <input
            className="input"
            type="number"
            step="0.1"
            value={form.rating}
            onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
          />
        </label>
        <label className="label">
          Description
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <label className="label">
          Tags (comma-separated)
          <input
            className="input"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="Womenswear, Denim"
          />
        </label>
        {saveVendor.isError ? <p className="error">Could not save vendor.</p> : null}
      </Modal>
    </div>
  );
}
