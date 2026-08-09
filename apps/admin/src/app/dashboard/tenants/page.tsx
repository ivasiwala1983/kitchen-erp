'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import { formatDate, formatCurrency } from '@kitchen-erp/utils';
import type { Tenant, TenantPlan } from '@kitchen-erp/types';

interface TenantDetailsData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    domain?: string | null;
    plan: string;
    currency: string;
    isActive: boolean;
    createdAt: string;
    userCount: number;
    vendorCount: number;
    productCount: number;
    purchaseCount: number;
    totalSpend: number;
  };
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }>;
  vendors: Array<{
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    category?: string | null;
    isActive: boolean;
    createdAt: string;
  }>;
  products: Array<{
    id: string;
    name: string;
    categoryName: string;
    unit: string;
    isActive: boolean;
    createdAt: string;
  }>;
  purchases: Array<{
    id: string;
    purchaseDate: string;
    vendorName: string;
    totalAmount: number;
    status: string;
    invoiceReceiptUrl?: string | null;
    itemCount: number;
    createdByName: string;
  }>;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);

  // Tenant Details Modal states
  const [selectedDetailTenant, setSelectedDetailTenant] = useState<Tenant | null>(null);
  const [detailData, setDetailData] = useState<TenantDetailsData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailTab, setDetailTab] = useState<
    'overview' | 'users' | 'vendors' | 'products' | 'purchases'
  >('overview');

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
      const res = (await api.tenants.list({ page, limit: LIMIT })) as {
        data?: unknown;
        total?: number;
      };
      const resObj = res as { data?: unknown[]; total?: number };
      const items = Array.isArray(res.data) ? res.data : resObj.data || [];
      const count = typeof res.total === 'number' ? res.total : resObj.total || items.length;
      setTenants(items as Tenant[]);
      setTotal(count);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  function formatApiError(e: unknown): string {
    const err = e as {
      message?: string;
      response?: { data?: { message?: string; errors?: Record<string, string[]> } };
    };
    const data = err?.response?.data;
    if (!data) return err?.message || 'Request failed';
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
      await api.tenants.create({ ...createForm, plan: createForm.plan as TenantPlan });
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
    } catch (e: unknown) {
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
        plan: editForm.plan as TenantPlan,
        currency: editForm.currency,
      });
      setEditingTenant(null);
      setSuccessMsg('Tenant updated successfully!');
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to update tenant');
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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to delete tenant');
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
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to update tenant status');
    }
  };

  const openEditModal = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditForm({
      name: tenant.name,
      domain: ((tenant as unknown as Record<string, unknown>).domain as string) || '',
      plan: tenant.plan || 'BASIC',
      currency: ((tenant as unknown as Record<string, unknown>).currency as string) || 'INR',
    });
  };

  const openDetailsModal = async (tenant: Tenant) => {
    setSelectedDetailTenant(tenant);
    setDetailData(null);
    setLoadingDetails(true);
    setDetailTab('overview');
    try {
      const res = (await api.tenants.getDetails(tenant.id)) as { data?: TenantDetailsData };
      if (res?.data) {
        setDetailData(res.data);
      }
    } catch (e: unknown) {
      setError(formatApiError(e));
    } finally {
      setLoadingDetails(false);
    }
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
                    <td>
                      {((t as unknown as Record<string, unknown>).domain as string) || (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-purple">{t.plan}</span>
                    </td>
                    <td>
                      <span className="badge badge-blue">
                        {((t as unknown as Record<string, unknown>).currency as string) || 'INR'}
                      </span>
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
                          className="btn btn-sm btn-primary"
                          onClick={() => openDetailsModal(t)}
                          title="View Tenant Details"
                          style={{ background: '#3b82f6', borderColor: '#3b82f6', color: 'white' }}
                        >
                          🔍 Details
                        </button>
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

      {/* ── TENANT DETAILS MODAL ───────────────────────────────────────── */}
      {selectedDetailTenant && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setSelectedDetailTenant(null)}
        >
          <div
            className="modal"
            style={{
              maxWidth: 920,
              width: '94vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.5rem',
            }}
          >
            {/* Modal Top Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: '#f0f4e8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    flexShrink: 0,
                  }}
                >
                  🍳
                </div>
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <h2
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        margin: 0,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {selectedDetailTenant.name}
                    </h2>
                    <span
                      className={`badge badge-${selectedDetailTenant.isActive ? 'green' : 'red'}`}
                    >
                      {selectedDetailTenant.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="badge badge-purple">{selectedDetailTenant.plan}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-muted)',
                      marginTop: 2,
                    }}
                  >
                    Slug: <code>{selectedDetailTenant.slug}</code> · Created:{' '}
                    {formatDate(selectedDetailTenant.createdAt)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailTenant(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  padding: '0.25rem',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {loadingDetails ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem', width: 36, height: 36 }} />
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Loading tenant details & metrics...
                </div>
              </div>
            ) : detailData ? (
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
                {/* Summary Metrics Cards */}
                <div className="grid-4" style={{ marginBottom: '1.25rem', gap: '0.75rem' }}>
                  <div className="stat-card" style={{ padding: '0.875rem' }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      Users Count
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                      {detailData.users.length}
                    </div>
                  </div>
                  <div className="stat-card" style={{ padding: '0.875rem' }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      Vendors Count
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                      {detailData.vendors.length}
                    </div>
                  </div>
                  <div className="stat-card" style={{ padding: '0.875rem' }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      Products Count
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                      {detailData.products.length}
                    </div>
                  </div>
                  <div className="stat-card" style={{ padding: '0.875rem' }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      Total Spend
                    </div>
                    <div
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: 'var(--color-accent-green)',
                      }}
                    >
                      {formatCurrency(
                        detailData.tenant.totalSpend,
                        detailData.tenant.currency || 'INR'
                      )}
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    borderBottom: '1px solid var(--color-border)',
                    marginBottom: '1rem',
                    paddingBottom: '0.5rem',
                    overflowX: 'auto',
                  }}
                >
                  <button
                    className={`btn btn-sm ${detailTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDetailTab('overview')}
                  >
                    ℹ️ Overview
                  </button>
                  <button
                    className={`btn btn-sm ${detailTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDetailTab('users')}
                  >
                    👥 Users ({detailData.users.length})
                  </button>
                  <button
                    className={`btn btn-sm ${detailTab === 'vendors' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDetailTab('vendors')}
                  >
                    🏬 Vendors ({detailData.vendors.length})
                  </button>
                  <button
                    className={`btn btn-sm ${detailTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDetailTab('products')}
                  >
                    🥦 Products ({detailData.products.length})
                  </button>
                  <button
                    className={`btn btn-sm ${detailTab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDetailTab('purchases')}
                  >
                    🧾 Purchases ({detailData.purchases.length})
                  </button>
                </div>

                {/* Tab Content Panels */}
                {detailTab === 'overview' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '1rem',
                    }}
                  >
                    <div className="card" style={{ padding: '1rem' }}>
                      <h3
                        style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem' }}
                      >
                        Organization Overview
                      </h3>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        <div>
                          <strong>Tenant ID:</strong> <code>{detailData.tenant.id}</code>
                        </div>
                        <div>
                          <strong>Kitchen Name:</strong> {detailData.tenant.name}
                        </div>
                        <div>
                          <strong>URL Slug:</strong> <code>{detailData.tenant.slug}</code>
                        </div>
                        <div>
                          <strong>Domain:</strong> {detailData.tenant.domain || 'Not configured'}
                        </div>
                        <div>
                          <strong>Subscription Plan:</strong>{' '}
                          <span className="badge badge-purple">{detailData.tenant.plan}</span>
                        </div>
                        <div>
                          <strong>Currency:</strong>{' '}
                          <span className="badge badge-blue">{detailData.tenant.currency}</span>
                        </div>
                        <div>
                          <strong>Created On:</strong> {formatDate(detailData.tenant.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="card" style={{ padding: '1rem' }}>
                      <h3
                        style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem' }}
                      >
                        Activity Breakdown
                      </h3>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        <div>
                          <strong>Total Registered Staff:</strong> {detailData.users.length} users
                        </div>
                        <div>
                          <strong>Suppliers / Vendors:</strong> {detailData.vendors.length} vendors
                        </div>
                        <div>
                          <strong>Inventory Product Master:</strong> {detailData.products.length}{' '}
                          items
                        </div>
                        <div>
                          <strong>Total Purchases Recorded:</strong> {detailData.purchases.length}{' '}
                          invoices
                        </div>
                        <div>
                          <strong>Total Kitchen Expenditure:</strong>{' '}
                          <strong style={{ color: 'var(--color-accent-green)' }}>
                            {formatCurrency(
                              detailData.tenant.totalSpend,
                              detailData.tenant.currency || 'INR'
                            )}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {detailTab === 'users' && (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>User Name</th>
                          <th>Email Address</th>
                          <th>System Role</th>
                          <th>Status</th>
                          <th>Joined Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.users.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              style={{
                                textAlign: 'center',
                                color: 'var(--color-text-muted)',
                                padding: '1.5rem',
                              }}
                            >
                              No users registered for this tenant.
                            </td>
                          </tr>
                        ) : (
                          detailData.users.map((u) => (
                            <tr key={u.id}>
                              <td style={{ fontWeight: 600 }}>{u.name}</td>
                              <td>
                                <code>{u.email}</code>
                              </td>
                              <td>
                                <span
                                  className={`badge ${u.role === 'TENANT_ADMIN' ? 'badge-purple' : 'badge-blue'}`}
                                >
                                  {u.role}
                                </span>
                              </td>
                              <td>
                                <span className={`badge badge-${u.isActive ? 'green' : 'red'}`}>
                                  {u.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td>{formatDate(u.createdAt)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {detailTab === 'vendors' && (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Vendor Name</th>
                          <th>Category</th>
                          <th>Phone</th>
                          <th>Email</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.vendors.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              style={{
                                textAlign: 'center',
                                color: 'var(--color-text-muted)',
                                padding: '1.5rem',
                              }}
                            >
                              No vendors added for this tenant.
                            </td>
                          </tr>
                        ) : (
                          detailData.vendors.map((v) => (
                            <tr key={v.id}>
                              <td style={{ fontWeight: 600 }}>{v.name}</td>
                              <td>
                                <span className="badge badge-blue">{v.category || 'General'}</span>
                              </td>
                              <td>{v.phone || '—'}</td>
                              <td>{v.email || '—'}</td>
                              <td>
                                <span className={`badge badge-${v.isActive ? 'green' : 'red'}`}>
                                  {v.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {detailTab === 'products' && (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Product Name</th>
                          <th>Category</th>
                          <th>Unit</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.products.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              style={{
                                textAlign: 'center',
                                color: 'var(--color-text-muted)',
                                padding: '1.5rem',
                              }}
                            >
                              No products found in catalog for this tenant.
                            </td>
                          </tr>
                        ) : (
                          detailData.products.map((p) => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 600 }}>{p.name}</td>
                              <td>
                                <span className="badge badge-purple">{p.categoryName}</span>
                              </td>
                              <td>
                                <code>{p.unit}</code>
                              </td>
                              <td>
                                <span className={`badge badge-${p.isActive ? 'green' : 'red'}`}>
                                  {p.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {detailTab === 'purchases' && (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Purchase Date</th>
                          <th>Vendor</th>
                          <th>Items</th>
                          <th>Created By</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Invoice Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.purchases.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              style={{
                                textAlign: 'center',
                                color: 'var(--color-text-muted)',
                                padding: '1.5rem',
                              }}
                            >
                              No purchases recorded for this tenant.
                            </td>
                          </tr>
                        ) : (
                          detailData.purchases.map((pur) => (
                            <tr key={pur.id}>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {formatDate(pur.purchaseDate)}
                              </td>
                              <td style={{ fontWeight: 600 }}>{pur.vendorName}</td>
                              <td>{pur.itemCount} items</td>
                              <td>{pur.createdByName}</td>
                              <td
                                style={{
                                  fontWeight: 700,
                                  color: 'var(--color-accent-green)',
                                }}
                              >
                                {formatCurrency(
                                  pur.totalAmount,
                                  detailData.tenant.currency || 'INR'
                                )}
                              </td>
                              <td>
                                <span className="badge badge-green">{pur.status}</span>
                              </td>
                              <td>
                                {pur.invoiceReceiptUrl ? (
                                  <a
                                    href={pur.invoiceReceiptUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-sm btn-secondary"
                                    style={{
                                      textDecoration: 'none',
                                      padding: '0.2rem 0.55rem',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    📎 View Receipt
                                  </a>
                                ) : (
                                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
