import React, { useState, useEffect, useCallback } from 'react';
import { SmartSelect, SmartSelectOption } from '../SmartSelect';
import { KitchenErpApi, api as defaultApi } from '@kitchen-erp/api-client';
import { CategoryPublic } from '@kitchen-erp/types';
import { getRecentItems, addRecentItem } from '@kitchen-erp/utils';

export interface CategorySelectorProps {
  id?: string;
  tenantId?: string | null;
  value?: string | null;
  onChange: (categoryId: string | null, category?: CategoryPublic | null) => void;
  categories?: CategoryPublic[]; // Preloaded categories list if available
  apiClient?: KitchenErpApi;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
  variant?: 'auto' | 'admin' | 'pwa';
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  id,
  tenantId,
  value,
  onChange,
  categories: initialCategories = [],
  apiClient,
  label = 'Category',
  placeholder = 'Select category...',
  disabled = false,
  required = false,
  onQuickAdd,
  quickAddLabel = '+ Add New Category',
  variant = 'auto',
}) => {
  const [items, setItems] = useState<CategoryPublic[]>(initialCategories);
  const client = apiClient || defaultApi;

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setItems(initialCategories);
    }
  }, [initialCategories]);

  const mapToOption = (c: CategoryPublic): SmartSelectOption<string> => ({
    value: c.id,
    label: c.name,
    icon: c.icon || (c.type === 'UTILITY_BILL' ? '⚡' : '📦'),
    data: c,
  });

  const recentRaw = getRecentItems<string>(tenantId, 'category');
  const recentOptions: SmartSelectOption<string>[] = recentRaw.map((r) => ({
    value: r.id,
    label: r.name,
    icon: r.icon || '🏷️',
  }));

  const handleServerSearch = useCallback(
    async (searchTerm: string): Promise<SmartSelectOption<string>[]> => {
      try {
        const res = await client.categories.list({
          search: searchTerm,
          isActive: true,
          limit: 20,
        });
        const list: CategoryPublic[] = Array.isArray(res.data)
          ? res.data
          : (res.data as any)?.data || [];
        return list.map(mapToOption);
      } catch {
        return [];
      }
    },
    [client]
  );

  const options = items.map(mapToOption);

  return (
    <SmartSelect<string>
      id={id}
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      onChange={(val, opt) => {
        if (opt?.data && tenantId) {
          addRecentItem(tenantId, 'category', {
            id: opt.data.id,
            name: opt.data.name,
            icon: opt.data.icon || '🏷️',
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
      title="Select Category"
    />
  );
};
