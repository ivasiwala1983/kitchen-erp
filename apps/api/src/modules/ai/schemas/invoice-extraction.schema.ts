import { z } from 'zod';

const nullableString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => val ?? null);
const nullableNumber = z
  .number()
  .nullable()
  .optional()
  .transform((val) => val ?? null);

export const extractedLineItemSchema = z.object({
  productName: z.string(),
  description: nullableString,
  quantity: nullableNumber,
  unit: nullableString,
  unitPrice: nullableNumber,
  lineTotal: nullableNumber,
  tax: nullableNumber,
  discount: nullableNumber,
});

export const extractedInvoiceHeaderSchema = z.object({
  invoiceNumber: nullableString,
  invoiceDate: nullableString,
  vendorName: nullableString,
  vendorAddress: nullableString,
  vendorPhone: nullableString,
  vendorEmail: nullableString,
  currency: nullableString,
  subtotal: nullableNumber,
  tax: nullableNumber,
  discount: nullableNumber,
  grandTotal: nullableNumber,
});

export const structuredInvoiceExtractionSchema = z.object({
  invoice: extractedInvoiceHeaderSchema,
  items: z.array(extractedLineItemSchema).default([]),
  isUtilityBill: z.boolean().default(false),
  billMonth: nullableString,
  billAmount: nullableNumber,
  notes: nullableString,
});

export type ExtractedLineItem = z.infer<typeof extractedLineItemSchema>;
export type ExtractedInvoiceHeader = z.infer<typeof extractedInvoiceHeaderSchema>;
export type StructuredInvoiceExtraction = z.infer<typeof structuredInvoiceExtractionSchema>;
