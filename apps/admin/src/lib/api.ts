/**
 * Admin Portal — API Client singleton
 * Used by all admin pages to communicate with the backend.
 */

import { KitchenErpApi } from '@kitchen-erp/api-client';

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = rawApiUrl.replace(/\/+$/, '');

export const api = new KitchenErpApi({
  baseURL: API_URL,
  onUnauthorized: () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },
});
