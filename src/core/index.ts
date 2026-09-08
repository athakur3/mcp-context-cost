/**
 * The library export — what `import … from "mcp-context-cost"` gives you.
 *
 * Named rather than `export *`, and that is the point of the file. A wildcard
 * makes the public surface "whatever these seven modules happen to export",
 * which then moves in both directions without anyone deciding: a new export in
 * `canonical.ts` widens the API, and a deleted one narrows it. Removing five
 * names from `session-start.ts` on 2026-09-08 did exactly that, and nothing
 * anywhere reported it.
 *
 * Naming them buys two things no test can. A name that leaves its module is a
 * compile error here (TS2305) rather than a quiet narrowing — for types as much
 * as for values, which is the half a runtime check cannot see at all. And a
 * name added to a module does not reach the API until it is added here, so the
 * surface widens by decision instead of by inheritance.
 *
 * What belongs: the measurement and what is derived from it — the canonical
 * form and its tokenizer, the colour bands, the badge, the Claude field
 * selection, the session-start load. What does not: anything that launches a
 * server, reads someone's config, or renders this repository's own pages. That
 * is the harness, and `audit` is its entry point.
 *
 * `test/core.test.ts` pins this list, so a change here arrives with a changelog
 * entry rather than on its own.
 */

/** The record every published number is re-derivable from. */
export type { Measurement, MeasurementStatus, ToolMeasurement, BadgeJson } from './types.js';

/** The measurement itself: canonical bytes, the pinned tokenizer, the hash. */
export {
  METHODOLOGY_VERSION,
  canonicalString,
  countTokens,
  failedMeasurement,
  measureTool,
  measureTools,
  sha256Hex,
} from './canonical.js';

/** What an Anthropic request carries of a capture, and what it drops. */
export {
  ANTHROPIC_TOOL_FIELDS,
  DIVERGENCE_METHOD,
  claudeRatio,
  dropStaleRows,
  fieldSelectionShare,
  isCurrent,
  mappedTokens,
  parseDivergence,
  toAnthropicTools,
} from './divergence.js';
export type { AnthropicTool, DivergenceRow, DivergenceRun } from './divergence.js';

/** What a client pays at session start when it defers definitions. */
export {
  SESSION_START_METHOD,
  measuredInstructions,
  sessionStartLoad,
  sessionStartTokens,
  toolNameTokens,
  toolNames,
} from './session-start.js';
export type { InstructionsSource, SessionStartLoad } from './session-start.js';

/** The frozen colour bands, and the badge JSON shields.io reads. */
export { BAND_META, UNKNOWN_COLOR, bandColor } from './bands.js';
export { BADGE_CACHE_SECONDS, BADGE_LABEL, formatTokens, toBadge } from './badge.js';
export { readmeSnippet } from './snippet.js';

/**
 * The type half of the surface, pinned where it can actually fail.
 *
 * The runtime half is a list in `test/core.test.ts` read off `Object.keys`.
 * Types are erased before that runs, so they need a compile-time check — and it
 * cannot live in the test, because `tsconfig.json` includes only `src` and
 * `tsconfig.tools.json` only `src` and `tools`: no test file is typechecked by
 * `npm run typecheck`, so a type assertion written there would report nothing
 * and read as though it did.
 *
 * A type-only self-import instead. Dropping a name from the list above stops
 * this file compiling (TS2724), and shortening the tuple without changing the
 * count below fails too, so neither half can be edited alone.
 */
import type * as Public from './index.js';

type PublicTypes = [
  Public.AnthropicTool,
  Public.BadgeJson,
  Public.DivergenceRow,
  Public.DivergenceRun,
  Public.InstructionsSource,
  Public.Measurement,
  Public.MeasurementStatus,
  Public.SessionStartLoad,
  Public.ToolMeasurement,
];

/** Nine types. Changing the list means changing this, which means saying so. */
const publicTypeCount: PublicTypes['length'] = 9;
void publicTypeCount;
