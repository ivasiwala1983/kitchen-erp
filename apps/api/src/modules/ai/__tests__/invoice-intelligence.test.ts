/**
 * Enterprise Test Suite for ArgusOne Invoice Intelligence
 * Covers File Validation, Tenant Isolation, Structured Extraction, No Hallucination,
 * Product & Vendor Candidate Matching, Utility Bill Recognition, Financial Validation,
 * Duplicate Detection, Read-Only AI Enforcement, and Model Failure Safety.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  prisma,
  tenantRepository,
  vendorRepository,
  productRepository,
  categoryRepository,
} from '@kitchen-erp/database';
import { CategoryType, Role } from '@kitchen-erp/types';
import { invoiceMatchingService } from '../services/invoice-matching.service';
import { invoiceValidationService } from '../services/invoice-validation.service';
import { invoiceDocumentReader } from '../services/invoice-document-reader';
import { structuredInvoiceExtractionSchema } from '../schemas/invoice-extraction.schema';
import { InvoiceIntelligenceService } from '../services/invoice-intelligence.service';
import type { AIProvider, ChatMessage, AIProviderResponse } from '../providers/ai.provider';

class MockAIProvider implements AIProvider {
  public mockResponseText: string = '';
  public shouldFail: boolean = false;

  async chat(_messages: ChatMessage[]): Promise<AIProviderResponse> {
    if (this.shouldFail) {
      throw new Error('OPENROUTER_RATE_LIMIT');
    }
    return {
      message: {
        role: 'assistant',
        content:
          this.mockResponseText ||
          JSON.stringify({
            invoice: {
              invoiceNumber: 'INV-9901',
              invoiceDate: '2026-08-10',
              vendorName: 'Fresh Veggies Co',
              grandTotal: 3050.0,
              currency: 'INR',
            },
            items: [
              { productName: 'Potato', quantity: 50, unit: 'kg', unitPrice: 40, lineTotal: 2000 },
              { productName: 'Onion', quantity: 30, unit: 'kg', unitPrice: 35, lineTotal: 1050 },
            ],
            isUtilityBill: false,
            billMonth: null,
            billAmount: null,
          }),
      },
      finishReason: 'stop',
      model: 'openrouter/free',
    };
  }
}

describe('ArgusOne Invoice Intelligence Test Suite', () => {
  let tenantAId: string;
  let tenantBId: string;
  let catAId: string;
  let catBId: string;
  let vendorAId: string;
  let _vendorBId: string;
  let prodPotatoAId: string;
  let prodOnionAId: string;
  let _prodTomatoBId: string;

  before(async () => {
    // 1. Create Tenant A
    const tenantA = await tenantRepository.create({
      name: `Invoice Test Tenant A ${Date.now()}`,
      slug: `invoice-tenant-a-${Date.now()}`,
      currency: 'INR',
    });
    tenantAId = tenantA.id;

    // 2. Create Tenant B
    const tenantB = await tenantRepository.create({
      name: `Invoice Test Tenant B ${Date.now()}`,
      slug: `invoice-tenant-b-${Date.now()}`,
      currency: 'INR',
    });
    tenantBId = tenantB.id;

    // 3. Create Categories
    const catA = await categoryRepository.create({
      tenantId: tenantAId,
      name: 'Vegetables A',
      type: CategoryType.PRODUCT,
    });
    catAId = catA.id;

    const catB = await categoryRepository.create({
      tenantId: tenantBId,
      name: 'Vegetables B',
      type: CategoryType.PRODUCT,
    });
    catBId = catB.id;

    // 4. Create Vendors
    const vendorA = await vendorRepository.create({
      tenantId: tenantAId,
      categoryId: catAId,
      name: 'ABC Foods Pvt Ltd',
    });
    vendorAId = vendorA.id;

    const vendorB = await vendorRepository.create({
      tenantId: tenantBId,
      categoryId: catBId,
      name: 'XYZ Supplies',
    });
    _vendorBId = vendorB.id;

    // 5. Create Products in Tenant A
    const prodPotatoA = await productRepository.create({
      tenantId: tenantAId,
      categoryId: catAId,
      name: 'Potato',
      unit: 'kg',
    });
    prodPotatoAId = prodPotatoA.id;

    const prodOnionA = await productRepository.create({
      tenantId: tenantAId,
      categoryId: catAId,
      name: 'Tata Salt 1 KG',
      unit: 'kg',
    });
    prodOnionAId = prodOnionA.id;

    // 6. Create Product in Tenant B
    const prodTomatoB = await productRepository.create({
      tenantId: tenantBId,
      categoryId: catBId,
      name: 'Tomato Tenant B',
      unit: 'kg',
    });
    _prodTomatoBId = prodTomatoB.id;
  });

  it('1. File Validation & Document Reader', async () => {
    const pdfBuffer = Buffer.from(
      '%PDF-1.4 Mock PDF Invoice Content with Invoice INV-100 and ABC Foods'
    );
    const docPdf = await invoiceDocumentReader.readDocument(
      pdfBuffer,
      'application/pdf',
      'sample.pdf'
    );

    assert.equal(docPdf.mimeType, 'application/pdf');
    assert.equal(docPdf.fileName, 'sample.pdf');
    assert.ok(docPdf.text.length > 0);

    const imgBuffer = Buffer.from('fake-image-bytes');
    const docImg = await invoiceDocumentReader.readDocument(imgBuffer, 'image/png', 'receipt.png');

    assert.equal(docImg.mimeType, 'image/png');
    assert.ok(docImg.base64Image?.startsWith('data:image/png;base64,'));
  });

  it('2. Structured Schema Parsing & No Hallucination Null Defaults', async () => {
    const rawAiJson = {
      invoice: {
        invoiceNumber: 'INV-404',
        invoiceDate: null,
        vendorName: 'ABC Foods',
        subtotal: null,
        grandTotal: 1000,
      },
      items: [
        {
          productName: 'Potato',
          quantity: 25,
          unitPrice: 40,
          lineTotal: 1000,
        },
      ],
      isUtilityBill: false,
    };

    const parsed = structuredInvoiceExtractionSchema.parse(rawAiJson);
    assert.equal(parsed.invoice.invoiceNumber, 'INV-404');
    assert.equal(parsed.invoice.vendorPhone, null); // Unextracted field remains null
    assert.equal(parsed.items[0].productName, 'Potato');
    assert.equal(parsed.items[0].tax, null);
  });

  it('3. Product Candidate Matching with Tiered Confidence', async () => {
    const extractedItems = [
      { productName: 'Potato', quantity: 10, unitPrice: 30, lineTotal: 300 }, // Exact match
      { productName: 'Potatoes', quantity: 5, unitPrice: 30, lineTotal: 150 }, // Normalized / Singular match
      { productName: 'Salt - Tata 1 KG', quantity: 2, unitPrice: 20, lineTotal: 40 }, // Fuzzy match candidate
      { productName: 'Unknown Exotic Herb', quantity: 1, unitPrice: 100, lineTotal: 100 }, // No match
    ];

    const matches = await invoiceMatchingService.matchProducts(extractedItems, tenantAId);

    // Potato -> Exact Match (100%)
    assert.equal(matches[0].matchedProductId, prodPotatoAId);
    assert.equal(matches[0].confidence, 100);
    assert.equal(matches[0].matchStatus, 'matched');

    // Potatoes -> Singular/Plural Match (95%)
    assert.equal(matches[1].matchedProductId, prodPotatoAId);
    assert.ok(matches[1].confidence >= 90);
    assert.equal(matches[1].matchStatus, 'matched');

    // Salt - Tata 1 KG -> Fuzzy match against "Tata Salt 1 KG"
    assert.equal(matches[2].matchedProductId, prodOnionAId);
    assert.ok(matches[2].confidence >= 70);

    // Unknown Herb -> Low confidence / Needs Review
    assert.equal(matches[3].matchedProductId, null);
    assert.equal(matches[3].matchStatus, 'needs_review');
    assert.ok(matches[3].confidence < 70);
  });

  it('4. Vendor Matching with High & Medium Confidence Thresholds', async () => {
    // Test Exact Match
    const matchExact = await invoiceMatchingService.matchVendor(
      { vendorName: 'ABC Foods Pvt Ltd' },
      tenantAId
    );
    assert.equal(matchExact.matchedVendorId, vendorAId);
    assert.equal(matchExact.confidence, 100);
    assert.equal(matchExact.matchStatus, 'matched');

    // Test Normalized Match
    const matchNorm = await invoiceMatchingService.matchVendor(
      { vendorName: 'ABC Foods' },
      tenantAId
    );
    assert.equal(matchNorm.matchedVendorId, vendorAId);
    assert.ok(matchNorm.confidence >= 85);

    // Test Unknown Vendor
    const matchUnknown = await invoiceMatchingService.matchVendor(
      { vendorName: 'Non Existent Vendor 999' },
      tenantAId
    );
    assert.equal(matchUnknown.matchedVendorId, null);
    assert.equal(matchUnknown.matchStatus, 'needs_review');
  });

  it('5. Tenant Isolation Guarantee', async () => {
    // Tenant B attempts to match against product "Potato" (which exists in Tenant A, not Tenant B)
    const matchesB = await invoiceMatchingService.matchProducts(
      [{ productName: 'Potato', quantity: 1, unitPrice: 10, lineTotal: 10 }],
      tenantBId
    );

    // Must NOT match Tenant A product!
    assert.notEqual(matchesB[0].matchedProductId, prodPotatoAId);
    assert.equal(matchesB[0].matchedProductId, null);

    // Tenant B vendor check
    const vendorMatchB = await invoiceMatchingService.matchVendor(
      { vendorName: 'ABC Foods Pvt Ltd' },
      tenantBId
    );
    assert.notEqual(vendorMatchB.matchedVendorId, vendorAId);
  });

  it('6. Utility Bill Processing & Category Recognition', async () => {
    const mockProvider = new MockAIProvider();
    mockProvider.mockResponseText = JSON.stringify({
      invoice: {
        invoiceNumber: 'ELEC-2026-08',
        invoiceDate: '2026-09-02',
        vendorName: 'State Electricity Board',
        grandTotal: 12450.0,
      },
      items: [],
      isUtilityBill: true,
      billMonth: 'August 2026',
      billAmount: 12450.0,
    });

    const service = new InvoiceIntelligenceService(mockProvider);
    const pdfBuffer = Buffer.from('Mock Electricity Bill August 2026 Rs 12450');

    const result = await service.processInvoice(
      pdfBuffer,
      'application/pdf',
      'electricity.pdf',
      tenantAId
    );

    assert.equal(result.isUtilityBill, true);
    assert.equal(result.billMonth, 'August 2026');
    assert.equal(result.billAmount, 12450.0);
    assert.equal(result.header.invoiceNumber, 'ELEC-2026-08');
  });

  it('7. Application Code Financial Totals Validation', async () => {
    const header = { grandTotal: 5000, tax: 500, discount: 0 };
    const items = [
      {
        extractedName: 'Potato',
        quantity: 50,
        unitPrice: 40,
        lineTotal: 2000, // Correct (50*40)
        matchedProductId: prodPotatoAId,
        matchedProductName: 'Potato',
        matchedUnit: 'kg',
        confidence: 100,
        matchStatus: 'matched' as const,
        candidates: [],
        unit: 'kg',
      },
      {
        extractedName: 'Onion',
        quantity: 30,
        unitPrice: 35,
        lineTotal: 9999, // Mismatched line total! (Expected 30*35=1050)
        matchedProductId: null,
        matchedProductName: null,
        matchedUnit: 'kg',
        confidence: 0,
        matchStatus: 'needs_review' as const,
        candidates: [],
        unit: 'kg',
      },
    ];

    const validation = invoiceValidationService.validateTotals(header, items);

    assert.equal(validation.isValid, false);
    assert.equal(validation.itemMismatches.length, 1);
    assert.equal(validation.itemMismatches[0].productName, 'Onion');
    assert.ok(validation.itemMismatches[0].message?.includes('does not match Qty'));
  });

  it('8. Duplicate Invoice Detection', async () => {
    // Create an existing purchase with notes containing invoice number
    await prisma.purchase.create({
      data: {
        tenantId: tenantAId,
        vendorId: vendorAId,
        userId:
          (await prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } }))?.id ||
          (await prisma.user.findFirst())!.id,
        grandTotal: 1000,
        notes: 'Existing Invoice INV-DUP-7788',
        purchaseDate: new Date(),
      },
    });

    const dupCheck = await invoiceValidationService.checkDuplicateInvoice(
      tenantAId,
      vendorAId,
      'INV-DUP-7788'
    );

    assert.equal(dupCheck.isPossibleDuplicate, true);
    assert.ok(dupCheck.warningMessage?.includes('INV-DUP-7788'));
  });

  it('9. Read-Only AI Principle: Process returns suggestions without writing DB purchases', async () => {
    const countBefore = await prisma.purchase.count({ where: { tenantId: tenantAId } });

    const mockProvider = new MockAIProvider();
    const service = new InvoiceIntelligenceService(mockProvider);

    const pdfBuffer = Buffer.from('Mock supplier invoice');
    const result = await service.processInvoice(
      pdfBuffer,
      'application/pdf',
      'invoice.pdf',
      tenantAId
    );

    assert.ok(result.items.length > 0);

    const countAfter = await prisma.purchase.count({ where: { tenantId: tenantAId } });

    // Database count MUST remain identical! AI processing does not write purchases.
    assert.equal(countAfter, countBefore);
  });

  it('10. AI Model Failure Graceful Fallback', async () => {
    const failingProvider = new MockAIProvider();
    failingProvider.shouldFail = true;

    const service = new InvoiceIntelligenceService(failingProvider);
    const pdfBuffer = Buffer.from('Mock invoice');

    await assert.rejects(async () => {
      await service.processInvoice(pdfBuffer, 'application/pdf', 'invoice.pdf', tenantAId);
    }, /OPENROUTER_RATE_LIMIT/);
  });
});
