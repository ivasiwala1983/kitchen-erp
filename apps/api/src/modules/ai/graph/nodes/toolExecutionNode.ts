/**
 * LangGraph Node: Tool Execution Node
 */

import type { ArgusOneGraphState } from '../state';
import type { ChatMessage } from '../../providers/ai.provider';
import { toolRegistry } from '../../tools/tool.registry';

export async function toolExecutionNode(state: ArgusOneGraphState): Promise<ArgusOneGraphState> {
  if (state.isCompleted || state.toolCalls.length === 0) return state;

  const newMessages: ChatMessage[] = [];
  const dataSources = new Set(state.dataSources);
  const toolResults: unknown[] = [];

  for (const toolCall of state.toolCalls) {
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

    const execution = await toolRegistry.executeTool(fnName, fnArgs, {
      tenantId: state.tenantContext.tenantId,
      userId: state.authenticatedUser.userId,
      role: state.authenticatedUser.role,
    });

    execution.dataSources.forEach((ds) => dataSources.add(ds));
    toolResults.push(execution.result);

    newMessages.push({
      role: 'tool',
      tool_call_id: (toolCall.id as string) || `call-${Date.now()}`,
      name: fnName,
      content: JSON.stringify(execution.result),
    });
  }

  return {
    ...state,
    messages: [...state.messages, ...newMessages],
    dataSources,
    toolResults: [...state.toolResults, ...toolResults],
    toolCalls: [],
  };
}
