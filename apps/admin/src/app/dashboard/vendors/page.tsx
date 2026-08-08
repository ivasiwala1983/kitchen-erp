'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import type { Vendor, Category } from '@kitchen-erp/types';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    categoryId: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    gst: '',
  });
  const [editForm, setEditForm] = useState({
    categoryId: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    gst: '',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, cRes] = await Promise.all([
        api.vendors.list({ limit: 100 }) as any,
        api.categories.list({ limit: 100 }) as any,
      ]);
      setVendors(Array.isArray(vRes.data) ? vRes.data : vRes.data?.data || []);
      setCategories(Array.isArray(cRes.data) ? cRes.data : cRes.data?.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.vendors.create(form);
      setShowModal(false);
      setForm({ categoryId: '', name: '', phone: '', email: '', address: '', gst: '' });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create vendor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (v: Vendor) => {
    setEditingVendor(v);
    setEditForm({
      categoryId: v.categoryId || '',
      name: v.name || '',
      phone: v.phone || '',
      email: v.email || '',
      address: v.address || '',
      gst: v.gst || '',
      isActive: v.isActive,
    });
    setError('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;
    setSubmitting(true);
    setError('');
    try {
      await api.vendors.update(editingVendor.id, editForm);
      setEditingVendor(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update vendor');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (v: Vendor) => {
    try {
      await api.vendors.update(v.id, { isActive: !v.isActive });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update status');
    }
  };

  const safeVendors = vendors || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Vendor Master</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Manage supplier vendors referencing Category Master
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError('');
            setShowModal(true);
          }}
        >
          + New Vendor
        </button>
      </div>

      <div className="page-body">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Phone</th>
                    <th>GST</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {safeVendors.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {v.name}
                      </td>
                      <td>
                        <span className="badge badge-purple">
                          {v.category?.icon ? `${v.category.icon} ` : ''}
                          {v.category?.name || '—'}
                        </span>
                      </td>
                      <td>{v.phone || '—'}</td>
                      <td>{v.gst || '—'}</td>
                      <td>
                        <span className={`badge badge-${v.isActive ? 'green' : 'red'}`}>
                          {v.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}
                        >
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenEdit(v)}
                          >
                            Edit
                          </button>
                          <button
                            className={`btn btn-sm ${v.isActive ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => toggleActive(v)}
                          >
                            {v.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE VENDOR MODAL ──────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Create Vendor
            </h2>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            <form
              onSubmit={handleCreate}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="input"
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  required
                >
                  <option value="">Select category...</option>
                  {(categories || [])
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ''}
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g. Satnam Agro"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 9876543210"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input
                    className="input"
                    value={form.gst}
                    onChange={(e) => setForm((f) => ({ ...f, gst: e.target.value }))}
                    placeholder="27AAAAA0000A1Z5"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="vendor@example.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="City, Market Gate"
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                  marginTop: '0.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT VENDOR MODAL ───────────────────────────────────────────────── */}
      {editingVendor && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setEditingVendor(null)}
        >
          <div className="modal">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Edit Vendor
            </h2>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}
            <form
              onSubmit={handleUpdate}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="input"
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
                  required
                >
                  <option value="">Select category...</option>
                  {(categories || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Vendor Name *</label>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="input"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input
                    className="input"
                    value={editForm.gst}
                    onChange={(e) => setEditForm((f) => ({ ...f, gst: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  className="input"
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div
                className="form-group"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <input
                  type="checkbox"
                  id="vendor-active"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="vendor-active" className="form-label" style={{ marginBottom: 0 }}>
                  Active Vendor
                </label>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                  marginTop: '0.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingVendor(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
