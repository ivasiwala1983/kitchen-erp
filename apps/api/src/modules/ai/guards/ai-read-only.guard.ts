/**
 * Read-Only Hard Guard for ArgusOne AI.
 * Guarantees that ArgusOne AI cannot register, execute, or invoke any mutation/write tools.
 */

import { config } from '../../../config/env';

export interface ToolDefinition {
  name: string;
  description: string;
  isReadOnly: boolean;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (
    params: Record<string, any>,
    context: { tenantId: string; userId: string; role: string }
  ) => Promise<unknown>;
}

export class AiReadOnlyGuard {
  /**
   * Validates if a tool definition is permitted to be registered under read-only mode.
   * Throws an error if a write tool is attempted when AI_READ_ONLY is true.
   */
  static validateToolRegistration(tool: ToolDefinition): void {
    if (config.aiReadOnly && !tool.isReadOnly) {
      throw new Error(
        `[AiReadOnlyGuard] Security Violation: Attempted to register write tool '${tool.name}' while AI_READ_ONLY is enabled.`
      );
    }
  }

  /**
   * Validates tool execution request before dispatch.
   */
  static validateToolExecution(tool: ToolDefinition): void {
    if (config.aiReadOnly && !tool.isReadOnly) {
      throw new Error(
        `[AiReadOnlyGuard] Security Violation: Execution of write tool '${tool.name}' is strictly blocked.`
      );
    }
  }
}
