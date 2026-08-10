/**
 * LangGraph Node: Final Response Formatting Node
 */

import type { ArgusOneGraphState } from '../state';

export interface FinalGraphOutput {
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

export function finalResponseNode(state: ArgusOneGraphState): FinalGraphOutput {
  const tenantSlug = state.tenantContext.tenantSlug;
  const dataSourcesList = Array.from(state.dataSources);

  const quickActions: Array<{ label: string; route: string }> = [];
  const textLower = state.userMessage.toLowerCase();

  if (tenantSlug) {
    if (
      dataSourcesList.includes('Purchase History') ||
      textLower.includes('purchase') ||
      textLower.includes('buy') ||
      textLower.includes('spent')
    ) {
      quickActions.push({ label: 'View Purchases', route: `/t/${tenantSlug}/history` });
    }

    if (
      dataSourcesList.includes('Ledger & Payments') ||
      textLower.includes('ledger') ||
      textLower.includes('owe') ||
      textLower.includes('balance') ||
      textLower.includes('vendor')
    ) {
      quickActions.push({ label: 'View Ledger', route: `/t/${tenantSlug}/ledger` });
    }
  }

  return {
    message: state.aiResponse || 'I have analyzed your query based on current system data.',
    dataSources: dataSourcesList,
    quickActions,
    code: state.code || 'SUCCESS',
    userMessage: state.userMessageFormatted || state.aiResponse,
  };
}
