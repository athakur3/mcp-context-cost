import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SESSION_START_METHOD,
  isCurrentInstructions,
  measuredInstructions,
  parseSessionStart,
  sessionStartLoad,
  sessionStartTokens,
  toSessionStartRow,
  toolNameTokens,
  toolNames,
  type SessionStartRow,
} from '../src/core/session-start.js';
import { countTokens, measureTools, sha256Hex } from '../src/core/canonical.js';
import { writeLeaderboard, sessionStartCell, type ServerEntry } from '../src/sweep/report.js';
import type { Measurement } from '../src/core/types.js';

const rawTools = [
  {
    name: 'search',
    title: 'Search The Knowledge Base',
    description: 'Search the knowledge base for a phrase and return ranked passages.',
    inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
  },
  {
    name: 'fetch_document',
    description: 'Fetch a document by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
  },
];

function measurement(over: Partial<Measurement> = {}): Measurement {
  const m = measureTools(rawTools, { serverName: 'demo', measuredAt: '2026-08-19T00:00:00.000Z' });
  return { ...m, ...over };
}

/** A measurement as it was recorded BEFORE serverInstructions existed. */
function legacyMeasurement(over: Partial<Measurement> = {}): Measurement {
  // Round-tripped through JSON, which is how every published measurement is
  // read: an absent key, not a key holding undefined.
  const m = JSON.parse(JSON.stringify(measurement(over))) as Measurement;
  delete (m as { serverInstructions?: unknown }).serverInstructions;
  return m;
}

describe('toolNames', () => {
  it('keeps server order and drops tools with no usable name', () => {
    expect(toolNames([...rawTools, { description: 'nameless' }, { name: '' }, null])).toEqual([
      'search',
      'fetch_document',
    ]);
  });
});

describe('the session-start number', () => {
  it('is the JSON.stringify of the name array, tokenized like the headline', () => {
    expect(toolNameTokens(rawTools)).toBe(countTokens(JSON.stringify(['search', 'fetch_document'])));
  });

  it('is dramatically smaller than the full definitions it defers', () => {
    const m = measurement();
    expect(toolNameTokens(rawTools)).toBeLessThan(m.totalTokens! / 5);
  });

  it('adds the two halves rather than tokenizing them joined, so parts sum to the total', () => {
    const instructions = 'Always call search before fetch_document.';
    expect(sessionStartTokens(rawTools, instructions)).toBe(
      toolNameTokens(rawTools) + countTokens(instructions),
    );
  });

  it('counts no instructions as zero, not as an error', () => {
    expect(sessionStartTokens(rawTools, null)).toBe(toolNameTokens(rawTools));
    expect(sessionStartTokens(rawTools, '')).toBe(toolNameTokens(rawTools));
  });
});

describe('measuredInstructions — absent is not zero', () => {
  it('reads a captured string as itself', () => {
    expect(measuredInstructions(measurement({ serverInstructions: 'hello' }))).toBe('hello');
  });

  it('reads null as "the server sent none"', () => {
    expect(measuredInstructions(measurement({ serverInstructions: null }))).toBe('');
  });

  it('reads an absent field as unknown', () => {
    expect(measuredInstructions(legacyMeasurement())).toBeUndefined();
  });

  it('survives the JSON round trip that every published measurement makes', () => {
    const round = (m: Measurement) => JSON.parse(JSON.stringify(m)) as Measurement;
    expect(measuredInstructions(round(measurement({ serverInstructions: null })))).toBe('');
    expect(measuredInstructions(round(measurement({ serverInstructions: 'x' })))).toBe('x');
  });
});

describe('measureTools records the instructions it was given', () => {
  it('stores a string, and null when the server returned none', () => {
    expect(measureTools(rawTools, { serverName: 'demo', instructions: 'use me' }).serverInstructions).toBe('use me');
    expect(measureTools(rawTools, { serverName: 'demo', instructions: null }).serverInstructions).toBeNull();
  });

  it('leaves the field out of the JSON entirely when nothing was captured', () => {
    const json = JSON.parse(JSON.stringify(measureTools(rawTools, { serverName: 'demo' })));
    expect('serverInstructions' in json).toBe(false);
  });

  it('does not disturb the headline number or its hash', () => {
    const bare = measureTools(rawTools, { serverName: 'demo', measuredAt: '2026-08-19T00:00:00.000Z' });
    const withInstructions = measureTools(rawTools, {
      serverName: 'demo',
      measuredAt: '2026-08-19T00:00:00.000Z',
      instructions: 'a long instructions block that costs real tokens',
    });
    expect(withInstructions.totalTokens).toBe(bare.totalTokens);
    expect(withInstructions.canonicalSha256).toBe(bare.canonicalSha256);
  });
});

