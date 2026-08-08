'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import { formatDate } from '@kitchen-erp/utils';
import type { AuditLog } from '@kitchen-erp/types';
import { useAuth } from '../../../contexts/AuthContext';

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entityFilter, setEntityFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.auditLogs.list({
        page,
        limit: LIMIT,
        ...(entityFilter && { entity: entityFilter }),
      })) as any;
      const items = Array.isArray(res.data) ? res.data : res.data?.data || [];
      const count = typeof res.total === 'number' ? res.total : res.data?.total || items.length;
      setLogs(items);
      setTotal(count);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, entityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const ACTION_COLOR: Record<string, string> = {
    CREATE: 'green',
    UPDATE: 'blue',
    DELETE: 'red',
    LOGIN: 'purple',
    LOGOUT: 'gray',
    UPLOAD: 'amber',
  };

  const safeLogs = logs || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Audit Logs</h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            System-wide immutable activity & audit trail
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All entities</option>
            {[
              'Tenant',
              'User',
              'Vendor',
              'Product',
              'Purchase',
              'VendorCategory',
              'ProductCategory',
            ].map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            ↻ Refresh
          </button>
        </div>
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
          ) : safeLogs.length === 0 ? (
            <div className="empty-state">
              <h3>No audit logs found</h3>
              <p>System activities and user actions will be recorded here.</p>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    {user?.role === 'SUPER_ADMIN' && <th>Tenant</th>}
                    <th>Action</th>
                    <th>Entity</th>
                    <th>User</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {safeLogs.map((log) => {
                    const isExpanded = expandedId === log.id;
                    const tenantInfo = (log as any).tenant;
                    const userInfo = (log as any).user;
                    const hasPayload = log.newValues || log.oldValues;

                    return (
                      <>
                        <tr key={log.id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                            {formatDate(log.createdAt)}
                          </td>
                          {user?.role === 'SUPER_ADMIN' && (
                            <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                              {tenantInfo ? tenantInfo.name : 'System / Super Admin'}
                              {tenantInfo?.slug && (
                                <div
                                  style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}
                                >
                                  ({tenantInfo.slug})
                                </div>
                              )}
                            </td>
                          )}
                          <td>
                            <span className={`badge badge-${ACTION_COLOR[log.action] || 'gray'}`}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {log.entity}
                            {log.entityId && (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--color-text-muted)',
                                  marginLeft: 4,
                                }}
                              >
                                #{log.entityId.slice(0, 8)}
                              </span>
                            )}
                          </td>
                          <td>
                            {userInfo?.name || 'System User'}
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {userInfo?.email || userInfo?.role}
                            </div>
                          </td>
                          <td>
                            {hasPayload ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setExpandedId(isExpanded ? null : log.id)}
                              >
                                {isExpanded ? 'Hide Payload' : 'View Payload'}
                              </button>
                            ) : (
                              <span
                                style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}
                              >
                                No data
                              </span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && hasPayload && (
                          <tr key={`${log.id}-payload`}>
                            <td
                              colSpan={user?.role === 'SUPER_ADMIN' ? 6 : 5}
                              style={{
                                background: 'var(--color-bg-tertiary)',
                                padding: '0.75rem 1rem',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  marginBottom: 4,
                                  color: 'var(--color-text-secondary)',
                                }}
                              >
                                RECORDED CHANGES PAYLOAD
                              </div>
                              <pre
                                style={{
                                  background: 'var(--color-bg-primary)',
                                  padding: '0.625rem',
                                  borderRadius: 6,
                                  border: '1px solid var(--color-border)',
                                  fontSize: '0.75rem',
                                  overflowX: 'auto',
                                  margin: 0,
                                }}
                              >
                                {JSON.stringify(log.newValues || log.oldValues, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {total > LIMIT && (
            <div className="pagination" style={{ padding: '1rem' }}>
              <span>
                {total} total · Page {page} of {Math.ceil(total / LIMIT)}
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
      </div>
    </>
  );
}
