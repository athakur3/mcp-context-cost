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
  parseToolVectorFile,
  readSeries,
  summarize,
  vectorEntryOf,
  type CostChange,
  type Mechanism,
  type RegressionSummary,
  type ToolVectorFile,
  type UnchangedSeries,
} from '../core/regression.js';
import {
  CAPTURE_INDEX_METHOD,
  type CaptureIndex,
  type IndexedCapture,
} from '../core/capture-index.js';
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
    const entry = vectorEntryOf(m);
    if (!entry) continue;

    const path = join(resultsDir, server, 'tool-vectors.json');
    const existing = existsSync(path) ? parseToolVectorFile(readFileSync(path, 'utf8')) : null;
    const before: ToolVectorFile = existing ?? { method: REGRESSION_METHOD, server, entries: [] };
    const after = appendVector(before, entry);
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

/**
 * Fold every server's tool vectors into results/capture-index.json — the
 * hash → (server, date) lookup `audit --changed` joins against. Derived from
 * the vectors, so it can only see as far back as they do, and written in the
 * same pass that appends them.
 */
export function writeCaptureIndex(entries: ServerEntry[], root = process.cwd()): CaptureIndex {
  const captures: Record<string, IndexedCapture> = {};
  const current: Record<string, string> = {};
  // A hash two servers share identifies neither of them. The set already holds
  // near-duplicate pairs (`redis`/`redis-legacy`, `github`/`github-legacy`), and
  // one package listed under two slugs would produce byte-identical captures —
  // whereupon the later write would silently rename the earlier server's capture
  // and `audit --changed` would print the wrong name with full confidence.
  // Ambiguous hashes are dropped instead, so `identify` answers `unknown`: an
  // absence of a record, which is true, rather than a confident misattribution.
  const ambiguous = new Set<string>();
  for (const entry of entries) {
    const vectors = loadToolVectors(entry.name, root);
    if (!vectors || vectors.entries.length === 0) continue;
    for (const e of vectors.entries) {
      const held = captures[e.canonicalSha256];
      if (held && held.server !== entry.name) {
        ambiguous.add(e.canonicalSha256);
        continue;
      }
      captures[e.canonicalSha256] = {
        server: entry.name,
        date: e.date,
        totalTokens: e.totalTokens,
        toolCount: e.tools.length,
      };
    }
    current[entry.name] = vectors.entries[vectors.entries.length - 1]!.canonicalSha256;
  }
  for (const sha of ambiguous) delete captures[sha];
  const index: CaptureIndex = {
    method: CAPTURE_INDEX_METHOD,
    generatedAt: new Date().toISOString().slice(0, 10),
    // Key order sorted so a re-run over unchanged vectors produces no diff noise.
    captures: Object.fromEntries(Object.entries(captures).sort(([a], [b]) => a.localeCompare(b))),
    current: Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(join(root, 'results', 'capture-index.json'), JSON.stringify(index, null, 2) + '\n');
  return index;
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
  const unchanged: UnchangedSeries[] = [];
  let withoutComparison = 0;
  for (const entry of entries) {
    const series = byServer.get(entry.name);
    if (!series || series.length === 0) continue;
    // The isolation rule lives in plottableSeries; a diff only ever spans the
    // run it keeps, so a change of harness can never read as a change of server.
    const { rows: comparable } = plottableSeries(series);
    // Three readings, three sections. Every entry with a row in history lands
    // in exactly one, which is what lets the page state a total that sums.
    const reading = readSeries(entry.name, comparable, loadToolVectors(entry.name, root));
    if (reading.kind === 'changed') changes.push(reading.change);
    else if (reading.kind === 'unchanged') unchanged.push(reading.held);
    else withoutComparison++;
  }
  const newest = rows.map((r) => r.date).sort();
  return {
    summary: summarize(changes, withoutComparison, unchanged),
    measuredAt: newest[newest.length - 1] ?? '',
  };
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

/**
 * The held costs. A section rather than a count, because "unchanged at 1,003
 * since 2026-08-18, across four sweeps" is the most reassuring thing this data
 * holds and it was previously unsayable: the reading shared a `null` with "no
 * second comparable measurement", so the page reported both as an absence.
 */
function unchangedLines(summary: RegressionSummary): string[] {
  const md: string[] = ['## Unchanged', ''];
  if (summary.unchanged.length === 0) {
    md.push(
      `No server on record has two or more comparable measurements that agree — every server ` +
        `measured more than once under its current isolation has moved at least once.`,
    );
    md.push('');
    return md;
  }
  const sweeps = summary.unchanged.map((u) => u.sweeps);
  md.push(
    `**${summary.unchanged.length} server${summary.unchanged.length === 1 ? ' has' : 's have'} been measured ` +
      `${Math.min(...sweeps) === 2 ? 'at least twice' : `${Math.min(...sweeps)}+ times`} under the same isolation ` +
      `and ${summary.unchanged.length === 1 ? 'has' : 'have'} not moved** — same tokens, same tool count, every ` +
      `time. That is a measured fact about the server, not a missing one: the definitions in a context window ` +
      `today are the definitions that were there on the date in the window column, confirmed on every sweep ` +
      `since. \`since\` is when the cost was first recorded at this number, never when it was last looked at.`,
  );
  md.push('');
  md.push('| server | window | tokens | tools | sweeps |');
  md.push('|---|---|---:|---:|---:|');
  for (const u of summary.unchanged) {
    const link = `[${mdCell(u.server)}](../docs/servers/${encodeURIComponent(u.server)}.md)`;
    const window =
      u.since === u.measuredThrough
        ? mdCell(u.since)
        : `${mdCell(u.since)} → ${mdCell(u.measuredThrough)}`;
    md.push(`| ${link} | ${window} | ${n(u.tokens)} | ${n(u.toolCount)} | ${u.sweeps} |`);
  }
  md.push('');
  return md;
}

/**
 * The servers there is genuinely nothing to compare yet. Narrower than it was:
 * a cost that has held is now published as held, so what remains here really is
 * a first measurement or a series broken by an isolation change.
 */
function notComparedLines(summary: RegressionSummary): string[] {
  return [
    '## Not compared (and why)',
    '',
    `${summary.withoutComparison} server(s) carry a measurement but no second comparable one — a first ` +
      `measurement, or every earlier run taken under different isolation. They appear on the ` +
      `[leaderboard](leaderboard.md) with today's number and no delta, which is the honest reading: ` +
      `a cost with nothing yet to compare it to. A cost that *has* been compared and did not move is ` +
      `above, under [Unchanged](#unchanged) — the two are different facts and this page counted them ` +
      `as one until 2026-09-05.`,
    '',
  ];
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
  // Stated so a reader can check it: every server with a row in history is in
  // exactly one of the three sections, and the three add up. They did not used
  // to — a held cost was counted as one with nothing to compare against.
  const total = summary.changes.length + summary.unchanged.length + summary.withoutComparison;
  md.push(
    `Every server with a measurement on record is in exactly one of the three sections below: ` +
      `**${summary.changes.length} moved**, **${summary.unchanged.length} held the same cost across every ` +
      `comparable measurement**, and **${summary.withoutComparison} ${summary.withoutComparison === 1 ? 'has' : 'have'} ` +
      `no second comparable measurement yet** — ${summary.changes.length} + ${summary.unchanged.length} + ` +
      `${summary.withoutComparison} = ${total}.`,
  );
  md.push('');

  if (summary.changes.length === 0) {
    md.push(`**Nothing moved.** No server on record has two comparable measurements that differ.`);
    md.push('');
    md.push(...unchangedLines(summary));
    md.push(...notComparedLines(summary));
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

  md.push(...unchangedLines(summary));
  md.push(...notComparedLines(summary));
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
