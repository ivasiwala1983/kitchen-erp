/**
 * AI Provider Abstraction Interface
 * Decouples the LangGraph workflow and tools from specific AI providers or model vendors.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<Record<string, unknown>>;
}

export interface AIProviderResponse {
  message: ChatMessage;
  finishReason: string;
  model: string;
}

export interface AIProvider {
  chat(messages: ChatMessage[], tools?: unknown[]): Promise<AIProviderResponse>;
}
