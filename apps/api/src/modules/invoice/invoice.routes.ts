/**
 * Invoice Module — Managed via StorageProvider (Supabase Storage) & PostgreSQL metadata.
 * Implements private bucket signed URLs, tenant isolation, file validation, and compensating cleanup.
 */

import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { purchaseRepository, invoiceRepository } from '@kitchen-erp/database';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { uploadInvoice } from '../../middleware/upload.middleware';
import { sendSuccess } from '../../shared/response';
import { NotFoundError, BadRequestError, InternalServerError } from '../../shared/errors';
import type { AuthenticatedRequest } from '../../shared/types';
import { Role } from '@kitchen-erp/types';
import { getStorageProvider } from '../../storage';
import { recordAuditLog } from '../auditLog/auditLog.routes';

const router: Router = Router({ mergeParams: true });

// Allowed file formats & size limits
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/purchases/:id/invoice
 * Upload invoice file to Supabase Storage and save metadata in PostgreSQL
 */
router.post(
  '/invoice',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  resolveTenant,
  requireTenant,
  uploadInvoice,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const purchaseId = String(req.params.id);

      if (!req.file) {
        throw new BadRequestError('No file uploaded. Use field name "invoice".');
      }

      // File validation
      if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
        throw new BadRequestError(
          `Unsupported MIME type: ${req.file.mimetype}. Allowed: PDF, JPG, PNG, WEBP.`
        );
      }

      if (req.file.size > MAX_FILE_SIZE) {
        throw new BadRequestError(
          `File size exceeds limit of 10 MB. Received: ${(req.file.size / 1024 / 1024).toFixed(2)} MB.`
        );
      }

      const purchase = await purchaseRepository.findById(purchaseId, authReq.tenantId);
      if (!purchase) {
        throw new NotFoundError('Purchase not found');
      }

      const oldStoragePath = purchase.invoiceStoragePath;
      const invoiceId = uuidv4();
      const ext = path.extname(req.file.originalname) || '.pdf';
      const storagePath = `invoices/${authReq.tenantId}/${purchaseId}/${invoiceId}${ext}`;

      const storage = getStorageProvider();

      // Step 1: Upload binary to Supabase Storage
      try {
        await storage.upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });
      } catch (err: any) {
        console.error('❌ Storage upload error:', err);
        throw new InternalServerError(`Failed to upload invoice to storage: ${err.message}`);
      }

      const uploadedAt = new Date();
      const invoiceApiUrl = `/api/purchases/${purchaseId}/invoice`;

      // Step 2: Update PostgreSQL metadata
      try {
        await invoiceRepository.updateInvoice(purchaseId, authReq.tenantId, {
          invoiceStoragePath: storagePath,
          invoiceFileName: req.file.originalname,
          invoiceMimeType: req.file.mimetype,
          invoiceSize: req.file.size,
          invoiceUploadedAt: uploadedAt,
          invoiceUploadedBy: authReq.user.sub,
          invoiceUrl: invoiceApiUrl,
        });
      } catch (dbErr: any) {
        console.error(
          '❌ Database update failed. Attempting compensating cleanup on storage path:',
          storagePath
        );
        // Compensating Cleanup
        try {
          await storage.delete(storagePath);
        } catch (cleanupErr) {
          console.error('⚠️ Failed to cleanup orphaned storage object:', storagePath, cleanupErr);
        }
        throw new InternalServerError(
          'Database metadata update failed. Storage upload rolled back.'
        );
      }

      // Cleanup old invoice object if replacing
      if (oldStoragePath && oldStoragePath !== storagePath) {
        storage.delete(oldStoragePath).catch((err) => {
          console.warn(
            '⚠️ Non-critical: Failed to remove old invoice file from storage:',
            oldStoragePath,
            err
          );
        });
      }

      // Audit Log
      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: oldStoragePath ? 'REPLACE_INVOICE' : 'UPLOAD_INVOICE',
        entity: 'Purchase',
        entityId: purchaseId,
        newValues: {
          invoiceStoragePath: storagePath,
          invoiceFileName: req.file.originalname,
          invoiceSize: req.file.size,
        },
      });

      // Step 3: Generate short-lived signed URL (300 seconds / 5 min)
      const signedUrl = await storage.getSignedUrl(storagePath, 300);

      sendSuccess(
        res,
        {
          purchaseId,
          storagePath,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          uploadedAt,
          signedUrl,
          invoiceUrl: invoiceApiUrl,
        },
        'Invoice uploaded successfully'
      );
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /api/purchases/:id/invoice
 * Retrieve signed URL and metadata for viewing/downloading invoice
 */
router.get(
  '/invoice',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  resolveTenant,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const purchaseId = String(req.params.id);

      const purchase = await purchaseRepository.findById(purchaseId, authReq.tenantId);
      if (!purchase) {
        throw new NotFoundError('Purchase not found');
      }

      if (!purchase.invoiceStoragePath) {
        // Fallback for legacy invoiceUrl if present
        if (purchase.invoiceUrl && purchase.invoiceUrl.startsWith('http')) {
          res.redirect(purchase.invoiceUrl);
          return;
        }
        throw new NotFoundError('No invoice attached to this purchase');
      }

      const storage = getStorageProvider();
      const signedUrl = await storage.getSignedUrl(purchase.invoiceStoragePath, 300);

      // Support direct redirect for browser tab navigation (?redirect=true, ?token=..., or Accept: text/html)
      const acceptsHtml = req.headers.accept?.includes('text/html');
      const hasDirectQuery =
        req.query.redirect === 'true' || req.query.redirect === '1' || Boolean(req.query.token);
      if (acceptsHtml || hasDirectQuery) {
        res.redirect(signedUrl);
        return;
      }

      sendSuccess(res, {
        purchaseId: purchase.id,
        fileName: purchase.invoiceFileName,
        mimeType: purchase.invoiceMimeType,
        size: purchase.invoiceSize,
        uploadedAt: purchase.invoiceUploadedAt,
        signedUrl,
        invoiceUrl: `/api/purchases/${purchase.id}/invoice`,
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * DELETE /api/purchases/:id/invoice
 * Delete invoice object from storage and clear PostgreSQL metadata
 */
router.delete(
  '/invoice',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN),
  resolveTenant,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const purchaseId = String(req.params.id);

      const purchase = await purchaseRepository.findById(purchaseId, authReq.tenantId);
      if (!purchase) {
        throw new NotFoundError('Purchase not found');
      }

      if (!purchase.invoiceStoragePath) {
        throw new NotFoundError('No invoice attached to this purchase to delete');
      }

      const storage = getStorageProvider();

      // Delete from storage
      try {
        await storage.delete(purchase.invoiceStoragePath);
      } catch (err: any) {
        console.warn('⚠️ Warning during storage file deletion:', err.message);
      }

      // Clear metadata in DB
      await invoiceRepository.removeInvoice(purchaseId, authReq.tenantId, authReq.user.sub);

      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: 'DELETE_INVOICE',
        entity: 'Purchase',
        entityId: purchaseId,
      });

      sendSuccess(res, null, 'Invoice deleted successfully');
    } catch (e) {
      next(e);
    }
  }
);

export default router;
