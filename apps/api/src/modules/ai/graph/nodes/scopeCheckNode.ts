/**
 * LangGraph Node: Business Scope Check Guardrail with Language Adaptation
 */

import type { ArgusOneGraphState } from '../state';
import { ScopeGuard } from '../../guardrails/scope.guard';
import { ToneGuard } from '../../guardrails/tone.guard';

export function scopeCheckNode(state: ArgusOneGraphState): ArgusOneGraphState {
  if (state.isCompleted) return state;

  const scopeResult = ScopeGuard.evaluateScope(state.userMessage);

  if (!scopeResult.isAllowed) {
    const refusalMsg =
      state.detectedLanguage === 'hinglish'
        ? ToneGuard.getHinglishRefusal('OUT_OF_SCOPE')
        : scopeResult.refusalMessage ||
          "🤖 I'm ArgusOne Assistant, so I stick to your business operations. Ask me about purchases, vendors, inventory, products, ledger or reports.";

    return {
      ...state,
      scope: 'OUT_OF_SCOPE',
      isScopeAllowed: false,
      aiResponse: refusalMsg,
      isCompleted: true,
    };
  }

  return {
    ...state,
    scope: scopeResult.scope,
    isScopeAllowed: true,
  };
}
