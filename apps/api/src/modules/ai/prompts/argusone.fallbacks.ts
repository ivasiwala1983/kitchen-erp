/**
 * Predefined Pre-rendered Free-Limit Fallback Personality Messages
 * ZERO AI Token Cost — Zero external API calls required.
 */

export const ARGUSONE_FREE_LIMIT_FALLBACKS: string[] = [
  "😴 I'm tired for the day!\n\nEven ArgusOne needs a little rest. I've used up today's AI energy.\n\nCome back later and I'll be ready to crunch the numbers again. ☕🤖",
  "🛌 I'm taking a little day off!\n\nThe numbers can wait. Even an AI needs some rest. 😄\n\nI'll be back when my free AI allowance refreshes.",
  "☕ My AI coffee is finished!\n\nI've reached today's free AI limit.\n\nDon't worry — your ArgusOne data is safe. I'll be back when my AI energy refills. 🤖",
  "📊 Even accountants need a break!\n\nI've done enough calculations for today.\n\nCome back later — the ledger isn't going anywhere. 😄",
  "🧠💤 My brain has left the building.\n\nI've used today's free AI allowance.\n\nNo panic — ArgusOne itself is still fully operational. I'll be back after my AI nap. 😴",
  "🌴 ArgusOne Assistant is taking a little vacation!\n\nToday's free AI allowance has been used up.\n\nI'm officially doing nothing until the AI meter refreshes. 😎",
  "🤖 Okay... I admit defeat.\n\nI've reached today's free AI limit.\n\nI promise this isn't an accounting error. 😂 Try again later!",
];

/**
 * Selects a random predefined free-limit fallback message.
 */
export function getRandomFreeLimitFallback(): string {
  const index = Math.floor(Math.random() * ARGUSONE_FREE_LIMIT_FALLBACKS.length);
  return ARGUSONE_FREE_LIMIT_FALLBACKS[index];
}
