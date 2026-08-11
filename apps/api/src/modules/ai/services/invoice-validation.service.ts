/**
 * Invoice Validation & Duplicate Detection Service
 * Performs strict deterministic financial calculations and database checks.
 */

import { purchaseRepository } from '@kitchen-erp/database';
import type { MatchedProductItem } from './invoice-matching.service';
import type { ExtractedInvoiceHeader } from '../schemas/invoice-extraction.schema';

export interface LineItemValidationResult {
  index: number;
  productName: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  computedTotal: number | null;
  hasMismatch: boolean;
  message?: string;
}

export interface TotalsValidationResult {
  isValid: boolean;
  computedItemsTotal: number;
  computedGrandTotal: number;
  extractedGrandTotal: number | null;
  tax: number;
  discount: number;
  discrepancyMessage?: string;
  itemMismatches: LineItemValidationResult[];
}

export interface DuplicateCheckResult {
  isPossibleDuplicate: boolean;
  existingPurchaseId?: string;
  existingPurchaseDate?: string;
  existingGrandTotal?: number;
  warningMessage?: string;
}

export class InvoiceValidationService {
  /**
   * Validates line item math and invoice total consistency in pure TypeScript
   */
  public validateTotals(
    header: Partial<ExtractedInvoiceHeader>,
    items: MatchedProductItem[],
    isUtilityBill: boolean = false
  ): TotalsValidationResult {
    const itemMismatches: LineItemValidationResult[] = [];
    let computedItemsTotal = 0;

    if (!isUtilityBill && items && items.length > 0) {
      items.forEach((item, index) => {
        const qty = item.quantity ?? 0;
        const price = item.unitPrice ?? 0;
        const total = item.lineTotal ?? qty * price;

        computedItemsTotal += total;

        let hasMismatch = false;
        let message: string | undefined;

        if (qty > 0 && price > 0 && item.lineTotal !== null && item.lineTotal !== undefined) {
          const expected = qty * price;
          // Allow minor rounding difference (e.g. within 0.5)
          if (Math.abs(expected - item.lineTotal) > 0.5) {
            hasMismatch = true;
            message = `Line total ${item.lineTotal} does not match Qty (${qty}) × Price (${price}) = ${expected.toFixed(2)}`;
          }
        }

        if (hasMismatch) {
          itemMismatches.push({
            index,
            productName: item.extractedName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            computedTotal: qty * price,
            hasMismatch: true,
            message,
          });
        }
      });
    }

    const tax = header.tax ?? 0;
    const discount = header.discount ?? 0;
    const extractedGrandTotal = header.grandTotal ?? null;

    const baseAmount = isUtilityBill ? (header.grandTotal ?? 0) : computedItemsTotal;
    const computedGrandTotal = baseAmount + tax - discount;

    let isValid = true;
    let discrepancyMessage: string | undefined;

    if (extractedGrandTotal !== null && extractedGrandTotal > 0) {
      if (Math.abs(computedGrandTotal - extractedGrandTotal) > 1.0) {
        isValid = false;
        discrepancyMessage = `Invoice grand total (${extractedGrandTotal}) does not match calculated total (${computedGrandTotal.toFixed(2)}: items ${computedItemsTotal.toFixed(2)} + tax ${tax} - discount ${discount})`;
      }
    }

    return {
      isValid: isValid && itemMismatches.length === 0,
      computedItemsTotal,
      computedGrandTotal,
      extractedGrandTotal,
      tax,
      discount,
      discrepancyMessage,
      itemMismatches,
    };
  }

  /**
   * Checks database for possible duplicate invoice under same tenant & vendor/invoiceNumber
   */
  public async checkDuplicateInvoice(
    tenantId: string,
    vendorId: string | null,
    invoiceNumber: string | null
  ): Promise<DuplicateCheckResult> {
    if (!vendorId || !invoiceNumber || !invoiceNumber.trim()) {
      return { isPossibleDuplicate: false };
    }

    const cleanInvoiceNo = invoiceNumber.trim();

    try {
      // Find purchases for this tenant & vendor
      const { items: vendorPurchases } = await purchaseRepository.findAll(tenantId, {
        vendorId,
        skip: 0,
        take: 50,
      });

      // Check if notes or invoice metadata contains invoice number
      const existing = vendorPurchases.find((p) => {
        const notesMatch = p.notes && p.notes.toLowerCase().includes(cleanInvoiceNo.toLowerCase());
        const fileNameMatch =
          p.invoiceFileName &&
          p.invoiceFileName.toLowerCase().includes(cleanInvoiceNo.toLowerCase());
        return Boolean(notesMatch || fileNameMatch);
      });

      if (existing) {
        return {
          isPossibleDuplicate: true,
          existingPurchaseId: existing.id,
          existingPurchaseDate: existing.purchaseDate
            ? existing.purchaseDate.toISOString()
            : undefined,
          existingGrandTotal: Number(existing.grandTotal),
          warningMessage: `⚠️ An invoice with number '${cleanInvoiceNo}' may already have been added for this vendor (Purchase ID: ${existing.id.slice(0, 8)}...).`,
        };
      }
    } catch {
      // Non-blocking fallback
    }

    return { isPossibleDuplicate: false };
  }
}

export const invoiceValidationService = new InvoiceValidationService();
