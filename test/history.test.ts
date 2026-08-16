import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseHistory,
  formatHistory,
  upsert,
  rowFor,
  appendHistory,
  HISTORY_HEADER,
  type HistoryRow,
} from '../src/sweep/history.js';
import type { Measurement } from '../src/core/types.js';

function measurement(over: Partial<Measurement> = {}): Measurement {
  return {
    methodologyVersion: '1.0',
    provider: 'tiktoken',
    encoding: 'o200k_base',
    status: 'measured',
    totalTokens: 2378,
    toolCount: 9,
    tools: [],
    canonicalSha256: 'deadbeef',
    rawToolsCapture: [],
    measuredAt: '2026-08-16T12:03:51.569Z',
    serverName: 'memory',
    ...over,
  };
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mcc-history-'));
  mkdirSync(join(root, 'results'), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function writeResult(server: string, m: Measurement | string) {
  mkdirSync(join(root, 'results', server), { recursive: true });
  writeFileSync(
    join(root, 'results', server, 'measurement.json'),
    typeof m === 'string' ? m : JSON.stringify(m, null, 2),
  );
}

const history = () => readFileSync(join(root, 'results', 'history.csv'), 'utf8');

describe('history rows', () => {
  it('derives a row from a measured measurement', () => {
    expect(rowFor('memory', measurement())).toEqual({
      date: '2026-08-16',
      server: 'memory',
      tokens: 2378,
      toolCount: 9,
      status: 'measured',
    });
  });

  it('keeps dynamic measurements, with the status carried through', () => {
    expect(rowFor('x', measurement({ status: 'dynamic' }))?.status).toBe('dynamic');
  });

  it('drops failures rather than recording a fake zero', () => {
    for (const status of ['timeout', 'startup-failure', 'auth-required'] as const) {
      expect(rowFor('x', measurement({ status, totalTokens: null, toolCount: null }))).toBeNull();
    }
  });

  it('drops rows with an unusable measuredAt', () => {
    expect(rowFor('x', measurement({ measuredAt: '' }))).toBeNull();
    expect(rowFor('x', measurement({ measuredAt: 'not-a-date' }))).toBeNull();
  });
});

describe('csv round trip', () => {
  const rows: HistoryRow[] = [
    { date: '2026-08-16', server: 'memory', tokens: 2378, toolCount: 9, status: 'measured' },
    { date: '2026-08-09', server: 'github', tokens: 54422, toolCount: 44, status: 'measured' },
  ];

  it('writes a header and sorts by date then server', () => {
    const lines = formatHistory(rows).trim().split('\n');
    expect(lines[0]).toBe(HISTORY_HEADER);
    expect(lines[1]).toBe('2026-08-09,github,54422,44,measured');
    expect(lines[2]).toBe('2026-08-16,memory,2378,9,measured');
  });

  it('round-trips through parseHistory', () => {
    expect(parseHistory(formatHistory(rows))).toEqual(
      [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    );
  });

  it('escapes and re-reads a server name containing a comma', () => {
    const odd: HistoryRow[] = [
      { date: '2026-08-16', server: 'a,b "c"', tokens: 1, toolCount: 1, status: 'measured' },
    ];
    expect(parseHistory(formatHistory(odd))).toEqual(odd);
  });

  it('skips malformed and non-numeric lines instead of throwing', () => {
    const parsed = parseHistory(
      `${HISTORY_HEADER}\n\nnonsense\n2026-13,x,1,1,measured\n2026-08-16,x,NaN,1,measured\n2026-08-16,ok,5,2,measured\n`,
    );
    expect(parsed).toEqual([
      { date: '2026-08-16', server: 'ok', tokens: 5, toolCount: 2, status: 'measured' },
    ]);
  });
});

describe('upsert', () => {
  const base: HistoryRow = { date: '2026-08-16', server: 'x', tokens: 10, toolCount: 1, status: 'measured' };

  it('replaces the row for the same (date, server)', () => {
    const out = upsert([base], { ...base, tokens: 20 });
    expect(out).toHaveLength(1);
    expect(out[0].tokens).toBe(20);
  });

  it('appends a different date or a different server', () => {
    expect(upsert([base], { ...base, date: '2026-08-23' })).toHaveLength(2);
    expect(upsert([base], { ...base, server: 'y' })).toHaveLength(2);
  });
});

describe('appendHistory', () => {
  it('folds every measurement in results/ into history.csv', () => {
    writeResult('memory', measurement());
    writeResult('github', measurement({ totalTokens: 54422, toolCount: 44 }));
    const r = appendHistory(root);
    expect(r).toEqual({ rows: 2, added: 2 });
    expect(history()).toBe(
      `${HISTORY_HEADER}\n2026-08-16,github,54422,44,measured\n2026-08-16,memory,2378,9,measured\n`,
    );
  });

  it('is idempotent — a second fold over the same results changes nothing', () => {
    writeResult('memory', measurement());
    appendHistory(root);
    const first = history();
    expect(appendHistory(root)).toEqual({ rows: 1, added: 0 });
    expect(history()).toBe(first);
  });

  it('corrects the same day in place and appends a later sweep', () => {
    writeResult('memory', measurement());
    appendHistory(root);

    writeResult('memory', measurement({ totalTokens: 2400 })); // re-swept same day
    appendHistory(root);
    expect(parseHistory(history())).toEqual([
      { date: '2026-08-16', server: 'memory', tokens: 2400, toolCount: 9, status: 'measured' },
    ]);

    writeResult('memory', measurement({ measuredAt: '2026-08-23T06:17:00.000Z', totalTokens: 2500 }));
    appendHistory(root);
    expect(parseHistory(history()).map((r) => [r.date, r.tokens])).toEqual([
      ['2026-08-16', 2400],
      ['2026-08-23', 2500],
    ]);
  });

  it('preserves earlier rows for a server that has since started failing', () => {
    writeResult('memory', measurement());
    appendHistory(root);
    writeResult('memory', measurement({ status: 'timeout', totalTokens: null, toolCount: null }));
    appendHistory(root);
    expect(parseHistory(history())).toHaveLength(1);
  });

  it('ignores an unparseable measurement without losing the rest', () => {
    writeResult('broken', '{ not json');
    writeResult('memory', measurement());
    expect(appendHistory(root).rows).toBe(1);
  });
});
