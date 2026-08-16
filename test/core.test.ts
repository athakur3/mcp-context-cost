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

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../spec/fixtures');
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
    expect(Object.keys(badge).sort()).toEqual([
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
