/**
 * InvoiceRepository
 * Handles invoice attachments for purchases.
 */

import { Purchase } from '@prisma/client';
import { prisma } from '../client/prisma';

export interface UpdateInvoiceMetadataDto {
  invoiceUrl?: string;
  invoiceFid?: string;
  invoiceStoragePath: string;
  invoiceFileName: string;
  invoiceMimeType: string;
  invoiceSize: number;
  invoiceUploadedAt?: Date;
  invoiceUploadedBy?: string;
}

export class InvoiceRepository {
  async updateInvoice(
    purchaseId: string,
    tenantId: string,
    metadata: UpdateInvoiceMetadataDto
  ): Promise<Purchase> {
    return prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        invoiceStoragePath: metadata.invoiceStoragePath,
        invoiceFileName: metadata.invoiceFileName,
        invoiceMimeType: metadata.invoiceMimeType,
        invoiceSize: metadata.invoiceSize,
        invoiceUploadedAt: metadata.invoiceUploadedAt || new Date(),
        invoiceUploadedBy: metadata.invoiceUploadedBy || null,
        invoiceUrl: metadata.invoiceUrl || null,
        invoiceFid: metadata.invoiceFid || null,
        ...(metadata.invoiceUploadedBy && { updatedBy: metadata.invoiceUploadedBy }),
      },
    });
  }

  async removeInvoice(purchaseId: string, tenantId: string, updatedBy?: string): Promise<Purchase> {
    return prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        invoiceUrl: null,
        invoiceFid: null,
        invoiceStoragePath: null,
        invoiceFileName: null,
        invoiceMimeType: null,
        invoiceSize: null,
        invoiceUploadedAt: null,
        invoiceUploadedBy: null,
        ...(updatedBy && { updatedBy }),
      },
    });
  }
}

export const invoiceRepository = new InvoiceRepository();
