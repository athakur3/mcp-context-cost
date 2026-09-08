/**
 * Signed numbers, formatted one way.
 *
 * These were thirteen inline lambdas in three mutually inconsistent
 * conventions, and the inconsistency reached the published pages: the
 * leaderboard and the movement report typeset a fall as `−369`, while the
 * dashboard and every server page's history column typeset the same fall as
 * `-369` — because those let `toLocaleString` supply the sign instead of
 * prepending one, and its sign is a hyphen. One fact, two typographies, decided
 * by which copy rendered it.
 *
 * Two intents live here, and they are not interchangeable:
 *
 *  - `signed` is a magnitude with a direction. Zero has no direction, so it
 *    prints bare.
 * Not in the library export: these render this repository's own pages, and a
 * consumer formats its own numbers. `core/index.ts` says what is public.
 *
 *  - `signedToPrecision` is for a value whose *displayed* precision can round to
 *    zero while the value itself still points one way. The leaderboard's
 *    cross-check column is the case: `+0.0%` and `−0.0%` are a small rise and a
 *    small fall, and printing both as `0.0%` would delete the difference.
 */

/** The one locale every published surface counts in. */
export const count = (v: number): string => v.toLocaleString('en-US');

/** U+2212 MINUS SIGN — never the hyphen `toLocaleString` and `toFixed` supply. */
const MINUS = '−';

const direction = (v: number): string => (v > 0 ? '+' : v < 0 ? MINUS : '');

/** A magnitude with a direction; zero prints bare. */
export const signed = (v: number): string => `${direction(v)}${count(Math.abs(v))}`;

/** The same rule for a percentage. */
export const signedPct = (v: number, digits = 1): string =>
  `${direction(v)}${Math.abs(v).toFixed(digits)}%`;

/**
 * A percentage that always carries its direction, because the rounding can
 * reach zero from either side and which side it came from is the finding.
 */
export const signedPctToPrecision = (v: number, digits = 1): string =>
  `${v >= 0 ? '+' : MINUS}${Math.abs(v).toFixed(digits)}%`;
