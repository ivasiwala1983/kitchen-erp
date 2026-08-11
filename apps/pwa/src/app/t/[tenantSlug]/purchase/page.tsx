'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatCurrency, getCurrencySymbol } from '@kitchen-erp/utils';
import { VendorSelector, ProductSelector, CategorySelector } from '@kitchen-erp/ui';
import type { Category, Vendor, Product } from '@kitchen-erp/types';
import { FeatureCode } from '@kitchen-erp/types';
import { useTenant } from '../../../../contexts/TenantContext';

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

  // Inline Item Editing State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editUnit, setEditUnit] = useState('');

  // Invoice Receipt File & Input Refs
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');

  // Tenant Context & Feature Flags
  const tenantCtx = useTenant();
  const isInvoiceUploadEnabled = tenantCtx.isFeatureEnabled(FeatureCode.FEATURE_INVOICE_UPLOAD);

  // AI Invoice Intelligence States
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [aiProcessingStep, setAiProcessingStep] = useState<
    'idle' | 'uploading' | 'reading' | 'finding_products' | 'review' | 'failed'
  >('idle');
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [aiInvoiceNumber, setAiInvoiceNumber] = useState('');
  const [aiInvoiceDate, setAiInvoiceDate] = useState('');
  const [aiDiscrepancyMessage, setAiDiscrepancyMessage] = useState<string | null>(null);
  const [aiDuplicateWarning, setAiDuplicateWarning] = useState<string | null>(null);
  const [aiItems, setAiItems] = useState<
    Array<{
      extractedName: string;
      description?: string | null;
      matchedProductId: string | null;
      matchedProductName: string | null;
      quantity: number;
      unit: string;
      unitPrice: number;
      lineTotal: number;
      confidence: number;
      matchStatus: 'matched' | 'recommended' | 'needs_review';
      candidates: Array<{ id: string; name: string; unit: string; score: number }>;
      isUserCorrected: boolean;
    }>
  >([]);

  const handleProcessAiInvoice = async (file: File) => {
    if (!file) return;
    setInvoiceFile(file);
    setAiProcessingStep('uploading');
    setAiStatusMessage('Uploading invoice to ArgusOne AI...');
    setError('');
    setSuccess('');

    const t1 = setTimeout(() => {
      setAiProcessingStep('reading');
      setAiStatusMessage('🔍 Reading your invoice...');
    }, 600);

    const t2 = setTimeout(() => {
      setAiProcessingStep('finding_products');
      setAiStatusMessage('🤖 ArgusOne is extracting details and matching products...');
    }, 1800);

    try {
      const res = await api.purchases.processInvoiceIntelligence(file);
      clearTimeout(t1);
      clearTimeout(t2);

      if (res?.data) {
        const data = res.data?.data || res.data || {};
        setAiInvoiceNumber(data.invoiceNumber || '');
        if (data.header?.invoiceDate) {
          setAiInvoiceDate(data.header.invoiceDate);
        }

        if (data.vendorMatch?.matchedVendorId) {
          const found = vendors.find((v) => v.id === data.vendorMatch.matchedVendorId);
          if (found) setActiveVendor(found);
        }

        if (data.isUtilityBill) {
          const utilCat = categories.find((c) => c.type === 'UTILITY_BILL');
          if (utilCat) setActiveCategoryId(utilCat.id);
          if (data.billMonth) setBillMonth(data.billMonth);
          if (data.billAmount) setBillAmount(String(data.billAmount));
        }

        setAiItems(
          (data.items || []).map((it: Record<string, unknown>) => ({
            extractedName: (it.extractedName as string) || '',
            description: (it.description as string) || null,
            matchedProductId: (it.matchedProductId as string) || null,
            matchedProductName: (it.matchedProductName as string) || null,
            quantity: Number(it.quantity || 1),
            unit: (it.matchedUnit as string) || (it.unit as string) || 'kg',
            unitPrice: Number(it.unitPrice || 0),
            lineTotal: Number(it.lineTotal || Number(it.quantity || 1) * Number(it.unitPrice || 0)),
            confidence: Number(it.confidence || 0),
            matchStatus: (it.matchStatus as string) || 'needs_review',
            candidates: (it.candidates as unknown[]) || [],
            isUserCorrected: false,
          }))
        );

        setAiDiscrepancyMessage(data.totalsValidation?.discrepancyMessage || null);
        setAiDuplicateWarning(data.duplicateCheck?.warningMessage || null);
        setAiProcessingStep('review');
        setSuccess('🤖 Invoice processed successfully! Please review the extracted data below.');
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (e) {
      clearTimeout(t1);
      clearTimeout(t2);
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const errMsg =
        err?.response?.data?.message || err?.message || 'Failed to read invoice automatically.';
      setAiProcessingStep('failed');
      setAiStatusMessage(
        `😅 ArgusOne is taking a little AI break right now. (${errMsg}) You can enter the purchase manually or try again.`
      );
    }
  };

  const handleCancelAiUpload = () => {
    setAiProcessingStep('idle');
    setAiItems([]);
    setAiDiscrepancyMessage(null);
    setAiDuplicateWarning(null);
  };

  const handleConfirmAiPurchase = async () => {
    if (!activeVendor) {
      setError('Please select a vendor');
      return;
    }

    if (isUtilityBillCategory) {
      if (!billMonth || !billAmount || parseFloat(billAmount) <= 0) {
        setError('Please enter a valid Bill Month and Bill Amount');
        return;
      }
    } else {
      if (aiItems.length === 0) {
        setError('At least one item is required');
        return;
      }
      const unselected = aiItems.find((it) => !it.matchedProductId);
      if (unselected) {
        setError(`Please select a matching product for "${unselected.extractedName}"`);
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      let res;
      if (isUtilityBillCategory) {
        res = await api.purchases.create({
          vendorId: activeVendor.id,
          categoryId: activeCategoryId,
          billMonth,
          billAmount: parseFloat(billAmount),
          notes: `AI Extracted Utility Bill ${aiInvoiceNumber ? `(Inv #${aiInvoiceNumber})` : ''}`,
          purchaseDate: selectedDate.toISOString(),
        });
      } else {
        res = await api.purchases.create({
          vendorId: activeVendor.id,
          categoryId: activeCategoryId,
          items: aiItems.map((it) => ({
            productId: it.matchedProductId!,
            qty: it.quantity,
            rate: it.unitPrice,
          })),
          notes: `AI Extracted Invoice ${aiInvoiceNumber ? `(Inv #${aiInvoiceNumber})` : ''}`,
          purchaseDate: selectedDate.toISOString(),
        });
      }

      if (res?.data?.id && invoiceFile) {
        try {
          await api.purchases.uploadInvoice(res.data.id, invoiceFile);
        } catch (uploadErr) {
          console.warn('Invoice file attachment warning:', uploadErr);
        }
      }

      setSuccess('🎉 Purchase created successfully from invoice!');
      setAiProcessingStep('idle');
      setAiItems([]);
      setInvoiceFile(null);
      setTimeout(() => {
        router.push(`/t/${tenantSlug}/purchase/history`);
      }, 1200);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to save purchase.';
      setError(`Your invoice was read successfully, but I couldn't save the purchase: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  };

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

  // Utility Bill state
  const getCurrentYearMonth = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const [billMonth, setBillMonth] = useState<string>(getCurrentYearMonth());
  const [billAmount, setBillAmount] = useState<string>('');

  // Running Grand Total calculation
  const grandTotal = addedItems.reduce((sum, item) => sum + item.total, 0);

  // Active Category Object
  const activeCategoryObj = categories.find((c) => c.id === activeCategoryId);
  const isUtilityBillCategory = activeCategoryObj?.type === 'UTILITY_BILL';

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
        if (meData?.role) {
          setUserRole(meData.role);
        }
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

  const handleSaveDraft = () => {
    if (addedItems.length === 0 && !isUtilityBillCategory) {
      setError('Add at least one item before saving a draft');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const draftData = {
      vendorId: activeVendor?.id,
      vendorName: activeVendor?.name,
      categoryId: activeCategoryId,
      items: addedItems,
      date: selectedDate.toISOString(),
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    }
    setSuccess('\uD83D\uDCE5 Draft saved successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const startEdit = (index: number) => {
    const item = addedItems[index];
    setEditingIndex(index);
    setEditQty(String(item.qty));
    setEditRate(String(item.rate));
    setEditUnit(item.unit);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const qtyNum = parseFloat(editQty) || 0;
    const rateNum = parseFloat(editRate) || 0;
    if (qtyNum <= 0 || rateNum <= 0) {
      setError('Please enter valid Qty and Rate');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setAddedItems((prev) =>
      prev.map((item, i) =>
        i === editingIndex
          ? {
              ...item,
              qty: qtyNum,
              rate: rateNum,
              unit: editUnit,
              total: parseFloat((qtyNum * rateNum).toFixed(2)),
            }
          : item
      )
    );
    setEditingIndex(null);
  };

  // Selected Product details & unit auto-fill
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const currentUnit = selectedProduct?.unit || 'kg';
  const isWeightUnit = ['kg', 'gram', 'g', 'lbs'].includes(currentUnit.toLowerCase());

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

    if (isUtilityBillCategory) {
      const amtNum = parseFloat(billAmount) || 0;
      if (!billMonth) {
        setError('Please select a Bill Month');
        return;
      }
      if (amtNum <= 0) {
        setError('Please enter a valid Bill Amount');
        return;
      }

      setSaving(true);
      setError('');
      setSuccess('⚡ Utility bill submitted! Saving to cloud...');

      try {
        const purchaseRes = await api.purchases.create({
          vendorId: activeVendor.id,
          categoryId: activeCategoryId,
          billMonth,
          billAmount: amtNum,
          purchaseDate: selectedDate.toISOString(),
        });

        if (purchaseRes.data && invoiceFile) {
          setSuccess('⚡ Uploading attached invoice receipt...');
          await api.purchases.uploadInvoice(purchaseRes.data.id, invoiceFile);
        }

        if (typeof window !== 'undefined') {
          localStorage.removeItem(DRAFT_KEY);
        }
        setSavedDraft(null);
        setSuccess('🎉 Utility bill saved successfully!');
        setBillAmount('');
        setInvoiceFile(null);
        setTimeout(() => setSuccess(''), 4000);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } };
        const errMsg = err?.response?.data?.message || 'Network connection or server error';
        setError(`⚠️ ${errMsg}`);
      } finally {
        setSaving(false);
      }
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
        categoryId: activeCategoryId,
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
      <div className="pwa-content" style={{ paddingTop: '0.75rem', paddingBottom: '11rem' }}>
        {/* 1. COMPACT Header */}
        <div className="mock-header" style={{ marginBottom: '0.5rem', alignItems: 'center' }}>
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
              padding: '0.35rem 0.7rem',
              borderRadius: 999,
              background: 'var(--mint-light)',
              color: 'var(--forest-green)',
              textDecoration: 'none',
              fontSize: '0.75rem',
              fontWeight: 800,
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span>🤖</span>
            <span>Ask ArgusOne</span>
          </Link>
        </div>

        {/* 2. COMPACT Purchase Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.5rem' }}>
          <Link
            href={`/t/${tenantSlug}/purchase`}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '0.375rem',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.75rem',
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
              padding: '0.375rem',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.75rem',
              background: '#f1f5f9',
              color: 'var(--text-main)',
              textDecoration: 'none',
            }}
          >
            📋 Purchase History
          </Link>
        </div>

        {/* 3. COMPACT Date Selector */}
        <div
          className="date-selector-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            padding: '0.375rem 0.75rem',
            borderRadius: 12,
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '0.5rem',
          }}
        >
          <button
            type="button"
            className="date-arrow-btn"
            onClick={handlePrevDay}
            title="Previous Day"
            aria-label="Previous Day"
            style={{
              width: 34,
              height: 34,
              border: 'none',
              borderRadius: 8,
              background: '#f0f4e8',
              color: 'var(--forest-green)',
              fontSize: '1.125rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ‹
          </button>

          <div
            onClick={() => {
              try {
                dateInputRef.current?.showPicker?.();
              } catch (err) {
                void err;
              }
            }}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              background: '#f8fafc',
              border: '1.5px solid var(--border)',
              borderRadius: 8,
              padding: '0.3rem 0.75rem',
              gap: '0.375rem',
            }}
          >
            <span style={{ pointerEvents: 'none' }}>📅</span>
            <span
              style={{
                fontFamily: 'inherit',
                fontSize: '0.8125rem',
                fontWeight: 800,
                color: 'var(--forest-green)',
                pointerEvents: 'none',
              }}
            >
              {formatDateDisplay(selectedDate)}
            </span>
            <input
              ref={dateInputRef}
              type="date"
              className="pwa-date-input"
              value={formatDateYMD(selectedDate)}
              onChange={handleDateInputChange}
              onClick={(e) => {
                try {
                  (e.target as HTMLInputElement).showPicker?.();
                } catch (err) {
                  void err;
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 10,
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
              width: 34,
              height: 34,
              border: 'none',
              borderRadius: 8,
              background: '#f0f4e8',
              color: 'var(--forest-green)',
              fontSize: '1.125rem',
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
              borderRadius: 12,
              padding: '0.5rem 0.875rem',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.625rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.8125rem', color: '#1e40af' }}>
                📝 Draft Found ({savedDraft.items?.length || 0} item
                {(savedDraft.items?.length || 0) === 1 ? '' : 's'})
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#1e3a8a', marginTop: 1 }}>
                Saved at {savedDraft.updatedAt || 'earlier'}{' '}
                {savedDraft.vendorName ? `· ${savedDraft.vendorName}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="pwa-btn pwa-btn-primary pwa-btn-sm"
                style={{ fontWeight: 800, fontSize: '0.71875rem', padding: '0.25rem 0.625rem' }}
              >
                📥 Restore
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="pwa-btn pwa-btn-secondary pwa-btn-sm"
                style={{
                  fontWeight: 700,
                  fontSize: '0.71875rem',
                  padding: '0.25rem 0.375rem',
                  color: '#4b5563',
                }}
              >
                🗑️
              </button>
            </div>
          </div>
        )}

        {/* 4. COMPACT Invoice Intelligence (collapsible when idle) */}
        {isInvoiceUploadEnabled && (
          <div style={{ marginBottom: '0.5rem' }}>
            {/* Idle: compact sleek AI card */}
            {aiProcessingStep === 'idle' && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '1px solid #bbf7d0',
                  borderRadius: 10,
                  padding: '0.5rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  boxShadow: '0 2px 6px rgba(22, 101, 52, 0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                  <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>🤖</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          color: '#166534',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ArgusOne AI
                      </span>
                      <span
                        style={{
                          background: 'var(--forest-green)',
                          color: '#ffffff',
                          fontSize: '0.5rem',
                          fontWeight: 800,
                          padding: '0.05rem 0.3rem',
                          borderRadius: 100,
                          letterSpacing: '0.5px',
                          flexShrink: 0,
                          textTransform: 'uppercase',
                        }}
                      >
                        AI
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.625rem',
                        color: '#15803d',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      Scan invoice to auto-fill cart
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => aiFileInputRef.current?.click()}
                  style={{
                    background: 'var(--forest-green)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.375rem 0.625rem',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    boxShadow: '0 1px 4px rgba(22, 101, 52, 0.2)',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  📷 Scan Invoice
                </button>
                <input
                  ref={aiFileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessAiInvoice(file);
                  }}
                />
              </div>
            )}

            {/* 2. Processing States */}
            {['uploading', 'reading', 'finding_products'].includes(aiProcessingStep) && (
              <div
                className="pwa-card"
                style={{
                  padding: '1.75rem 1.25rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                }}
              >
                <div style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>
                  {aiProcessingStep === 'uploading'
                    ? '📤'
                    : aiProcessingStep === 'reading'
                      ? '🔍'
                      : '🤖'}
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: '#1e293b',
                    marginBottom: '0.25rem',
                  }}
                >
                  {aiStatusMessage}
                </div>
                <div style={{ fontSize: '0.78125rem', color: '#64748b' }}>
                  Extracting header, items, rates, and candidate products...
                </div>
              </div>
            )}

            {/* 3. Failed State */}
            {aiProcessingStep === 'failed' && (
              <div
                className="pwa-card"
                style={{
                  padding: '1.25rem',
                  background: '#fff1f2',
                  border: '1.5px solid #fecdd3',
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.9375rem',
                    color: '#9f1239',
                    marginBottom: '0.375rem',
                  }}
                >
                  Couldn't read this invoice automatically
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#be123c', marginBottom: '0.875rem' }}>
                  {aiStatusMessage}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => aiFileInputRef.current?.click()}
                    className="pwa-btn pwa-btn-secondary pwa-btn-sm"
                  >
                    🔄 Try Again
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAiUpload}
                    className="pwa-btn pwa-btn-primary pwa-btn-sm"
                  >
                    ✍️ Enter Purchase Manually
                  </button>
                </div>
              </div>
            )}

            {/* 4. Review Required Screen */}
            {aiProcessingStep === 'review' && (
              <div
                className="pwa-card"
                style={{
                  padding: '1.25rem',
                  background: '#ffffff',
                  border: '2px solid #6366f1',
                  borderRadius: 16,
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.12)',
                }}
              >
                {/* Header Banner */}
                <div
                  style={{
                    background: '#e0e7ff',
                    borderRadius: 12,
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#3730a3' }}>
                      🤖 Invoice Extracted & Matched ✓
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#4338ca', marginTop: 2 }}>
                      {aiItems.length} items found ·{' '}
                      {aiItems.filter((i) => i.matchStatus === 'matched').length} matched
                      automatically, {aiItems.filter((i) => i.matchStatus !== 'matched').length}{' '}
                      need review.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelAiUpload}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#4f46e5',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel AI Review
                  </button>
                </div>

                {/* Duplicate Invoice Warning */}
                {aiDuplicateWarning && (
                  <div
                    style={{
                      background: '#fffbe6',
                      border: '1.5px solid #ffe58f',
                      borderRadius: 10,
                      padding: '0.625rem 0.875rem',
                      marginBottom: '0.875rem',
                      fontSize: '0.78125rem',
                      color: '#d48806',
                      fontWeight: 700,
                    }}
                  >
                    {aiDuplicateWarning}
                  </div>
                )}

                {/* Totals Discrepancy Warning */}
                {aiDiscrepancyMessage && (
                  <div
                    style={{
                      background: '#fff1f0',
                      border: '1.5px solid #ffa39e',
                      borderRadius: 10,
                      padding: '0.625rem 0.875rem',
                      marginBottom: '0.875rem',
                      fontSize: '0.78125rem',
                      color: '#cf1322',
                      fontWeight: 700,
                    }}
                  >
                    ⚠️ {aiDiscrepancyMessage}
                  </div>
                )}

                {/* Extracted Header Details (Invoice No, Date, Vendor) */}
                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: 12,
                    padding: '0.875rem',
                    marginBottom: '1rem',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: '#475569',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Extracted Header Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#64748b',
                        }}
                      >
                        Invoice Number
                      </label>
                      <input
                        type="text"
                        value={aiInvoiceNumber}
                        onChange={(e) => setAiInvoiceNumber(e.target.value)}
                        placeholder="e.g. INV-1002"
                        style={{
                          width: '100%',
                          padding: '0.4rem 0.6rem',
                          fontSize: '0.8125rem',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          marginTop: 2,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#64748b',
                        }}
                      >
                        Invoice Date
                      </label>
                      <input
                        type="date"
                        value={aiInvoiceDate}
                        onChange={(e) => setAiInvoiceDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.4rem 0.6rem',
                          fontSize: '0.8125rem',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          marginTop: 2,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Items Review Section */}
                <div style={{ marginBottom: '1rem' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: '#475569',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Review Matched Items ({aiItems.length})
                  </div>

                  {aiItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '0.875rem',
                        marginBottom: '0.75rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* Row 1: Extracted Name & Confidence Badge */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#1e293b' }}>
                          📄 "{item.extractedName}"
                        </div>
                        <div>
                          {item.confidence >= 90 ? (
                            <span
                              style={{
                                background: '#dcfce7',
                                color: '#15803d',
                                fontSize: '0.71875rem',
                                fontWeight: 800,
                                padding: '0.2rem 0.5rem',
                                borderRadius: 12,
                              }}
                            >
                              ✓ {item.confidence}% Match
                            </span>
                          ) : item.confidence >= 70 ? (
                            <span
                              style={{
                                background: '#fef3c7',
                                color: '#b45309',
                                fontSize: '0.71875rem',
                                fontWeight: 800,
                                padding: '0.2rem 0.5rem',
                                borderRadius: 12,
                              }}
                            >
                              ⚠️ Possible match {item.confidence}%
                            </span>
                          ) : (
                            <span
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                fontSize: '0.71875rem',
                                fontWeight: 800,
                                padding: '0.2rem 0.5rem',
                                borderRadius: 12,
                              }}
                            >
                              Needs Review
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 2: ProductSelector for matching */}
                      <div style={{ marginBottom: '0.625rem' }}>
                        <ProductSelector
                          tenantId={tenantSlug}
                          categoryId={activeCategoryId}
                          value={item.matchedProductId}
                          onChange={(val, prodObj) => {
                            setAiItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      matchedProductId: val,
                                      matchedProductName: prodObj?.name || null,
                                      unit: prodObj?.unit || it.unit,
                                      isUserCorrected: true,
                                    }
                                  : it
                              )
                            );
                          }}
                          products={products}
                          apiClient={api}
                          variant="pwa"
                          placeholder="Search or select catalog product..."
                        />
                      </div>

                      {/* Row 3: Qty, Unit Price, Line Total */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: '0.5rem',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <label
                            style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b' }}
                          >
                            Qty ({item.unit})
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={item.quantity}
                            onChange={(e) => {
                              const q = parseFloat(e.target.value) || 0;
                              setAiItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        quantity: q,
                                        lineTotal: q * it.unitPrice,
                                        isUserCorrected: true,
                                      }
                                    : it
                                )
                              );
                            }}
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.8125rem',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                            }}
                          />
                        </div>

                        <div>
                          <label
                            style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b' }}
                          >
                            Rate ({currencySymbol})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const r = parseFloat(e.target.value) || 0;
                              setAiItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        unitPrice: r,
                                        lineTotal: it.quantity * r,
                                        isUserCorrected: true,
                                      }
                                    : it
                                )
                              );
                            }}
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.8125rem',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                            }}
                          />
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b' }}>
                            Total
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>
                            {formatCurrency(item.quantity * item.unitPrice, tenantCurrency)}
                          </div>
                          <span
                            style={{
                              fontSize: '0.625rem',
                              color: item.isUserCorrected ? '#2563eb' : '#64748b',
                              fontWeight: 700,
                            }}
                          >
                            {item.isUserCorrected ? 'Manually corrected' : 'Extracted'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final Confirmation Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleConfirmAiPurchase}
                    disabled={saving}
                    className="pwa-btn pwa-btn-primary"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      borderColor: '#15803d',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.875rem',
                      padding: '0.65rem 1rem',
                      borderRadius: 10,
                    }}
                  >
                    {saving ? 'Saving Purchase...' : `✓ Add ${aiItems.length} Items to Purchase`}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAiUpload}
                    className="pwa-btn pwa-btn-secondary"
                    style={{
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      padding: '0.65rem 0.875rem',
                      borderRadius: 10,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Purchase Context Card (Vendor + Category) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '0.75rem',
            marginBottom: '0.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.625rem',
            }}
          >
            {/* Category — LEFT */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '0.25rem',
                }}
              >
                Category
              </label>
              <CategorySelector
                tenantId={tenantSlug}
                value={activeCategoryId}
                onChange={(val) => {
                  if (val) setActiveCategoryId(val);
                }}
                categories={categories}
                apiClient={api}
                placeholder="Select category..."
                label=""
                variant="pwa"
              />
            </div>

            {/* Vendor / Supplier — RIGHT */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '0.25rem',
                }}
              >
                Vendor / Supplier
              </label>
              <VendorSelector
                tenantId={tenantSlug}
                categoryId={activeCategoryObj?.id}
                value={activeVendor?.id || null}
                onChange={(val, vendorObj) => {
                  if (vendorObj) setActiveVendor(vendorObj);
                  else if (!val) setActiveVendor(null);
                }}
                vendors={vendors}
                apiClient={api}
                placeholder="Select vendor..."
                onQuickAdd={undefined}
                label=""
                variant="pwa"
              />
              {userRole !== 'STAFF' && (
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
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    padding: '0.2rem 0',
                    marginTop: '0.25rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontFamily: 'inherit',
                  }}
                >
                  + Add New Vendor
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '0.4375rem 0.75rem',
              background: '#fee2e2',
              color: '#dc2626',
              borderRadius: 10,
              fontSize: '0.8125rem',
              marginBottom: '0.5rem',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              padding: '0.4375rem 0.75rem',
              background: '#d1fae5',
              color: '#059669',
              borderRadius: 10,
              fontSize: '0.8125rem',
              marginBottom: '0.5rem',
              fontWeight: 600,
            }}
          >
            {success}
          </div>
        )}

        {/* 6. Product Selection & Quick Entry Card or Utility Bill Entry Card */}
        {isUtilityBillCategory ? (
          <div
            className="add-item-card"
            style={{ background: '#fffbeb', border: '1.5px solid #fcd34d' }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: '0.9375rem',
                color: '#b45309',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>⚡</span>
              <span>Add Utility Bill — {activeCategoryObj?.name}</span>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--forest-green)',
                  marginBottom: '0.375rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Bill Month *
              </label>
              <input
                type="month"
                className="pwa-input"
                value={billMonth}
                onChange={(e) => setBillMonth(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  borderRadius: 10,
                  border: '1.5px solid var(--border)',
                  background: '#ffffff',
                }}
              />
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--forest-green)',
                  marginBottom: '0.375rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Bill Amount * ({currencySymbol})
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 12,
                    fontWeight: 800,
                    fontSize: '1.125rem',
                    color: 'var(--forest-green)',
                  }}
                >
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  className="pwa-input"
                  placeholder="e.g. 12450"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem 0.625rem 2.25rem',
                    fontSize: '1.125rem',
                    fontWeight: 800,
                    color: 'var(--forest-green)',
                    borderRadius: 10,
                    border: '1.5px solid var(--border)',
                    background: '#ffffff',
                  }}
                />
              </div>
            </div>

            {/* Invoice Attachment for Utility Bills */}
            <div style={{ margin: '0.5rem 0 0.25rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: '#f8fafc',
                  border: '1.5px dashed var(--border)',
                  borderRadius: 10,
                  padding: '0.375rem 0.875rem',
                  fontSize: '0.71875rem',
                  fontWeight: 700,
                  color: invoiceFile ? 'var(--forest-green)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3125rem',
                  transition: 'all 0.15s ease',
                }}
              >
                📎{' '}
                {invoiceFile ? (
                  <>
                    <span>
                      ✓ {invoiceFile.name.slice(0, 18)}
                      {invoiceFile.name.length > 18 ? '...' : ''}
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
                  <span>Attach Bill (Optional)</span>
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
        ) : (
          // Cart — Table Layout
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Cart Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.625rem 0.75rem',
                borderBottom: '1px solid var(--border)',
                background: '#f8fafc',
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '0.9375rem',
                    color: 'var(--forest-green)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  🛒 CART ITEMS
                  <span
                    style={{
                      background: 'var(--forest-green)',
                      color: '#fff',
                      borderRadius: 999,
                      padding: '0.05rem 0.4rem',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      minWidth: '1.25rem',
                      textAlign: 'center',
                    }}
                  >
                    {addedItems.length}
                  </span>
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 1 }}>
                  Add products to build your purchase
                </div>
              </div>
              {addedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAddedItems([]);
                    setEditingIndex(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                  }}
                >
                  Clear All 🗑
                </button>
              )}
            </div>

            {/* Product Search + Add Product button */}
            <div
              style={{
                padding: '0.625rem 0.75rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <ProductSelector
                  tenantId={tenantSlug}
                  categoryId={activeCategoryObj?.id}
                  value={selectedProductId}
                  onChange={(val, prodObj) => {
                    setSelectedProductId(val || '');
                    if (prodObj && !products.some((p) => p.id === prodObj.id)) {
                      setProducts((prev) => [...prev, prodObj]);
                    }
                    if (val) {
                      setTimeout(() => quantityInputRef.current?.focus(), 50);
                    }
                  }}
                  products={products}
                  apiClient={api}
                  onQuickAdd={undefined}
                  variant="pwa"
                  placeholder="Search product (type 2+ characters)..."
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewProductName('');
                  setNewProductUnit('kg');
                  setQuickAddProductError('');
                  setDuplicateProduct(null);
                  setShowAddProductModal(true);
                }}
                style={{
                  background: 'var(--forest-green)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                + Add Product
              </button>
            </div>

            {/* Qty + Rate inputs — revealed when a product is selected */}
            {selectedProductId && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  background: '#f0fdf4',
                  borderBottom: '1px solid #bbf7d0',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: '0.5rem',
                  alignItems: 'flex-end',
                }}
              >
                {/* Qty */}
                <div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#166534',
                      marginBottom: 3,
                    }}
                  >
                    {isWeightUnit ? 'Qty' : 'Qty'} ({currentUnit})
                  </div>
                  <input
                    ref={quantityInputRef}
                    type="number"
                    placeholder="0"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    step="0.01"
                    style={{
                      width: '100%',
                      border: '1.5px solid #bbf7d0',
                      borderRadius: 6,
                      padding: '0.375rem 0.5rem',
                      fontSize: '0.9375rem',
                      fontWeight: 700,
                      background: '#fff',
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {/* Rate */}
                <div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#166534',
                      marginBottom: 3,
                    }}
                  >
                    Rate ({currencySymbol})
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#fff',
                      border: '1.5px solid #bbf7d0',
                      borderRadius: 6,
                      padding: '0.375rem 0.5rem',
                      gap: '0.2rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#94a3b8',
                        flexShrink: 0,
                      }}
                    >
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      placeholder="0"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      step="0.01"
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        background: 'transparent',
                        fontFamily: 'inherit',
                        minWidth: 0,
                      }}
                    />
                  </div>
                </div>
                {/* Add button */}
                <button
                  id="quick-add-product-btn"
                  onClick={handleAddItem}
                  aria-label="Add product to cart"
                  style={{
                    background: 'var(--forest-green)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    alignSelf: 'flex-end',
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                  }}
                >
                  + Add
                </button>
              </div>
            )}

            {/* Table or Empty State */}
            {addedItems.length === 0 ? (
              <div
                style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.375rem' }}>🛒</div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                  No items yet. Search above to add.
                </div>
              </div>
            ) : (
              <>
                {/* Scrollable table wrapper */}
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  {/* Table header */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.8fr 0.7fr 0.7fr 0.9fr 1fr 0.65fr',
                      minWidth: 320,
                      gap: '0.125rem',
                      padding: '0.3rem 0.5rem',
                      background: '#f1f5f9',
                      fontSize: '0.5625rem',
                      fontWeight: 800,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span>Product</span>
                    <span style={{ textAlign: 'center' }}>Qty</span>
                    <span style={{ textAlign: 'center' }}>Unit</span>
                    <span style={{ textAlign: 'center' }}>Rate ({currencySymbol})</span>
                    <span style={{ textAlign: 'right' }}>Amt ({currencySymbol})</span>
                    <span style={{ textAlign: 'center' }}>Act.</span>
                  </div>

                  {/* Table rows */}
                  {addedItems.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.8fr 0.7fr 0.7fr 0.9fr 1fr 0.65fr',
                        minWidth: 320,
                        gap: '0.125rem',
                        padding: '0.4rem 0.5rem',
                        borderBottom: index < addedItems.length - 1 ? '1px solid #f1f5f9' : 'none',
                        alignItems: 'center',
                        background:
                          editingIndex === index
                            ? '#f0fdf4'
                            : index % 2 === 0
                              ? '#ffffff'
                              : '#fafafa',
                      }}
                    >
                      {/* Product Name */}
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </span>

                      {/* Qty */}
                      {editingIndex === index ? (
                        <input
                          type="number"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          step="0.01"
                          style={{
                            width: '100%',
                            border: '1px solid var(--forest-green)',
                            borderRadius: 4,
                            padding: '0.15rem 0.2rem',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            background: '#fff',
                            fontFamily: 'inherit',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-main)',
                          }}
                        >
                          {item.qty}
                        </span>
                      )}

                      {/* Unit */}
                      {editingIndex === index ? (
                        <select
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          style={{
                            width: '100%',
                            border: '1px solid var(--forest-green)',
                            borderRadius: 4,
                            padding: '0.15rem 0.1rem',
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            background: '#fff',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            boxSizing: 'border-box',
                          }}
                        >
                          {[
                            'kg',
                            'g',
                            'L',
                            'ml',
                            'pcs',
                            'dozen',
                            'box',
                            'pack',
                            'bottle',
                            'bunch',
                            'bag',
                          ].map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                          {![
                            'kg',
                            'g',
                            'L',
                            'ml',
                            'pcs',
                            'dozen',
                            'box',
                            'pack',
                            'bottle',
                            'bunch',
                            'bag',
                          ].includes(item.unit) && <option value={item.unit}>{item.unit}</option>}
                        </select>
                      ) : (
                        <span
                          style={{
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                          }}
                        >
                          {item.unit}
                        </span>
                      )}

                      {/* Rate */}
                      {editingIndex === index ? (
                        <input
                          type="number"
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                          step="0.01"
                          style={{
                            width: '100%',
                            border: '1px solid var(--forest-green)',
                            borderRadius: 4,
                            padding: '0.15rem 0.2rem',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            background: '#fff',
                            fontFamily: 'inherit',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--text-main)',
                          }}
                        >
                          {item.rate.toFixed(2)}
                        </span>
                      )}

                      {/* Amount */}
                      <span
                        style={{
                          textAlign: 'right',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: 'var(--forest-green)',
                        }}
                      >
                        {editingIndex === index
                          ? (parseFloat(editQty || '0') * parseFloat(editRate || '0')).toFixed(2)
                          : item.total.toFixed(2)}
                      </span>

                      {/* Action */}
                      {editingIndex === index ? (
                        <div style={{ display: 'flex', gap: '0.125rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            title="Save changes"
                            style={{
                              background: 'var(--forest-green)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              width: 22,
                              height: 22,
                              fontSize: '0.625rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                            }}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIndex(null)}
                            title="Cancel edit"
                            style={{
                              background: '#f1f5f9',
                              color: '#64748b',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              width: 22,
                              height: 22,
                              fontSize: '0.625rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.125rem', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => startEdit(index)}
                            title={`Edit ${item.name}`}
                            aria-label={`Edit ${item.name}`}
                            style={{
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: 4,
                              width: 22,
                              height: 22,
                              fontSize: '0.6875rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            title={`Remove ${item.name}`}
                            aria-label={`Remove ${item.name}`}
                            style={{
                              background: '#fff1f2',
                              color: '#dc2626',
                              border: '1px solid #fecdd3',
                              borderRadius: 4,
                              width: 22,
                              height: 22,
                              fontSize: '0.6875rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>{' '}
                {/* end scroll wrapper */}
                {/* Cart Totals */}
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderTop: '2px solid var(--border)',
                    background: '#f8fafc',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Total Items: {addedItems.length}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div>
                        Subtotal{' '}
                        <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                          {currencySymbol}
                          {grandTotal.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        Tax (0%){' '}
                        <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                          {currencySymbol}0.00
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border)',
                      paddingTop: '0.375rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '0.875rem',
                        color: 'var(--text-main)',
                      }}
                    >
                      Total
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '1rem',
                        color: 'var(--forest-green)',
                      }}
                    >
                      {currencySymbol}
                      {grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── 9. Bottom Action Bar ─────────────────────── */}
      <div className="purchase-action-bar">
        {/* Row 1: Attach + Draft */}
        <div className="action-row-1">
          {/* Attach Invoice */}
          <button
            type="button"
            className={`action-btn-secondary${invoiceFile ? ' attached' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <span>📎</span>
            {invoiceFile ? (
              <>
                <span>✓ Attached</span>
                <span
                  style={{ color: '#dc2626', marginLeft: 4, fontWeight: 900, flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInvoiceFile(null);
                  }}
                >
                  ✕
                </span>
              </>
            ) : (
              <span>Attach Invoice</span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
          />

          {/* Save Draft */}
          <button type="button" className="action-btn-secondary" onClick={handleSaveDraft}>
            <span>💾</span>
            <span>Save Draft</span>
          </button>
        </div>

        {/* Row 2: Submit — full width */}
        <button
          type="button"
          className="action-btn-submit"
          onClick={handleSavePurchase}
          disabled={saving}
        >
          {saving ? '⏳ Saving...' : '✅ Submit Purchase'}
        </button>
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
                Add
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
                  Use Existing
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
                    Name
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
                    {quickAddLoading ? 'Adding...' : 'Add'}
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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>➕ Quick Add</h3>
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
                  Use Existing
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
                    Name
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
                    {quickAddProductLoading ? 'Adding...' : 'Add'}
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
