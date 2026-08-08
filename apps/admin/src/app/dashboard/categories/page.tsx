'use client';

import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import type { Category } from '@kitchen-erp/types';

export default function CategoryMasterPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayOrder: 0,
    icon: '🥕',
    color: '#22c55e',
    description: '',
    isActive: true,
  });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res: any = await api.categories.list({ search, limit: 100 });
      const items = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setCategories(items);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [search]);

  const handleOpenCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      displayOrder: categories.length + 1,
      icon: '📦',
      color: '#6366f1',
      description: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      displayOrder: cat.displayOrder ?? 0,
      icon: cat.icon || '',
      color: cat.color || '#6366f1',
      description: cat.description || '',
      isActive: cat.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.categories.update(editingCategory.id, formData);
        setSuccess('Category updated successfully');
      } else {
        await api.categories.create(formData);
        setSuccess('Category created successfully');
      }
      setIsModalOpen(false);
      fetchCategories();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      await api.categories.delete(id);
      setSuccess('Category deleted successfully');
      fetchCategories();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete category');
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--color-text-primary)',
            }}
          >
            Category Master
          </h1>
          <p
            style={{
              margin: '0.25rem 0 0 0',
              color: 'var(--color-text-muted)',
              fontSize: '0.875rem',
            }}
          >
            Unified categories used across Vendors and Products.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          + Add Category
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input
            type="text"
            className="input"
            placeholder="Search categories by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 350 }}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Order</th>
              <th>Category</th>
              <th>Description</th>
              <th>Vendors</th>
              <th>Products</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading categories...
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}
                >
                  No categories found.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id}>
                  <td>
                    <span className="badge badge-gray" style={{ fontWeight: 600 }}>
                      #{cat.displayOrder}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: cat.color ? `${cat.color}20` : '#f1f5f9',
                          color: cat.color || '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                          border: `1px solid ${cat.color || '#cbd5e1'}40`,
                        }}
                      >
                        {cat.icon || '📁'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {cat.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    {cat.description || '—'}
                  </td>
                  <td>
                    <span className="badge badge-purple">{cat._count?.vendors ?? 0} Vendors</span>
                  </td>
                  <td>
                    <span className="badge badge-blue">{cat._count?.products ?? 0} Products</span>
                  </td>
                  <td>
                    {cat.isActive ? (
                      <span className="badge badge-green">Active</span>
                    ) : (
                      <span className="badge badge-gray">Inactive</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleOpenEditModal(cat)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(cat.id, cat.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 500, padding: '1.5rem' }}>
            <h2
              style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 0, marginBottom: '1rem' }}
            >
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Category Name *</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Vegetable, Dairy, Gas"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label">Display Order</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.displayOrder}
                    onChange={(e) =>
                      setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="label">Icon (Emoji/Text)</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="e.g. 🥕, 🥦"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Badge Color</label>
                  <input
                    type="color"
                    className="input"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    style={{ height: 42, padding: 4, cursor: 'pointer' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional notes or details..."
                />
              </div>

              <div
                className="form-group"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <label
                  htmlFor="isActive"
                  style={{ fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Active (Visible in PWA & Admin)
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '1.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
