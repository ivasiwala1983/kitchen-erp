/**
 * InvoiceRepository
 * Handles invoice attachments for purchases.
 */

import { Purchase } from '../generated/client';
import { prisma } from '../client/prisma';

export class InvoiceRepository {
  async updateInvoice(
    purchaseId: string,
    tenantId: string,
    invoiceUrl: string,
    invoiceFid?: string,
    updatedBy?: string
  ): Promise<Purchase> {
    return prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        invoiceUrl,
        invoiceFid: invoiceFid || null,
        ...(updatedBy && { updatedBy }),
      },
    });
  }

  async removeInvoice(purchaseId: string, tenantId: string, updatedBy?: string): Promise<Purchase> {
    return prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        invoiceUrl: null,
        invoiceFid: null,
        ...(updatedBy && { updatedBy }),
      },
    });
  }
}

export const invoiceRepository = new InvoiceRepository();
