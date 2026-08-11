/**
 * Product & Vendor Matching Engine for Invoice Intelligence
 * Implements layered candidate retrieval, exact, normalized, and fuzzy matching with confidence scoring.
 */

import { vendorRepository, productRepository } from '@kitchen-erp/database';
import type {
  ExtractedLineItem,
  ExtractedInvoiceHeader,
} from '../schemas/invoice-extraction.schema';

export interface ConfidenceThresholds {
  HIGH: number; // >= 90% (Auto-suggest / matched)
  MEDIUM: number; // 70-89% (Recommendation / review)
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  HIGH: 90,
  MEDIUM: 70,
};

export interface MatchedProductItem {
  extractedName: string;
  description?: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  tax?: number | null;
  discount?: number | null;

  // Matching results
  matchedProductId: string | null;
  matchedProductName: string | null;
  matchedUnit: string | null;
  confidence: number;
  matchStatus: 'matched' | 'recommended' | 'needs_review';
  candidates: Array<{ id: string; name: string; unit: string; score: number }>;
  isUserCorrected?: boolean;
}

export interface MatchedVendorResult {
  extractedVendorName: string | null;
  matchedVendorId: string | null;
  matchedVendorName: string | null;
  confidence: number;
  matchStatus: 'matched' | 'recommended' | 'needs_review';
  candidates: Array<{ id: string; name: string; score: number }>;
}

export class InvoiceMatchingService {
  private thresholds = DEFAULT_CONFIDENCE_THRESHOLDS;

  /**
   * Normalize string for fuzzy matching (lowercased, trimmed, alphanumerics only)
   */
  private normalize(str: string | null | undefined): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Calculate string similarity percentage (0-100) using token overlap and Levenshtein distance
   */
  public calculateSimilarity(str1: string, str2: string): number {
    const s1 = this.normalize(str1);
    const s2 = this.normalize(str2);

    if (!s1 || !s2) return 0;
    if (s1 === s2) return 100;

    // Check singular/plural equivalence (e.g. Potato vs Potatoes)
    if (s1.length > 2 && s2.length > 2) {
      if (s1 === `${s2}s` || s2 === `${s1}s` || s1 === `${s2}es` || s2 === `${s1}es`) {
        return 95;
      }
    }

    // Token Overlap Check (e.g. "ABC Foods" vs "ABC Foods Pvt Ltd" or "Tata Salt" vs "Tata Salt 1 KG")
    const words1 = str1
      .toLowerCase()
      .trim()
      .split(/[^a-z0-9]+/);
    const words2 = str2
      .toLowerCase()
      .trim()
      .split(/[^a-z0-9]+/);

    const set1 = new Set(words1.filter((w) => w.length > 1));
    const set2 = new Set(words2.filter((w) => w.length > 1));

    if (set1.size > 0 && set2.size > 0) {
      let intersectionCount = 0;
      set1.forEach((w) => {
        if (set2.has(w)) intersectionCount += 1;
      });

      const smallerSize = Math.min(set1.size, set2.size);
      const overlapRatio = intersectionCount / smallerSize;

      if (overlapRatio >= 0.9) {
        // All words of smaller name are present in larger name!
        return 92;
      } else if (overlapRatio >= 0.5) {
        return 80;
      }
    }

    // Substring inclusion check
    if (s1.length > 2 && s2.length > 2) {
      if (s1.includes(s2) || s2.includes(s1)) {
        const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
        return Math.round(80 * ratio + 15);
      }
    }

    // Levenshtein Distance fallback
    const track = Array(s2.length + 1)
      .fill(null)
      .map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator
        );
      }
    }

    const distance = track[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = ((maxLength - distance) / maxLength) * 100;
    return Math.round(similarity);
  }

  /**
   * Matches extracted vendor against tenant active vendors
   */
  public async matchVendor(
    extractedHeader: Partial<ExtractedInvoiceHeader>,
    tenantId: string
  ): Promise<MatchedVendorResult> {
    const rawName = extractedHeader.vendorName?.trim() || '';
    if (!rawName) {
      return {
        extractedVendorName: null,
        matchedVendorId: null,
        matchedVendorName: null,
        confidence: 0,
        matchStatus: 'needs_review',
        candidates: [],
      };
    }

    const { items: activeVendors } = await vendorRepository.findAll(tenantId, {
      skip: 0,
      take: 500,
      isActive: true,
    });

    let bestMatchVendor: { id: string; name: string } | null = null;
    let highestScore = 0;
    const scoredCandidates: Array<{ id: string; name: string; score: number }> = [];

    for (const vendor of activeVendors) {
      const score = this.calculateSimilarity(rawName, vendor.name);
      scoredCandidates.push({ id: vendor.id, name: vendor.name, score });

      if (score > highestScore) {
        highestScore = score;
        bestMatchVendor = vendor;
      }
    }

    // Sort candidates descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    let matchStatus: 'matched' | 'recommended' | 'needs_review' = 'needs_review';
    if (highestScore >= this.thresholds.HIGH) {
      matchStatus = 'matched';
    } else if (highestScore >= this.thresholds.MEDIUM) {
      matchStatus = 'recommended';
    }

    return {
      extractedVendorName: rawName,
      matchedVendorId:
        matchStatus !== 'needs_review' && bestMatchVendor ? bestMatchVendor.id : null,
      matchedVendorName:
        matchStatus !== 'needs_review' && bestMatchVendor ? bestMatchVendor.name : null,
      confidence: highestScore,
      matchStatus,
      candidates: scoredCandidates.slice(0, 5),
    };
  }

  /**
   * Matches extracted line items against tenant active products
   */
  public async matchProducts(
    extractedItems: Array<Partial<ExtractedLineItem>>,
    tenantId: string
  ): Promise<MatchedProductItem[]> {
    if (!extractedItems || extractedItems.length === 0) {
      return [];
    }

    const { items: activeProducts } = await productRepository.findAll(tenantId, {
      skip: 0,
      take: 500,
      isActive: true,
    });

    return extractedItems.map((item) => {
      const rawName = item.productName || '';
      let bestProduct: { id: string; name: string; unit: string } | null = null;
      let highestScore = 0;
      const candidates: Array<{ id: string; name: string; unit: string; score: number }> = [];

      for (const prod of activeProducts) {
        const score = this.calculateSimilarity(rawName, prod.name);
        candidates.push({ id: prod.id, name: prod.name, unit: prod.unit, score });

        if (score > highestScore) {
          highestScore = score;
          bestProduct = prod;
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      let matchStatus: 'matched' | 'recommended' | 'needs_review' = 'needs_review';
      if (highestScore >= this.thresholds.HIGH) {
        matchStatus = 'matched';
      } else if (highestScore >= this.thresholds.MEDIUM) {
        matchStatus = 'recommended';
      }

      return {
        extractedName: rawName,
        description: item.description,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        unitPrice: item.unitPrice ?? null,
        lineTotal: item.lineTotal ?? null,
        tax: item.tax ?? null,
        discount: item.discount ?? null,

        matchedProductId: matchStatus !== 'needs_review' && bestProduct ? bestProduct.id : null,
        matchedProductName: matchStatus !== 'needs_review' && bestProduct ? bestProduct.name : null,
        matchedUnit:
          matchStatus !== 'needs_review' && bestProduct ? bestProduct.unit : item.unit || null,
        confidence: highestScore,
        matchStatus,
        candidates: candidates.slice(0, 5),
        isUserCorrected: false,
      };
    });
  }
}

export const invoiceMatchingService = new InvoiceMatchingService();
