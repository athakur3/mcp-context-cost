import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  CAPTURE_INDEX_METHOD,
  identify,
  parseCaptureIndex,
  type CaptureIndex,
} from '../src/core/capture-index.js';
import { measureTools } from '../src/core/canonical.js';
import { buildReport, formatReport, serverKey } from '../src/audit/audit.js';
import { loadToolVectors } from '../src/sweep/regressions.js';
import type { ServerEntry } from '../src/sweep/report.js';

/**
 * `--changed` tells a user their server got heavier, which is a claim about
 * *which server they have*. The failure mode that matters is claiming it from
 * the config's name — a key a user chose, which may sit on a fork, a pin, or
 * something unrelated. Everything here is about the join being byte identity,
 * and about the unknown case staying unknown.
 */

const SHA_OLD = 'a'.repeat(64);
const SHA_NEW = 'b'.repeat(64);
const SHA_OTHER = 'c'.repeat(64);

const index: CaptureIndex = {
  method: CAPTURE_INDEX_METHOD,
  generatedAt: '2026-09-04',
  captures: {
    [SHA_OLD]: { server: 'obsidian', date: '2026-08-19', totalTokens: 1132, toolCount: 12 },
    [SHA_NEW]: { server: 'obsidian', date: '2026-08-26', totalTokens: 2062, toolCount: 15 },
  },
  current: { obsidian: SHA_NEW },
};

describe('identify — by bytes, never by name', () => {
  it('places an older published capture as behind, with the delta to current', () => {
    const v = identify(SHA_OLD, index);
    expect(v.kind).toBe('behind');
    if (v.kind !== 'behind') throw new Error('unreachable');
    expect(v.server).toBe('obsidian');
    expect(v.yourTokens).toBe(1132);
    expect(v.currentTokens).toBe(2062);
    expect(v.deltaTokens).toBe(930);
    expect(v.yourDate).toBe('2026-08-19');
    expect(v.currentDate).toBe('2026-08-26');
  });

  it('places the newest published capture as current', () => {
    const v = identify(SHA_NEW, index);
    expect(v.kind).toBe('current');
    if (v.kind !== 'current') throw new Error('unreachable');
    expect(v.server).toBe('obsidian');
    expect(v.tokens).toBe(2062);
  });

  it('refuses to identify bytes it has never published', () => {
    // A version newer than anything measured, a fork, a pin — all the same
    // answer, because the index cannot describe what it has not measured.
    expect(identify(SHA_OTHER, index).kind).toBe('unknown');
    expect(identify(null, index).kind).toBe('unknown');
    expect(identify(undefined, index).kind).toBe('unknown');
  });

  it('does not claim a comparison when the current pointer has no capture behind it', () => {
    const broken: CaptureIndex = { ...index, current: { obsidian: SHA_OTHER } };
    expect(identify(SHA_OLD, broken).kind).toBe('current');
  });
});

describe('parseCaptureIndex', () => {
  it('round-trips its published form', () => {
    expect(parseCaptureIndex(JSON.stringify(index))).toEqual(index);
  });

  it('rejects text that is not an index, and drops malformed captures', () => {
    expect(parseCaptureIndex('nope')).toBeNull();
    expect(parseCaptureIndex('{"generatedAt":"2026-09-04"}')).toBeNull();
    const dirty = parseCaptureIndex(
      JSON.stringify({ ...index, captures: { ...index.captures, bad: { server: 'x' } } }),
    );
    expect(Object.keys(dirty!.captures).sort()).toEqual([SHA_OLD, SHA_NEW].sort());
  });
});

describe('the audit report', () => {
  const stdio = (name: string) => ({ name, transport: 'stdio' as const, command: 'node', argv: ['node', `${name}.js`] });
  const cfg = (servers: ReturnType<typeof stdio>[]) =>
    [{ client: 'claude-desktop', source: '/cfg.json', servers }] as Parameters<typeof buildReport>[0];
  const measurement = measureTools([{ name: 't', description: 'A tool.', inputSchema: { type: 'object' } }], {
    serverName: 'x',
    launchCommand: 'node x.js',
    envVarNames: [],
  });
  /** An index in which the measured stub is a published capture that has since moved. */
  const indexFor = (sha: string): CaptureIndex => ({
    method: CAPTURE_INDEX_METHOD,
    generatedAt: '2026-09-04',
    captures: {
      [sha]: { server: 'upstream-name', date: '2026-08-19', totalTokens: measurement.totalTokens!, toolCount: 1 },
      [SHA_NEW]: { server: 'upstream-name', date: '2026-09-03', totalTokens: measurement.totalTokens! + 500, toolCount: 2 },
    },
    current: { 'upstream-name': SHA_NEW },
  });

  it('names both the local label and the server the bytes identify', () => {
    const a = stdio('my-local-alias');
    const r = buildReport(cfg([a]), new Map([[serverKey(a), measurement]]), {
      generatedAt: 'T',
      captureIndex: indexFor(measurement.canonicalSha256!),
    });
    expect(r.captureIndex).toEqual({ generatedAt: '2026-09-04', captureCount: 2 });
    const text = formatReport(r);
    expect(text).toContain('my-local-alias (published as upstream-name)');
    expect(text).toContain('+500');
    expect(text).toContain('would add 500 tokens');
    expect(text).toContain('matched by canonical hash, never by name');
  });

  it('reports an unidentifiable server as unidentified, claiming nothing about it', () => {
    const a = stdio('mystery');
    const r = buildReport(cfg([a]), new Map([[serverKey(a), measurement]]), {
      generatedAt: 'T',
      captureIndex: index, // the stub's bytes are not in it
    });
    const text = formatReport(r);
    expect(text).toContain('could not be identified');
    expect(text).toContain('Nothing is claimed about it');
    expect(text).not.toContain('published as');
  });

  it('attaches nothing at all when --changed did not run', () => {
    const a = stdio('x');
    const r = buildReport(cfg([a]), new Map([[serverKey(a), measurement]]), { generatedAt: 'T' });
    expect(r.configs[0].captureVerdicts).toBeUndefined();
    expect(r.captureIndex).toBeUndefined();
    expect(formatReport(r)).not.toContain('changed');
  });
});

describe('the committed index is the one the vectors derive', () => {
  it('names, for every entry, a capture its own tool-vectors file holds', () => {
    const repoRoot = join(import.meta.dirname, '..');
    const committed = parseCaptureIndex(readFileSync(join(repoRoot, 'results', 'capture-index.json'), 'utf8'));
    expect(committed).not.toBeNull();
    const doc = parse(readFileSync(join(repoRoot, 'servers.yaml'), 'utf8')) as { servers: ServerEntry[] };
    let checked = 0;
    for (const entry of doc.servers) {
      const vectors = loadToolVectors(entry.name, repoRoot);
      if (!vectors || vectors.entries.length === 0) continue;
      for (const e of vectors.entries) {
        expect(committed!.captures[e.canonicalSha256], `${entry.name}@${e.date}`).toMatchObject({
          server: entry.name,
          date: e.date,
          totalTokens: e.totalTokens,
        });
        checked++;
      }
      // The current pointer is the newest capture on record for that server.
      expect(committed!.current[entry.name]).toBe(vectors.entries[vectors.entries.length - 1]!.canonicalSha256);
    }
    expect(checked).toBeGreaterThan(0);
    expect(Object.keys(committed!.captures)).toHaveLength(checked);
  });
});
