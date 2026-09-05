/**
 * Leaderboard generation from results/<name>/measurement.json + servers.yaml
 * metadata. Every yaml entry appears — failures included, no silent drops.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Measurement } from '../core/types.js';
import { isCurrent, parseDivergence, type DivergenceRun } from '../core/divergence.js';
import { divergencePct, isComparable, parseCrossCheck, type CrossCheckRun } from '../core/cross-check.js';
// Type-only, and from core rather than ./regressions.js: the regression report
// imports this module for its markdown escaping, so importing it back at
// runtime would close a cycle. The summary is handed in by the caller instead.
import type { RegressionSummary } from '../core/regression.js';
import {
  SESSION_START_METHOD,
  parseSessionStart,
  sessionStartLoad,
  type SessionStartLoad,
  type SessionStartRun,
} from '../core/session-start.js';

export interface ServerEntry {
  name: string;
  command: string;
  package?: string;
  env?: string[];
  metric?: number;
  metricSource?: string;
  category?: string;
  repo?: string;
  remote?: boolean;
  dockerImage?: string;
  timeoutSeconds?: number;
  /** Launch needs the `git` binary (e.g. `uvx --from git+...`) — absent from the slim isolation images. */
  needsGit?: boolean;
  /**
   * Per-var overrides for the literal `dummy` placeholder docker mode injects
   * for `env` names — for servers that parse a var's shape (URI scheme, URL)
   * before ever reaching tools/list. See docker.ts `dummyEnvValues`.
   */
  envValues?: Record<string, string>;
  /**
   * Declares that a failure of this entry is this harness's limitation, not the
   * server's — an OS or architecture the package does not ship for, or a
   * backing service the isolation deliberately does not provide.
   *
   * `evidence` is what keeps the declaration honest. The status only becomes
   * `not-applicable` when the failure's own text contains that substring, so an
   * annotation left behind after upstream changes cannot quietly absorb a real
   * breakage: the server fails a different way, the evidence stops matching,
   * and it is published as the failure it actually is. The entry is still
   * attempted every sweep, so the day it starts working it simply measures.
   */
  notApplicable?: { reason: string; evidence: string };
  /**
   * The package is deprecated by its own publisher.
   *
   * A fact about the package, published as one. Without it `gdrive` and `neon`
   * are bare failure rows, which reads as "this server is broken" when the
   * truth is that upstream stopped shipping it and, in `neon`'s case, said
   * where to go instead — and `elasticsearch` is worse, a clean 374-token
   * measurement of a package nobody should be adopting, with nothing on the
   * row to say so.
   *
   * The entry stays in the sweep either way: a package people have already
   * installed and upstream has stopped updating is precisely the one whose
   * context cost nobody is watching.
   */
  deprecated?: Deprecation;
}

/**
 * A deprecation as a dated reading, like every other reading here. `version`
 * because an npm deprecation is per-version, `source` because a published
 * claim carries its evidence, and `readOn` because both can change without
 * anything in this repository moving.
 */
export interface Deprecation {
  /** Where upstream points instead, in upstream's own words. Absent when the notice names nowhere. */
  replacement?: string;
  /** The published version whose registry metadata carries the notice. */
  version: string;
  /** Where the notice was read. */
  source: string;
  /** The day it was read. */
  readOn: string;
}

export interface Row {
  entry: ServerEntry;
  m: Measurement | null;
}

