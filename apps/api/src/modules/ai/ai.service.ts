/**
 * ArgusOne AI Service
 * Delegates execution to LangGraph state machine workflow (`ArgusOneGraph`).
 */

import { ArgusOneGraph } from './graph/argusone.graph';
import type { FinalGraphOutput } from './graph/nodes/finalResponseNode';

export class AiService {
  private graph: ArgusOneGraph;

  constructor() {
    this.graph = new ArgusOneGraph();
  }

  public async chat(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
    context: {
      tenantId: string;
      userId: string;
      role: string;
      tenantSlug?: string;
      tenantName?: string;
      userName?: string;
    }
  ): Promise<FinalGraphOutput> {
    return this.graph.run({ message, history, context });
  }
}

export const aiService = new AiService();
