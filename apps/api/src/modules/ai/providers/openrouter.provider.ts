/**
 * OpenRouter AI Provider Implementation
 * Encapsulates backend HTTP communication with OpenRouter API endpoints.
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../../../config/env';
import type { AIProvider, AIProviderResponse, ChatMessage } from './ai.provider';

export class OpenRouterProvider implements AIProvider {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: 15000, // 15s timeout safeguard
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Validates configured model against OPENROUTER_FREE_ONLY guard.
   */
  private validateModelGuard(): void {
    const configuredModel = config.openrouterModel || 'openrouter/free';

    if (config.openrouterFreeOnly) {
      const isAllowedFreeModel =
        configuredModel === 'openrouter/free' ||
        configuredModel.startsWith('openrouter/free') ||
        configuredModel.endsWith(':free');

      if (!isAllowedFreeModel) {
        throw new Error(
          `[OpenRouterProvider] Security Guard Violation: OPENROUTER_FREE_ONLY is true but paid model '${configuredModel}' is configured.`
        );
      }
    }
  }

  public async chat(messages: ChatMessage[], tools?: unknown[]): Promise<AIProviderResponse> {
    // 1. Validate free-only safety guard
    this.validateModelGuard();

    // 2. Validate API Key configuration
    if (!config.openrouterApiKey || config.openrouterApiKey.trim() === '') {
      throw new Error('OPENROUTER_API_KEY_MISSING');
    }

    const modelName = config.openrouterModel || 'openrouter/free';

    const payload: Record<string, unknown> = {
      model: modelName,
      messages,
      temperature: 0.2, // low temperature for factual query processing
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.openrouterApiKey}`,
    };

    if (config.openrouterSiteUrl) {
      headers['HTTP-Referer'] = config.openrouterSiteUrl;
    }
    if (config.openrouterSiteName) {
      headers['X-Title'] = config.openrouterSiteName;
    }

    try {
      const response = await this.client.post('/chat/completions', payload, { headers });
      const choice = response.data?.choices?.[0];

      if (!choice || !choice.message) {
        throw new Error('Invalid response structure from OpenRouter API.');
      }

      return {
        message: choice.message,
        finishReason: choice.finish_reason || 'stop',
        model: modelName,
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; code?: string; message?: string };
      if (err.response?.status === 429) {
        throw new Error('OPENROUTER_RATE_LIMIT');
      }
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        throw new Error('OPENROUTER_TIMEOUT');
      }
      if (err.response?.status && err.response.status >= 500) {
        throw new Error('OPENROUTER_PROVIDER_UNAVAILABLE');
      }
      throw error;
    }
  }
}
