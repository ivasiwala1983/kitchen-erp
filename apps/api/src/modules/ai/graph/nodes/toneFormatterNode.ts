/**
 * LangGraph Node: Tone & Language Formatting Pass
 * Adapts phrasing and friendliness to match user tone/language while keeping numbers and facts strictly intact.
 */

import type { ArgusOneGraphState } from '../state';

export function toneFormatterNode(state: ArgusOneGraphState): ArgusOneGraphState {
  if (state.isCompleted || !state.aiResponse) return state;

  let response = state.aiResponse;
  const tone = state.detectedTone || 'formal';

  // Apply natural tone prefixing if response does not already have an emoji or greeting
  if (
    tone === 'casual' &&
    !response.startsWith('😄') &&
    !response.startsWith('😊') &&
    !response.startsWith('👍')
  ) {
    if (state.detectedLanguage === 'hinglish') {
      response = `😄 ${response}`;
    } else {
      response = `Sure! ${response}`;
    }
  }

  return {
    ...state,
    aiResponse: response,
  };
}
