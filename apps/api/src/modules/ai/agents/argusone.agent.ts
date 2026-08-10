/**
 * ArgusOne AI Orchestrator Agent
 * Manages system instructions, tool execution loop, context assembly, and fallback handling.
 */

import { OpenRouterProvider } from '../providers/openrouter.provider';
import type { ChatMessage } from '../providers/ai.provider';
import { ARGUSONE_SYSTEM_INSTRUCTIONS } from '../prompts/argusone.instructions';
import { getRandomFreeLimitFallback } from '../prompts/argusone.fallbacks';
import { toolRegistry } from '../tools/tool.registry';

export interface AgentUserContext {
  tenantId: string;
  userId: string;
  role: string;
  tenantSlug?: string;
  tenantName?: string;
  userName?: string;
}

export interface AgentResponse {
  message: string;
  dataSources: string[];
  quickActions: Array<{ label: string; route: string }>;
  code?:
    | 'AI_RATE_LIMITED'
    | 'AI_PROVIDER_UNAVAILABLE'
    | 'AI_CONFIGURATION_ERROR'
    | 'AI_AUTH_ERROR'
    | 'SUCCESS';
  userMessage?: string;
}

export class ArgusOneAgent {
  private provider: OpenRouterProvider;

  constructor() {
    this.provider = new OpenRouterProvider();
  }

