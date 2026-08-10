/**
 * LangGraph Node: After-AI Guardrails & Response Grounding Node
 */

import type { ArgusOneGraphState } from '../state';
import { ResponseGuard } from '../../guardrails/response.guard';

export function afterGuardNode(state: ArgusOneGraphState): ArgusOneGraphState {
  if (state.isCompleted || !state.aiResponse) return state;

  const { sanitizedContent } = ResponseGuard.validateAndSanitize(
    state.aiResponse,
    state.toolResults
  );

  return {
    ...state,
    aiResponse: sanitizedContent,
  };
}
