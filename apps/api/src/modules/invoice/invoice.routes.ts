/**
 * Invoice Module — File upload/download proxy for SeaweedFS or local filesystem.
 *
 * Endpoints:
 *   POST /api/purchases/:id/invoice — Upload invoice (multipart/form-data)
 *   GET  /api/purchases/:id/invoice — Download/redirect to invoice
 */

import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { resolveTenant, requireTenant } from '../../middleware/tenant.middleware';
import { uploadInvoice } from '../../middleware/upload.middleware';
import { sendSuccess } from '../../shared/response';
import { NotFoundError, InternalServerError } from '../../shared/errors';
import type { AuthenticatedRequest } from '../../shared/types';
import { config } from '../../config/env';
import { Role } from '@kitchen-erp/types';
import prisma from '../../config/database';

const router: Router = Router({ mergeParams: true });

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
        throw new NotFoundError('No file uploaded. Use field name "invoice".');
      }

      const purchase = await prisma.purchase.findFirst({
        where: { id: purchaseId, tenantId: authReq.tenantId, deletedAt: null },
      });
      if (!purchase) throw new NotFoundError('Purchase not found');

      let invoiceUrl: string;
      let invoiceFid: string | undefined;

      if (config.seaweedFallbackLocal) {
        const ext = path.extname(req.file.originalname || '.jpg');
        const filename = `${purchaseId}${ext}`;
        const targetDir = path.resolve(config.uploadsDir);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        const uploadPath = path.join(targetDir, filename);

        fs.writeFileSync(uploadPath, req.file.buffer);

        // Build absolute URL using backend API host
        const host = req.get('host') || `localhost:${config.port}`;
        const protocol = req.protocol || 'http';
        invoiceUrl = `${protocol}://${host}/uploads/${filename}`;
      } else {
        try {
          const assignRes = await axios.get<{ fid: string; url: string }>(
            `${config.seaweedMasterUrl}/dir/assign`
          );
          const { fid, url } = assignRes.data;

          const formData = new FormData();
          formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
          });
          await axios.post(`http://${url}/${fid}`, formData, {
            headers: formData.getHeaders(),
          });

          invoiceFid = fid;
          invoiceUrl = `${config.seaweedPublicUrl}/${fid}`;
        } catch (seaweedErr) {
          throw new InternalServerError('Failed to upload to SeaweedFS.');
        }
      }

      await prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          invoiceUrl,
          ...(invoiceFid && { invoiceFid }),
          updatedBy: authReq.user.sub,
        },
      });

      sendSuccess(res, { invoiceUrl }, 'Invoice uploaded successfully');
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/invoice',
  authenticate,
  authorize(Role.SUPER_ADMIN, Role.TENANT_ADMIN, Role.INVENTORY_MANAGER),
  resolveTenant,
  requireTenant,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const purchase = await prisma.purchase.findFirst({
        where: { id: String(req.params.id), tenantId: authReq.tenantId, deletedAt: null },
        select: { invoiceUrl: true },
      });
      if (!purchase) throw new NotFoundError('Purchase not found');
      if (!purchase.invoiceUrl) throw new NotFoundError('No invoice uploaded for this purchase');

      // Normalize relative URL if stored as /uploads/...
      let redirectUrl = purchase.invoiceUrl;
      if (redirectUrl.startsWith('/')) {
        const host = req.get('host') || `localhost:${config.port}`;
        const protocol = req.protocol || 'http';
        redirectUrl = `${protocol}://${host}${redirectUrl}`;
      }

      res.redirect(redirectUrl);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
