/**
 * LangGraph State Definition for ArgusOne Assistant
 */

import type { ChatMessage } from '../providers/ai.provider';
import type { ScopeCategory } from '../guardrails/scope.guard';
import type { UserLanguage, UserTone } from '../guardrails/tone.guard';

export interface ArgusOneGraphState {
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  authenticatedUser: {
    userId: string;
    role: string;
    name?: string;
  };
  tenantContext: {
    tenantId: string;
    tenantSlug?: string;
    tenantName?: string;
  };
  detectedLanguage?: UserLanguage;
  detectedTone?: UserTone;
  scope: ScopeCategory;
  isScopeAllowed: boolean;
  messages: ChatMessage[];
  toolCalls: Array<Record<string, unknown>>;
  toolResults: unknown[];
  dataSources: Set<string>;
  aiResponse: string;
  code?:
    | 'AI_RATE_LIMITED'
    | 'AI_PROVIDER_UNAVAILABLE'
    | 'AI_CONFIGURATION_ERROR'
    | 'AI_AUTH_ERROR'
    | 'SUCCESS';
  userMessageFormatted?: string;
  isCompleted: boolean;
}
