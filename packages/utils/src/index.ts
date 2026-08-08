/**
 * @kitchen-erp/utils
 * Shared utility functions for date formatting, currency,
 * pagination, and other common operations.
 */

// ── Date Utilities ────────────────────────────────────────────

/**
 * Format a date to YYYY-MM-DD string
 */
export function formatDate(date?: Date | string | null): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toISOString().split('T')[0];
}

/**
 * Format a datetime for display (e.g. "07 Aug 2026, 3:30 PM")
 */
export function formatDateTime(date?: Date | string | null): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get start and end of a given date
 */
export function getDayRange(date: Date | string): { start: Date; end: Date } {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

/**
 * Get start and end of a given month
 */
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Get date N days ago
 */
export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Currency Utilities ────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED',
  SAR: 'SAR',
  CAD: 'CA$',
  AUD: 'A$',
  SGD: 'S$',
  QAR: 'QR',
  OMR: 'OMR',
  KWD: 'KD',
  BHD: 'BD',
  JPY: '¥',
  CNY: '¥',
};

/**
 * Get currency symbol for a given currency code (default: INR -> ₹)
 */
export function getCurrencySymbol(currencyCode?: string): string {
  if (!currencyCode) return '₹';
  const code = currencyCode.toUpperCase();
  return CURRENCY_SYMBOLS[code] || code;
}

/**
 * Format a number using a dynamic tenant currency code (default: INR)
 */
export function formatCurrency(amount: number | string, currencyCode: string = 'INR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${getCurrencySymbol(currencyCode)} 0.00`;

  const code = (currencyCode || 'INR').toUpperCase();
  try {
    const localeMap: Record<string, string> = {
      INR: 'en-IN',
      USD: 'en-US',
      EUR: 'de-DE',
      GBP: 'en-GB',
      AED: 'ar-AE',
      SAR: 'ar-SA',
      CAD: 'en-CA',
      AUD: 'en-AU',
    };
    const locale = localeMap[code] || 'en-US';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    const symbol = getCurrencySymbol(code);
    return `${symbol} ${num.toFixed(2)}`;
  }
}

/**
 * Round a number to 2 decimal places
 */
export function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ── Pagination Utilities ──────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Calculate pagination metadata
 */
export function getPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Parse page/limit from query params with safe defaults
 */
export function parsePagination(
  page?: string | number,
  limit?: string | number
): { page: number; limit: number; skip: number } {
  const p = Math.max(1, parseInt(String(page || 1), 10));
  const l = Math.min(100, Math.max(1, parseInt(String(limit || 20), 10)));
  return { page: p, limit: l, skip: (p - 1) * l };
}

// ── String Utilities ──────────────────────────────────────────

/**
 * Slugify a string (for tenant slugs)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Capitalize first letter of each word
 */
export function titleCase(text: string): string {
  return text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

/**
 * Truncate text to maxLength with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ── Number Utilities ──────────────────────────────────────────

/**
 * Calculate total from qty and rate
 */
export function calculateTotal(qty: number, rate: number): number {
  return roundAmount(qty * rate);
}

/**
 * Calculate grand total from an array of items
 */
export function calculateGrandTotal(items: { qty: number; rate: number }[]): number {
  return roundAmount(items.reduce((sum, item) => sum + item.qty * item.rate, 0));
}

// ── Validation Utilities ──────────────────────────────────────

/**
 * Check if a string is a valid UUID v4
 */
export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Check if a string is a valid email
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Check password strength (min 8 chars, 1 uppercase, 1 lowercase, 1 digit)
 */
export function isStrongPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
}

// ── Object Utilities ──────────────────────────────────────────

/**
 * Strip undefined/null values from an object (for partial updates)
 */
export function cleanObject<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  ) as Partial<T>;
}

/**
 * Pick specific keys from an object
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce(
    (acc, key) => {
      if (key in obj) acc[key] = obj[key];
      return acc;
    },
    {} as Pick<T, K>
  );
}

/**
 * Omit specific keys from an object
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result as Omit<T, K>;
}
