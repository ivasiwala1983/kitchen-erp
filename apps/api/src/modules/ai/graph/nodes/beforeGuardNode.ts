/**
 * LangGraph Node: Before-AI Guardrails with Tone Analysis
 */

import type { ArgusOneGraphState } from '../state';
import { PromptInjectionGuard } from '../../guardrails/promptInjection.guard';
import { ToneGuard } from '../../guardrails/tone.guard';

export function beforeGuardNode(state: ArgusOneGraphState): ArgusOneGraphState {
  // 1. Analyze tone & language first
  const { language, tone } = ToneGuard.analyze(state.userMessage);
  const updatedState: ArgusOneGraphState = {
    ...state,
    detectedLanguage: language,
    detectedTone: tone,
  };

  // 2. Verify tenant & auth context
  if (!updatedState.tenantContext.tenantId) {
    return {
      ...updatedState,
      code: 'AI_AUTH_ERROR',
      aiResponse: 'Tenant context is missing for this operation.',
      isCompleted: true,
    };
  }

  // 3. Evaluate Prompt Injection
  const injectionResult = PromptInjectionGuard.evaluate(updatedState.userMessage);
  if (!injectionResult.isSafe) {
    const refusalMsg =
      language === 'hinglish'
        ? ToneGuard.getHinglishRefusal('CROSS_TENANT')
        : 'I can only assist with authorized tenant business operations.';

    return {
      ...updatedState,
      code: 'AI_AUTH_ERROR',
      aiResponse: refusalMsg,
      isCompleted: true,
    };
  }

  // 4. Evaluate Mutation/Write Keyword Refusal
  const textLower = updatedState.userMessage.toLowerCase();
  const writeKeywords = [
    'create purchase',
    'create a purchase',
    'add purchase',
    'add a purchase',
    'update purchase',
    'delete purchase',
    'create vendor',
    'create a vendor',
    'add vendor',
    'update vendor',
    'delete vendor',
    'create product',
    'create a product',
    'add product',
    'update product',
    'delete product',
    'create payment',
    'make payment',
    'add payment',
    'update payment',
    'delete payment',
    'approve purchase',
    'upload invoice',
    'delete invoice',
    'bana de',
    'purchase bana',
    'create kar',
    'add kar',
  ];

  if (writeKeywords.some((kw) => textLower.includes(kw))) {
    const refusalMsg =
      language === 'hinglish'
        ? ToneGuard.getHinglishRefusal('WRITE_MUTATION')
        : 'I can currently provide read-only information. I cannot create or modify records.';

    return {
      ...updatedState,
      code: 'SUCCESS',
      aiResponse: refusalMsg,
      isCompleted: true,
    };
  }

  return updatedState;
}