describe('sessionStartLoad', () => {
  it('prefers the measurement over a side capture, even a current one', () => {
    const m = measurement({ serverInstructions: 'from the same run' });
    const row = toSessionStartRow('from a later capture', { capturedSha256: m.canonicalSha256 });
    const load = sessionStartLoad(m, row)!;
    expect(load.instructionsSource).toBe('measurement');
    expect(load.instructionsTokens).toBe(countTokens('from the same run'));
    expect(load.isFloor).toBe(false);
  });

  it('falls back to a side capture that still points at the measurement on disk', () => {
    const m = legacyMeasurement();
    const row = toSessionStartRow('backfilled instructions', { capturedSha256: m.canonicalSha256 });
    const load = sessionStartLoad(m, row)!;
    expect(load.instructionsSource).toBe('capture');
    expect(load.totalTokens).toBe(toolNameTokens(rawTools) + countTokens('backfilled instructions'));
    expect(load.isFloor).toBe(false);
  });

  it('degrades a STALE capture to the names-only floor instead of blanking the row', () => {
    const m = legacyMeasurement();
    const row = toSessionStartRow('captured against different tools', { capturedSha256: 'b'.repeat(64) });
    const load = sessionStartLoad(m, row)!;
    expect(load.instructionsSource).toBe('not-captured');
    expect(load.isFloor).toBe(true);
    expect(load.totalTokens).toBe(toolNameTokens(rawTools));
    expect(load.instructionsTokens).toBeNull();
  });

  it('marks an errored capture row as a floor rather than counting it as zero', () => {
    const m = legacyMeasurement();
    const row: SessionStartRow = {
      instructions: '',
      instructionsTokens: 0,
      instructionsSha256: '',
      capturedSha256: m.canonicalSha256,
      error: 'startup-failure: exited 1',
    };
    expect(sessionStartLoad(m, row)!.isFloor).toBe(true);
  });

  it('reports a floor when nothing has ever been captured', () => {
    const load = sessionStartLoad(legacyMeasurement())!;
    expect(load.isFloor).toBe(true);
    expect(load.instructionsTokens).toBeNull();
  });

  it('is null for a measurement with no capture at all — no session, no load', () => {
    expect(sessionStartLoad(measurement({ rawToolsCapture: null, status: 'startup-failure' }))).toBeNull();
  });

  it('never claims a total larger than the definitions it defers', () => {
    const m = measurement({ serverInstructions: null });
    expect(sessionStartLoad(m)!.totalTokens).toBeLessThan(m.totalTokens!);
  });
});

describe('isCurrentInstructions', () => {
  const row = toSessionStartRow('x', { capturedSha256: 'a'.repeat(64) });
  it('needs a matching hash on both sides', () => {
    expect(isCurrentInstructions(row, 'a'.repeat(64))).toBe(true);
    expect(isCurrentInstructions(row, 'b'.repeat(64))).toBe(false);
    expect(isCurrentInstructions(row, null)).toBe(false);
    expect(isCurrentInstructions(undefined, 'a'.repeat(64))).toBe(false);
  });
  it('rejects a row whose capture never happened', () => {
    expect(isCurrentInstructions({ ...row, capturedSha256: null }, null)).toBe(false);
  });
});

describe('toSessionStartRow', () => {
  it('hashes the instructions bytes so the row is disputable like every other number', () => {
    const r = toSessionStartRow('be careful', { capturedSha256: null });
    expect(r.instructionsSha256).toBe(sha256Hex('be careful'));
    expect(r.instructionsTokens).toBe(countTokens('be careful'));
  });
});