  public async run(
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: AgentUserContext
  ): Promise<AgentResponse> {
    // 1. Guard check for explicit write requests at agent entry
    if (this.isExplicitWriteRequest(userMessage)) {
      return {
        message:
          'I can currently provide read-only information. I cannot create or modify records.',
        dataSources: [],
        quickActions: [],
      };
    }

    // 2. Prepare message history with system instructions & user runtime context
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${ARGUSONE_SYSTEM_INSTRUCTIONS}\n\nCURRENT USER CONTEXT:\n- User: ${context.userName || 'Authenticated User'}\n- Role: ${context.role}\n- Tenant ID: ${context.tenantId}\n- Tenant Name: ${context.tenantName || 'Tenant Kitchen'}`,
      },
    ];

    // Include recent history (last 6 messages max for token efficiency)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-6);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add current user prompt
    messages.push({ role: 'user', content: userMessage });

    const tools = toolRegistry.getOpenRouterToolSpecs();
    const dataSourcesCollected = new Set<string>();

    try {
      // First model pass
      const initialResponse = await this.provider.chat(messages, tools);
      const assistantMsg = initialResponse.message;

      // Check if model requested tool call(s)
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        messages.push(assistantMsg);

        for (const toolCall of assistantMsg.tool_calls) {
          const fnObj = toolCall.function as { name?: string; arguments?: unknown } | undefined;
          const fnName = fnObj?.name || '';
          let fnArgs: Record<string, unknown> = {};

          try {
            if (fnObj?.arguments) {
              fnArgs =
                typeof fnObj.arguments === 'string'
                  ? JSON.parse(fnObj.arguments)
                  : (fnObj.arguments as Record<string, unknown>);
            }
          } catch {
            fnArgs = {};
          }

          // Execute tool safely via registry
          const execution = await toolRegistry.executeTool(fnName, fnArgs, {
            tenantId: context.tenantId,
            userId: context.userId,
            role: context.role,
          });

          execution.dataSources.forEach((ds) => dataSourcesCollected.add(ds));

          messages.push({
            role: 'tool',
            tool_call_id: (toolCall.id as string) || `call-${Date.now()}`,
            name: fnName,
            content: JSON.stringify(execution.result),
          });
        }

        // Final completion pass to format answer
        const finalResponse = await this.provider.chat(messages);
        const finalContent =
          finalResponse.message?.content || 'Here is your requested business summary.';

        return {
          message: finalContent,
          dataSources: Array.from(dataSourcesCollected),
          quickActions: this.buildQuickActions(
            userMessage,
            Array.from(dataSourcesCollected),
            context.tenantSlug
          ),
        };
      }

      // If no tool call was made, return standard model output
      return {
        message:
          assistantMsg.content || 'I have analyzed your query based on available system context.',
        dataSources: Array.from(dataSourcesCollected),
        quickActions: this.buildQuickActions(
          userMessage,
          Array.from(dataSourcesCollected),
          context.tenantSlug
        ),
      };
    } catch (error: unknown) {
      return this.handleAgentError(error, context.tenantSlug);
    }
  }

  private isExplicitWriteRequest(text: string): boolean {
    const lower = text.toLowerCase();
    const writeKeywords = [
      'create purchase',
      'create a purchase',
      'add purchase',
      'add a purchase',
      'new purchase',
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
      'record transaction',
    ];
    return writeKeywords.some((keyword) => lower.includes(keyword));
  }

  private buildQuickActions(
    userQuery: string,
    dataSources: string[],
    tenantSlug?: string
  ): Array<{ label: string; route: string }> {
    if (!tenantSlug) return [];

    const actions: Array<{ label: string; route: string }> = [];
    const queryLower = userQuery.toLowerCase();

    if (
      dataSources.includes('Purchase History') ||
      queryLower.includes('purchase') ||
      queryLower.includes('buy') ||
      queryLower.includes('spent')
    ) {
      actions.push({ label: 'View Purchases', route: `/t/${tenantSlug}/history` });
    }

    if (
      dataSources.includes('Ledger & Payments') ||
      queryLower.includes('ledger') ||
      queryLower.includes('owe') ||
      queryLower.includes('balance') ||
      queryLower.includes('vendor')
    ) {
      actions.push({ label: 'View Ledger', route: `/t/${tenantSlug}/ledger` });
    }

    return actions;
  }

  private handleAgentError(error: unknown, _tenantSlug?: string): AgentResponse {
    const err = error as { message?: string };
    const errorMsg = err?.message || '';

    if (errorMsg.includes('OPENROUTER_API_KEY_MISSING')) {
      return {
        message: 'ArgusOne Assistant is not configured.',
        userMessage: 'Please configure OPENROUTER_API_KEY in environment variables.',
        code: 'AI_CONFIGURATION_ERROR',
        dataSources: [],
        quickActions: [],
      };
    }

    if (errorMsg.includes('OPENROUTER_RATE_LIMIT') || errorMsg.includes('429')) {
      const funnyFallback = getRandomFreeLimitFallback();
      return {
        message: 'AI assistant is temporarily unavailable.',
        userMessage: funnyFallback,
        code: 'AI_RATE_LIMITED',
        dataSources: [],
        quickActions: [],
      };
    }

    if (
      errorMsg.includes('OPENROUTER_TIMEOUT') ||
      errorMsg.includes('OPENROUTER_PROVIDER_UNAVAILABLE')
    ) {
      return {
        message: 'ArgusOne Assistant is temporarily unavailable. Please try again later.',
        userMessage:
          'ArgusOne Assistant service is temporarily unreachable. Please try again in a moment.',
        code: 'AI_PROVIDER_UNAVAILABLE',
        dataSources: [],
        quickActions: [],
      };
    }

    if (errorMsg.includes('Security Guard Violation')) {
      return {
        message: 'Configuration Error: Invalid AI model setting.',
        userMessage:
          'ArgusOne Assistant operates under strict free-model safety mode. Configured model is not permitted.',
        code: 'AI_CONFIGURATION_ERROR',
        dataSources: [],
        quickActions: [],
      };
    }

    console.error('[ArgusOneAgent] Unexpected AI execution error:', error);
    return {
      message: 'ArgusOne Assistant is temporarily unavailable. Please try again later.',
      userMessage: getRandomFreeLimitFallback(),
      code: 'AI_RATE_LIMITED',
      dataSources: [],
      quickActions: [],
    };
  }
}
