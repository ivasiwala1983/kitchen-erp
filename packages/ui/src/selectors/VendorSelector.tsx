import React, { useState, useEffect, useCallback } from 'react';
import { SmartSelect, SmartSelectOption } from '../SmartSelect';
import { KitchenErpApi, api as defaultApi } from '@kitchen-erp/api-client';
import { VendorPublic } from '@kitchen-erp/types';
import { getRecentItems, addRecentItem } from '@kitchen-erp/utils';

export interface VendorSelectorProps {
  id?: string;
  tenantId?: string | null;
  categoryId?: string | null;
  value?: string | null;
  onChange: (vendorId: string | null, vendor?: VendorPublic | null) => void;
  vendors?: VendorPublic[]; // Preloaded vendors list if available
  apiClient?: KitchenErpApi;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
  variant?: 'auto' | 'admin' | 'pwa';
}

export const VendorSelector: React.FC<VendorSelectorProps> = ({
  id,
  tenantId,
  categoryId,
  value,
  onChange,
  vendors: initialVendors = [],
  apiClient,
  label = 'Vendor',
  placeholder = 'Select vendor...',
  disabled = false,
  required = false,
  onQuickAdd,
  quickAddLabel = '+ Add New Vendor',
  variant = 'auto',
}) => {
  const [items, setItems] = useState<VendorPublic[]>(initialVendors);
  const client = apiClient || defaultApi;

  useEffect(() => {
    if (initialVendors && initialVendors.length > 0) {
      setItems(initialVendors);
    }
  }, [initialVendors]);

  const mapToOption = (v: VendorPublic): SmartSelectOption<string> => ({
    value: v.id,
    label: v.name,
    sublabel: v.phone || undefined,
    data: v,
  });

  const recentRaw = getRecentItems<string>(tenantId, 'vendor');
  const recentOptions: SmartSelectOption<string>[] = recentRaw.map((r) => ({
    value: r.id,
    label: r.name,
    sublabel: r.sublabel,
    icon: r.icon || '🏪',
  }));

  const handleServerSearch = useCallback(
    async (searchTerm: string): Promise<SmartSelectOption<string>[]> => {
      try {
        const res = await client.vendors.list({
          search: searchTerm,
          categoryId: categoryId || undefined,
          isActive: true,
          limit: 20,
        });
        const list: VendorPublic[] = Array.isArray(res.data)
          ? res.data
          : (res.data as any)?.data || [];
        return list.map(mapToOption);
      } catch {
        return [];
      }
    },
    [client, categoryId]
  );

  const categoryFiltered = categoryId
    ? items.filter((v) => !v.categoryId || v.categoryId === categoryId)
    : items;

  const options = categoryFiltered.map(mapToOption);

  return (
    <SmartSelect<string>
      id={id}
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={(val, opt) => {
        if (opt?.data && tenantId) {
          addRecentItem(tenantId, 'vendor', {
            id: opt.data.id,
            name: opt.data.name,
            sublabel: opt.data.phone || undefined,
            icon: '🏪',
          });
        }
        onChange(val, opt?.data || null);
      }}
      onSearch={handleServerSearch}
      recentOptions={recentOptions}
      onQuickAdd={onQuickAdd}
      quickAddLabel={quickAddLabel}
      disabled={disabled}
      required={required}
      variant={variant}
      title="Select Vendor"
    />
  );
};
