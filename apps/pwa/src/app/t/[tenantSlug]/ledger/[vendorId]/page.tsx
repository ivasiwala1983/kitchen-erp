'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '../../../../../contexts/TenantContext';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatCurrency, formatDate } from '@kitchen-erp/utils';
import type { LedgerAccountPublic, LedgerTransactionPublic } from '@kitchen-erp/types';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export default function PwaVendorLedgerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenant, tenantSlug, user, isLoading } = useTenant();
  const vendorId = params?.vendorId as string;

  const [account, setAccount] = useState<LedgerAccountPublic | null>(null);
  const [transactions, setTransactions] = useState<LedgerTransactionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const LIMIT = 20;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/t/${tenantSlug}/login`);
    }
  }, [user, isLoading, tenantSlug, router]);

  useEffect(() => {
    if (!tenantSlug || !vendorId) return;
    const api = new KitchenErpApi({ baseURL: API_URL, tenantSlug });

    // Fetch Vendor Ledger Detail
    api.ledger
      .getVendorDetail(vendorId)
      .then((res) => {
        if (res.data) setAccount(res.data);
      })
      .catch(() => {});
  }, [tenantSlug, vendorId]);

  useEffect(() => {
    if (!tenantSlug || !vendorId) return;
    setLoading(true);
    const api = new KitchenErpApi({ baseURL: API_URL, tenantSlug });

    api.ledger
      .getVendorTransactions(vendorId, { page, limit: LIMIT })
      .then((res: any) => {
        const items = Array.isArray(res?.data) ? res.data : res?.data?.data || [];
        const count = typeof res?.total === 'number' ? res.total : res?.data?.total || items.length;
        setTransactions(items);
        setTotal(count);
      })
      .catch(() => {
        setTransactions([]);
      })
      .finally(() => setLoading(false));
  }, [tenantSlug, vendorId, page]);

  const currency = tenant?.currency || 'INR';

  if (isLoading || !user) return null;

  const vendorName = account?.vendor?.name || 'Vendor Statement';
  const categoryName = account?.vendor?.category?.name;
  const balance = account?.currentBalance || 0;
  const isCredit = account?.isVendorCredit || false;

  return (
    <div style={{ padding: '1.25rem', maxWidth: 600, margin: '0 auto' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <button
            onClick={() => router.push(`/t/${tenantSlug}/ledger`)}
            style={{
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 10,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            ←
          </button>
          <div>
            <h1
              style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}
            >
              {vendorName}
            </h1>
            {categoryName && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                📁 Category: {categoryName}
              </p>
            )}
          </div>
        </div>

        <Link href={`/t/${tenantSlug}/ledger/pay?vendorId=${vendorId}`}>
          <button
            className="pwa-btn pwa-btn-primary pwa-btn-sm"
            style={{ fontWeight: 800, padding: '0.5rem 0.875rem', borderRadius: 10 }}
          >
            💳 Pay Vendor
          </button>
        </Link>
      </div>

      {/* Balance Summary Header Card */}
      {account && (
        <div
          className="pwa-card"
          style={{
            background: isCredit
              ? 'linear-gradient(135deg, #166534, #14532d)'
              : 'linear-gradient(135deg, #1f4e38, #0f2e20)',
            color: 'white',
            padding: '1.25rem',
            borderRadius: 16,
            marginBottom: '1.25rem',
            boxShadow: '0 8px 24px rgba(31, 78, 56, 0.2)',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              opacity: 0.85,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {isCredit ? 'Vendor Credit / Advance Amount' : 'Current Outstanding Balance (Payable)'}
          </div>
          <div
            style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.25rem', color: '#ffffff' }}
          >
            {isCredit
              ? `- ${formatCurrency(account.absBalance, currency)}`
              : formatCurrency(balance, currency)}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.35rem' }}>
            {isCredit
              ? '✅ Vendor has an advance payment / credit balance with kitchen'
              : '⚠️ Amount currently due and payable to this vendor'}
          </div>
        </div>
      )}

      {/* Transaction History Heading */}
      <h2
        style={{
          fontSize: '0.9375rem',
          fontWeight: 800,
          color: 'var(--text-main)',
          marginBottom: '0.75rem',
        }}
      >
        Transaction History Log
      </h2>

      {/* Transactions List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <span className="pwa-spinner" style={{ borderTopColor: 'var(--forest-green)' }} />
        </div>
      ) : transactions.length === 0 ? (
        <div
          className="pwa-empty"
          style={{ background: '#ffffff', borderRadius: 16, padding: '2rem 1rem' }}
        >
          <div className="pwa-empty-icon">📜</div>
          <h3>No ledger transactions</h3>
          <p>No purchases or payments have been recorded for this vendor yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {transactions.map((t) => {
            const isPurchase = t.type === 'PURCHASE';
            const isPayment = t.type === 'PAYMENT';
            const amountVal = Number(t.amount);

            return (
              <div
                key={t.id}
                className="pwa-card"
                style={{
                  padding: '0.875rem 1rem',
                  borderRadius: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: 2,
                    }}
                  >
                    <span
                      className={`pwa-badge pwa-badge-${isPurchase ? 'red' : isPayment ? 'green' : 'blue'}`}
                      style={{ fontWeight: 800, fontSize: '0.75rem' }}
                    >
                      {isPurchase ? '🛒 Purchase' : isPayment ? '💳 Payment' : t.type}
                    </span>
                    <span
                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}
                    >
                      {formatDate(t.transactionDate)}
                    </span>
                  </div>

                  {t.paymentMethod && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-main)',
                        fontWeight: 700,
                        marginTop: 2,
                      }}
                    >
                      Method: {t.paymentMethod}
                    </div>
                  )}

                  {t.note && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Note: {t.note}
                    </div>
                  )}

                  {t.referenceType && (
                    <div
                      style={{ fontSize: '0.6875rem', color: 'var(--text-light)', marginTop: 2 }}
                    >
                      Ref: {t.referenceType} #{t.referenceId ? t.referenceId.slice(0, 8) : ''}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 900,
                      color: isPurchase ? '#d9381e' : '#166534',
                    }}
                  >
                    {isPurchase
                      ? `+ ${formatCurrency(amountVal, currency)}`
                      : `- ${formatCurrency(amountVal, currency)}`}
                  </div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      marginTop: 2,
                    }}
                  >
                    {isPurchase ? 'Increases Payable' : 'Decreases Payable'}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {total > LIMIT && (
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '1rem 0',
              }}
            >
              <button
                className="pwa-btn pwa-btn-secondary pwa-btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ opacity: page === 1 ? 0.5 : 1, width: 80 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Page {page} / {Math.ceil(total / LIMIT)}
              </span>
              <button
                className="pwa-btn pwa-btn-secondary pwa-btn-sm"
                disabled={page >= Math.ceil(total / LIMIT)}
                onClick={() => setPage((p) => p + 1)}
                style={{ opacity: page >= Math.ceil(total / LIMIT) ? 0.5 : 1, width: 80 }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="bottom-nav">
        <Link href={`/t/${tenantSlug}/purchase`} className="bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          Buy
        </Link>

        <Link href={`/t/${tenantSlug}/history`} className="bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          History
        </Link>

        <Link href={`/t/${tenantSlug}/ledger`} className="bottom-nav-item active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          Ledger
        </Link>

        <button
          className="bottom-nav-item"
          onClick={() => {
            clearTokens();
            router.push(`/t/${tenantSlug}/login`);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </nav>
    </div>
  );
}
