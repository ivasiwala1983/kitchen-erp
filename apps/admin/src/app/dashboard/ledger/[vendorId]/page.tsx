'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import type { LedgerAccountPublic, LedgerTransactionPublic } from '@kitchen-erp/types';
import { formatCurrency, formatDate } from '@kitchen-erp/utils';

export default function AdminVendorStatementPage() {
  const params = useParams();
  const vendorId = params?.vendorId as string;

  const [account, setAccount] = useState<LedgerAccountPublic | null>(null);
  const [transactions, setTransactions] = useState<LedgerTransactionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const LIMIT = 25;

  const loadData = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    setError('');

    try {
      const [accRes, txRes] = await Promise.all([
        api.ledger.getVendorDetail(vendorId),
        api.ledger.getVendorTransactions(vendorId, { page, limit: LIMIT }),
      ]);

      if (accRes?.data) setAccount(accRes.data);
      const txPayload = txRes as unknown as { data?: LedgerTransactionPublic[]; total?: number };
      const txItems: LedgerTransactionPublic[] = Array.isArray(txRes?.data)
        ? txRes.data
        : txPayload?.data || [];
      const count = typeof txPayload?.total === 'number' ? txPayload.total : txItems.length;
      setTransactions(txItems);
      setTotal(count);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to load vendor statement');
    } finally {
      setLoading(false);
    }
  }, [vendorId, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const vendor = account?.vendor;
  const balance = account?.currentBalance || 0;
  const isCredit = account?.isVendorCredit || false;

  // Calculate totals for currently fetched statement view
  const totalPurchases = transactions
    .filter((t) => t.type === 'PURCHASE')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalPayments = transactions
    .filter((t) => t.type === 'PAYMENT')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <>
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/dashboard/ledger">
            <button className="btn btn-sm btn-secondary">← Back to Ledger</button>
          </Link>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              Vendor Statement — {vendor?.name || 'Vendor'}
            </h1>
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              Full financial transaction ledger and payment audit history
            </p>
          </div>
        </div>

        <button
          className="btn btn-sm btn-secondary"
          onClick={() => {
            if (typeof window !== 'undefined') window.print();
          }}
        >
          🖨️ Print Statement
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Vendor Master Card */}
      {vendor && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <div
                style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700 }}
              >
                VENDOR NAME
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 2 }}>{vendor.name}</div>
            </div>

            <div>
              <div
                style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700 }}
              >
                CATEGORY
              </div>
              <div style={{ marginTop: 2 }}>
                <span className="badge badge-gray">{vendor.category?.name || '—'}</span>
              </div>
            </div>

            <div>
              <div
                style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700 }}
              >
                PHONE & EMAIL
              </div>
              <div style={{ fontSize: '0.875rem', marginTop: 2 }}>
                {vendor.phone ? `📞 ${vendor.phone}` : '—'}{' '}
                {vendor.email ? `· ✉️ ${vendor.email}` : ''}
              </div>
            </div>

            <div>
              <div
                style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700 }}
              >
                GST NUMBER
              </div>
              <div style={{ fontSize: '0.875rem', marginTop: 2 }}>{vendor.gst || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Statement Summary Cards */}
      {account && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
              OPENING BALANCE
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: 4 }}>
              {formatCurrency(account.openingBalance, 'INR')}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
              PAGE PURCHASES (+)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
              + {formatCurrency(totalPurchases, 'INR')}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
              PAGE PAYMENTS (-)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
              - {formatCurrency(totalPayments, 'INR')}
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '1.25rem',
              background: isCredit ? '#ecfdf5' : '#fef2f2',
              borderColor: isCredit ? '#a7f3d0' : '#fecaca',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: isCredit ? '#065f46' : '#991b1b',
                fontWeight: 700,
              }}
            >
              {isCredit ? 'CREDIT / ADVANCE BALANCE' : 'CURRENT PAYABLE BALANCE'}
            </div>
            <div
              style={{
                fontSize: '1.35rem',
                fontWeight: 900,
                color: isCredit ? '#047857' : '#dc2626',
                marginTop: 4,
              }}
            >
              {isCredit
                ? `- ${formatCurrency(account.absBalance, 'INR')}`
                : formatCurrency(balance, 'INR')}
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Log Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '1rem',
            borderBottom: '1px solid var(--color-border)',
            fontWeight: 700,
          }}
        >
          Transaction Statement History
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Payment Method</th>
                <th>Reference</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: 'center',
                      padding: '2.5rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    No ledger transactions recorded for this vendor.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isPurchase = t.type === 'PURCHASE';
                  const isPayment = t.type === 'PAYMENT';
                  const amt = Number(t.amount);

                  return (
                    <tr key={t.id}>
                      <td style={{ fontSize: '0.84375rem', fontWeight: 600 }}>
                        {formatDate(t.transactionDate)}
                      </td>
                      <td>
                        <span
                          className={`badge ${isPurchase ? 'badge-red' : isPayment ? 'badge-green' : 'badge-purple'}`}
                        >
                          {isPurchase ? '🛒 PURCHASE' : isPayment ? '💳 PAYMENT' : t.type}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.84375rem' }}>{t.paymentMethod || '—'}</td>
                      <td style={{ fontSize: '0.78125rem', color: 'var(--color-text-muted)' }}>
                        {t.referenceType
                          ? `${t.referenceType} #${t.referenceId ? t.referenceId.slice(0, 8) : ''}`
                          : '—'}
                      </td>
                      <td style={{ fontSize: '0.84375rem', color: 'var(--color-text-muted)' }}>
                        {t.note || '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          color: isPurchase ? '#dc2626' : '#059669',
                        }}
                      >
                        {isPurchase
                          ? `+ ${formatCurrency(amt, 'INR')}`
                          : `- ${formatCurrency(amt, 'INR')}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div
            style={{
              padding: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Showing {transactions.length} of {total} transactions
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-sm btn-secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn-sm btn-secondary"
                disabled={page >= Math.ceil(total / LIMIT)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
