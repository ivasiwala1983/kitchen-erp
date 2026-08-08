'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import type { UserPublic } from '@kitchen-erp/types';
import { Role } from '@kitchen-erp/types';
import { formatDate } from '@kitchen-erp/utils';

const ROLES_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  TENANT_ADMIN: 'Tenant Admin',
  INVENTORY_MANAGER: 'Inventory Manager',
};
const ROLE_BADGE: Record<Role, string> = {
  SUPER_ADMIN: 'purple',
  TENANT_ADMIN: 'blue',
  INVENTORY_MANAGER: 'amber',
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'INVENTORY_MANAGER',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.users.list({ limit: 50 })) as any;
      const items = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setUsers(items);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load users');
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
      await api.users.create({ ...form, role: form.role as Role });
      setShowModal(false);
      setForm({ email: '', password: '', name: '', role: 'INVENTORY_MANAGER' });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (user: UserPublic) => {
    try {
      await api.users.update(user.id, { isActive: !user.isActive });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update user');
    }
  };

  const safeUsers = users || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Users</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Manage tenant users and roles
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New User
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
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {safeUsers.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {u.name}
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge badge-${ROLE_BADGE[u.role]}`}>
                          {ROLES_LABELS[u.role]}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${u.isActive ? 'green' : 'red'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td>
                        <button
                          className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => toggleActive(u)}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              Create User
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
                <label className="form-label">Full Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <option value="TENANT_ADMIN">Tenant Admin</option>
                  <option value="INVENTORY_MANAGER">Inventory Manager</option>
                </select>
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
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
