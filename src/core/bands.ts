/**
 * Provisional color bands (v0) — to be frozen against observed sweep
 * percentiles before launch (see METHODOLOGY.md). Any change bumps the
 * methodology version.
 */
export function bandColor(totalTokens: number): string {
  if (totalTokens < 1_000) return 'brightgreen';
  if (totalTokens < 5_000) return 'green';
  if (totalTokens < 15_000) return 'yellow';
  if (totalTokens < 30_000) return 'orange';
  return 'red';
}

export const UNKNOWN_COLOR = 'lightgrey';
