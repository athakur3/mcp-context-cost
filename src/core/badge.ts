import type { BadgeJson, Measurement } from './types.js';
import { bandColor, UNKNOWN_COLOR } from './bands.js';

export const BADGE_LABEL = 'context cost';
export const BADGE_CACHE_SECONDS = 3600;

export function formatTokens(totalTokens: number): string {
  return `${totalTokens.toLocaleString('en-US')} tokens`;
}

/**
 * Measurement -> strict shields.io endpoint JSON. Non-measured statuses render
 * grey "unknown" (used only in sweep snapshots; maintainer CI publishes only
 * on success, so their badges degrade to last-known-good instead).
 */
export function toBadge(m: Measurement): BadgeJson {
  const measurable = (m.status === 'measured' || m.status === 'dynamic') && m.totalTokens !== null;
  return {
    schemaVersion: 1,
    label: BADGE_LABEL,
    message: measurable ? formatTokens(m.totalTokens as number) : 'unknown',
    color: measurable ? bandColor(m.totalTokens as number) : UNKNOWN_COLOR,
    cacheSeconds: BADGE_CACHE_SECONDS,
  };
}
