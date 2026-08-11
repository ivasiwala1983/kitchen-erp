'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import { CategorySelector } from '@kitchen-erp/ui';
import type { Product, Category } from '@kitchen-erp/types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ categoryId: '', name: '', unit: 'kg' });
  const [editForm, setEditForm] = useState({
    categoryId: '',
    name: '',
    unit: 'kg',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const units = [
    'kg',
    'litre',
    'piece',
    'dozen',
    'gram',
    'ml',
    'box',
    'packet',
    'cylinder',
    'can',
    'bunch',
    'bottle',
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.products.list({ limit: 200 }) as Promise<{ data?: unknown }>,
        api.categories.list({ limit: 100 }) as Promise<{ data?: unknown }>,
      ]);
      const pObj = pRes as { data?: unknown[] };
      const cObj = cRes as { data?: unknown[] };
      setProducts((Array.isArray(pRes.data) ? pRes.data : pObj.data || []) as Product[]);
      setCategories((Array.isArray(cRes.data) ? cRes.data : cObj.data || []) as Category[]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load products');
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
      await api.products.create(form);
      setShowModal(false);
      setForm({ categoryId: '', name: '', unit: 'kg' });
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setEditForm({
      categoryId: p.categoryId || '',
      name: p.name || '',
      unit: p.unit || 'kg',
      isActive: p.isActive,
    });
    setError('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSubmitting(true);
    setError('');
    try {
      await api.products.update(editingProduct.id, editForm);
      setEditingProduct(null);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to update product');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (p: Product) => {
    try {
      await api.products.update(p.id, { isActive: !p.isActive });
      load();
    } catch {
      setError('Failed to update product status');
    }
  };

  const safeProducts = products || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Product Master</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Manage inventory products referencing Category Master
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError('');
            setShowModal(true);
          }}
        >
          + New Product
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
                    <th>Product</th>
                    <th>Category</th>
                    <th>Default Unit</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {safeProducts.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {p.name}
                      </td>
                      <td>
                        <span className="badge badge-purple">
                          {p.category?.icon ? `${p.category.icon} ` : ''}
                          {p.category?.name || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-blue">{p.unit}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${p.isActive ? 'green' : 'red'}`}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}
                        >
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenEdit(p)}
                          >
                            Edit
                          </button>
                          <button
                            className={`btn btn-sm ${p.isActive ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => toggleActive(p)}
                          >
                            {p.isActive ? 'Deactivate' : 'Activate'}
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

      {/* ── CREATE PRODUCT MODAL ────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Create Product
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
                <CategorySelector
                  label="Category"
                  value={form.categoryId}
                  onChange={(val) => setForm((f) => ({ ...f, categoryId: val || '' }))}
                  categories={categories.filter((c) => c.isActive)}
                  apiClient={api}
                  required
                  variant="admin"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g. Tomato / Basmati Rice"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Default Unit *</label>
                <select
                  className="input"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                >
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
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
                  {submitting ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT PRODUCT MODAL ──────────────────────────────────────────────── */}
      {editingProduct && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setEditingProduct(null)}
        >
          <div className="modal">
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Edit Product
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
                <CategorySelector
                  label="Category"
                  value={editForm.categoryId}
                  onChange={(val) => setEditForm((f) => ({ ...f, categoryId: val || '' }))}
                  categories={categories}
                  apiClient={api}
                  required
                  variant="admin"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Default Unit *</label>
                <select
                  className="input"
                  value={editForm.unit}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                >
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className="form-group"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <input
                  type="checkbox"
                  id="product-active"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="product-active" className="form-label" style={{ marginBottom: 0 }}>
                  Active Product
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
                  onClick={() => setEditingProduct(null)}
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
