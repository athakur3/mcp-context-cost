import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  MAX_VECTOR_ENTRIES,
  REGRESSION_METHOD,
  SIGNIFICANT_PCT,
  SIGNIFICANT_TOKENS,
  appendVector,
  attribute,
  isSignificant,
  latestChange,
  mechanismOf,
  parseToolVectorFile,
  summarize,
  type DatedMeasurement,
  type ToolVectorEntry,
  type ToolVectorFile,
} from '../src/core/regression.js';
import { plottableSeries, type HistoryRow } from '../src/sweep/history.js';
import { collectChanges, renderRegressions } from '../src/sweep/regressions.js';
import type { ServerEntry } from '../src/sweep/report.js';

/**
 * A cost delta is a claim about a server, so the failure modes worth testing
 * are the ones that would make it a claim about something else: a step across
 * an isolation change, a failed measurement read as a drop to zero, a movement
 * hidden behind a week of stability, or a per-tool breakdown asserted from a
 * capture that was never kept.
 */

const row = (date: string, tokens: number, toolCount: number, isolation = 'docker', status = 'measured'): HistoryRow => ({
  date,
  server: 's',
  tokens,
  toolCount,
  status,
  isolation,
});

describe('latestChange — which pair a movement is measured across', () => {
  it('reports the change that produced the current cost, not the newest pair', () => {
    // The obsidian shape: grew once, then held. Reporting only the newest pair
    // would hide the largest movement in the set behind a week of stability.
    const c = latestChange('obsidian', [
      row('2026-08-19', 1132, 12),
      row('2026-08-26', 2062, 15),
      row('2026-09-03', 2062, 15),
    ]);
    expect(c).not.toBeNull();
    expect(c!.fromDate).toBe('2026-08-19');
    expect(c!.toDate).toBe('2026-08-26');
    expect(c!.deltaTokens).toBe(930);
    expect(c!.deltaPct).toBeCloseTo(82.2, 1);
    // …and says the new cost has held since, rather than restating the window.
    expect(c!.measuredThrough).toBe('2026-09-03');
  });

  it('reports nothing for a series that has never changed', () => {
    expect(latestChange('flat', [row('2026-08-19', 500, 4), row('2026-09-03', 500, 4)])).toBeNull();
  });

  it('reports nothing when there is only one measurement to compare', () => {
    expect(latestChange('new', [row('2026-09-03', 500, 4)])).toBeNull();
  });

  it('never compares across an isolation change', () => {
    // plottableSeries owns the rule; this asserts the diff honours the run it keeps.
    const series = [row('2026-08-16', 900, 4, ''), row('2026-08-17', 400, 4, 'host'), row('2026-08-19', 500, 4, 'docker')];
    const { rows: comparable } = plottableSeries(series);
    expect(comparable.map((r) => r.date)).toEqual(['2026-08-19']);
    expect(latestChange('s', comparable)).toBeNull();
  });

  it('treats a failed measurement as a gap, never as a drop to zero', () => {
    const c = latestChange('s', [
      row('2026-08-19', 2378, 9),
      row('2026-08-26', 0, 0, 'docker', 'startup-failure'),
      row('2026-09-03', 2378, 9),
    ]);
    // The failure contributes nothing, so the two real numbers are equal: no movement.
    expect(c).toBeNull();
  });
});

describe('mechanism — which half of the server moved', () => {
  it('separates more tools from heavier definitions', () => {
    expect(mechanismOf(930, 3)).toBe('tools-added');
    expect(mechanismOf(113, 0)).toBe('definitions-changed');
    expect(mechanismOf(-369, 0)).toBe('definitions-changed');
    expect(mechanismOf(-500, -2)).toBe('tools-removed');
  });

  it('refuses to attribute when count and cost moved in opposite directions', () => {
    expect(mechanismOf(400, -1)).toBe('mixed');
    expect(mechanismOf(-400, 1)).toBe('mixed');
  });
});

describe('significance needs both scales', () => {
  it('takes a movement that is both relatively and absolutely meaningful', () => {
    expect(isSignificant(113, 19.4)).toBe(true);
  });

  it('rejects large-but-relatively-tiny drift on an expensive server', () => {
    expect(isSignificant(200, 0.4)).toBe(false); // github
  });

  it('rejects relatively-large but absolutely trivial movement', () => {
    expect(isSignificant(10, 40)).toBe(false);
  });

  it('states its own thresholds', () => {
    expect(isSignificant(SIGNIFICANT_TOKENS, SIGNIFICANT_PCT)).toBe(true);
    expect(isSignificant(SIGNIFICANT_TOKENS - 1, SIGNIFICANT_PCT)).toBe(false);
    expect(isSignificant(SIGNIFICANT_TOKENS, SIGNIFICANT_PCT - 0.1)).toBe(false);
  });
});

