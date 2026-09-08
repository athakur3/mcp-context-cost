/**
 * Badge color bands, frozen on 2026-08-16 against the observed percentiles of
 * the first full sweep (see METHODOLOGY.md §"Color bands"). Frozen is the point:
 * a boundary that moved with the data would recolour badges nobody re-measured.
 * Any change to these numbers bumps the methodology version.
 */
export function bandColor(totalTokens: number): string {
  if (totalTokens < 1_000) return 'brightgreen';
  if (totalTokens < 5_000) return 'green';
  if (totalTokens < 15_000) return 'yellow';
  if (totalTokens < 30_000) return 'orange';
  return 'red';
}

export const UNKNOWN_COLOR = 'lightgrey';

/** Human-readable name + range for each band, shared by every generated view. */
export const BAND_META: Record<string, { label: string; range: string }> = {
  brightgreen: { label: 'lean', range: '< 1K' },
  green: { label: 'light', range: '1–5K' },
  yellow: { label: 'moderate', range: '5–15K' },
  orange: { label: 'heavy', range: '15–30K' },
  red: { label: 'very heavy', range: '≥ 30K' },
};
