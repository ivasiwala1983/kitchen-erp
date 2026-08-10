/**
 * After-AI Response Validation & Secret Stripper Guardrail
 */

export class ResponseGuard {
  public static validateAndSanitize(
    rawResponse: string,
    _toolResults: unknown[]
  ): { isValid: boolean; sanitizedContent: string } {
    let sanitized = rawResponse;

    // 1. Strip sensitive credentials or environment keys if present
    const sensitiveTokens = [
      process.env.OPENROUTER_API_KEY,
      process.env.DATABASE_URL,
      process.env.JWT_SECRET,
    ].filter((t): t is string => Boolean(t && t.length > 5));

    for (const token of sensitiveTokens) {
      if (sanitized.includes(token)) {
        sanitized = sanitized.replace(new RegExp(token, 'g'), '[REDACTED_SECRET]');
      }
    }

    // 2. Strip database table implementation references
    sanitized = sanitized
      .replace(/prisma\.[a-zA-Z0-9_]+/gi, 'ArgusOne Services')
      .replace(/schema\.prisma/gi, 'ArgusOne Core');

    return {
      isValid: true,
      sanitizedContent: sanitized,
    };
  }
}
