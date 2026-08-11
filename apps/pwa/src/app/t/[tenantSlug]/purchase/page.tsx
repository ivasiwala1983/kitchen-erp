'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { KitchenErpApi, clearTokens } from '@kitchen-erp/api-client';
import { formatCurrency, getCurrencySymbol } from '@kitchen-erp/utils';
import { VendorSelector, ProductSelector } from '@kitchen-erp/ui';
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
  const [userRole, setUserRole] = useState<string>('');

  // Tenant Context & Feature Flags
  const tenantCtx = useTenant();
  const isInvoiceUploadEnabled = tenantCtx.isFeatureEnabled(FeatureCode.FEATURE_INVOICE_UPLOAD);

  // AI Invoice Intelligence States
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [isAiUploadMode, setIsAiUploadMode] = useState(false);
  const [aiProcessingStep, setAiProcessingStep] = useState<
    'idle' | 'uploading' | 'reading' | 'finding_products' | 'review' | 'failed'
  >('idle');
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [aiExtractedData, setAiExtractedData] = useState<any>(null);
  const [aiInvoiceNumber, setAiInvoiceNumber] = useState('');
  const [aiInvoiceDate, setAiInvoiceDate] = useState('');
  const [aiDiscrepancyMessage, setAiDiscrepancyMessage] = useState<string | null>(null);
  const [aiDuplicateWarning, setAiDuplicateWarning] = useState<string | null>(null);
  const [aiTempStoragePath, setAiTempStoragePath] = useState<string | null>(null);
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
    setIsAiUploadMode(true);
    setAiProcessingStep('uploading');
    setAiStatusMessage('Uploading invoice file...');
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
        const data = res.data;
        setAiExtractedData(data);
        setAiInvoiceNumber(data.header?.invoiceNumber || '');
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
          (data.items || []).map((it: any) => ({
            extractedName: it.extractedName,
            description: it.description || null,
            matchedProductId: it.matchedProductId || null,
            matchedProductName: it.matchedProductName || null,
            quantity: Number(it.quantity || 1),
            unit: it.matchedUnit || it.unit || 'kg',
            unitPrice: Number(it.unitPrice || 0),
            lineTotal: Number(it.lineTotal || Number(it.quantity || 1) * Number(it.unitPrice || 0)),
            confidence: Number(it.confidence || 0),
            matchStatus: it.matchStatus || 'needs_review',
            candidates: it.candidates || [],
            isUserCorrected: false,
          }))
        );

        setAiDiscrepancyMessage(data.totalsValidation?.discrepancyMessage || null);
        setAiDuplicateWarning(data.duplicateCheck?.warningMessage || null);
        setAiTempStoragePath(data.tempStoragePath || null);
        setAiProcessingStep('review');
        setSuccess('🤖 Invoice processed successfully! Please review the extracted data below.');
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (e: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      const errMsg =
        e?.response?.data?.message || e?.message || 'Failed to read invoice automatically.';
      setAiProcessingStep('failed');
      setAiStatusMessage(
        `😅 ArgusOne is taking a little AI break right now. (${errMsg}) You can enter the purchase manually or try again.`
      );
    }
  };

  const handleCancelAiUpload = () => {
    setIsAiUploadMode(false);
    setAiProcessingStep('idle');
    setAiExtractedData(null);
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
      setIsAiUploadMode(false);
      setAiProcessingStep('idle');
      setAiItems([]);
      setInvoiceFile(null);
      setTimeout(() => {
        router.push(`/t/${tenantSlug}/purchase/history`);
      }, 1200);
    } catch (e: any) {
      const errMsg = e?.response?.data?.message || e?.message || 'Failed to save purchase.';
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
  const displayGrandTotal = isUtilityBillCategory ? parseFloat(billAmount) || 0 : grandTotal;

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

        {/* AI Invoice Intelligence Action & Review Card */}
        {isInvoiceUploadEnabled && (
          <div style={{ marginBottom: '1.25rem' }}>
            {/* 1. Upload Banner */}
            {aiProcessingStep === 'idle' && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
                  border: '1.5px solid #a5b4fc',
                  borderRadius: 16,
                  padding: '1rem 1.25rem',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.625rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>🤖</span>
                  <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#3730a3' }}>
                    ArgusOne Invoice Intelligence
                  </span>
                </div>
                <div style={{ fontSize: '0.78125rem', color: '#4338ca', textAlign: 'center' }}>
                  Upload a supplier invoice (PDF or Photo) and ArgusOne will automatically extract
                  details, line items, and match products.
                </div>
                <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => aiFileInputRef.current?.click()}
                    className="pwa-btn pwa-btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                      borderColor: '#3730a3',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.8125rem',
                      padding: '0.55rem 1.125rem',
                      borderRadius: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      boxShadow: '0 2px 6px rgba(67, 56, 202, 0.25)',
                    }}
                  >
                    <span>📷 Scan / Upload Invoice</span>
                  </button>
                </div>
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
            <div style={{ flex: 1, maxWidth: '65%' }}>
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
                onQuickAdd={
                  userRole !== 'STAFF'
                    ? () => {
                        setNewVendorName('');
                        setQuickAddError('');
                        setDuplicateVendor(null);
                        setShowAddVendorModal(true);
                      }
                    : undefined
                }
                variant="pwa"
              />
            </div>
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
          </div>
        ) : (
          <>
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
                </div>

                <ProductSelector
                  tenantId={tenantSlug}
                  categoryId={activeCategoryObj?.id}
                  value={selectedProductId}
                  onChange={(val) => {
                    setSelectedProductId(val || '');
                    if (val) {
                      setTimeout(() => quantityInputRef.current?.focus(), 50);
                    }
                  }}
                  products={products}
                  apiClient={api}
                  onQuickAdd={() => {
                    setNewProductName('');
                    setNewProductUnit('kg');
                    setQuickAddProductError('');
                    setDuplicateProduct(null);
                    setShowAddProductModal(true);
                  }}
                  variant="pwa"
                />

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
                    <span
                      style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)' }}
                    >
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
          </>
        )}

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
                  : isUtilityBillCategory
                    ? `Bill Month: ${billMonth || 'Current'} (Tap to Save Bill)`
                    : `${addedItems.length} item${addedItems.length === 1 ? '' : 's'} (Tap to Submit Purchase)`}
              </div>
            </div>
            <div className="ticket-badge-total">
              {formatCurrency(displayGrandTotal, tenantCurrency)}
            </div>
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
