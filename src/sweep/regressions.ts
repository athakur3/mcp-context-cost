/**
 * results/regressions.md — what the measured set did since it was last measured.
 *
 * Two artifacts, written by the same regen that writes the leaderboard:
 *
 * - `results/<server>/tool-vectors.json`, a short deduped history of each
 *   server's per-tool token vector. `measurement.json` holds only the newest
 *   capture, so without this the question "which tool grew" is unanswerable the
 *   moment a sweep overwrites it. Deduped by canonical hash, so a server that
 *   has not changed adds nothing.
 * - `results/regressions.md`, the report. Every comparable movement is listed;
 *   the thresholds in `core/regression.ts` decide which are called out, not
 *   which are included.
 *
 * Attribution accrues rather than back-fills: changes older than a server's
 * vector file are listed with their totals and their mechanism, and say plainly
 * that the per-tool breakdown is unavailable because only one of the two
 * captures was ever kept. That is the same shape as the session-start
 * instructions backfill — publish what is derivable, mark the rest, and let the
 * rotation fill it in.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REGRESSION_METHOD,
  SIGNIFICANT_PCT,
  SIGNIFICANT_TOKENS,
  appendVector,
  latestChange,
  parseToolVectorFile,
  summarize,
  type CostChange,
  type Mechanism,
  type RegressionSummary,
  type ToolVectorFile,
} from '../core/regression.js';
import { parseHistory, plottableSeries, type HistoryRow } from './history.js';
import { mdCell, type ServerEntry } from './report.js';
import type { Measurement } from '../core/types.js';

/** Fold every results/<server>/measurement.json into its tool-vectors.json. Idempotent. */
export function appendToolVectors(root = process.cwd()): { servers: number; appended: number } {
  const resultsDir = join(root, 'results');
  if (!existsSync(resultsDir)) return { servers: 0, appended: 0 };
  let servers = 0;
  let appended = 0;

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
    if (m.status !== 'measured' && m.status !== 'dynamic') continue;
    if (typeof m.totalTokens !== 'number' || !m.canonicalSha256 || !Array.isArray(m.tools)) continue;
    const date = String(m.measuredAt ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const path = join(resultsDir, server, 'tool-vectors.json');
    const existing = existsSync(path) ? parseToolVectorFile(readFileSync(path, 'utf8')) : null;
    const before: ToolVectorFile = existing ?? { method: REGRESSION_METHOD, server, entries: [] };
    const after = appendVector(before, {
      date,
      canonicalSha256: m.canonicalSha256,
      totalTokens: m.totalTokens,
      tools: m.tools.map((t) => ({ name: t.name, tokens: t.tokens })),
    });
    servers++;
    if (after !== before) {
      appended++;
      writeFileSync(path, JSON.stringify(after, null, 2) + '\n');
    }
  }
  return { servers, appended };
}

export function loadToolVectors(server: string, root = process.cwd()): ToolVectorFile | null {
  const p = join(root, 'results', server, 'tool-vectors.json');
  return existsSync(p) ? parseToolVectorFile(readFileSync(p, 'utf8')) : null;
}

const MECHANISM_WORDS: Record<Mechanism, string> = {
  'tools-added': 'shipped more tools',
  'tools-removed': 'dropped tools',
  'definitions-changed': 'same tools, rewritten',
  mixed: 'added and rewrote',
};

const n = (v: number) => v.toLocaleString('en-US');
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${n(Math.abs(v))}`;
const signedPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;

/** Compute every comparable movement on disk, newest-pair per server. */
export function collectChanges(
  entries: ServerEntry[],
  root = process.cwd(),
): { summary: RegressionSummary; measuredAt: string } {
  const historyPath = join(root, 'results', 'history.csv');
  const rows = existsSync(historyPath) ? parseHistory(readFileSync(historyPath, 'utf8')) : [];
  const byServer = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    if (!byServer.has(r.server)) byServer.set(r.server, []);
    byServer.get(r.server)!.push(r);
  }

  const changes: CostChange[] = [];
  let withoutComparison = 0;
  for (const entry of entries) {
    const series = byServer.get(entry.name);
    if (!series || series.length === 0) continue;
    // The isolation rule lives in plottableSeries; a diff only ever spans the
    // run it keeps, so a change of harness can never read as a change of server.
    const { rows: comparable } = plottableSeries(series);
    const change = latestChange(entry.name, comparable, loadToolVectors(entry.name, root));
    if (change) changes.push(change);
    else withoutComparison++;
  }
  const newest = rows.map((r) => r.date).sort();
  return { summary: summarize(changes, withoutComparison), measuredAt: newest[newest.length - 1] ?? '' };
}

function attributionLines(c: CostChange): string[] {
  const out: string[] = [];
  if (!c.attribution) {
    out.push(
      `  - per-tool breakdown unavailable: only one of the two captures is on record. ` +
        `Attribution accrues from the first sweep after a server's tool vectors were first stored.`,
    );
    return out;
  }
  const a = c.attribution;
  const top = <T>(xs: T[], k = 3) => xs.slice(0, k);
  if (a.added.length) {
    out.push(
      `  - added ${a.added.length} tool${a.added.length === 1 ? '' : 's'}: ` +
        top(a.added)
          .map((t) => `\`${mdCell(t.name)}\` (${n(t.tokens)})`)
          .join(', ') +
        (a.added.length > 3 ? `, and ${a.added.length - 3} more` : ''),
    );
  }
  if (a.removed.length) {
    out.push(
      `  - removed ${a.removed.length} tool${a.removed.length === 1 ? '' : 's'}: ` +
        top(a.removed)
          .map((t) => `\`${mdCell(t.name)}\` (${n(t.tokens)})`)
          .join(', ') +
        (a.removed.length > 3 ? `, and ${a.removed.length - 3} more` : ''),
    );
  }
  if (a.grew.length) {
    out.push(
      `  - grew: ` +
        top(a.grew)
          .map((t) => `\`${mdCell(t.name)}\` ${n(t.from)} → ${n(t.to)} (${signed(t.delta)})`)
          .join(', ') +
        (a.grew.length > 3 ? `, and ${a.grew.length - 3} more` : ''),
    );
  }
  if (a.shrank.length) {
    out.push(
      `  - shrank: ` +
        top(a.shrank)
          .map((t) => `\`${mdCell(t.name)}\` ${n(t.from)} → ${n(t.to)} (${signed(t.delta)})`)
          .join(', ') +
        (a.shrank.length > 3 ? `, and ${a.shrank.length - 3} more` : ''),
    );
  }
  if (a.unexplainedTokens !== 0) {
    out.push(
      `  - ${signed(a.unexplainedTokens)} unattributed: the headline counts the canonical JSON of the whole ` +
        `array, whose framing bytes and token boundaries belong to no single tool.`,
    );
  }
  return out;
}