/** Neutralize markdown/table syntax in third-party strings (tool names, notes). */
export function mdCell(s: unknown): string {
  return String(s ?? '')
    .replace(/[|`[\]<>]/g, (c) => `\\${c}`)
    .replace(/\r?\n/g, ' ')
    .slice(0, 160);
}

/** A URL safe to sit inside a markdown link's parentheses. */
const mdLink = (url: unknown) => encodeURI(String(url ?? '')).replace(/\)/g, '%29');

/**
 * The deprecation, in the words of the notice rather than of this repository —
 * "superseded by the remote MCP server at mcp.neon.tech", not "broken".
 * Returns '' for an entry with no deprecation, so a caller can splice it in
 * without branching.
 */
export function deprecationText(entry: ServerEntry): string {
  const d = entry.deprecated;
  if (!d) return '';
  const words = d.replacement ? `superseded by ${d.replacement}` : 'deprecated by its publisher';
  return `[${mdCell(words)}](${mdLink(d.source)}) — ${mdCell(d.version)}, read ${mdCell(d.readOn)}`;
}

function csvCell(s: unknown): string {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function loadRows(entries: ServerEntry[], root = process.cwd()): Row[] {
  return entries.map((entry) => {
    const p = join(root, 'results', entry.name, 'measurement.json');
    if (!existsSync(p)) return { entry, m: null };
    try {
      return { entry, m: JSON.parse(readFileSync(p, 'utf8')) as Measurement };
    } catch {
      // The same tolerance `appendHistory` states for the same file: a sweep
      // killed mid-write leaves a truncated measurement, and every generator
      // reads through here. Throwing meant one such file broke the leaderboard,
      // the server pages, the dashboard, the tool-shape baseline and the
      // published-stats check at once — weekly, with a SyntaxError that named
      // no file. A server with no readable record reads as one with no record.
      return { entry, m: null };
    }
  });
}

/** results/divergence.json if a divergence run has been recorded, else null. */
export function loadDivergence(root = process.cwd()): DivergenceRun | null {
  const p = join(root, 'results', 'divergence.json');
  return existsSync(p) ? parseDivergence(readFileSync(p, 'utf8')) : null;
}

/** results/session-start.json — the instructions backfill, if one exists. */
export function loadSessionStartRun(root = process.cwd()): SessionStartRun | null {
  const p = join(root, 'results', 'session-start.json');
  return existsSync(p) ? parseSessionStart(readFileSync(p, 'utf8')) : null;
}

/** results/cross-check.json if a CLI cross-check run has been recorded, else null. */
export function loadCrossCheckRun(root = process.cwd()): CrossCheckRun | null {
  const p = join(root, 'results', 'cross-check.json');
  return existsSync(p) ? parseCrossCheck(readFileSync(p, 'utf8')) : null;
}

/**
 * A session-start figure that is a floor reads `>= N`, never a bare `N`. The
 * marker is half the point of publishing the number: the names half is measured,
 * the instructions half has not been captured for this server, and a reader has
 * to be able to tell that from a row where both halves are known.
 */
export function sessionStartCell(load: SessionStartLoad | null): string {
  if (!load) return '—';
  return `${load.isFloor ? '≥' : ''}${load.totalTokens.toLocaleString('en-US')}`;
}

export function writeLeaderboard(
  entries: ServerEntry[],
  root = process.cwd(),
  regressions?: RegressionSummary | null,
): void {
  const rows = loadRows(entries, root);
  const div = loadDivergence(root);
  const ss = loadSessionStartRun(root);
  const xc = loadCrossCheckRun(root);
  /** Session-start load for a row, or null when there is no capture to read. */
  const session = (r: Row): SessionStartLoad | null =>
    r.m ? sessionStartLoad(r.m, ss?.servers[r.entry.name]) : null;
  /** Claude tokens for a row, or null when not measured / stale / errored. */
  const claude = (r: Row): number | null => {
    if (!div || !r.m) return null;
    const d = div.servers[r.entry.name];
    return isCurrent(d, r.m.canonicalSha256) ? d.claudeDelta : null;
  };
  /** The other CLI's row, or null when the comparison is not like-with-like. */
  const crossCheck = (r: Row) => {
    if (!xc || !r.m) return null;
    const row = xc.servers[r.entry.name];
    return isComparable(row, r.m.canonicalSha256) ? row : null;
  };
  const signedPct = (p: number) => `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`;
  const measured = rows
    .filter((r) => r.m && (r.m.status === 'measured' || r.m.status === 'dynamic'))
    .sort((a, b) => (b.m!.totalTokens ?? 0) - (a.m!.totalTokens ?? 0));
  const unmeasured = rows.filter((r) => !measured.includes(r));

  const md: string[] = [];
  md.push('# MCP server context-cost leaderboard');
  md.push('');
  md.push(
    `Tokens = o200k_base count of the canonical \`tools/list\` bytes ([methodology v1.0](../docs/METHODOLOGY.md)). ` +
      `Measured ${measured.length}/${rows.length} candidates; every candidate is listed — failures are findings, not omissions. ` +
      `Server names link to their per-tool breakdown.`,
  );
  md.push('');
  if (div) {
    const n = measured.filter((r) => claude(r) !== null).length;
    md.push(
      `The **claude** column is the same tools measured through Anthropic's \`count_tokens\` on ` +
        `\`${mdCell(div.model)}\` (${mdCell(div.measuredAt)}, method \`${mdCell(div.method)}\`): the tokens the server's ` +
        `tools add to a request, measured for the top ${n}. It is not a rescaling of the o200k column — ` +
        `two effects pull in opposite directions, and the [per-server pages](../docs/servers/) break both out. ` +
        `See [Claude divergence](../docs/METHODOLOGY.md#claude-divergence).`,
    );
    md.push('');
  }
  if (xc) {
    const pcts = measured
      .map((r) => {
        const row = crossCheck(r);
        return row ? divergencePct(row) : null;
      })
      .filter((p): p is number => p !== null);
    md.push(
      `The **mcp-tokens** column is the other CLI's count of the same server — ` +
        `\`${mdCell(xc.cli)}\` \`${mdCell(xc.cliVersion)}\` (${mdCell(xc.measuredAt)}, method \`${mdCell(xc.method)}\`), ` +
        `invoked with \`--model gpt-4o\` so both columns count o200k tokens. Its structs model the three ` +
        `request fields (name/description/input\\_schema), so its number sits below the tokens column ` +
        `wherever a server ships metadata those fields do not carry — that gap is each server's ` +
        `field-selection share, published on its page, not a disagreement of counters. The parenthesized ` +
        `percentage is the disagreement of counters: the CLI's count against ours of the same three-field ` +
        `projection` +
        (pcts.length > 0
          ? `, ${signedPct(Math.min(...pcts))} to ${signedPct(Math.max(...pcts))} across the ` +
            `${pcts.length} row${pcts.length === 1 ? '' : 's'} where both tools saw the same tool set.`
          : `. No row currently compares like with like.`) +
        ` A row prints only while the comparison is between like and like: the same tool names on both ` +
        `sides, and our capture unchanged since the run. ` +
        `See [CLI cross-check](../docs/METHODOLOGY.md#cli-cross-check).`,
    );
    md.push('');
  }
  // Derived on every write from the movements actually on record, and the
  // paragraph disappears when nothing has moved — the same rule the
  // deferral-costs-more note follows, rather than asserting a stale count.
  if (regressions && regressions.changes.length > 0) {
    const net = regressions.netTokens;
    const sign = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-US')}`;
    md.push(
      `**Of the servers whose cost has moved at all, ${regressions.grew} moved upward and ` +
        `${regressions.shrank} moved down** — a net ${sign(net)} tokens across the set. Most entries here ` +
        `launch unpinned, so a movement is a real upstream release landing in real context windows, and ` +
        `only measurements taken under the same isolation are compared. Every movement, which half of the ` +
        `server moved, and where the tokens went: [regressions.md](regressions.md).`,
    );
    md.push('');
  }
  const floors = measured.filter((r) => session(r)?.isFloor).length;
  md.push(
    `The **session start** column is what a client puts in context when it *defers* tool definitions until they ` +
      `are used: the server's tool names plus the \`instructions\` string it returns from \`initialize\` ` +
      `(method \`${SESSION_START_METHOD}\`). The tokens column is what a client that loads every definition up ` +
      `front pays; this one is what the same server costs a client that does not. ` +
      `See [session-start load](../docs/METHODOLOGY.md#session-start-load).`,
  );
  md.push('');
  if (floors > 0) {
    md.push(
      `**\`≥\` marks a floor, on ${floors} of ${measured.length} rows.** Tool names are counted exactly from ` +
        `the published capture, but \`instructions\` is not part of \`tools/list\` and has not been captured for ` +
        `these servers — so the figure is the names half alone and the true number is that or higher. A row stops ` +
        `being a floor the first time the server is measured with its instructions.`,
    );
    md.push('');
  }
  // Deferring usually saves almost everything, but it is not guaranteed to save
  // anything: `instructions` are bytes the headline never counted, and a server
  // that re-lists its tools in prose can charge a deferring client more than an
  // eager one. Those rows are the most useful thing this column finds, so they
  // are named here rather than left for a reader to spot by comparing columns.
  // Derived on every write — no row is listed by hand, and the paragraph
  // disappears if the set ever empties, rather than asserting a stale count.
  const costlier = measured.filter((r) => {
    const load = session(r);
    return load !== null && r.m!.totalTokens !== null && load.totalTokens >= r.m!.totalTokens;
  });
  if (costlier.length > 0) {
    // Server names are backticked, not bolded: the lead sentence is already
    // bold and a nested `**` would close it early, silently un-bolding the
    // half of the sentence that carries the finding.
    const named = costlier
      .map((r) => {
        const load = session(r)!;
        return `\`${mdCell(r.entry.name)}\` pays ${load.isFloor ? '≥' : ''}${load.totalTokens.toLocaleString(
          'en-US',
        )} at session start against ${r.m!.totalTokens!.toLocaleString('en-US')} of definitions`;
      })
      .join('; ');
    md.push(
      `**Deferring costs more than it saves on ${costlier.length} of ${measured.length} rows.** ${named}. ` +
        `The names half is always a fraction of the headline, but \`instructions\` are bytes the tokens column ` +
        `never counted and their length is independent of the tool set — so a server that re-lists its tools in ` +
        `its instructions makes a deferring client pay for a prose copy of the schemas it just skipped. ` +
        `A client that defers definitions is better off on every other measured row and worse off on ${
          costlier.length === 1 ? 'this one' : 'these'
        }.`,
    );
    md.push('');
  }
  md.push(
    `| # | server | tokens | session start |${div ? ' claude |' : ''}${xc ? ' mcp-tokens |' : ''} tools | largest tool | status | category |`,
  );
  md.push(`|---:|---|---:|---:|${div ? '---:|' : ''}${xc ? '---:|' : ''}---:|---|---|---|`);
  measured.forEach((r, i) => {
    const m = r.m!;
    const largest = [...m.tools].sort((a, b) => b.tokens - a.tokens)[0];
    const link = `[${mdCell(r.entry.name)}](../docs/servers/${encodeURIComponent(r.entry.name)}.md)`;
    const c = claude(r);
    const x = crossCheck(r);
    const xCell = x === null ? '—' : `${x.cliTokens.toLocaleString('en-US')} (${signedPct(divergencePct(x)!)})`;
    md.push(
      `| ${i + 1} | ${link} | ${m.totalTokens!.toLocaleString('en-US')} |` +
        ` ${sessionStartCell(session(r))} |` +
        (div ? ` ${c === null ? '—' : c.toLocaleString('en-US')} |` : '') +
        (xc ? ` ${xCell} |` : '') +
        ` ${m.toolCount} | ` +
        `${largest ? `${mdCell(largest.name)} (${largest.tokens.toLocaleString('en-US')})` : '—'} | ${m.status} | ${mdCell(r.entry.category)} |`,
    );
  });
  md.push('');
  // Derived, and the section disappears when the set empties — the same rule
  // the movement and deferral notes follow. Listed apart from the failure
  // table because a deprecation is orthogonal to whether the server measured:
  // `elasticsearch` measures cleanly and is deprecated; `gdrive` and `neon`
  // fail and are deprecated. Neither reading is left to the reader.
  const deprecated = rows.filter((r) => r.entry.deprecated);
  if (deprecated.length > 0) {
    md.push('## Deprecated upstream');
    md.push('');
    md.push(
      `${deprecated.length} entr${deprecated.length === 1 ? 'y is' : 'ies are'} no longer maintained by ` +
        `the publisher that ships ${deprecated.length === 1 ? 'it' : 'them'}. They are measured on the same ` +
        `rotation as everything else — a package people have already installed and upstream has stopped ` +
        `updating is precisely the one whose context cost nobody is watching — so a row here can carry a ` +
        `real number, a real failure, or both over time. What it should not carry is silence about the ` +
        `deprecation itself.`,
    );
    md.push('');
    md.push('| server | status | deprecation |');
    md.push('|---|---|---|');
    for (const r of deprecated) {
      const status = r.entry.remote ? 'remote-auth-wall' : (r.m?.status ?? 'not-yet-run');
      md.push(`| ${mdCell(r.entry.name)} | ${status} | ${deprecationText(r.entry)} |`);
    }
    md.push('');
  }
  if (unmeasured.length > 0) {
    md.push('## Not measured (and why)');
    md.push('');
    md.push('| server | status | note |');
    md.push('|---|---|---|');
    for (const r of unmeasured) {
      const status = r.entry.remote ? 'remote-auth-wall' : (r.m?.status ?? 'not-yet-run');
      // A deprecated entry's failure note leads with the deprecation: the
      // stderr below it explains how the run ended, not why the package is a
      // dead end.
      const lead = r.entry.deprecated ? `**${deprecationText(r.entry)}.** ` : '';
      md.push(`| ${mdCell(r.entry.name)} | ${status} | ${lead}${mdCell(r.m?.notes)} |`);
    }
    md.push('');
  }
  writeFileSync(join(root, 'results', 'leaderboard.md'), md.join('\n') + '\n');

  // Columns are append-only: consumers key off the header, so each new group
  // (the Claude pair, then the session-start four) goes on the end and leaves
  // every existing parser working.
  const csv: string[] = [
    'name,tokens,toolCount,status,category,metric,metricSource,claudeTokens,claudeModel,' +
      'sessionStartTokens,sessionStartIsFloor,toolNameTokens,instructionsTokens,' +
      'crossCheckTokens,crossCheckCliVersion',
  ];
  for (const r of rows) {
    const m = r.m;
    const c = claude(r);
    const ssl = session(r);
    const x = crossCheck(r);
    csv.push(
      [
        csvCell(r.entry.name),
        m?.totalTokens ?? '',
        m?.toolCount ?? '',
        r.entry.remote ? 'remote-auth-wall' : (m?.status ?? 'not-yet-run'),
        csvCell(r.entry.category),
        r.entry.metric ?? '',
        csvCell(r.entry.metricSource),
        c ?? '',
        c === null ? '' : csvCell(div!.model),
        ssl?.totalTokens ?? '',
        // Spelled out rather than left implicit: a consumer that ignores this
        // column and sums the previous one is understating every floor row.
        ssl ? String(ssl.isFloor) : '',
        ssl?.toolNameTokens ?? '',
        ssl?.instructionsTokens ?? '',
        x?.cliTokens ?? '',
        x === null ? '' : csvCell(xc!.cliVersion),
      ].join(','),
    );
  }
  writeFileSync(join(root, 'results', 'leaderboard.csv'), csv.join('\n') + '\n');
}

/** Percentile helper for freezing color bands against the observed distribution. */
export function percentiles(entries: ServerEntry[], root = process.cwd()): Record<string, number> {
  const totals = loadRows(entries, root)
    .map((r) => r.m?.totalTokens)
    .filter((t): t is number => typeof t === 'number')
    .sort((a, b) => a - b);
  // Nearest-rank percentile: ceil(p/100 * n) as 1-based rank (unbiased at exact multiples).
  const at = (p: number) =>
    totals[Math.min(totals.length - 1, Math.max(0, Math.ceil((p / 100) * totals.length) - 1))] ?? 0;
  return { p25: at(25), p50: at(50), p75: at(75), p90: at(90), n: totals.length };
}