describe('parseSessionStart', () => {
  it('returns null rather than throwing on anything malformed', () => {
    expect(parseSessionStart('not json')).toBeNull();
    expect(parseSessionStart('{}')).toBeNull();
    expect(parseSessionStart('{"measuredAt":"2026-08-20"}')).toBeNull();
  });
  it('defaults the method but never invents a date', () => {
    const run = parseSessionStart('{"measuredAt":"2026-08-20","servers":{}}')!;
    expect(run.method).toBe(SESSION_START_METHOD);
    expect(run.measuredAt).toBe('2026-08-20');
  });
});

describe('the leaderboard shows both figures for every measured server', () => {
  let root: string;
  const entries: ServerEntry[] = [
    { name: 'known', command: 'x' },
    { name: 'floored', command: 'y' },
    { name: 'broken', command: 'z' },
  ];

  function place(name: string, m: Measurement) {
    mkdirSync(join(root, 'results', name), { recursive: true });
    writeFileSync(join(root, 'results', name, 'measurement.json'), JSON.stringify(m, null, 2));
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ss-report-'));
    mkdirSync(join(root, 'results'), { recursive: true });
    place('known', measurement({ serverName: 'known', serverInstructions: 'Prefer search over fetch.' }));
    place('floored', legacyMeasurement({ serverName: 'floored' }));
    place(
      'broken',
      measurement({ serverName: 'broken', status: 'startup-failure', rawToolsCapture: null, totalTokens: null }),
    );
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('prints a session-start figure on every measured row', () => {
    writeLeaderboard(entries, root);
    const md = readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8');
    const rows = md.split('\n').filter((l) => /^\| \d+ \|/.test(l));
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.split('|')[4].trim()).toMatch(/^≥?[\d,]+$/);
  });

  it('marks the floored row and only the floored row', () => {
    writeLeaderboard(entries, root);
    const md = readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8');
    const cell = (name: string) =>
      md.split('\n').find((l) => l.includes(`[${name}]`))!.split('|')[4].trim();
    expect(cell('floored').startsWith('≥')).toBe(true);
    expect(cell('known').startsWith('≥')).toBe(false);
    expect(md).toContain('marks a floor, on 1 of 2 rows');
  });

  it('says nothing about floors when there are none', () => {
    rmSync(join(root, 'results', 'floored'), { recursive: true });
    writeLeaderboard([entries[0], entries[2]], root);
    expect(readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8')).not.toContain('marks a floor');
  });

  it('uses a current side capture to lift a legacy row off its floor', () => {
    const m = JSON.parse(readFileSync(join(root, 'results', 'floored', 'measurement.json'), 'utf8')) as Measurement;
    writeFileSync(
      join(root, 'results', 'session-start.json'),
      JSON.stringify({
        method: SESSION_START_METHOD,
        measuredAt: '2026-08-20',
        servers: { floored: toSessionStartRow('backfilled', { capturedSha256: m.canonicalSha256 }) },
      }),
    );
    writeLeaderboard(entries, root);
    const md = readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8');
    expect(md.split('\n').find((l) => l.includes('[floored]'))!.split('|')[4].trim().startsWith('≥')).toBe(false);
    expect(md).not.toContain('marks a floor');
  });

  it('carries the parts and the floor flag into the CSV, appended after the existing columns', () => {
    writeLeaderboard(entries, root);
    const csv = readFileSync(join(root, 'results', 'leaderboard.csv'), 'utf8').trim().split('\n');
    expect(csv[0]).toBe(
      'name,tokens,toolCount,status,category,metric,metricSource,claudeTokens,claudeModel,' +
        'sessionStartTokens,sessionStartIsFloor,toolNameTokens,instructionsTokens',
    );
    const cols = (name: string) => csv.find((l) => l.startsWith(`${name},`))!.split(',');
    expect(cols('known').slice(9, 13)).toEqual([
      String(toolNameTokens(rawTools) + countTokens('Prefer search over fetch.')),
      'false',
      String(toolNameTokens(rawTools)),
      String(countTokens('Prefer search over fetch.')),
    ]);
    expect(cols('floored').slice(9, 13)).toEqual([String(toolNameTokens(rawTools)), 'true', String(toolNameTokens(rawTools)), '']);
    // A server with no capture has no session-start columns at all — not zeros.
    expect(cols('broken').slice(9, 13)).toEqual(['', '', '', '']);
  });
});

describe('sessionStartCell', () => {
  it('renders an em dash when there is no load to show', () => {
    expect(sessionStartCell(null)).toBe('—');
  });
});
