/**
 * Kitchen ERP — Express Application
 * Registers all middleware, routes, and error handlers.
 */

import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';

import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// ── Route Modules ─────────────────────────────────────────────
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

// ── App Setup ─────────────────────────────────────────────────

const app = express();

// Security
app.use(helmet());

// CORS with Subdomain Support
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // In development or testing: allow any localhost port or wildcard subdomains (*.localhost, *.lvh.me)
      if (
        config.isDev ||
        origin.includes('localhost') ||
        origin.includes('lvh.me') ||
        config.corsOrigin.some((allowed) => origin.includes(allowed))
      ) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Stricter rate limit on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts.' },
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

// Static file serving (local invoice uploads)
if (config.seaweedFallbackLocal) {
  app.use('/uploads', express.static(path.resolve(config.uploadsDir)));
}

// ── Routes ────────────────────────────────────────────────────

const api = config.apiPrefix;

// Health check (public)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Auth (mixed: login is public, others protected)
app.use(`${api}/auth`, authLimiter, authRoutes);

// Tenant management (SUPER_ADMIN only)
app.use(`${api}/tenants`, tenantRoutes);

// User management (SUPER_ADMIN + TENANT_ADMIN)
app.use(`${api}/users`, usersRoutes);

// Category Master (TENANT_ADMIN + INVENTORY_MANAGER read)
app.use(`${api}/categories`, categoryRoutes);

// Vendors (TENANT_ADMIN + read for INVENTORY_MANAGER)
app.use(`${api}/vendors`, vendorRoutes);

// Products (TENANT_ADMIN + read for INVENTORY_MANAGER)
app.use(`${api}/products`, productRoutes);

// Purchases (all roles)
app.use(`${api}/purchases`, purchaseRoutes);

// Invoice upload/download (nested under purchases)
app.use(`${api}/purchases/:id`, invoiceRoutes);

// Reports (TENANT_ADMIN)
app.use(`${api}/reports`, reportsRoutes);

// Audit Logs (TENANT_ADMIN)
app.use(`${api}/audit-logs`, auditLogRoutes);

// ── Error Handling ────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
