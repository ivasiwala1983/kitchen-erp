'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import { formatDate } from '@kitchen-erp/utils';
import type { Tenant } from '@kitchen-erp/types';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    adminEmail: '',
    adminName: '',
    adminPassword: '',
    plan: 'BASIC',
    currency: 'INR',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    domain: '',
    plan: 'BASIC',
    currency: 'INR',
  });

  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.tenants.list({ page, limit: LIMIT })) as any;
      const items = Array.isArray(res.data) ? res.data : res.data?.data || [];
      const count = typeof res.total === 'number' ? res.total : res.data?.total || items.length;
      setTenants(items);
      setTotal(count);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  function formatApiError(e: any): string {
    const data = e?.response?.data;
    if (!data) return e?.message || 'Request failed';
    if (data.errors && typeof data.errors === 'object') {
      const messages = Object.entries(data.errors)
        .map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`)
        .join(' | ');
      return `${data.message || 'Validation failed'}: ${messages}`;
    }
    return data.message || 'Failed';
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.tenants.create({ ...createForm, plan: createForm.plan as any });
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        slug: '',
        adminEmail: '',
        adminName: '',
        adminPassword: '',
        plan: 'BASIC',
        currency: 'INR',
      });
      setSuccessMsg('Tenant created successfully!');
      load();
    } catch (e: any) {
      setError(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.tenants.update(editingTenant.id, {
        name: editForm.name,
        domain: editForm.domain || undefined,
        plan: editForm.plan as any,
        currency: editForm.currency,
      });
      setEditingTenant(null);
      setSuccessMsg('Tenant updated successfully!');
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update tenant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTenant) return;
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.tenants.delete(deletingTenant.id);
      setDeletingTenant(null);
      setSuccessMsg(`Tenant '${deletingTenant.name}' deleted successfully!`);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete tenant');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (tenant: Tenant) => {
    setError('');
    setSuccessMsg('');
    try {
      if (tenant.isActive) {
        await api.tenants.deactivate(tenant.id);
        setSuccessMsg(`Tenant '${tenant.name}' deactivated`);
      } else {
        await api.tenants.activate(tenant.id);
        setSuccessMsg(`Tenant '${tenant.name}' activated`);
      }
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update tenant status');
    }
  };

  const openEditModal = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditForm({
      name: tenant.name,
      domain: (tenant as any).domain || '',
      plan: tenant.plan || 'BASIC',
      currency: (tenant as any).currency || 'INR',
    });
  };

  const safeTenants = tenants || [];

  const CURRENCY_OPTIONS = [
    { code: 'INR', label: 'INR (₹) — Indian Rupee' },
    { code: 'USD', label: 'USD ($) — US Dollar' },
    { code: 'EUR', label: 'EUR (€) — Euro' },
    { code: 'GBP', label: 'GBP (£) — British Pound' },
    { code: 'AED', label: 'AED (د.إ) — UAE Dirham' },
    { code: 'SAR', label: 'SAR (﷼) — Saudi Riyal' },
    { code: 'CAD', label: 'CAD (CA$) — Canadian Dollar' },
    { code: 'AUD', label: 'AUD (A$) — Australian Dollar' },
    { code: 'SGD', label: 'SGD (S$) — Singapore Dollar' },
    { code: 'QAR', label: 'QAR (QR) — Qatari Riyal' },
    { code: 'OMR', label: 'OMR — Omani Rial' },
    { code: 'KWD', label: 'KWD (KD) — Kuwaiti Dinar' },
    { code: 'BHD', label: 'BHD (BD) — Bahraini Dinar' },
  ];

  return (
    <div>
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 className="page-title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            Tenants
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Manage all platform tenants
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError('');
            setShowCreateModal(true);
          }}
        >
          + Add New Tenant
        </button>
      </div>

      {successMsg && (
        <div
          className="alert alert-success"
          style={{
            marginBottom: '1rem',
            background: 'rgba(16,185,129,0.15)',
            borderColor: 'rgba(16,185,129,0.3)',
            color: '#6ee7b7',
          }}
        >
          {successMsg}
        </div>
      )}
      {error && !showCreateModal && !editingTenant && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="spinner" />
          </div>
        ) : safeTenants.length === 0 ? (
          <div className="empty-state">
            <h3>No tenants yet</h3>
            <p>Create your first tenant to get started.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Domain</th>
                  <th>Plan</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {safeTenants.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {t.name}
                    </td>
                    <td>
                      <code
                        style={{
                          background: 'var(--color-bg-tertiary)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: '0.8125rem',
                        }}
                      >
                        {t.slug}
                      </code>
                    </td>
                    <td>{(t as any).domain || <span className="text-muted">—</span>}</td>
                    <td>
                      <span className="badge badge-purple">{t.plan}</span>
                    </td>
                    <td>
                      <span className="badge badge-blue">{(t as any).currency || 'INR'}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${t.isActive ? 'green' : 'red'}`}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{formatDate(t.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => openEditModal(t)}
                          title="Edit Tenant"
                        >
                          Edit
                        </button>
                        <button
                          className={`btn btn-sm ${t.isActive ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => toggleActive(t)}
                          title={t.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {t.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => setDeletingTenant(t)}
                          title="Delete Tenant"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="pagination" style={{ padding: '1rem' }}>
            <span>
              Page {page} of {Math.ceil(total / LIMIT)}
            </span>
            <button
              className="page-btn"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ←
            </button>
            <button
              className="page-btn"
              disabled={page >= Math.ceil(total / LIMIT)}
              onClick={() => setPage((p) => p + 1)}
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* ── CREATE TENANT MODAL ─────────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
        >
          <div className="modal">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              Create New Tenant
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
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Tenant Name *</label>
                  <input
                    className="input"
                    placeholder="Badri Kitchen"
                    value={createForm.name}
                    onChange={(e) => {
                      setCreateForm((f) => ({
                        ...f,
                        name: e.target.value,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/(^-|-$)/g, ''),
                      }));
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug *</label>
                  <input
                    className="input"
                    placeholder="badri-kitchen"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Plan</label>
                  <select
                    className="input"
                    value={createForm.plan}
                    onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value }))}
                  >
                    <option value="BASIC">Basic</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Currency *</label>
                  <select
                    className="input"
                    value={createForm.currency}
                    onChange={(e) => setCreateForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-muted)',
                    marginBottom: '0.875rem',
                  }}
                >
                  First Admin Account
                </p>
                <div className="grid-2" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Admin Name *</label>
                    <input
                      className="input"
                      placeholder="John Doe"
                      value={createForm.adminName}
                      onChange={(e) => setCreateForm((f) => ({ ...f, adminName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Admin Email *</label>
                    <input
                      className="input"
                      type="email"
                      placeholder="admin@tenant.com"
                      value={createForm.adminEmail}
                      onChange={(e) => setCreateForm((f) => ({ ...f, adminEmail: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Admin Password *</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Min 8 chars, upper+lower+digit"
                    value={createForm.adminPassword}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, adminPassword: e.target.value }))
                    }
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT TENANT MODAL ───────────────────────────────────────── */}
      {editingTenant && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setEditingTenant(null)}
        >
          <div className="modal">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              Edit Tenant
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
                <label className="form-label">Tenant Name *</label>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Custom Domain (optional)</label>
                <input
                  className="input"
                  placeholder="kitchen.example.com"
                  value={editForm.domain}
                  onChange={(e) => setEditForm((f) => ({ ...f, domain: e.target.value }))}
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Subscription Plan</label>
                  <select
                    className="input"
                    value={editForm.plan}
                    onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))}
                  >
                    <option value="BASIC">Basic</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Currency *</label>
                  <select
                    className="input"
                    value={editForm.currency}
                    onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
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
                  onClick={() => setEditingTenant(null)}
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

      {/* ── DELETE CONFIRMATION MODAL ───────────────────────────────── */}
      {deletingTenant && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setDeletingTenant(null)}
        >
          <div className="modal" style={{ maxWidth: 440 }}>
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--color-accent-red)',
                marginBottom: '0.75rem',
              }}
            >
              Delete Tenant?
            </h2>
            <p
              style={{
                fontSize: '0.9375rem',
                color: 'var(--color-text-secondary)',
                marginBottom: '1.25rem',
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to delete{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>{deletingTenant.name}</strong>{' '}
              ({deletingTenant.slug})? This will soft-delete the tenant and restrict all associated
              user logins.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingTenant(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Yes, Delete Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
