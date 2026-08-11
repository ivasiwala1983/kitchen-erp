/**
 * ArgusOne Invoice Intelligence Service
 * Orchestrates document extraction, FREE AI model processing via OpenRouter,
 * product & vendor candidate matching, financial validation, and duplicate detection.
 * Strictly READ-ONLY (never writes purchases directly to database).
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { OpenRouterProvider } from '../providers/openrouter.provider';
import type { AIProvider, ChatMessage } from '../providers/ai.provider';
import { PromptInjectionGuard } from '../guardrails/promptInjection.guard';
import { invoiceDocumentReader } from './invoice-document-reader';
import {
  invoiceMatchingService,
  type MatchedVendorResult,
  type MatchedProductItem,
} from './invoice-matching.service';
import {
  invoiceValidationService,
  type TotalsValidationResult,
  type DuplicateCheckResult,
} from './invoice-validation.service';
import {
  structuredInvoiceExtractionSchema,
  type StructuredInvoiceExtraction,
} from '../schemas/invoice-extraction.schema';
import { getStorageProvider } from '../../../storage';

export interface InvoiceIntelligenceProcessResult {
  header: {
    invoiceNumber: string | null;
    invoiceDate: string | null;
    vendorName: string | null;
    vendorAddress: string | null;
    vendorPhone: string | null;
    vendorEmail: string | null;
    currency: string | null;
    subtotal: number | null;
    tax: number | null;
    discount: number | null;
    grandTotal: number | null;
  };
  vendorMatch: MatchedVendorResult;
  items: MatchedProductItem[];
  isUtilityBill: boolean;
  billMonth: string | null;
  billAmount: number | null;
  totalsValidation: TotalsValidationResult;
  duplicateCheck: DuplicateCheckResult;
  tempStoragePath: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
}

export class InvoiceIntelligenceService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || new OpenRouterProvider();
  }

  /**
   * Main pipeline to process invoice file
   */
  public async processInvoice(
    fileBuffer: Buffer,
    mimeType: string,
    originalFileName: string,
    tenantId: string
  ): Promise<InvoiceIntelligenceProcessResult> {
    // Step 1: Read and extract document text/image payload
    const doc = await invoiceDocumentReader.readDocument(fileBuffer, mimeType, originalFileName);

    // Step 2: Before-AI Guardrail (Prompt Injection Defense)
    if (doc.text && doc.text.length > 0) {
      const guardResult = PromptInjectionGuard.evaluate(doc.text);
      if (!guardResult.isSafe) {
        throw new Error(
          `Security Guardrail Violation: ${guardResult.message || 'Invoice content rejected.'}`
        );
      }
    }

    // Step 3: Call FREE AI Model via OpenRouter abstraction
    const extraction = await this.extractStructuredDataWithAI(doc);

    // Step 4: Product & Vendor Candidate Matching Engine
    const vendorMatch = await invoiceMatchingService.matchVendor(extraction.invoice, tenantId);
    const matchedItems = await invoiceMatchingService.matchProducts(extraction.items, tenantId);

    // Step 5: Financial Totals Validation (Application code)
    const totalsValidation = invoiceValidationService.validateTotals(
      extraction.invoice,
      matchedItems,
      extraction.isUtilityBill
    );

    // Step 6: Duplicate Invoice Detection
    const duplicateCheck = await invoiceValidationService.checkDuplicateInvoice(
      tenantId,
      vendorMatch.matchedVendorId,
      extraction.invoice.invoiceNumber || null
    );

    // Step 7: Save uploaded invoice binary to temporary Supabase Storage path
    const tempId = uuidv4();
    const ext = path.extname(originalFileName) || '.pdf';
    const tempStoragePath = `invoices/temp/${tenantId}/${tempId}${ext}`;

    try {
      const storage = getStorageProvider();
      await storage.upload(tempStoragePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });
    } catch (err) {
      console.warn('⚠️ Storage upload warning for temp invoice:', err);
    }

    return {
      header: {
        invoiceNumber: extraction.invoice.invoiceNumber || null,
        invoiceDate: extraction.invoice.invoiceDate || null,
        vendorName: extraction.invoice.vendorName || null,
        vendorAddress: extraction.invoice.vendorAddress || null,
        vendorPhone: extraction.invoice.vendorPhone || null,
        vendorEmail: extraction.invoice.vendorEmail || null,
        currency: extraction.invoice.currency || 'INR',
        subtotal: extraction.invoice.subtotal ?? null,
        tax: extraction.invoice.tax ?? null,
        discount: extraction.invoice.discount ?? null,
        grandTotal: extraction.invoice.grandTotal ?? null,
      },
      vendorMatch,
      items: matchedItems,
      isUtilityBill: extraction.isUtilityBill,
      billMonth: extraction.billMonth || null,
      billAmount: extraction.billAmount ?? null,
      totalsValidation,
      duplicateCheck,
      tempStoragePath,
      originalFileName,
      mimeType,
      fileSize: fileBuffer.length,
    };
  }

  /**
   * Private helper to invoke AI model and return validated structured extraction
   */
  private async extractStructuredDataWithAI(doc: {
    mimeType: string;
    text: string;
    base64Image?: string;
  }): Promise<StructuredInvoiceExtraction> {
    const systemPrompt = `You are an expert AI Invoice Processing Engine for ArgusOne ERP.
Your role is to read the provided supplier invoice document and extract structured JSON matching this exact schema:

{
  "invoice": {
    "invoiceNumber": string or null,
    "invoiceDate": string or null (YYYY-MM-DD or readable date string),
    "vendorName": string or null,
    "vendorAddress": string or null,
    "vendorPhone": string or null,
    "vendorEmail": string or null,
    "currency": string or null (e.g. INR),
    "subtotal": number or null,
    "tax": number or null,
    "discount": number or null,
    "grandTotal": number or null
  },
  "items": [
    {
      "productName": string,
      "description": string or null,
      "quantity": number or null,
      "unit": string or null (e.g. kg, L, pcs, pkt),
      "unitPrice": number or null,
      "lineTotal": number or null,
      "tax": number or null,
      "discount": number or null
    }
  ],
  "isUtilityBill": boolean (true if electricity, water, internet, or utility bill),
  "billMonth": string or null (e.g. "August 2026", required if utility bill),
  "billAmount": number or null (required if utility bill)
}

RULES:
1. ONLY return JSON. Do not include markdown headers or conversational commentary.
2. DO NOT INVENT or HALLUCINATE values. If a field is missing from the invoice, return null.
3. For normal product invoices, populate items array. For utility bills, set isUtilityBill: true and populate billMonth & billAmount.
4. Ensure all extracted quantities, rates, and totals are numeric numbers.`;

    const userContent: unknown[] = [];

    if (doc.base64Image) {
      userContent.push({
        type: 'text',
        text: 'Please analyze this supplier invoice document image/file and extract all fields according to the schema.',
      });
      userContent.push({
        type: 'image_url',
        image_url: {
          url: doc.base64Image,
        },
      });
    } else {
      userContent.push({
        type: 'text',
        text: `Here is the extracted invoice text:\n\n${doc.text}`,
      });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          typeof userContent[0] === 'string'
            ? (userContent[0] as string)
            : JSON.stringify(userContent),
      },
    ];

    try {
      const response = await this.provider.chat(messages);
      const rawText = response.message?.content || '';

      // Clean markdown code blocks if present
      let cleanJson = rawText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      }

      const parsed = JSON.parse(cleanJson);
      return structuredInvoiceExtractionSchema.parse(parsed);
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || '';
      if (errorMsg.includes('OPENROUTER_') || errorMsg.includes('Security Guard Violation')) {
        throw err;
      }
      console.warn('⚠️ AI Invoice Extraction Warning:', err);
      return {
        invoice: {
          invoiceNumber: null,
          invoiceDate: null,
          vendorName: null,
          vendorAddress: null,
          vendorPhone: null,
          vendorEmail: null,
          currency: 'INR',
          subtotal: null,
          tax: null,
          discount: null,
          grandTotal: null,
        },
        items: [],
        isUtilityBill: false,
        billMonth: null,
        billAmount: null,
        notes: null,
      };
    }
  }
}

export const invoiceIntelligenceService = new InvoiceIntelligenceService();
