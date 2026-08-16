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
}

export const HISTORY_HEADER = 'date,server,tokens,toolCount,status';

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
    const [date, server, tokens, toolCount, status] = splitCsvLine(line);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !server) continue;
    if (!/^\d+$/.test(tokens ?? '') || !/^\d+$/.test(toolCount ?? '')) continue;
    rows.push({ date, server, tokens: Number(tokens), toolCount: Number(toolCount), status: status ?? '' });
  }
  return rows;
}

export function formatHistory(rows: HistoryRow[]): string {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.server.localeCompare(b.server));
  const lines = sorted.map((r) =>
    [csvCell(r.date), csvCell(r.server), r.tokens, r.toolCount, csvCell(r.status)].join(','),
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
export function rowFor(server: string, m: Measurement): HistoryRow | null {
  if (m.status !== 'measured' && m.status !== 'dynamic') return null;
  if (typeof m.totalTokens !== 'number' || typeof m.toolCount !== 'number') return null;
  const date = String(m.measuredAt ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { date, server, tokens: m.totalTokens, toolCount: m.toolCount, status: m.status };
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
