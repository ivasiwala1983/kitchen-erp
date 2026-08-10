/**
 * Language & Tone Detection Guardrail
 * Recognizes user language (English, Hindi, Hinglish) and tone (formal, casual, friendly)
 * to allow natural language adaptation while respecting deterministic security hierarchy.
 */

export type UserLanguage = 'english' | 'hindi' | 'hinglish';
export type UserTone = 'formal' | 'casual' | 'friendly' | 'business';

export interface ToneAnalysis {
  language: UserLanguage;
  tone: UserTone;
}

const HINGLISH_INDICATORS = [
  'bhai',
  'bhaiya',
  'bana de',
  'bata de',
  'dikha de',
  'kar de',
  'kharcha',
  'is mahine',
  'kitna',
  'kya hai',
  'kaise',
  'kahan',
  'kaun',
  'kal',
  'aaj',
  'wala',
  'wali',
  'bhi',
  'zaroor',
  'dikhayein',
  'pata',
  'dusre',
];

export class ToneGuard {
  /**
   * Analyzes user prompt language and tone.
   */
  public static analyze(text: string): ToneAnalysis {
    const lower = text.toLowerCase().trim();

    // 1. Devanagari Unicode Range Check for Hindi
    const isHindiDevanagari = /[\u0900-\u097F]/.test(text);
    if (isHindiDevanagari) {
      return { language: 'hindi', tone: 'friendly' };
    }

    // 2. Check for Hinglish vocabulary indicators
    const isHinglish = HINGLISH_INDICATORS.some((kw) => lower.includes(kw));
    if (isHinglish) {
      const isCasual =
        lower.includes('bhai') || lower.includes('kar de') || lower.includes('bana de');
      return {
        language: 'hinglish',
        tone: isCasual ? 'casual' : 'friendly',
      };
    }

    // 3. Check for English Casual vs Formal tone
    const isCasualEnglish =
      lower.startsWith('hey') ||
      lower.startsWith('hi') ||
      lower.includes('thanks') ||
      lower.includes('cool') ||
      lower.includes('yeah');

    return {
      language: 'english',
      tone: isCasualEnglish ? 'casual' : 'formal',
    };
  }

  /**
   * Pre-rendered Hinglish Refusal Messages for Security & Scope Guardrails
   */
  public static getHinglishRefusal(
    type: 'WRITE_MUTATION' | 'CROSS_TENANT' | 'OUT_OF_SCOPE'
  ): string {
    switch (type) {
      case 'WRITE_MUTATION':
        return '😄 Abhi main read-only mode mein hoon, so purchase create ya modify nahi kar sakta.\n\nLekin existing purchases ka analysis zaroor kar sakta hoon.';

      case 'CROSS_TENANT':
        return '😄 Main sirf aapke current ArgusOne tenant ke data ke saath help kar sakta hoon. Dusre tenant ka data access nahi kar sakta.';

      case 'OUT_OF_SCOPE':
        return '😄 Main aapke ArgusOne business operations ke data mein help karne ke liye specialized hoon. Ask me about purchases, vendors, inventory, products, ledger ya reports.';
    }
  }
}
