/**
 * Invoice Intelligence Routes
 * Handlers for uploading and processing supplier invoices with FREE AI & OCR.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { authorize } from '../../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../../middleware/tenant.middleware';
import { requireFeature } from '../../../middleware/feature.middleware';
import { uploadInvoice } from '../../../middleware/upload.middleware';
import { sendSuccess } from '../../../shared/response';
import { BadRequestError } from '../../../shared/errors';
import type { AuthenticatedRequest } from '../../../shared/types';
import { Role, FeatureCode } from '@kitchen-erp/types';
import { invoiceIntelligenceService } from '../services/invoice-intelligence.service';
import { recordAuditLog } from '../../auditLog/auditLog.routes';

const router: Router = Router();

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/purchases/invoice-intelligence/process
 * Upload supplier invoice file and run free OCR / AI extraction & candidate matching pipeline.
 */
router.post(
  '/process',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  resolveTenant,
  requireTenant,
  requireFeature(FeatureCode.FEATURE_INVOICE_UPLOAD),
  uploadInvoice,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;

      if (!req.file) {
        throw new BadRequestError('No file uploaded. Use field name "invoice".');
      }

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

      const result = await invoiceIntelligenceService.processInvoice(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
        authReq.tenantId
      );

      recordAuditLog({
        tenantId: authReq.tenantId,
        userId: authReq.user.sub,
        action: 'PROCESS_INVOICE_INTELLIGENCE',
        entity: 'Invoice',
        newValues: {
          originalFileName: req.file.originalname,
          fileSize: req.file.size,
          itemsExtracted: result.items.length,
          matchedVendor: result.vendorMatch.matchedVendorName,
          isUtilityBill: result.isUtilityBill,
        },
      });

      sendSuccess(res, result, 'Invoice extracted and matched successfully');
    } catch (e) {
      next(e);
    }
  }
);

export default router;
