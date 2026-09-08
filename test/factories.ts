// The one measurement factory, replacing six file-local copies that had
// drifted into six default sets — five serverNames' worth of `'demo-server'`
// against `'memory'`, three shas, four dates — so a new required field on
// `Measurement` was six edits and a reader could not tell which defaults a
// test relied on.
//
// The defaults are neutral on purpose: the majority value where the six
// agreed, zero where they did not. A test that depends on a value states it
// at the call site — that is the contract, and the suite enforces it, because
// every assertion in the adopting files compares against a literal rather
// than against another factory-derived value. Fix a red test by stating the
// value it depends on, never by widening a default back toward some file's
// old local one: a default that creeps toward one file's needs is how the six
// copies happened the first time.
//
// Not a `.test.ts` file, so vitest does not collect it — `tmp.ts` and
// `tsx.ts` next door are the precedent; tsconfig.test.json, oxlint and
// prettier already cover the path.
import type { Measurement } from '../src/core/types.js';

/** A measured record with neutral defaults; state what your test depends on. */
export function measurement(over: Partial<Measurement> = {}): Measurement {
  return {
    methodologyVersion: '1.0',
    provider: 'tiktoken',
    encoding: 'o200k_base',
    status: 'measured',
    totalTokens: 0,
    toolCount: 0,
    tools: [],
    canonicalSha256: 'a'.repeat(64),
    rawToolsCapture: [],
    measuredAt: '2026-08-16T12:00:00.000Z',
    serverName: 'demo-server',
    ...over,
  };
}
