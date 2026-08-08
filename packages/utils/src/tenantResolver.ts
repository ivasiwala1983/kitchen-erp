/**
 * Multi-Tenant TenantResolver Utility
 * Supports both path-based routing (/t/{tenantSlug}) and subdomain-based routing ({tenantSlug}.domain.com).
 * Production-ready and future-proof for wildcard subdomains.
 */

export type TenantMode = 'path' | 'subdomain';

export interface ResolveTenantOptions {
  /**
   * Request URL path (e.g. '/t/badri/purchase' or '/api/purchases')
   */
  path?: string;

  /**
   * Request hostname or Host header (e.g. 'badri.kitchenerp.com' or 'localhost:4000')
   */
  host?: string;

  /**
   * Origin or Referer header URL
   */
  originOrReferer?: string;

  /**
   * Explicit X-Tenant-Slug header value
   */
  headerSlug?: string;

  /**
   * Tenant resolution mode: 'path' or 'subdomain'. Defaults to 'path'.
   */
  mode?: TenantMode;

  /**
   * User JWT tenant slug (if authenticated)
   */
  jwtTenantSlug?: string;
}

export interface GetTenantUrlOptions {
  mode?: TenantMode;
  baseUrl?: string;
}

const NON_TENANT_PREFIXES = [
  'localhost',
  'lvh',
  'www',
  '127',
  '0',
  'vercel',
  'kitchen-erp-admin',
  'kitchen-erp-pwa',
  'kitchen-erp-api',
  'admin',
  'api',
  'app',
];

export class TenantResolver {
  /**
   * Extract tenant slug from a URL path.
   * Matches paths starting with /t/{tenantSlug}
   */
  static extractSlugFromPath(path?: string): string | undefined {
    if (!path) return undefined;
    const match = path.match(/^\/t\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const slug = match[1].toLowerCase().trim();
      if (!NON_TENANT_PREFIXES.includes(slug)) {
        return slug;
      }
    }
    return undefined;
  }

  /**
   * Extract tenant slug from a hostname.
   * Handles custom subdomains, badri.localhost, badri.lvh.me, etc.
   */
  static extractSlugFromHost(host?: string): string | undefined {
    if (!host) return undefined;
    const cleanHost = host.split(':')[0].toLowerCase().trim();

    if (cleanHost.endsWith('.vercel.app')) {
      const parts = cleanHost.split('.');
      if (
        parts.length > 2 &&
        !NON_TENANT_PREFIXES.includes(parts[0]) &&
        !parts[0].startsWith('kitchen-erp')
      ) {
        return parts[0];
      }
      return undefined;
    }

    const parts = cleanHost.split('.');
    if (
      parts.length > 1 &&
      !NON_TENANT_PREFIXES.includes(parts[0]) &&
      !parts[0].startsWith('kitchen-erp')
    ) {
      return parts[0];
    }

    return undefined;
  }

  /**
   * Extract tenant slug from Origin or Referer header URL
   */
  static extractSlugFromUrl(urlStr?: string, mode: TenantMode = 'path'): string | undefined {
    if (!urlStr) return undefined;
    try {
      const parsed = new URL(urlStr);
      if (mode === 'path') {
        const pathSlug = this.extractSlugFromPath(parsed.pathname);
        if (pathSlug) return pathSlug;
      }
      return this.extractSlugFromHost(parsed.hostname);
    } catch {
      return undefined;
    }
  }

  /**
   * Main tenant resolution engine.
   * Order of precedence:
   * 1. Header `X-Tenant-Slug` (if provided explicitly)
   * 2. Path (`/t/{tenantSlug}`) if mode === 'path'
   * 3. Host / Subdomain if mode === 'subdomain'
   * 4. JWT authenticated user's tenantSlug
   * 5. Fallback path/host checks
   */
  static resolveTenantSlug(options: ResolveTenantOptions): string | undefined {
    const mode = options.mode || (process.env.TENANT_MODE as TenantMode) || 'path';

    // 1. Explicit Header Override
    if (options.headerSlug && options.headerSlug.trim()) {
      const slug = options.headerSlug.trim().toLowerCase();
      if (!NON_TENANT_PREFIXES.includes(slug) && !slug.startsWith('kitchen-erp')) {
        return slug;
      }
    }

    // 2. Resolution based on configured mode
    if (mode === 'path') {
      const pathSlug = this.extractSlugFromPath(options.path);
      if (pathSlug) return pathSlug;

      if (options.originOrReferer) {
        const urlSlug = this.extractSlugFromUrl(options.originOrReferer, 'path');
        if (urlSlug) return urlSlug;
      }
    } else if (mode === 'subdomain') {
      const hostSlug = this.extractSlugFromHost(options.host);
      if (hostSlug) return hostSlug;

      if (options.originOrReferer) {
        const urlSlug = this.extractSlugFromUrl(options.originOrReferer, 'subdomain');
        if (urlSlug) return urlSlug;
      }
    }

    // 3. Authenticated JWT Tenant Slug
    if (options.jwtTenantSlug && options.jwtTenantSlug.trim()) {
      return options.jwtTenantSlug.trim().toLowerCase();
    }

    // 4. Fallback checks across modes for resilience
    const fallbackPathSlug = this.extractSlugFromPath(options.path);
    if (fallbackPathSlug) return fallbackPathSlug;

    const fallbackHostSlug = this.extractSlugFromHost(options.host);
    if (fallbackHostSlug) return fallbackHostSlug;

    return undefined;
  }

  /**
   * Construct tenant-specific URL based on routing mode.
   */
  static getTenantUrl(
    tenantSlug: string,
    path: string = '',
    options?: GetTenantUrlOptions
  ): string {
    const mode = options?.mode || (process.env.TENANT_MODE as TenantMode) || 'path';
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const slug = tenantSlug.toLowerCase().trim();

    if (mode === 'path') {
      const baseUrl = (options?.baseUrl || process.env.PWA_BASE_URL || '').replace(/\/+$/, '');
      if (cleanPath.startsWith('/t/')) {
        return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
      }
      const targetPath = cleanPath === '/' ? `/t/${slug}` : `/t/${slug}${cleanPath}`;
      return baseUrl ? `${baseUrl}${targetPath}` : targetPath;
    } else {
      const baseDomain = process.env.APP_DOMAIN || 'kitchenerp.com';
      const protocol = options?.baseUrl?.startsWith('https') ? 'https' : 'http';
      return `${protocol}://${slug}.${baseDomain}${cleanPath}`;
    }
  }
}
