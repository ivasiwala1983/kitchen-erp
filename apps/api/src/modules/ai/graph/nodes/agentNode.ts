/**
 * LangGraph Node: LangChain Agent Node using AIProvider
 */

import type { ArgusOneGraphState } from '../state';
import type { AIProvider, ChatMessage } from '../../providers/ai.provider';
import { ARGUSONE_SYSTEM_INSTRUCTIONS } from '../../prompts/argusone.instructions';
import { getRandomFreeLimitFallback } from '../../prompts/argusone.fallbacks';
import { toolRegistry } from '../../tools/tool.registry';

export async function agentNode(
  state: ArgusOneGraphState,
  provider: AIProvider
): Promise<ArgusOneGraphState> {
  if (state.isCompleted) return state;

  const systemMessage: ChatMessage = {
    role: 'system',
    content: `${ARGUSONE_SYSTEM_INSTRUCTIONS}\n\nCURRENT USER CONTEXT:\n- User: ${state.authenticatedUser.name || 'Authenticated User'}\n- Role: ${state.authenticatedUser.role}\n- Tenant ID: ${state.tenantContext.tenantId}\n- Tenant Name: ${state.tenantContext.tenantName || 'Tenant Kitchen'}`,
  };

  const messageList: ChatMessage[] = [systemMessage];

  if (Array.isArray(state.history)) {
    for (const msg of state.history.slice(-6)) {
      messageList.push({ role: msg.role, content: msg.content });
    }
  }

  // Combine with existing messages in state (e.g. tool results)
  if (state.messages.length > 0) {
    messageList.push(...state.messages);
  } else {
    messageList.push({ role: 'user', content: state.userMessage });
  }

  const tools = toolRegistry.getOpenRouterToolSpecs();

  try {
    const providerResponse = await provider.chat(messageList, tools);
    const assistantMsg = providerResponse.message;

    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      return {
        ...state,
        messages: [...state.messages, assistantMsg],
        toolCalls: assistantMsg.tool_calls,
      };
    }

    return {
      ...state,
      aiResponse: assistantMsg.content || 'Here is your requested business overview.',
      toolCalls: [],
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    const errorMsg = err?.message || '';

    if (errorMsg.includes('OPENROUTER_RATE_LIMIT') || errorMsg.includes('429')) {
      const funnyFallback = getRandomFreeLimitFallback();
      return {
        ...state,
        code: 'AI_RATE_LIMITED',
        userMessageFormatted: funnyFallback,
        aiResponse: 'AI assistant is temporarily unavailable.',
        isCompleted: true,
      };
    }

    if (
      errorMsg.includes('OPENROUTER_TIMEOUT') ||
      errorMsg.includes('OPENROUTER_PROVIDER_UNAVAILABLE')
    ) {
      return {
        ...state,
        code: 'AI_PROVIDER_UNAVAILABLE',
        userMessageFormatted:
          'ArgusOne Assistant service is temporarily unreachable. Please try again in a moment.',
        aiResponse: 'ArgusOne Assistant is temporarily unavailable. Please try again later.',
        isCompleted: true,
      };
    }

    if (errorMsg.includes('Security Guard Violation')) {
      return {
        ...state,
        code: 'AI_CONFIGURATION_ERROR',
        userMessageFormatted:
          'ArgusOne Assistant operates under strict free-model safety mode. Configured model is not permitted.',
        aiResponse: 'Configuration Error: Invalid AI model setting.',
        isCompleted: true,
      };
    }

    return {
      ...state,
      code: 'AI_RATE_LIMITED',
      userMessageFormatted: getRandomFreeLimitFallback(),
      aiResponse: 'ArgusOne Assistant is temporarily unavailable. Please try again later.',
      isCompleted: true,
    };
  }
}
