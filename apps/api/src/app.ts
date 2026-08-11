/**
 * Kitchen ERP — Express Application
 * Registers all middleware, routes, and error handlers.
 */

import 'express-async-errors';
import express, { RequestHandler } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// ── Route Modules ─────────────────────────────────────────────
import healthRoutes from './modules/health/health.routes';
import authRoutes from './modules/auth/auth.routes';
import tenantRoutes from './modules/tenant/tenant.routes';
import usersRoutes from './modules/users/users.routes';
import categoryRoutes from './modules/category/category.routes';
import vendorRoutes from './modules/vendor/vendor.routes';
import productRoutes from './modules/product/product.routes';
import purchaseRoutes from './modules/purchase/purchase.routes';
import invoiceRoutes from './modules/invoice/invoice.routes';
import reportsRoutes from './modules/reports/reports.routes';
import auditLogRoutes from './modules/auditLog/auditLog.routes';
import ledgerRoutes from './modules/ledger/ledger.routes';
import aiRoutes from './modules/ai/ai.routes';
import featureRoutes from './modules/feature/feature.routes';
import invoiceIntelligenceRoutes from './modules/ai/routes/invoice-intelligence.routes';

// ── App Setup ─────────────────────────────────────────────────

const app = express();

// Top-level CORS handling

// 1. Top-Level CORS & OPTIONS Preflight Handling (Runs before helmet and rate-limiters)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Tenant-Slug, Accept, X-Requested-With, Origin'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// 2. Security Headers
app.use(helmet());

// Rate limiting (skips OPTIONS preflight and /health checks)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => req.method === 'OPTIONS' || req.path === '/health' || req.path === '/api/health',
});
app.use(limiter);

// Stricter rate limit on auth endpoints (skips OPTIONS preflight)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many login attempts.' },
  skip: (req) => req.method === 'OPTIONS',
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ── Routes ────────────────────────────────────────────────────

const api = config.apiPrefix;

// Helper to mount routes under both /api/path and /path
const mountRoute = (routePath: string, ...handlers: (RequestHandler | express.Router)[]) => {
  if (routePath.startsWith('/')) {
    app.use(routePath, ...handlers);
  }
  app.use(`${api}${routePath.startsWith('/') ? '' : '/'}${routePath}`, ...handlers);
};

// Health check (public)
mountRoute('/health', healthRoutes);

// Auth (mixed: login is public, others protected)
mountRoute('/auth', authLimiter, authRoutes);

// Tenant management (Public lookup + SUPER_ADMIN CRUD)
mountRoute('/tenant', tenantRoutes);
mountRoute('/tenants', tenantRoutes);

// User management (SUPER_ADMIN + TENANT_ADMIN)
mountRoute('/users', usersRoutes);

// Category Master (TENANT_ADMIN + INVENTORY_MANAGER read)
mountRoute('/categories', categoryRoutes);

// Vendors (TENANT_ADMIN + read for INVENTORY_MANAGER)
mountRoute('/vendors', vendorRoutes);

// Products (TENANT_ADMIN + read for INVENTORY_MANAGER)
mountRoute('/products', productRoutes);

// Purchases (all roles)
mountRoute('/purchases', purchaseRoutes);

// Invoice Intelligence processing
mountRoute('/purchases/invoice-intelligence', invoiceIntelligenceRoutes);

// Invoice upload/download (nested under purchases)
mountRoute('/purchases/:id', invoiceRoutes);

// Reports (TENANT_ADMIN)
mountRoute('/reports', reportsRoutes);

// Audit Logs (TENANT_ADMIN)
mountRoute('/audit-logs', auditLogRoutes);

// Vendor Ledger & Payments
mountRoute('/ledger', ledgerRoutes);

// ArgusOne AI Assistant
mountRoute('/ai', aiRoutes);

// Centralized Tenant Feature Entitlements
mountRoute('/features', featureRoutes);

// ── Error Handling ────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
