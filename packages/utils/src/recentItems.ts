/**
 * Recent items utility for Smart Selector.
 * Lightweight local storage helper scoped by tenant and entity type.
 */

export interface RecentItem<T = string> {
  id: T;
  name: string;
  sublabel?: string;
  icon?: string;
  timestamp: number;
}

const STORAGE_PREFIX = 'argusone_recent_';

export function getRecentItems<T = string>(
  tenantId: string | null | undefined,
  entityKey: string,
  maxItems = 5
): RecentItem<T>[] {
  if (typeof window === 'undefined' || !tenantId || !entityKey) return [];
  try {
    const key = `${STORAGE_PREFIX}${tenantId}_${entityKey}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, maxItems);
  } catch {
    return [];
  }
}

export function addRecentItem<T = string>(
  tenantId: string | null | undefined,
  entityKey: string,
  item: { id: T; name: string; sublabel?: string; icon?: string },
  maxItems = 5
): void {
  if (typeof window === 'undefined' || !tenantId || !entityKey || !item?.id) return;
  try {
    const key = `${STORAGE_PREFIX}${tenantId}_${entityKey}`;
    const existing = getRecentItems<T>(tenantId, entityKey, 20);
    const filtered = existing.filter((x) => String(x.id) !== String(item.id));
    const newItem: RecentItem<T> = {
      id: item.id,
      name: item.name,
      sublabel: item.sublabel,
      icon: item.icon,
      timestamp: Date.now(),
    };
    const updated = [newItem, ...filtered].slice(0, maxItems);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // Ignore storage quota or disabled localStorage errors
  }
}
