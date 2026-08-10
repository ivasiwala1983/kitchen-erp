/**
 * ArgusOne StateGraph Workflow Orchestrator
 * Implements LangGraph state machine execution flow:
 * START ➔ beforeGuard ➔ scopeCheck ➔ agentNode ➔ toolExecution ➔ afterGuard ➔ toneFormatter ➔ finalResponse ➔ END
 */

import type { ArgusOneGraphState } from './state';
import { beforeGuardNode } from './nodes/beforeGuardNode';
import { scopeCheckNode } from './nodes/scopeCheckNode';
import { agentNode } from './nodes/agentNode';
import { toolExecutionNode } from './nodes/toolExecutionNode';
import { afterGuardNode } from './nodes/afterGuardNode';
import { toneFormatterNode } from './nodes/toneFormatterNode';
import { finalResponseNode, type FinalGraphOutput } from './nodes/finalResponseNode';
import { OpenRouterProvider } from '../providers/openrouter.provider';
import type { AIProvider } from '../providers/ai.provider';

export interface GraphExecuteInput {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: {
    tenantId: string;
    userId: string;
    role: string;
    tenantSlug?: string;
    tenantName?: string;
    userName?: string;
  };
}

export class ArgusOneGraph {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || new OpenRouterProvider();
  }

  /**
   * Executes state graph workflow asynchronously.
   */
  public async run(input: GraphExecuteInput): Promise<FinalGraphOutput> {
    let state: ArgusOneGraphState = {
      userMessage: input.message,
      history: input.history || [],
      authenticatedUser: {
        userId: input.context.userId,
        role: input.context.role,
        name: input.context.userName,
      },
      tenantContext: {
        tenantId: input.context.tenantId,
        tenantSlug: input.context.tenantSlug,
        tenantName: input.context.tenantName,
      },
      scope: 'REPORT_QUERY',
      isScopeAllowed: true,
      messages: [],
      toolCalls: [],
      toolResults: [],
      dataSources: new Set<string>(),
      aiResponse: '',
      isCompleted: false,
    };

    // Node 1: Before-AI Guardrails & Tone/Language Analysis
    state = beforeGuardNode(state);
    if (state.isCompleted) {
      return finalResponseNode(state);
    }

    // Node 2: Scope Check Guardrail (Rejects out-of-scope queries BEFORE calling AI provider)
    state = scopeCheckNode(state);
    if (state.isCompleted) {
      return finalResponseNode(state);
    }

    // Node 3 & 4 Loop: Agent Node & Tool Execution Node
    let maxPasses = 3;
    while (!state.isCompleted && maxPasses > 0) {
      maxPasses -= 1;
      state = await agentNode(state, this.provider);

      if (state.isCompleted) break;

      if (state.toolCalls.length > 0) {
        state = await toolExecutionNode(state);
      } else {
        // Model returned final response text
        break;
      }
    }

    // Node 5: After-AI Response Validation & Sanitization Guardrail
    state = afterGuardNode(state);

    // Node 6: Tone & Language Formatting Pass Node
    state = toneFormatterNode(state);

    // Node 7: Final Response Format Node
    return finalResponseNode(state);
  }
}