describe('attribute — where the tokens went', () => {
  const from: ToolVectorEntry = {
    date: '2026-08-19',
    canonicalSha256: 'a'.repeat(64),
    totalTokens: 300,
    tools: [
      { name: 'keep', tokens: 100 },
      { name: 'grows', tokens: 50 },
      { name: 'goes', tokens: 130 },
    ],
  };
  const to: ToolVectorEntry = {
    date: '2026-08-26',
    canonicalSha256: 'b'.repeat(64),
    totalTokens: 480,
    tools: [
      { name: 'keep', tokens: 100 },
      { name: 'grows', tokens: 90 },
      { name: 'brand-new', tokens: 200 },
    ],
  };

  it('separates added, removed, grown and shrunk tools', () => {
    const a = attribute(from, to, 180);
    expect(a.added).toEqual([{ name: 'brand-new', tokens: 200 }]);
    expect(a.removed).toEqual([{ name: 'goes', tokens: 130 }]);
    expect(a.grew).toEqual([{ name: 'grows', from: 50, to: 90, delta: 40 }]);
    expect(a.shrank).toEqual([]);
  });

  it('publishes the remainder rather than implying the parts sum to the whole', () => {
    // accounted = +200 (added) − 130 (removed) + 40 (grew) = 110; headline delta 180.
    expect(attribute(from, to, 180).unexplainedTokens).toBe(70);
    expect(attribute(from, to, 110).unexplainedTokens).toBe(0);
  });

  it('is claimed only when both captures are on record', () => {
    const vectors: ToolVectorFile = { method: REGRESSION_METHOD, server: 's', entries: [to] };
    const c = latestChange('s', [row('2026-08-19', 300, 3), row('2026-08-26', 480, 3)], vectors);
    expect(c!.attribution).toBeNull(); // only the newer side was ever stored
    const both: ToolVectorFile = { method: REGRESSION_METHOD, server: 's', entries: [from, to] };
    expect(latestChange('s', [row('2026-08-19', 300, 3), row('2026-08-26', 480, 3)], both)!.attribution).not.toBeNull();
  });
});

describe('tool vectors accrue without bloating', () => {
  const entry = (sha: string, date: string): ToolVectorEntry => ({
    date,
    canonicalSha256: sha,
    totalTokens: 10,
    tools: [{ name: 't', tokens: 10 }],
  });

  it('appends nothing when the capture has not changed', () => {
    const f: ToolVectorFile = { method: REGRESSION_METHOD, server: 's', entries: [entry('a'.repeat(64), '2026-08-19')] };
    const after = appendVector(f, entry('a'.repeat(64), '2026-09-03'));
    expect(after).toBe(f); // same object: nothing written
    expect(after.entries[0].date).toBe('2026-08-19'); // keeps when the capture arrived
  });

  it('appends when the capture changed', () => {
    const f: ToolVectorFile = { method: REGRESSION_METHOD, server: 's', entries: [entry('a'.repeat(64), '2026-08-19')] };
    expect(appendVector(f, entry('b'.repeat(64), '2026-08-26')).entries).toHaveLength(2);
  });

  it('caps the file, keeping the newest captures', () => {
    let f: ToolVectorFile = { method: REGRESSION_METHOD, server: 's', entries: [] };
    for (let i = 0; i < MAX_VECTOR_ENTRIES + 5; i++) f = appendVector(f, entry(String(i).padStart(64, '0'), `2026-08-${i}`));
    expect(f.entries).toHaveLength(MAX_VECTOR_ENTRIES);
    expect(f.entries[f.entries.length - 1].canonicalSha256).toBe(String(MAX_VECTOR_ENTRIES + 4).padStart(64, '0'));
  });

  it('round-trips its published form and rejects text that is not one', () => {
    const f: ToolVectorFile = { method: REGRESSION_METHOD, server: 's', entries: [entry('a'.repeat(64), '2026-08-19')] };
    expect(parseToolVectorFile(JSON.stringify(f))).toEqual(f);
    expect(parseToolVectorFile('nope')).toBeNull();
    expect(parseToolVectorFile('{"server":"s"}')).toBeNull();
  });
});

describe('the rendered report', () => {
  const change = (over: Partial<Parameters<typeof summarize>[0][number]> = {}) => ({
    server: 'demo',
    fromDate: '2026-08-19',
    toDate: '2026-08-26',
    fromTokens: 1000,
    toTokens: 1500,
    deltaTokens: 500,
    deltaPct: 50,
    fromToolCount: 4,
    toToolCount: 6,
    deltaTools: 2,
    mechanism: 'tools-added' as const,
    significant: true,
    measuredThrough: '2026-09-03',
    attribution: null,
    ...over,
  });

  it('states the aggregate, marks the called-out rows, and dates the window', () => {
    const text = renderRegressions(summarize([change()], 3), '2026-09-03');
    expect(text).toContain('1 server moved upward and 0 moved down');
    expect(text).toContain('2026-08-19 → 2026-08-26, held to 2026-09-03');
    expect(text).toContain('+500 (+50.0%)');
    expect(text).toContain('shipped more tools');
  });

  it('says a breakdown is unavailable instead of estimating one', () => {
    const text = renderRegressions(summarize([change()], 0), '2026-09-03');
    expect(text).toContain('per-tool breakdown unavailable');
    expect(text).not.toMatch(/approximately|roughly|estimated/i);
  });

  it('reports an empty set as nothing having moved, not as an empty page', () => {
    const text = renderRegressions(summarize([], 81), '2026-09-03');
    expect(text).toContain('Nothing moved');
    expect(text).toContain('81 server(s)');
  });

  it('accounts for servers with nothing to compare against', () => {
    expect(renderRegressions(summarize([change()], 71), '2026-09-03')).toContain('71 server(s) carry a measurement');
  });
});

describe('the committed report is the one the data derives', () => {
  it('re-renders byte-equal from results/', () => {
    const repoRoot = join(import.meta.dirname, '..');
    const committed = readFileSync(join(repoRoot, 'results', 'regressions.md'), 'utf8');
    const doc = parse(readFileSync(join(repoRoot, 'servers.yaml'), 'utf8')) as { servers: ServerEntry[] };
    const { summary, measuredAt } = collectChanges(doc.servers, repoRoot);
    expect(renderRegressions(summary, measuredAt)).toBe(committed);
  });
});
