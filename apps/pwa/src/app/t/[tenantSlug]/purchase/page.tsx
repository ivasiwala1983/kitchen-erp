'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatCurrency, getCurrencySymbol } from '@kitchen-erp/utils';
import type { Category, Vendor, Product } from '@kitchen-erp/types';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

function getCategoryPlaceholder(catName?: string): string {
  if (!catName) return '-- Select product --';
  const lower = catName.toLowerCase();
  if (lower.includes('veg')) return '-- e.g. Potato, Tomato, Onion... --';
  if (lower.includes('fruit')) return '-- e.g. Banana, Mango, Apple... --';
  if (lower.includes('dairy') || lower.includes('milk'))
    return '-- e.g. Milk, Cheese, Paneer... --';
  if (lower.includes('spice') || lower.includes('masala'))
    return '-- e.g. Turmeric, Cumin, Chili... --';
  if (
    lower.includes('meat') ||
    lower.includes('chicken') ||
    lower.includes('fish') ||
    lower.includes('poultry')
  )
    return '-- e.g. Chicken, Mutton, Fish... --';
  if (lower.includes('bakery') || lower.includes('bread'))
    return '-- e.g. Bread, Buns, Butter... --';
  if (lower.includes('beverage') || lower.includes('drink'))
    return '-- e.g. Tea, Coffee, Juice... --';
  if (lower.includes('oil') || lower.includes('ghee')) return '-- e.g. Cooking Oil, Ghee... --';
  if (
    lower.includes('grain') ||
    lower.includes('rice') ||
    lower.includes('pulse') ||
    lower.includes('flour') ||
    lower.includes('dal')
  )
    return '-- e.g. Basmati, Dal, Wheat Flour... --';
  return `-- e.g. Select product... --`;
}

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

  // Format Date for Display (DD/MMM/YYYY)
  const formatDateDisplay = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const formatted = `${day}/${month}/${year}`;

    const today = new Date();
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();

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

  // Invoice Receipt File & Input Refs
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const [tenantName, setTenantName] = useState<string>('');

  // Loading & Feedback States
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
      try {
        const [meRes, cRes] = await Promise.all([
          api.auth.me().catch(() => null),
          api.categories.list({ isActive: true, limit: 100 }) as Promise<{ data?: unknown }>,
        ]);

        const meData = meRes?.data as
          { role?: string; tenant?: { name?: string; currency?: string } } | undefined;
        if (meData?.tenant?.name) {
          setTenantName(meData.tenant.name);
        }
        if (meData?.tenant?.currency) {
          setTenantCurrency(meData.tenant.currency);
        }

        const cObj = cRes as { data?: Category[] };
        const cList: Category[] = Array.isArray(cRes?.data)
          ? (cRes.data as Category[])
          : cObj?.data || [];
        setCategories(cList);

        if (cList.length > 0) {
          setActiveCategoryId(cList[0].id);
        }
      } catch {
        setError('Failed to load categories');
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

  return (
    <div className="app-shell">
      {/* ── Scrollable Mobile Content ─────────────────────────────────── */}
      <div className="pwa-content">
        {/* 1. Header Bar */}
        <div className="mock-header">
          <div>
            <div className="mock-title">Kitchen ERP</div>
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 800,
                color: 'var(--forest-green)',
                marginTop: 2,
              }}
            >
              {tenantName || tenantSlug.toUpperCase()}
            </div>
          </div>
          <div className="mock-date">
            <div>Purchase Date</div>
            <div style={{ fontWeight: 800, color: 'var(--forest-green)', fontSize: '0.875rem' }}>
              {formatDateDisplay(selectedDate)}
            </div>
          </div>
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

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
              style={{
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                fontWeight: 800,
                color: 'var(--forest-green)',
                background: '#f8fafc',
                border: '1.5px solid var(--border)',
                borderRadius: 10,
                padding: '0.45rem 0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>📅</span>
              <span>{formatDateDisplay(selectedDate)}</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              className="pwa-date-input"
              value={formatDateYMD(selectedDate)}
              onChange={handleDateInputChange}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
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

        {/* 4. Category & Vendor Selection Card */}
        <div className="pwa-card" style={{ padding: '1.125rem', marginBottom: '1rem' }}>
          {/* Category Chips Scroll Row strictly bounded inside card */}
          <div className="category-chips-row" style={{ marginBottom: '0.875rem' }}>
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

          {/* Vendor Selection Row */}
          <div
            style={{
              paddingTop: '0.75rem',
              borderTop: '1px dashed var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--forest-green)',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Vendor / Supplier:
            </div>
            {vendors.length > 0 ? (
              <select
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: 'var(--forest-green)',
                  cursor: 'pointer',
                  outline: 'none',
                  maxWidth: '65%',
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
          <div style={{ marginBottom: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Select Product
              </label>
              {products.length > 5 && (
                <span
                  style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}
                >
                  {filteredProducts.length} of {products.length} products
                </span>
              )}
            </div>

            {products.length > 5 && (
              <input
                type="text"
                className="pwa-input"
                placeholder={`🔍 Filter ${activeCategoryObj?.name || 'items'}...`}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{
                  marginBottom: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8125rem',
                  borderRadius: 10,
                }}
              />
            )}

            <select
              className="item-search-input"
              value={selectedProductId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedProductId(val);
                if (val) {
                  setTimeout(() => quantityInputRef.current?.focus(), 50);
                }
              }}
            >
              <option value="">{getCategoryPlaceholder(activeCategoryObj?.name)}</option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit || 'unit'})
                </option>
              ))}
            </select>
          </div>

          <div className="inputs-row">
            <div className="input-pill-box">
              <span className="input-pill-label">{isWeightUnit ? 'Quantity' : 'Qty'}</span>
              <div className="input-pill-flex">
                <input
                  ref={quantityInputRef}
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

        {/* Subtle, Low-Priority Invoice Receipt Attachment */}
        <div style={{ margin: '0.75rem 0 1.25rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: '#f8fafc',
              border: '1.5px dashed var(--border)',
              borderRadius: 10,
              padding: '0.45rem 0.875rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: invoiceFile ? 'var(--forest-green)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              transition: 'all 0.15s ease',
            }}
          >
            <svg
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {invoiceFile ? (
              <>
                <span>
                  ✓ {invoiceFile.name.slice(0, 20)}
                  {invoiceFile.name.length > 20 ? '...' : ''}
                </span>
                <span
                  style={{ color: '#dc2626', marginLeft: 4, fontWeight: 800 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInvoiceFile(null);
                  }}
                >
                  ×
                </span>
              </>
            ) : (
              <span>📎 Attach Invoice (Optional)</span>
            )}
          </button>
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

        <Link href={`/t/${tenantSlug}/ledger`} className="bottom-nav-item">
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
