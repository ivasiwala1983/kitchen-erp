/**
 * Before-AI Business Scope Guardrail
 * Deterministically classifies user queries into supported business domains
 * and rejects out-of-scope prompts BEFORE calling the AI model.
 */

export type ScopeCategory =
  | 'PURCHASE_QUERY'
  | 'VENDOR_QUERY'
  | 'PRODUCT_QUERY'
  | 'INVENTORY_QUERY'
  | 'LEDGER_QUERY'
  | 'REPORT_QUERY'
  | 'OUT_OF_SCOPE';

export interface ScopeEvaluationResult {
  scope: ScopeCategory;
  isAllowed: boolean;
  refusalMessage?: string;
}

const OUT_OF_SCOPE_KEYWORDS = [
  'poem',
  'joke',
  'python',
  'code',
  'script',
  'quantum',
  'physics',
  'football',
  'match',
  'cricket',
  'email',
  'friend',
  'homework',
  'essay',
  'movie',
  'song',
  'weather',
  'recipe',
  'president',
  'capital of',
  'who is',
  'horoscope',
  'crypto',
  'bitcoin',
  'investment advice',
];

const ALLOWED_DOMAIN_KEYWORDS: Array<{ scope: ScopeCategory; keywords: string[] }> = [
  {
    scope: 'PURCHASE_QUERY',
    keywords: [
      'purchase',
      'purchased',
      'buy',
      'bought',
      'spend',
      'spent',
      'spending',
      'order',
      'orders',
    ],
  },
  {
    scope: 'VENDOR_QUERY',
    keywords: ['vendor', 'vendors', 'supplier', 'suppliers', 'seller', 'sellers', 'patel', 'dairy'],
  },
  {
    scope: 'PRODUCT_QUERY',
    keywords: ['product', 'products', 'item', 'items', 'unit', 'units', 'catalog'],
  },
  {
    scope: 'INVENTORY_QUERY',
    keywords: ['inventory', 'stock', 'low stock', 'attention', 'reorder', 'quantity'],
  },
  {
    scope: 'LEDGER_QUERY',
    keywords: [
      'ledger',
      'owe',
      'owed',
      'payable',
      'payables',
      'balance',
      'balances',
      'payment',
      'payments',
      'credit',
      'debit',
    ],
  },
  {
    scope: 'REPORT_QUERY',
    keywords: [
      'report',
      'reports',
      'analytics',
      'overview',
      'stats',
      'dashboard',
      'compare',
      'summary',
    ],
  },
];

export class ScopeGuard {
  /**
   * Deterministically evaluates user query scope.
   */
  public static evaluateScope(userQuery: string): ScopeEvaluationResult {
    const queryLower = userQuery.toLowerCase().trim();

    // 1. Check for explicit out-of-scope triggers
    const isExplicitOutOfScope = OUT_OF_SCOPE_KEYWORDS.some((kw) => queryLower.includes(kw));

    if (isExplicitOutOfScope) {
      return {
        scope: 'OUT_OF_SCOPE',
        isAllowed: false,
        refusalMessage:
          "🤖 I'm ArgusOne Assistant, so I stick to your business operations. Ask me about purchases, vendors, inventory, products, ledger or reports.",
      };
    }

    // 2. Match against supported business domain keywords
    for (const domain of ALLOWED_DOMAIN_KEYWORDS) {
      if (domain.keywords.some((kw) => queryLower.includes(kw))) {
        return {
          scope: domain.scope,
          isAllowed: true,
        };
      }
    }

    // 3. Fallback check: If query is very short or generic business query, allow with default classification
    const isGeneralBusinessQuery =
      queryLower.includes('how much') ||
      queryLower.includes('what did') ||
      queryLower.includes('show') ||
      queryLower.includes('top') ||
      queryLower.includes('recent') ||
      queryLower.includes('total') ||
      queryLower.includes('month');

    if (isGeneralBusinessQuery) {
      return {
        scope: 'REPORT_QUERY',
        isAllowed: true,
      };
    }

    // 4. Default out-of-scope refusal for non-business prompts
    return {
      scope: 'OUT_OF_SCOPE',
      isAllowed: false,
      refusalMessage:
        "🤖 I'm ArgusOne Assistant, so I stick to your business operations. Ask me about purchases, vendors, inventory, products, ledger or reports.",
    };
  }
}
