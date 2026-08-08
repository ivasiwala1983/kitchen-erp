'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatCurrency, getCurrencySymbol } from '@kitchen-erp/utils';
import type { Category, Vendor, Product } from '@kitchen-erp/types';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export default function TenantPurchaseMobilePage() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = (params?.tenantSlug as string) || '';
  const tenantSlug = rawSlug.toLowerCase().trim();

  const api = useRef(
    new KitchenErpApi({
      baseURL: API_URL,
      tenantSlug,
      onUnauthorized: () => {
        clearTokens();
        router.replace(`/t/${tenantSlug}/login`);
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

  // Previous Day Handler
  const handlePrevDay = () => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1));
  };

  // Next Day Handler
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
  }, [tenantSlug]);

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
      } catch {
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

  if (loading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="pwa-spinner"
          style={{ width: 32, height: 32, borderColor: 'var(--forest-green)' }}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* ── Scrollable Mobile Content ─────────────────────────────────── */}
      <div className="pwa-content">
        {/* 1. Header Bar */}
        <div className="mock-header">
          <div className="mock-title">Kitchen ERP ({tenantSlug})</div>
          <div className="mock-date">
            <div>Purchase Date</div>
            <div style={{ fontWeight: 800, color: 'var(--forest-green)', fontSize: '0.875rem' }}>
              {formatDateDisplay(selectedDate)}
            </div>
          </div>
        </div>

        {/* 2. Date Navigation Controls */}
        <div className="pwa-card" style={{ margin: '0.75rem 1rem', padding: '0.625rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="pwa-btn pwa-btn-secondary"
              onClick={handlePrevDay}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              ◀ Prev Day
            </button>
            <input
              type="date"
              className="pwa-input"
              value={formatDateYMD(selectedDate)}
              onChange={handleDateInputChange}
              style={{ flex: 1.5, textAlign: 'center', fontSize: '0.875rem', padding: '0.4rem' }}
            />
            <button
              className="pwa-btn pwa-btn-secondary"
              onClick={handleNextDay}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              Next Day ▶
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="pwa-alert pwa-alert-error" style={{ margin: '0 1rem 0.5rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div className="pwa-alert pwa-alert-success" style={{ margin: '0 1rem 0.5rem' }}>
            {success}
          </div>
        )}

        {/* 3. Category Horizontal Pills */}
        <div className="category-scroll">
          {categories.map((cat) => {
            const isActive = cat.id === activeCategoryId;
            return (
              <button
                key={cat.id}
                className={`category-pill ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategoryId(cat.id)}
              >
                <span>{cat.icon || '📦'}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* 4. Active Category & Vendor Selection */}
        {activeCategoryObj && (
          <div className="category-section">
            <div className="category-header">
              <span style={{ fontSize: '1.25rem' }}>{activeCategoryObj.icon || '📦'}</span>
              <span className="category-title">{activeCategoryObj.name} Category</span>
            </div>

            <div className="pwa-field" style={{ marginBottom: 0 }}>
              <label className="pwa-label">Select Vendor / Supplier</label>
              {vendors.length > 0 ? (
                <select
                  className="pwa-select"
                  value={activeVendor?.id || ''}
                  onChange={(e) => {
                    const found = vendors.find((v) => v.id === e.target.value);
                    setActiveVendor(found || null);
                  }}
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.phone ? `(${v.phone})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    padding: '0.5rem 0',
                  }}
                >
                  No active vendors found for this category.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Product Entry Form */}
        <div className="form-card">
          <div className="pwa-field">
            <label className="pwa-label">Item / Product Name</label>
            <input
              type="text"
              className="pwa-input"
              placeholder="Search or filter item..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setSelectedProductId('');
              }}
              style={{ marginBottom: '0.375rem' }}
            />
            {products.length > 0 ? (
              <select
                className="pwa-select"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">-- Select {activeCategoryObj?.name || 'Item'} --</option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
            ) : (
              <div
                style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}
              >
                No items available in this category.
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="pwa-field" style={{ marginBottom: 0 }}>
              <label className="pwa-label">Quantity ({currentUnit})</label>
              <input
                type="number"
                step="any"
                className="pwa-input"
                placeholder={isWeightUnit ? 'e.g. 5.5' : 'e.g. 10'}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="pwa-field" style={{ marginBottom: 0 }}>
              <label className="pwa-label">
                Rate ({currencySymbol}/{currentUnit})
              </label>
              <input
                type="number"
                step="any"
                className="pwa-input"
                placeholder="e.g. 120"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="pwa-btn pwa-btn-secondary"
            onClick={handleAddItem}
            style={{ width: '100%', marginTop: '0.75rem' }}
          >
            + Add Line Item
          </button>
        </div>

        {/* 6. Invoice Receipt File Upload */}
        <div className="pwa-card" style={{ margin: '0 1rem 0.75rem', padding: '0.875rem' }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: '0.875rem',
              color: 'var(--text-main)',
              marginBottom: '0.375rem',
            }}
          >
            Attach Invoice Receipt (Optional)
          </div>
          <input
            type="file"
            accept="image/*,application/pdf"
            ref={fileInputRef}
            onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
            style={{ fontSize: '0.8125rem', width: '100%' }}
          />
          {invoiceFile && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--forest-green)',
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              Selected: {invoiceFile.name} ({(invoiceFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {/* 7. Added Line Items List */}
        <div className="items-list-container">
          <div className="items-list-header">Added Items ({addedItems.length})</div>

          {addedItems.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🛒</div>
              <div>No items added to this purchase yet.</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Select items above and tap "+ Add Line Item"
              </div>
            </div>
          ) : (
            addedItems.map((item, index) => (
              <div key={index} className="item-row">
                <div className="item-details">
                  <div className="item-name">{item.name}</div>
                  <div className="item-sub">
                    {item.qty} {item.unit} × {formatCurrency(item.rate, tenantCurrency)}
                  </div>
                </div>
                <div className="item-total-col">
                  <div className="item-total">{formatCurrency(item.total, tenantCurrency)}</div>
                  <button className="item-remove-btn" onClick={() => handleRemoveItem(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 8. Sticky Ticket Summary Badge Bar ────────────────────────── */}
      <div className="ticket-badge-bar">
        <div
          className={`ticket-badge-card ${addedItems.length > 0 ? 'clickable' : ''}`}
          onClick={() => {
            if (addedItems.length > 0 && !saving) {
              handleSavePurchase();
            }
          }}
        >
          <div className="ticket-badge-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="ticket-badge-icon">🧾</div>
              <div className="ticket-badge-title">
                {saving
                  ? 'Saving Purchase...'
                  : `${addedItems.length} item${addedItems.length === 1 ? '' : 's'} (Tap to Submit Purchase)`}
              </div>
            </div>
            <div className="ticket-badge-total">{formatCurrency(grandTotal, tenantCurrency)}</div>
          </div>
        </div>
      </div>

      {/* ── 9. Bottom Navigation Bar ──────────────────────────────── */}
      <nav className="bottom-nav">
        <Link href={`/t/${tenantSlug}/purchase`} className="bottom-nav-item active">
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
