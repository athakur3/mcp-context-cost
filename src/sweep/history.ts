/**
 * results/history.csv — the time series behind the leaderboard snapshot.
 *
 * One row per (date, server): a server's tokens on the day it was measured.
 * Every sweep upserts by (date, server), so re-running a sweep on the same day
 * corrects that day's row instead of appending a duplicate. Rows for earlier
 * dates are never rewritten — history is append-only in practice.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Measurement } from '../core/types.js';

export interface HistoryRow {
  /** UTC calendar day of the measurement (YYYY-MM-DD). */
  date: string;
  server: string;
  tokens: number;
  toolCount: number;
  /** 'measured' or 'dynamic' — dynamic means the tool set moved between captures. */
  status: string;
  /**
   * How the measurement was taken: `docker` (isolated container), `host` (bare
   * machine), or `''` when the row predates this column and the conditions are
   * not on record. Two numbers taken under different isolation are not
   * comparable — same server, different node, different resolution of an
   * `@latest` tag, different ambient env — so a step between them is a property
   * of the harness, not of the server. Recording it is what lets the trend line
   * refuse to draw such a step; see `plottableSeries`.
   */
  isolation: string;
  /**
   * The version the server reported at `initialize`, or `''` when it reported
   * none and when the row predates this column.
   *
   * `measurement.json` has always recorded it, but only for the newest sweep —
   * so the moment a re-sweep overwrote the file, the question "which release
   * did this movement come from" became unanswerable, and the regression
   * report could say only that a movement was "a real upstream release". The
   * series is where it has to live for a diff to reach both sides of it.
   *
   * Never back-filled. A row written before this column carries `''` and reads
   * as not recorded, because that is what it is: nothing on disk says what
   * version produced a number measured three weeks ago.
   */
  version: string;
}

export const HISTORY_HEADER = 'date,server,tokens,toolCount,status,isolation,version';

function csvCell(s: unknown): string {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Split one CSV line, honouring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Parse history.csv text; malformed or non-numeric rows are dropped, not thrown. */
export function parseHistory(text: string): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('date,')) continue;
    const [date, server, tokens, toolCount, status, isolation, version] = splitCsvLine(line);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !server) continue;
    if (!/^\d+$/.test(tokens ?? '') || !/^\d+$/.test(toolCount ?? '')) continue;
    // A short row is an earlier write — 5 fields predate `isolation`, 6 predate
    // `version`. Both are recorded as unknown rather than back-filled with a
    // guess, which is the same rule the columns themselves exist to keep.
    rows.push({
      date,
      server,
      tokens: Number(tokens),
      toolCount: Number(toolCount),
      status: status ?? '',
      isolation: isolation ?? '',
      version: version ?? '',
    });
  }
  return rows;
}

export function formatHistory(rows: HistoryRow[]): string {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.server.localeCompare(b.server));
  const lines = sorted.map((r) =>
    [
      csvCell(r.date),
      csvCell(r.server),
      r.tokens,
      r.toolCount,
      csvCell(r.status),
      csvCell(r.isolation),
      csvCell(r.version),
    ].join(','),
  );
  return [HISTORY_HEADER, ...lines].join('\n') + '\n';
}

/** Upsert one row by (date, server) — the newest write for a day wins. */
export function upsert(rows: HistoryRow[], row: HistoryRow): HistoryRow[] {
  const i = rows.findIndex((r) => r.date === row.date && r.server === row.server);
  if (i < 0) return [...rows, row];
  const next = [...rows];
  next[i] = row;
  return next;
}

/**
 * A measurement contributes a row only if it produced a number: failures and
 * auth walls are recorded in the leaderboard's "not measured" section, and
 * writing them here as zeros would fabricate a drop to zero in the series.
 */
export function isolationOf(m: Measurement): string {
  if (!m.isolation) return '';
  return m.isolation.docker ? 'docker' : 'host';
}

export function rowFor(server: string, m: Measurement): HistoryRow | null {
  if (m.status !== 'measured' && m.status !== 'dynamic') return null;
  if (typeof m.totalTokens !== 'number' || typeof m.toolCount !== 'number') return null;
  const date = String(m.measuredAt ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    date,
    server,
    tokens: m.totalTokens,
    toolCount: m.toolCount,
    status: m.status,
    isolation: isolationOf(m),
    // Some servers report no version at `initialize` at all (`aws-documentation`
    // is the one in the current set). Absent is recorded as absent.
    version: typeof m.serverVersion === 'string' ? m.serverVersion : '',
  };
}

/**
 * Fold every results/<server>/measurement.json into results/history.csv.
 * Idempotent: running twice over the same results is a no-op.
 */
export function appendHistory(root = process.cwd()): { rows: number; added: number } {
  const resultsDir = join(root, 'results');
  const path = join(resultsDir, 'history.csv');
  const existing = existsSync(path) ? parseHistory(readFileSync(path, 'utf8')) : [];
  let rows = existing;
  if (!existsSync(resultsDir)) return { rows: 0, added: 0 };

  for (const server of readdirSync(resultsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()) {
    const file = join(resultsDir, server, 'measurement.json');
    if (!existsSync(file)) continue;
    let m: Measurement;
    try {
      m = JSON.parse(readFileSync(file, 'utf8')) as Measurement;
    } catch {
      continue; // a half-written measurement should not abort the whole fold
    }
    const row = rowFor(server, m);
    if (row) rows = upsert(rows, row);
  }

  writeFileSync(path, formatHistory(rows));
  return { rows: rows.length, added: rows.length - existing.length };
}

export interface PlottableSeries {
  /** The rows a trend may be drawn across, oldest first. */
  rows: HistoryRow[];
  /** Older rows excluded because they were measured under a different isolation. */
  dropped: number;
  /** True when a plotted row's conditions are not on record (a pre-`isolation` write). */
  conditionsUnknown: boolean;
}

/**
 * The longest run of a server's history, ending at its newest row, that a trend
 * line may honestly be drawn across.
 *
 * Walking back from the newest row, a row stops the run when its isolation is
 * known, the newest row's isolation is known, and the two differ — a step across
 * that boundary would say the server changed when what changed is how it was
 * measured. An *unknown* isolation is not evidence either way, so it stays in
 * the run and is reported through `conditionsUnknown` instead: the alternative,
 * treating unknown as its own incompatible value, would silently blank every
 * series recorded before this column existed.
 */
export function plottableSeries(rows: HistoryRow[]): PlottableSeries {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return { rows: [], dropped: 0, conditionsUnknown: false };
  const current = sorted[sorted.length - 1]!.isolation;
  let start = 0;
  if (current) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const iso = sorted[i]!.isolation;
      if (iso && iso !== current) {
        start = i + 1;
        break;
      }
    }
  }
  const kept = sorted.slice(start);
  return {
    rows: kept,
    dropped: start,
    conditionsUnknown: kept.some((r) => !r.isolation),
  };
}
