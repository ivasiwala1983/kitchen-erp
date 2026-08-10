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

  // Quick Add Vendor Modal state
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');
  const [duplicateVendor, setDuplicateVendor] = useState<Vendor | null>(null);

  // Quick Add Vendor Submit Handler
  const handleQuickAddVendor = async () => {
    const trimmed = newVendorName.trim();
    if (!trimmed) {
      setQuickAddError('Vendor name is required');
      return;
    }
    if (trimmed.length < 2) {
      setQuickAddError('Vendor name must be at least 2 characters');
      return;
    }
    if (!activeCategoryId) {
      setQuickAddError('Please select a category first');
      return;
    }

    setQuickAddLoading(true);
    setQuickAddError('');
    setDuplicateVendor(null);

    try {
      const res = await api.vendors.quickAdd({
        name: trimmed,
        categoryId: activeCategoryId,
      });

      if (res.data) {
        const vendorData = res.data.vendor as Vendor;

        if (res.data.created) {
          setVendors((prev) => {
            const exists = prev.some((v) => v.id === vendorData.id);
            return exists ? prev : [...prev, vendorData];
          });
          setActiveVendor(vendorData);
          setShowAddVendorModal(false);
          setSuccess(`✓ Vendor "${vendorData.name}" created and selected!`);
          setTimeout(() => setSuccess(''), 3000);
        } else if (res.data.existing) {
          setDuplicateVendor(vendorData);
          setQuickAddError(`"${vendorData.name}" already exists.`);
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const errMsg =
        err?.response?.data?.message || err?.message || 'Failed to add vendor. Please try again.';
      setQuickAddError(errMsg);
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleUseExistingVendor = () => {
    if (!duplicateVendor) return;
    setVendors((prev) => {
      const exists = prev.some((v) => v.id === duplicateVendor.id);
      return exists ? prev : [...prev, duplicateVendor];
    });
    setActiveVendor(duplicateVendor);
    setShowAddVendorModal(false);
    setSuccess(`✓ Vendor "${duplicateVendor.name}" selected!`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Products filtered by selected Category
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [weight, setWeight] = useState('');
  const [rate, setRate] = useState('');

  // Quick Add Product Modal state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('kg');
  const [quickAddProductLoading, setQuickAddProductLoading] = useState(false);
  const [quickAddProductError, setQuickAddProductError] = useState('');
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null);

  // Quick Add Product Submit Handler
  const handleQuickAddProduct = async () => {
    const trimmed = newProductName.trim();
    if (!trimmed) {
      setQuickAddProductError('Product name is required');
      return;
    }
    if (!activeCategoryId) {
      setQuickAddProductError('Please select a category first');
      return;
    }

    setQuickAddProductLoading(true);
    setQuickAddProductError('');
    setDuplicateProduct(null);

    try {
      const res = await api.products.quickAdd({
        name: trimmed,
        categoryId: activeCategoryId,
        unit: newProductUnit || 'kg',
      });

      if (res.data) {
        const prodData = res.data.product as Product;

        if (res.data.created) {
          setProducts((prev) => {
            const exists = prev.some((p) => p.id === prodData.id);
            return exists ? prev : [...prev, prodData];
          });
          setSelectedProductId(prodData.id);
          setShowAddProductModal(false);
          setSuccess(`✓ Product "${prodData.name}" created and selected!`);
          setTimeout(() => setSuccess(''), 3000);
          setTimeout(() => quantityInputRef.current?.focus(), 50);
        } else if (res.data.existing) {
          setDuplicateProduct(prodData);
          setQuickAddProductError(`"${prodData.name}" already exists in this kitchen.`);
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const errMsg =
        err?.response?.data?.message || err?.message || 'Failed to add product. Please try again.';
      setQuickAddProductError(errMsg);
    } finally {
      setQuickAddProductLoading(false);
    }
  };

  const handleUseExistingProduct = () => {
    if (!duplicateProduct) return;
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === duplicateProduct.id);
      return exists ? prev : [...prev, duplicateProduct];
    });
    setSelectedProductId(duplicateProduct.id);
    setShowAddProductModal(false);
    setSuccess(`✓ Product "${duplicateProduct.name}" selected!`);
    setTimeout(() => setSuccess(''), 3000);
    setTimeout(() => quantityInputRef.current?.focus(), 50);
  };

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

  // Draft Storage State
  const DRAFT_KEY = `kitchen_erp_purchase_draft_${tenantSlug}`;
  const [savedDraft, setSavedDraft] = useState<{
    vendorId?: string;
    vendorName?: string;
    categoryId?: string;
    items: Array<{
      productId: string;
      name: string;
      unit: string;
      qty: number;
      rate: number;
      total: number;
    }>;
    date?: string;
    updatedAt?: string;
  } | null>(null);

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
      } catch (e) {
        setVendors([]);
        setProducts([]);
        setActiveVendor(null);
      }
    })();
  }, [activeCategoryId, api]);

  // Draft Auto-Saver & Draft Recovery Handlers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          setSavedDraft(parsed);
        }
      }
    } catch (err) {
      void err;
    }
  }, [DRAFT_KEY]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (addedItems.length > 0) {
      const draftData = {
        vendorId: activeVendor?.id,
        vendorName: activeVendor?.name,
        categoryId: activeCategoryId,
        items: addedItems,
        date: selectedDate.toISOString(),
        updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    } else if (!savedDraft) {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [addedItems, activeVendor, activeCategoryId, selectedDate, savedDraft, DRAFT_KEY]);

  const handleRestoreDraft = () => {
    if (!savedDraft) return;
    if (savedDraft.items && savedDraft.items.length > 0) {
      setAddedItems(savedDraft.items);
    }
    if (savedDraft.categoryId) {
      setActiveCategoryId(savedDraft.categoryId);
    }
    if (savedDraft.date) {
      try {
        setSelectedDate(new Date(savedDraft.date));
      } catch (err) {
        void err;
      }
    }
    setSavedDraft(null);
    setSuccess('📥 Saved draft purchase order restored!');
    setTimeout(() => setSuccess(''), 3500);
  };

  const handleDiscardDraft = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DRAFT_KEY);
    }
    setSavedDraft(null);
  };

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

  // Save Complete Purchase Order with Optimistic Immediate Feedback & Failure Draft Protection
  const handleSavePurchase = async () => {
    if (!activeVendor) {
      setError('Please select a vendor for this category');
      return;
    }
    if (addedItems.length === 0) {
      setError('Please add at least one item before saving');
      return;
    }

    const itemsSnapshot = [...addedItems];
    const vendorSnapshot = activeVendor;
    const dateSnapshot = selectedDate;

    setSaving(true);
    setError('');
    setSuccess('⚡ Purchase order submitted! Saving to cloud in background...');

    const inFlightDraft = {
      vendorId: vendorSnapshot.id,
      vendorName: vendorSnapshot.name,
      categoryId: activeCategoryId,
      items: itemsSnapshot,
      date: dateSnapshot.toISOString(),
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(inFlightDraft));
    }

    try {
      const purchaseRes = await api.purchases.create({
        vendorId: vendorSnapshot.id,
        items: itemsSnapshot.map((i) => ({ productId: i.productId, qty: i.qty, rate: i.rate })),
        purchaseDate: dateSnapshot.toISOString(),
      });

      if (purchaseRes.data && invoiceFile) {
        setSuccess('⚡ Uploading attached invoice receipt...');
        await api.purchases.uploadInvoice(purchaseRes.data.id, invoiceFile);
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem(DRAFT_KEY);
      }
      setSavedDraft(null);
      setSuccess('🎉 Purchase order saved successfully!');
      setAddedItems([]);
      setInvoiceFile(null);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      const errMsg = err?.response?.data?.message || 'Network connection or server error';

      setError(`⚠️ ${errMsg}. Don't worry! Your purchase was saved as a Draft so you can retry.`);
      setSavedDraft(inFlightDraft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      {/* ── Scrollable Mobile Content ─────────────────────────────────── */}
      <div className="pwa-content">
        {/* 1. Header Bar */}
        <div className="mock-header" style={{ alignItems: 'center' }}>
          <div>
            <div className="mock-title">ArgusOne</div>
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
          <Link
            href={`/t/${tenantSlug}/assistant?source=purchases`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: 999,
              background: 'var(--mint-light)',
              color: 'var(--forest-green)',
              textDecoration: 'none',
              fontSize: '0.8125rem',
              fontWeight: 800,
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span>🤖</span>
            <span>Ask ArgusOne</span>
          </Link>
        </div>

        {/* Purchase Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <Link
            href={`/t/${tenantSlug}/purchase`}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '0.5rem',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.8125rem',
              background: 'var(--forest-green)',
              color: '#ffffff',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            ➕ New Purchase
          </Link>
          <Link
            href={`/t/${tenantSlug}/purchase/history`}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '0.5rem',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.8125rem',
              background: '#f1f5f9',
              color: 'var(--text-main)',
              textDecoration: 'none',
            }}
          >
            📋 Purchase History
          </Link>
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

        {/* Saved Draft Recovery Banner */}
        {savedDraft && addedItems.length === 0 && (
          <div
            style={{
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              border: '1px solid #93c5fd',
              borderRadius: 14,
              padding: '0.875rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#1e40af' }}>
                📝 Saved Draft Found ({savedDraft.items?.length || 0} item
                {(savedDraft.items?.length || 0) === 1 ? '' : 's'})
              </div>
              <div style={{ fontSize: '0.75rem', color: '#1e3a8a', marginTop: 2 }}>
                Saved at {savedDraft.updatedAt || 'earlier'}{' '}
                {savedDraft.vendorName ? `for ${savedDraft.vendorName}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="pwa-btn pwa-btn-primary pwa-btn-sm"
                style={{ fontWeight: 800, fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
              >
                📥 Restore Draft
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="pwa-btn pwa-btn-secondary pwa-btn-sm"
                style={{
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.5rem',
                  color: '#4b5563',
                }}
              >
                🗑️ Clear
              </button>
            </div>
          </div>
        )}

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

          {/* Quick Add Vendor Action Link */}
          <div style={{ marginTop: '0.625rem', textAlign: 'right' }}>
            <button
              type="button"
              id="quick-add-vendor-btn"
              onClick={() => {
                setNewVendorName('');
                setQuickAddError('');
                setDuplicateVendor(null);
                setShowAddVendorModal(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--forest-green)',
                fontSize: '0.78125rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.4rem',
              }}
            >
              + Add New Vendor
            </button>
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

            {/* Quick Add Product Action Link */}
            <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
              <button
                type="button"
                id="quick-add-product-btn"
                onClick={() => {
                  setNewProductName('');
                  setNewProductUnit('kg');
                  setQuickAddProductError('');
                  setDuplicateProduct(null);
                  setShowAddProductModal(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--forest-green)',
                  fontSize: '0.78125rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.4rem',
                }}
              >
                + Add New Product
              </button>
            </div>
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

      {/* ── Quick Add Vendor Modal ───────────────────────────────────── */}
      {showAddVendorModal && (
        <div
          id="quick-add-vendor-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowAddVendorModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '1.25rem',
              width: '100%',
              maxWidth: 380,
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: 'var(--forest-green)',
                  margin: 0,
                }}
              >
                Add Vendor
              </h3>
              <button
                type="button"
                id="modal-close-btn"
                onClick={() => setShowAddVendorModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {activeCategoryObj && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '1rem',
                  background: '#f8fafc',
                  padding: '0.35rem 0.625rem',
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                Category: <strong>{activeCategoryObj.name}</strong>
              </div>
            )}

            {quickAddError && (
              <div
                id="quick-add-error-msg"
                style={{
                  padding: '0.55rem 0.75rem',
                  background: duplicateVendor ? '#fef3c7' : '#fee2e2',
                  color: duplicateVendor ? '#92400e' : '#dc2626',
                  borderRadius: 8,
                  fontSize: '0.8125rem',
                  marginBottom: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {quickAddError}
              </div>
            )}

            {duplicateVendor ? (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  id="btn-use-existing-vendor"
                  onClick={handleUseExistingVendor}
                  style={{
                    flex: 1,
                    background: 'var(--forest-green)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '0.625rem',
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Use Existing Vendor
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddVendorModal(false)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: 10,
                    padding: '0.625rem 1rem',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: '#4b5563',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleQuickAddVendor();
                }}
              >
                <div style={{ marginBottom: '1.25rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '0.375rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Vendor Name
                  </label>
                  <input
                    type="text"
                    id="quick-vendor-name-input"
                    autoFocus
                    className="pwa-input"
                    placeholder="e.g. Patel Vegetables"
                    value={newVendorName}
                    onChange={(e) => {
                      setNewVendorName(e.target.value);
                      if (quickAddError) setQuickAddError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.875rem',
                      borderRadius: 10,
                      border: '1.5px solid var(--border)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddVendorModal(false)}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: 10,
                      padding: '0.5rem 1rem',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="submit-quick-add-vendor-btn"
                    disabled={quickAddLoading}
                    style={{
                      background: 'var(--forest-green)',
                      border: 'none',
                      borderRadius: 10,
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      color: '#ffffff',
                      cursor: quickAddLoading ? 'not-allowed' : 'pointer',
                      opacity: quickAddLoading ? 0.7 : 1,
                    }}
                  >
                    {quickAddLoading ? 'Adding...' : 'Add Vendor'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Add Product Modal ───────────────────────────────────── */}
      {showAddProductModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem',
          }}
        >
          <div
            className="pwa-card"
            style={{
              width: '100%',
              maxWidth: 400,
              background: '#ffffff',
              borderRadius: 16,
              padding: '1.25rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                ➕ Quick Add Product
              </h3>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                ×
              </button>
            </div>

            {activeCategoryObj && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '1rem',
                  background: '#f8fafc',
                  padding: '0.35rem 0.625rem',
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                Category: <strong>{activeCategoryObj.name}</strong>
              </div>
            )}

            {quickAddProductError && (
              <div
                id="quick-add-product-error-msg"
                style={{
                  padding: '0.55rem 0.75rem',
                  background: duplicateProduct ? '#fef3c7' : '#fee2e2',
                  color: duplicateProduct ? '#92400e' : '#dc2626',
                  borderRadius: 8,
                  fontSize: '0.8125rem',
                  marginBottom: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {quickAddProductError}
              </div>
            )}

            {duplicateProduct ? (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  id="btn-use-existing-product"
                  onClick={handleUseExistingProduct}
                  style={{
                    flex: 1,
                    background: 'var(--forest-green)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '0.625rem',
                    fontSize: '0.8125rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Use Existing Product
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: 10,
                    padding: '0.625rem 1rem',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: '#4b5563',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleQuickAddProduct();
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '0.375rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Product Name
                  </label>
                  <input
                    type="text"
                    id="quick-product-name-input"
                    autoFocus
                    className="pwa-input"
                    placeholder="e.g. Fresh Tomatoes"
                    value={newProductName}
                    onChange={(e) => {
                      setNewProductName(e.target.value);
                      if (quickAddProductError) setQuickAddProductError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.875rem',
                      borderRadius: 10,
                      border: '1.5px solid var(--border)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      marginBottom: '0.375rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Unit of Measurement
                  </label>
                  <select
                    className="pwa-input"
                    value={newProductUnit}
                    onChange={(e) => setNewProductUnit(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      fontSize: '0.875rem',
                      borderRadius: 10,
                      border: '1.5px solid var(--border)',
                    }}
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="gram">Gram (g)</option>
                    <option value="liter">Liter (L)</option>
                    <option value="ml">Milliliter (ml)</option>
                    <option value="piece">Piece (pcs)</option>
                    <option value="box">Box</option>
                    <option value="pkt">Packet (pkt)</option>
                    <option value="bunch">Bunch</option>
                    <option value="can">Can</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: 10,
                      padding: '0.5rem 1rem',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="submit-quick-add-product-btn"
                    disabled={quickAddProductLoading}
                    style={{
                      background: 'var(--forest-green)',
                      border: 'none',
                      borderRadius: 10,
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      color: '#ffffff',
                      cursor: quickAddProductLoading ? 'not-allowed' : 'pointer',
                      opacity: quickAddProductLoading ? 0.7 : 1,
                    }}
                  >
                    {quickAddProductLoading ? 'Adding...' : 'Add Product'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
