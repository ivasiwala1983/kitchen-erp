'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTenant } from '../../../../../contexts/TenantContext';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatCurrency } from '@kitchen-erp/utils';
import { VendorSelector } from '@kitchen-erp/ui';
import { PaymentMethod, type VendorPublic, type LedgerAccountPublic } from '@kitchen-erp/types';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export default function PwaMakePaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialVendorId = searchParams.get('vendorId') || '';

  const { tenant, tenantSlug, user, isLoading } = useTenant();

  const [vendors, setVendors] = useState<VendorPublic[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>(initialVendorId);
  const [vendorDetail, setVendorDetail] = useState<LedgerAccountPublic | null>(null);

  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [reference, setReference] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/t/${tenantSlug}/login`);
    }
  }, [user, isLoading, tenantSlug, router]);

  const apiRef = useRef<KitchenErpApi | null>(null);
  if (!apiRef.current && tenantSlug) {
    apiRef.current = new KitchenErpApi({ baseURL: API_URL, tenantSlug });
  }

  useEffect(() => {
    if (!tenantSlug || !apiRef.current) return;

    // Load active vendors
    apiRef.current.vendors
      .list({ isActive: true, limit: 100 })
      .then((res) => {
        const r = res as { data?: unknown };
        const items = Array.isArray(r?.data)
          ? r.data
          : (r?.data as { data?: unknown[] })?.data || [];
        setVendors(items as VendorPublic[]);
      })
      .catch(() => {});
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug || !selectedVendorId) {
      setVendorDetail(null);
      return;
    }
    const api = new KitchenErpApi({ baseURL: API_URL, tenantSlug });

    api.ledger
      .getVendorDetail(selectedVendorId)
      .then((res) => {
        if (res.data) setVendorDetail(res.data);
      })
      .catch(() => {
        setVendorDetail(null);
      });
  }, [tenantSlug, selectedVendorId]);

  const currency = tenant?.currency || 'INR';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedVendorId) {
      setError('Please select a vendor.');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    setSaving(true);

    try {
      const api = new KitchenErpApi({ baseURL: API_URL, tenantSlug });
      const res = await api.ledger.createPayment({
        vendorId: selectedVendorId,
        amount: numericAmount,
        paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        paymentMethod,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });

      if (res.data) {
        setSuccess('Payment saved successfully!');
        setTimeout(() => {
          router.replace(`/t/${tenantSlug}/ledger/${selectedVendorId}`);
        }, 1200);
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg =
        errorObj?.response?.data?.message || 'Failed to record payment. Please try again.';
      setError(msg);
      setSaving(false);
    }
  };

  if (isLoading || !user) return null;

  return (
    <div style={{ padding: '1.25rem', maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}
      >
        <button
          onClick={() => router.back()}
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
            style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}
          >
            Record Vendor Payment
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Enter payment transaction details
          </p>
        </div>
      </div>

      <div className="pwa-card" style={{ padding: '1.5rem', borderRadius: 16 }}>
        {error && (
          <div className="pwa-alert pwa-alert-error" style={{ marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="pwa-alert pwa-alert-success" style={{ marginBottom: '1rem' }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Vendor Selector */}
          <div className="pwa-field">
            <VendorSelector
              tenantId={tenant?.id || tenantSlug}
              value={selectedVendorId}
              onChange={(val) => setSelectedVendorId(val || '')}
              vendors={vendors}
              apiClient={apiRef.current || undefined}
              required
              variant="pwa"
            />
          </div>

          {/* Current Outstanding Box */}
          {vendorDetail && (
            <div
              style={{
                background: vendorDetail.isVendorCredit ? '#ecfdf5' : '#fef2f2',
                border: vendorDetail.isVendorCredit ? '1px solid #a7f3d0' : '1px solid #fecaca',
                borderRadius: 12,
                padding: '0.875rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: vendorDetail.isVendorCredit ? '#065f46' : '#991b1b',
                  }}
                >
                  {vendorDetail.isVendorCredit
                    ? 'Vendor Credit / Advance:'
                    : 'Current Payable Amount:'}
                </span>
              </div>
              <span
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 900,
                  color: vendorDetail.isVendorCredit ? '#047857' : '#dc2626',
                }}
              >
                {vendorDetail.isVendorCredit
                  ? `- ${formatCurrency(vendorDetail.absBalance, currency)}`
                  : formatCurrency(vendorDetail.currentBalance, currency)}
              </span>
            </div>
          )}

          {/* Payment Amount */}
          <div className="pwa-field">
            <label className="pwa-label" style={{ fontWeight: 700 }}>
              Payment Amount ({currency}) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 500.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pwa-input"
              required
              style={{ fontSize: '1.125rem', fontWeight: 800 }}
            />
          </div>

          {/* Payment Date & Method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="pwa-field">
              <label className="pwa-label">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="pwa-input"
                required
              />
            </div>

            <div className="pwa-field">
              <label className="pwa-label">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="pwa-input"
                required
              >
                <option value={PaymentMethod.CASH}>💵 Cash</option>
                <option value={PaymentMethod.UPI}>📱 UPI / GPay / PhonePe</option>
                <option value={PaymentMethod.BANK_TRANSFER}>🏦 Bank Transfer</option>
                <option value={PaymentMethod.CHEQUE}>📝 Cheque</option>
                <option value={PaymentMethod.CARD}>💳 Card</option>
                <option value={PaymentMethod.OTHER}>⚙️ Other</option>
              </select>
            </div>
          </div>

          {/* Reference / Cheque No / Tx ID */}
          <div className="pwa-field">
            <label className="pwa-label">Reference / UTR / Cheque # (Optional)</label>
            <input
              type="text"
              placeholder="e.g. UPI-987654321 / Chq #001234"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="pwa-input"
            />
          </div>

          {/* Note */}
          <div className="pwa-field">
            <label className="pwa-label">Note / Remark (Optional)</label>
            <textarea
              placeholder="e.g. Partial payment for July invoices"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="pwa-input"
              rows={2}
              style={{ resize: 'none' }}
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="pwa-btn pwa-btn-primary"
            style={{ marginTop: '0.5rem', width: '100%', fontWeight: 800 }}
            disabled={saving}
          >
            {saving ? <span className="pwa-spinner" /> : 'Confirm & Save Payment →'}
          </button>
        </form>
      </div>

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
