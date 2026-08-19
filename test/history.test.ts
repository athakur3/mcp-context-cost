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
  plottableSeries,
  isolationOf,
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
    isolation: { docker: true, image: 'node:22-slim' },
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
      isolation: 'docker',
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
    { date: '2026-08-16', server: 'memory', tokens: 2378, toolCount: 9, status: 'measured', isolation: 'docker' },
    { date: '2026-08-09', server: 'github', tokens: 54422, toolCount: 44, status: 'measured', isolation: 'host' },
  ];

  it('writes a header and sorts by date then server', () => {
    const lines = formatHistory(rows).trim().split('\n');
    expect(lines[0]).toBe(HISTORY_HEADER);
    expect(lines[1]).toBe('2026-08-09,github,54422,44,measured,host');
    expect(lines[2]).toBe('2026-08-16,memory,2378,9,measured,docker');
  });

  it('round-trips through parseHistory', () => {
    expect(parseHistory(formatHistory(rows))).toEqual(
      [...rows].sort((a, b) => a.date.localeCompare(b.date)),
    );
  });

  it('escapes and re-reads a server name containing a comma', () => {
    const odd: HistoryRow[] = [
      { date: '2026-08-16', server: 'a,b "c"', tokens: 1, toolCount: 1, status: 'measured', isolation: 'docker' },
    ];
    expect(parseHistory(formatHistory(odd))).toEqual(odd);
  });

  it('skips malformed and non-numeric lines instead of throwing', () => {
    const parsed = parseHistory(
      `${HISTORY_HEADER}\n\nnonsense\n2026-13,x,1,1,measured\n2026-08-16,x,NaN,1,measured\n2026-08-16,ok,5,2,measured\n`,
    );
    expect(parsed).toEqual([
      { date: '2026-08-16', server: 'ok', tokens: 5, toolCount: 2, status: 'measured', isolation: '' },
    ]);
  });
});

describe('upsert', () => {
  const base: HistoryRow = {
    date: '2026-08-16',
    server: 'x',
    tokens: 10,
    toolCount: 1,
    status: 'measured',
    isolation: 'docker',
  };

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
      `${HISTORY_HEADER}\n2026-08-16,github,54422,44,measured,docker\n2026-08-16,memory,2378,9,measured,docker\n`,
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
      { date: '2026-08-16', server: 'memory', tokens: 2400, toolCount: 9, status: 'measured', isolation: 'docker' },
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

describe('isolation is recorded, not guessed', () => {
  it('reads docker vs host off the measurement', () => {
    expect(isolationOf(measurement())).toBe('docker');
    expect(isolationOf(measurement({ isolation: { docker: false } }))).toBe('host');
  });

  it('leaves isolation unknown when the measurement never recorded one', () => {
    expect(isolationOf(measurement({ isolation: undefined }))).toBe('');
    expect(rowFor('memory', measurement({ isolation: undefined }))?.isolation).toBe('');
  });

  it('reads a pre-isolation 5-field row as unknown rather than assuming docker', () => {
    expect(parseHistory(`${HISTORY_HEADER}\n2026-08-16,memory,2378,9,measured\n`)).toEqual([
      { date: '2026-08-16', server: 'memory', tokens: 2378, toolCount: 9, status: 'measured', isolation: '' },
    ]);
  });

  it('records the isolation a sweep actually ran under', () => {
    writeResult('memory', measurement({ isolation: { docker: false } }));
    appendHistory(root);
    expect(history().trim().split('\n')[1]).toBe('2026-08-16,memory,2378,9,measured,host');
  });
});

describe('plottableSeries', () => {
  const row = (date: string, tokens: number, isolation: string): HistoryRow => ({
    date,
    server: 'x',
    tokens,
    toolCount: 1,
    status: 'measured',
    isolation,
  });

  it('plots the whole series when every sweep ran the same way', () => {
    const s = plottableSeries([row('2026-08-16', 10, 'docker'), row('2026-08-17', 12, 'docker')]);
    expect(s.rows.map((r) => r.tokens)).toEqual([10, 12]);
    expect(s.dropped).toBe(0);
    expect(s.conditionsUnknown).toBe(false);
  });

  it('drops the sweeps before an isolation change instead of drawing a step', () => {
    const s = plottableSeries([
      row('2026-08-16', 10, 'host'),
      row('2026-08-17', 11, 'host'),
      row('2026-08-18', 900, 'docker'),
      row('2026-08-19', 910, 'docker'),
    ]);
    expect(s.rows.map((r) => r.tokens)).toEqual([900, 910]);
    expect(s.dropped).toBe(2);
  });

  it('breaks on the most recent change only, not the first one', () => {
    const s = plottableSeries([
      row('2026-08-16', 10, 'docker'),
      row('2026-08-17', 20, 'host'),
      row('2026-08-18', 30, 'docker'),
    ]);
    expect(s.rows.map((r) => r.tokens)).toEqual([30]);
    expect(s.dropped).toBe(2);
  });

  it('keeps unrecorded conditions in the line but flags them', () => {
    const s = plottableSeries([row('2026-08-16', 10, ''), row('2026-08-17', 12, 'docker')]);
    expect(s.rows).toHaveLength(2);
    expect(s.dropped).toBe(0);
    expect(s.conditionsUnknown).toBe(true);
  });

  it('plots everything when the newest row itself has no isolation on record', () => {
    const s = plottableSeries([row('2026-08-16', 10, 'host'), row('2026-08-17', 12, '')]);
    expect(s.rows).toHaveLength(2);
    expect(s.conditionsUnknown).toBe(true);
  });

  it('sorts by date before deciding, and handles an empty series', () => {
    const s = plottableSeries([row('2026-08-18', 30, 'docker'), row('2026-08-16', 10, 'docker')]);
    expect(s.rows.map((r) => r.date)).toEqual(['2026-08-16', '2026-08-18']);
    expect(plottableSeries([])).toEqual({ rows: [], dropped: 0, conditionsUnknown: false });
  });
});
