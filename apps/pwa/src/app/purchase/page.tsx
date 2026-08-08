'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatCurrency, getCurrencySymbol } from '@kitchen-erp/utils';
import type { Category, Vendor, Product } from '@kitchen-erp/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function PurchaseMobilePage() {
  const router = useRouter();
  const api = useRef(
    new KitchenErpApi({
      baseURL: API_URL,
      onUnauthorized: () => {
        clearTokens();
        router.replace('/');
      },
    })
  ).current;

  // Selected Date state (Date object)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // Format Date to YYYY-MM-DD for <input type="date">
  const formatDateYMD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format Date for Display
  const formatDateDisplay = (d: Date): string => {
    const today = new Date();
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();

    const formatted = d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return isToday ? `Today (${formatted})` : formatted;
  };

  // Previous Day Handler (creates fresh Date object)
  const handlePrevDay = () => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1));
  };

  // Next Day Handler (creates fresh Date object)
  const handleNextDay = () => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1));
  };

  // Date Input Change Handler
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const [year, month, day] = val.split('-').map(Number);
      if (year && month && day) {
        setSelectedDate(new Date(year, month - 1, day));
      }
    }
  };

  // Unified Category Master & Active Selection
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');

  // Vendors & Active Vendor
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeVendor, setActiveVendor] = useState<Vendor | null>(null);

  // Products filtered by selected Category
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [weight, setWeight] = useState('');
  const [rate, setRate] = useState('');

  // Added Purchase Items List
  const [addedItems, setAddedItems] = useState<
    Array<{
      productId: string;
      name: string;
      unit: string;
      qty: number;
      rate: number;
      total: number;
    }>
  >([]);

  // Invoice Receipt File
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading & Feedback States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Running Grand Total calculation
  const grandTotal = addedItems.reduce((sum, item) => sum + item.total, 0);

  // Active Category Object
  const activeCategoryObj = categories.find((c) => c.id === activeCategoryId);

  // Tenant Currency State
  const [tenantCurrency, setTenantCurrency] = useState<string>('INR');
  const currencySymbol = getCurrencySymbol(tenantCurrency);

  // 1. Initial Load: Fetch Tenant Profile & Active Categories
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [meRes, cRes] = await Promise.all([
          api.auth.me().catch(() => null),
          api.categories.list({ isActive: true, limit: 100 }) as Promise<{ data?: unknown }>,
        ]);

        if (meRes?.data?.tenant?.currency) {
          setTenantCurrency(meRes.data.tenant.currency);
        }

        const cObj = cRes as { data?: Category[] };
        const cList: Category[] = Array.isArray(cRes?.data)
          ? (cRes.data as Category[])
          : cObj?.data || [];
        const sortedCats = [...cList].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        setCategories(sortedCats);

        if (sortedCats.length > 0) {
          setActiveCategoryId(sortedCats[0].id);
        }
      } catch {
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2. Fetch Vendors & Products whenever active Category changes
  useEffect(() => {
    if (!activeCategoryId) return;

    (async () => {
      try {
        const [vRes, pRes] = await Promise.all([
          api.vendors.list({
            categoryId: activeCategoryId,
            isActive: true,
            limit: 100,
          }) as Promise<{ data?: unknown }>,
          api.products.list({
            categoryId: activeCategoryId,
            isActive: true,
            limit: 200,
          }) as Promise<{ data?: unknown }>,
        ]);

        const vObj = vRes as { data?: Vendor[] };
        const pObj = pRes as { data?: Product[] };
        const vList: Vendor[] = Array.isArray(vRes.data)
          ? (vRes.data as Vendor[])
          : vObj?.data || [];
        const pList: Product[] = Array.isArray(pRes.data)
          ? (pRes.data as Product[])
          : pObj?.data || [];

        setVendors(vList);
        setProducts(pList);
        setActiveVendor(vList.length > 0 ? vList[0] : null);
        setSelectedProductId('');
        setProductSearch('');
      } catch (e) {
        setVendors([]);
        setProducts([]);
        setActiveVendor(null);
      }
    })();
  }, [activeCategoryId]);

  // Selected Product details & unit auto-fill
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const currentUnit = selectedProduct?.unit || 'kg';
  const isWeightUnit = ['kg', 'gram', 'g', 'lbs'].includes(currentUnit.toLowerCase());

  // Filter products by search text
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Add Item Handler
  const handleAddItem = () => {
    if (!selectedProductId || !selectedProduct) {
      setError('Please select item name');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const qtyNum = parseFloat(weight) || 0;
    const rateNum = parseFloat(rate) || 0;
    if (qtyNum <= 0 || rateNum <= 0) {
      setError('Please enter valid Qty and Rate');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const itemTotal = parseFloat((qtyNum * rateNum).toFixed(2));

    setAddedItems((prev) => [
      ...prev,
      {
        productId: selectedProduct.id,
        name: selectedProduct.name,
        unit: selectedProduct.unit || 'kg',
        qty: qtyNum,
        rate: rateNum,
        total: itemTotal,
      },
    ]);

    // Reset input fields
    setSelectedProductId('');
    setProductSearch('');
    setWeight('');
    setRate('');
    setError('');
  };

  // Remove Item Handler
  const handleRemoveItem = (index: number) => {
    setAddedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Complete Purchase Order
  const handleSavePurchase = async () => {
    if (!activeVendor) {
      setError('Please select a vendor for this category');
      return;
    }
    if (addedItems.length === 0) {
      setError('Please add at least one item before saving');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const purchaseRes = await api.purchases.create({
        vendorId: activeVendor.id,
        items: addedItems.map((i) => ({ productId: i.productId, qty: i.qty, rate: i.rate })),
        purchaseDate: selectedDate.toISOString(),
      });

      if (purchaseRes.data && invoiceFile) {
        await api.purchases.uploadInvoice(purchaseRes.data.id, invoiceFile);
      }

      setSuccess('Purchase order saved successfully!');
      setAddedItems([]);
      setInvoiceFile(null);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message || 'Failed to save purchase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      {/* ── Scrollable Mobile Content ─────────────────────────────────── */}
      <div className="pwa-content">
        {/* 1. Header Bar */}
        <div className="mock-header">
          <div className="mock-title">Kitchen ERP</div>
          <div className="mock-date">
            <div>Purchase Date</div>
            <div style={{ fontWeight: 800, color: 'var(--forest-green)', fontSize: '0.875rem' }}>
              {formatDateDisplay(selectedDate)}
            </div>
          </div>
        </div>

        {/* 2. Status Pill Row */}
        <div className="status-pill-row">
          <span className="pill-status-green">
            Role: <strong>Inventory Manager</strong>
          </span>
          <span className="pill-status-gray">
            <span className="dot-indicator" /> {loading ? 'Syncing...' : 'Online'}
          </span>
        </div>

        {/* 3. Fully Interactive & Working Date Selector Card */}
        <div
          className="date-selector-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            padding: '0.625rem 0.875rem',
            borderRadius: 14,
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '1rem',
          }}
        >
          <button
            type="button"
            className="date-arrow-btn"
            onClick={handlePrevDay}
            title="Previous Day"
            aria-label="Previous Day"
            style={{
              width: 40,
              height: 40,
              border: 'none',
              borderRadius: 10,
              background: '#f0f4e8',
              color: 'var(--forest-green)',
              fontSize: '1.25rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ‹
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="date"
              className="pwa-date-input"
              value={formatDateYMD(selectedDate)}
              onChange={handleDateInputChange}
              style={{
                fontFamily: 'inherit',
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                background: '#f8fafc',
                border: '1.5px solid var(--border)',
                borderRadius: 10,
                padding: '0.4rem 0.75rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>

          <button
            type="button"
            className="date-arrow-btn"
            onClick={handleNextDay}
            title="Next Day"
            aria-label="Next Day"
            style={{
              width: 40,
              height: 40,
              border: 'none',
              borderRadius: 10,
              background: '#f0f4e8',
              color: 'var(--forest-green)',
              fontSize: '1.25rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ›
          </button>
        </div>

        {/* 4. Display Active Categories (Sorted by Display Order) */}
        <div
          style={{
            marginBottom: '0.5rem',
            fontWeight: 700,
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Select Category
        </div>
        <div className="category-chips-row">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`chip-btn ${cat.id === activeCategoryId ? 'active' : 'inactive'}`}
              onClick={(e) => {
                setActiveCategoryId(cat.id);
                e.currentTarget.scrollIntoView({
                  behavior: 'smooth',
                  inline: 'center',
                  block: 'nearest',
                });
              }}
            >
              {cat.icon ? `${cat.icon} ` : ''}
              {cat.name}
            </button>
          ))}
        </div>

        {/* 5. Vendor Selection for Category */}
        <div
          className="vendor-subtitle"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '0.75rem 0',
          }}
        >
          <div>
            {activeCategoryObj
              ? `${activeCategoryObj.icon || '📁'} ${activeCategoryObj.name.toUpperCase()}`
              : 'CATEGORY'}{' '}
            VENDOR:
          </div>
          {vendors.length > 0 ? (
            <select
              style={{
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.375rem 0.625rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--forest-green)',
                cursor: 'pointer',
                outline: 'none',
              }}
              value={activeVendor?.id || ''}
              onChange={(e) => {
                const v = vendors.find((x) => x.id === e.target.value);
                if (v) setActiveVendor(v);
              }}
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
              No vendors for category
            </span>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: '0.625rem 0.875rem',
              background: '#fee2e2',
              color: '#dc2626',
              borderRadius: 10,
              fontSize: '0.8125rem',
              marginBottom: '0.75rem',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              padding: '0.625rem 0.875rem',
              background: '#d1fae5',
              color: '#059669',
              borderRadius: 10,
              fontSize: '0.8125rem',
              marginBottom: '0.75rem',
              fontWeight: 600,
            }}
          >
            {success}
          </div>
        )}

        {/* 6. Product Selection & Quick Entry Card */}
        <div className="add-item-card">
          <div style={{ marginBottom: '0.5rem' }}>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                marginBottom: 4,
                display: 'block',
              }}
            >
              Select Product
            </label>
            <select
              className="item-search-input"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">Select product from category...</option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="inputs-row">
            <div className="input-pill-box">
              <span className="input-pill-label">{isWeightUnit ? 'Quantity' : 'Qty'}</span>
              <div className="input-pill-flex">
                <input
                  type="number"
                  className="pill-input-field"
                  placeholder="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  step="0.01"
                />
                <span className="pill-suffix">{currentUnit}</span>
              </div>
            </div>

            <div className="input-pill-box">
              <span className="input-pill-label">Rate</span>
              <div className="input-pill-flex">
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  className="pill-input-field"
                  placeholder="0"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  step="0.01"
                />
                <span className="pill-suffix">/{currentUnit}</span>
              </div>
            </div>

            <button className="btn-add-plus" onClick={handleAddItem}>
              +
            </button>
          </div>

          {/* Instant Qty * Rate Preview */}
          {weight && rate && (
            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: 'var(--forest-green)',
                textAlign: 'right',
              }}
            >
              Subtotal: {formatCurrency(parseFloat(weight) * parseFloat(rate), tenantCurrency)}
            </div>
          )}
        </div>

        {/* 7. Added Purchase Items (Receipt Rows) */}
        {addedItems.length > 0 && (
          <div
            style={{
              margin: '1rem 0 0.5rem 0',
              fontWeight: 700,
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Purchase Items ({addedItems.length})
          </div>
        )}

        {addedItems.map((item, index) => (
          <div key={index} className="added-item-card">
            <div className="added-item-header">
              <div>
                <span className="added-item-title">{item.name}</span>
                <span className="added-item-sub">Item #{index + 1}</span>
              </div>
              <button className="btn-remove-item" onClick={() => handleRemoveItem(index)}>
                ×
              </button>
            </div>

            <div className="added-item-row">
              <div className="added-pill-box">
                <span>{item.qty}</span>
                <span className="pill-suffix">{item.unit}</span>
              </div>

              <div className="added-pill-box">
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {currencySymbol}
                </span>
                <span>{item.rate}</span>
                <span className="pill-suffix">/{item.unit}</span>
              </div>

              <div className="item-row-total">{formatCurrency(item.total, tenantCurrency)}</div>
            </div>
          </div>
        ))}

        {/* 8. Invoice Upload Section */}
        <div className="receipts-section-title" style={{ marginTop: '1.25rem' }}>
          ATTACH INVOICE RECEIPT
        </div>

        <div
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}
        >
          <div className="receipt-upload-box" onClick={() => fileInputRef.current?.click()}>
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="receipt-upload-text">Upload Invoice</span>
          </div>

          {invoiceFile && (
            <div
              style={{
                padding: '0.5rem 0.875rem',
                background: '#ffffff',
                borderRadius: 12,
                border: '1px solid var(--border)',
                fontSize: '0.8125rem',
                color: 'var(--forest-green)',
                fontWeight: 600,
              }}
            >
              ✓ {invoiceFile.name.slice(0, 18)}...
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      {/* ── 9. Sticky Sawtooth Bottom Grand Total Bar ─────────────────────── */}
      <div className="bottom-ticket-bar">
        <div
          className="ticket-container"
          onClick={handleSavePurchase}
          style={{ cursor: 'pointer' }}
        >
          <div className="ticket-flex">
            <div>
              <div className="ticket-label">
                VENDOR · {activeVendor?.name ? activeVendor.name.toUpperCase() : 'NONE'}
              </div>
              <div className="ticket-sub">
                {saving
                  ? 'Saving Purchase...'
                  : `${addedItems.length} item${addedItems.length === 1 ? '' : 's'} (Tap to Submit Purchase)`}
              </div>
            </div>
            <div className="ticket-badge-total">{formatCurrency(grandTotal, tenantCurrency)}</div>
          </div>
        </div>
      </div>

      {/* ── 10. Bottom Navigation Bar ──────────────────────────────── */}
      <nav className="bottom-nav">
        <Link href="/purchase" className="bottom-nav-item active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          Buy
        </Link>

        <Link href="/purchase/history" className="bottom-nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          History
        </Link>

        <button
          className="bottom-nav-item"
          onClick={() => {
            clearTokens();
            window.location.href = '/';
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
