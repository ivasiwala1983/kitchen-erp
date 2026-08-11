import React, { useState, useEffect, useCallback } from 'react';
import { SmartSelect, SmartSelectOption } from '../SmartSelect';
import { KitchenErpApi, api as defaultApi } from '@kitchen-erp/api-client';
import { ProductPublic } from '@kitchen-erp/types';
import { getRecentItems, addRecentItem } from '@kitchen-erp/utils';

export interface ProductSelectorProps {
  id?: string;
  tenantId?: string | null;
  categoryId?: string | null;
  value?: string | null;
  onChange: (productId: string | null, product?: ProductPublic | null) => void;
  products?: ProductPublic[]; // Preloaded products list if available
  apiClient?: KitchenErpApi;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
  variant?: 'auto' | 'admin' | 'pwa';
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  id,
  tenantId,
  categoryId,
  value,
  onChange,
  products: initialProducts = [],
  apiClient,
  label = '',
  placeholder = 'Select Product',
  disabled = false,
  required = false,
  onQuickAdd,
  quickAddLabel = '+ Add New',
  variant = 'auto',
}) => {
  const [items, setItems] = useState<ProductPublic[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const client = apiClient || defaultApi;

  // Sync initial preloaded products if passed
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setItems(initialProducts);
    }
  }, [initialProducts]);

  // Map product entity to SmartSelectOption
  const mapToOption = (p: ProductPublic): SmartSelectOption<string> => ({
    value: p.id,
    label: p.name,
    sublabel: p.unit ? p.unit : undefined,
    data: p,
  });

  // Recent products
  const recentRaw = getRecentItems<string>(tenantId, 'product');
  const recentOptions: SmartSelectOption<string>[] = recentRaw.map((r) => ({
    value: r.id,
    label: r.name,
    sublabel: r.sublabel,
    icon: r.icon || '📦',
  }));

  // Server-side search API call
  const handleServerSearch = useCallback(
    async (searchTerm: string): Promise<SmartSelectOption<string>[]> => {
      try {
        const res = await client.products.list({
          search: searchTerm,
          categoryId: categoryId || undefined,
          isActive: true,
          limit: 20,
        });
        const list: ProductPublic[] = Array.isArray(res.data)
          ? res.data
          : (res.data as any)?.data || [];
        return list.map(mapToOption);
      } catch {
        return [];
      }
    },
    [client, categoryId]
  );

  // Filter local preloaded items by category if provided
  const categoryFiltered = categoryId
    ? items.filter((p) => !p.categoryId || p.categoryId === categoryId)
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
          addRecentItem(tenantId, 'product', {
            id: opt.data.id,
            name: opt.data.name,
            sublabel: opt.data.unit,
            icon: '📦',
          });
        }
        onChange(val, opt?.data || null);
      }}
      onSearch={handleServerSearch}
      isLoading={loading}
      isError={error}
      onRetry={() => setError(false)}
      recentOptions={recentOptions}
      onQuickAdd={onQuickAdd}
      quickAddLabel={quickAddLabel}
      disabled={disabled}
      required={required}
      variant={variant}
      title=""
    />
  );
};