export function renderRegressions(summary: RegressionSummary, measuredAt: string): string {
  const md: string[] = [];
  md.push('# How the cost of the measured set has moved');
  md.push('');
  md.push(
    `Every server here is measured again on a rotating schedule, and most launch unpinned ` +
      `(\`npx -y <pkg>\`) — so a change between two measurements is a real upstream release ` +
      `landing in real context windows. This page reports each server's **most recent movement**: ` +
      `the change that produced the cost it carries today, dated to when it happened rather than ` +
      `to the last time anyone looked (method \`${REGRESSION_METHOD}\`, newest data ` +
      `${mdCell(measuredAt)}). A server that moved once and has held that cost since keeps its ` +
      `real window, and the table says how long the new cost has held.`,
  );
  md.push('');
  md.push(
    `Comparable means the two runs used the same isolation — two numbers taken under different ` +
      `isolation are not comparable, and the trend line already refuses to span that boundary ` +
      `(see [history](history.csv) and the sparklines on each ` +
      `[server page](../docs/servers/)). A failed measurement contributes no row at all, so a ` +
      `server that stopped starting reads as a gap in its series, never as a drop to zero.`,
  );
  md.push('');

  if (summary.changes.length === 0) {
    md.push(
      `**Nothing moved.** No server on record has two comparable measurements that differ. ` +
        `${summary.withoutComparison} server(s) have a measurement but no second comparable one to diff against.`,
    );
    md.push('');
    return md.join('\n') + '\n';
  }

  const net = summary.netTokens;
  md.push(
    `**${summary.grew} server${summary.grew === 1 ? '' : 's'} moved upward and ${summary.shrank} moved ` +
      `down**, a net ${signed(net)} tokens across the measured set. ` +
      `${summary.significant} movement${summary.significant === 1 ? '' : 's'} clear${summary.significant === 1 ? 's' : ''} ` +
      `both thresholds for being called out (at least ${SIGNIFICANT_PCT}% *and* at least ` +
      `${SIGNIFICANT_TOKENS} tokens — relative alone would headline a fifth of a cheap server, ` +
      `absolute alone would headline drift on an expensive one). Everything comparable is listed either way.`,
  );
  md.push('');
  md.push('| server | window | tokens | change | tools | what moved |');
  md.push('|---|---|---:|---:|---:|---|');
  for (const c of summary.changes) {
    const link = `[${mdCell(c.server)}](../docs/servers/${encodeURIComponent(c.server)}.md)`;
    const mark = c.significant ? ' **·**' : '';
    const held = c.measuredThrough !== c.toDate ? `, held to ${mdCell(c.measuredThrough)}` : '';
    md.push(
      `| ${link}${mark} | ${mdCell(c.fromDate)} → ${mdCell(c.toDate)}${held} | ` +
        `${n(c.fromTokens)} → ${n(c.toTokens)} | ${signed(c.deltaTokens)} (${signedPct(c.deltaPct)}) | ` +
        `${c.deltaTools === 0 ? '—' : signed(c.deltaTools)} | ${MECHANISM_WORDS[c.mechanism]} |`,
    );
  }
  md.push('');
  md.push(`Rows marked **·** clear both thresholds.`);
  md.push('');

  const detailed = summary.changes.filter((c) => c.significant);
  if (detailed.length) {
    md.push('## Where the tokens went');
    md.push('');
    for (const c of detailed) {
      md.push(
        `**${mdCell(c.server)}** ${signed(c.deltaTokens)} (${signedPct(c.deltaPct)}), ` +
          `${mdCell(c.fromDate)} → ${mdCell(c.toDate)}:`,
      );
      md.push(...attributionLines(c));
      md.push('');
    }
  }

  md.push('## Not compared (and why)');
  md.push('');
  md.push(
    `${summary.withoutComparison} server(s) carry a measurement but no second comparable one — first ` +
      `measurement, or every earlier run taken under different isolation. They appear on the ` +
      `[leaderboard](leaderboard.md) with today's number and no delta, which is the honest reading: ` +
      `a cost with nothing yet to compare it to.`,
  );
  md.push('');
  return md.join('\n') + '\n';
}

export function writeRegressions(
  entries: ServerEntry[],
  root = process.cwd(),
): { summary: RegressionSummary; out: string } {
  const { summary, measuredAt } = collectChanges(entries, root);
  const out = join(root, 'results', 'regressions.md');
  writeFileSync(out, renderRegressions(summary, measuredAt));
  return { summary, out };
}
