import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  measureTools,
  failedMeasurement,
  canonicalString,
  countTokens,
  sha256Hex,
  bandColor,
  toBadge,
  readmeSnippet,
  BADGE_CACHE_SECONDS,
} from '../src/core/index.js';
import * as publicApi from '../src/core/index.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(repoRoot, 'spec/fixtures');
const tools = JSON.parse(readFileSync(join(fixtures, 'tools-basic.json'), 'utf8'));
const expected = JSON.parse(readFileSync(join(fixtures, 'expected-basic.json'), 'utf8'));

describe('golden fixture (the spec, executable)', () => {
  const m = measureTools(tools, {
    serverName: 'fixture-basic',
    serverVersion: '1.0.0',
    launchCommand: 'npx -y fixture-basic',
    measuredAt: '2026-08-16T00:00:00.000Z',
  });

  it('reproduces the frozen measurement exactly', () => {
    expect(m).toEqual(expected.measurement);
  });

  it('derives the frozen badge JSON', () => {
    expect(toBadge(m)).toEqual(expected.badge);
  });

  it('derives the frozen README snippet', () => {
    expect(
      readmeSnippet(
        'https://raw.githubusercontent.com/OWNER/mcp-context-cost/main/badges/fixture-basic.json',
        'https://OWNER.github.io/mcp-context-cost/methodology#m1',
      ),
    ).toEqual(expected.snippet);
  });
});

describe('reproducibility (the dispute drill)', () => {
  it('re-tokenizing the published capture reproduces the total exactly', () => {
    const m = measureTools(tools, { serverName: 'x' });
    const rederived = countTokens(JSON.stringify(m.rawToolsCapture));
    expect(rederived).toBe(m.totalTokens);
  });

  it('canonical hash matches an independent sha256 of the capture', () => {
    const m = measureTools(tools, { serverName: 'x' });
    expect(sha256Hex(JSON.stringify(m.rawToolsCapture))).toBe(m.canonicalSha256);
  });

  it('canonical serialization is deterministic across calls', () => {
    expect(canonicalString(tools)).toBe(canonicalString(JSON.parse(JSON.stringify(tools))));
  });
});

describe('bands (provisional v0)', () => {
  it.each([
    [0, 'brightgreen'],
    [999, 'brightgreen'],
    [1000, 'green'],
    [4999, 'green'],
    [5000, 'yellow'],
    [14999, 'yellow'],
    [15000, 'orange'],
    [29999, 'orange'],
    [30000, 'red'],
    [42000, 'red'],
  ])('%i tokens -> %s', (tokens, color) => {
    expect(bandColor(tokens)).toBe(color);
  });
});

describe('badge rendering', () => {
  it('thousands-separates the message', () => {
    const m = measureTools(tools, { serverName: 'x' });
    m.totalTokens = 12430;
    expect(toBadge(m).message).toBe('12,430 tokens');
  });

  it('renders grey unknown for failed measurements', () => {
    const badge = toBadge(failedMeasurement('auth-required', { serverName: 'x' }));
    expect(badge).toEqual({
      schemaVersion: 1,
      label: 'context cost',
      message: 'unknown',
      color: 'lightgrey',
      cacheSeconds: BADGE_CACHE_SECONDS,
    });
  });

  it('emits strict shields endpoint schema with no extra keys', () => {
    const badge = toBadge(measureTools(tools, { serverName: 'x' }));
    expect(Object.keys(badge).toSorted()).toEqual([
      'cacheSeconds',
      'color',
      'label',
      'message',
      'schemaVersion',
    ]);
  });
});

describe('snippet', () => {
  it('URL-encodes the endpoint url and wraps the image in a methodology link', () => {
    const s = readmeSnippet('https://example.com/a.json', 'https://example.com/m');
    expect(s).toBe(
      '[![context cost](https://img.shields.io/endpoint?url=https%3A%2F%2Fexample.com%2Fa.json)](https://example.com/m)',
    );
  });
});

/**
 * The library surface, pinned.
 *
 * `src/core/index.ts` was written as the export a library would ship — the note
 * in `core/protocol.ts` says so, and says why that module is kept out of it —
 * but `package.json` never declared it, so for eight months it was a public API
 * in every sense except the one that would have made a change to it reviewable.
 * It shipped in the tarball, it was reachable at
 * `mcp-context-cost/dist/core/index.js`, and because the barrel is `export *`
 * its contents moved whenever any of the seven modules moved. Removing five
 * names from `core/session-start.ts` on 2026-09-08 took them off the published
 * surface, and nothing anywhere noticed or had reason to.
 *
 * `package.json` declares it now, which makes it a compatibility obligation.
 * This is the list that obligation is measured against: adding an export fails
 * here, and so does removing one, so both arrive as a deliberate edit with a
 * changelog entry rather than as a side effect of tidying a module.
 *
 * What it does not cover, stated so nobody reads more into a green run: these
 * are the *runtime* exports. A type removed from `dist/core/index.d.ts` is just
 * as breaking for a TypeScript consumer and is invisible here.
 */
describe('the published library surface', () => {
  const SURFACE = [
    'ANTHROPIC_TOOL_FIELDS',
    'BADGE_CACHE_SECONDS',
    'BADGE_LABEL',
    'BAND_META',
    'DIVERGENCE_METHOD',
    'METHODOLOGY_VERSION',
    'SESSION_START_METHOD',
    'UNKNOWN_COLOR',
    'bandColor',
    'canonicalString',
    'claudeRatio',
    'countTokens',
    'dropStaleRows',
    'failedMeasurement',
    'fieldSelectionShare',
    'formatTokens',
    'isCurrent',
    'mappedTokens',
    'measureTool',
    'measureTools',
    'measuredInstructions',
    'parseDivergence',
    'readmeSnippet',
    'sessionStartLoad',
    'sessionStartTokens',
    'sha256Hex',
    'toAnthropicTools',
    'toBadge',
    'toolNameTokens',
    'toolNames',
  ];

  it('exports exactly what package.json promises a consumer', () => {
    const actual = Object.keys(publicApi)
      .filter((n) => n !== 'default')
      .toSorted();
    expect(
      actual,
      'the library surface moved. If that was intended, update this list and say so in the ' +
        'changelog — a consumer is pinned to a version, and this is the promise that version made',
    ).toEqual(SURFACE.toSorted());
  });

  // The type half of this surface is pinned in `src/core/index.ts` itself, not
  // here: no test file is in either tsconfig's `include`, so a compile-time
  // assertion written in this file would never be checked by `npm run
  // typecheck` and would read as a guarantee it could not give.
  it('is what package.json points at, so the promise and the file cannot come apart', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      main: string;
      types: string;
      exports: Record<string, { types: string; default: string }>;
    };
    // Built paths, so they are checked as strings against the compiler's own
    // output layout (`outDir: dist`, `rootDir: src`) rather than read off disk —
    // `dist/` is a build artifact and is not in the repository.
    expect(pkg.main).toBe('./dist/core/index.js');
    expect(pkg.types).toBe('./dist/core/index.d.ts');
    expect(pkg.exports['.'].default).toBe(pkg.main);
    expect(pkg.exports['.'].types).toBe(pkg.types);
  });
});
