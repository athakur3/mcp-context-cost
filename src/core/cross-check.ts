/**
 * CLI cross-check — the other tool's number, published beside ours.
 *
 * `sd2k/mcp-tokens` measures the same thing this project measures, differently
 * in two documented ways (spec/upstream-notes.md): its tiktoken provider picks
 * the encoding from a `--model` argument with a cl100k_base fallback, and it
 * counts a `serde_json` re-serialization of deserialized tool structs rather
 * than the wire bytes. Measured (2026-09-03, addendum in the notes), the
 * second difference is nearly all field modeling: the CLI's count lands within
 * a fraction of a percent of our o200k count of the three-field
 * name/description/input_schema projection — the same projection the Claude
 * divergence starts from — not of the full capture. So the published
 * comparison is against `mappedTokens` of the same fresh capture: like counted
 * against like, with the field-selection gap already published separately as
 * each server's field-selection share. The honest move is the one the notes
 * chose on day one: publish the divergence ourselves rather than leave it to
 * be discovered by critics.
 *
 * Every row is filed under the `canonicalSha256` of a capture taken by OUR
 * client in the same run, minutes from the CLI's own launch — the session-start
 * discipline: a re-sweep that moves the published capture marks the row stale
 * instead of leaving a comparison against bytes that no longer exist. And a
 * comparison is only printed when both tools counted the same tool set: the CLI
 * launches the server itself, so on a server that changed between the two
 * launches (or lists dynamically) the two numbers describe different schemas,
 * and publishing their difference as "divergence" would be a category error.
 * Those rows keep their data in the run file and print silence.
 *
 * Versioned independently of the o200k methodology, like `tools-delta/v1` and
 * `deferred-load/v1`: a new published number, no change to the definition of
 * the first. No `totalTokens` and no canonical hash moves.
 */
import { mappedTokens } from './divergence.js';
import { toolNames } from './session-start.js';
import type { Measurement } from './types.js';

/** Method identifier, versioned independently of METHODOLOGY_VERSION. */
export const CROSS_CHECK_METHOD = 'cli-cross-check/v1';

/** The CLI being cross-checked against, and the release this run pins. */
export const CROSS_CHECK_CLI = 'sd2k/mcp-tokens';
export const CROSS_CHECK_CLI_VERSION = 'v0.2.5';

/**
 * The exact analyze invocation, recorded in every run. `--model gpt-4o` is
 * load-bearing: tiktoken-rs maps it to o200k_base, and without a model the CLI
 * falls back to cl100k_base — a systematic difference that would swamp the one
 * being measured (spec/upstream-notes.md, finding 1).
 */
export const CROSS_CHECK_CLI_ARGS = ['analyze', '--provider', 'tiktoken', '--model', 'gpt-4o', '--format', 'json'] as const;

export interface CrossCheckRow {
  /** o200k count of our fresh canonical capture from this run — the headline. */
  ourTokens: number;
  /**
   * o200k count of the same capture's name/description/input_schema
   * projection — what the CLI's structs actually model, and therefore the
   * number its count is compared against.
   */
  ourMappedTokens: number;
  /** The CLI's `.tools.total` for the same server, launched by the CLI itself. */
  cliTokens: number;
  ourToolCount: number;
  cliToolCount: number;
  /** Both tools saw the same tool names (order-insensitive) — the comparison is between like and like. */
  toolSetMatches: boolean;
  /**
   * Our fresh measurement listed dynamically (tools/list differed between its
   * own two captures). The CLI's launch is a third capture, so even with
   * matching names its residual mixes content drift with counter disagreement
   * — recorded, never printed.
   */
  dynamic: boolean;
  /** canonicalSha256 of our capture in this run; null when our measurement failed. */
  capturedSha256: string | null;
  /** Set when either side could not produce a number; nothing is published from the row. */
  error?: string;
}

export interface CrossCheckRun {
  method: string;
  cli: string;
  cliVersion: string;
  /** The analyze invocation, verbatim, so the encoding choice is auditable. */
  cliArgs: string[];
  /** UTC day the run was taken (YYYY-MM-DD). */
  measuredAt: string;
  isolation: string;
  servers: Record<string, CrossCheckRow>;
}

export function parseCrossCheck(text: string): CrossCheckRun | null {
  let run: unknown;
  try {
    run = JSON.parse(text);
  } catch {
    return null;
  }
  const r = run as Partial<CrossCheckRun>;
  if (!r || typeof r.cliVersion !== 'string' || typeof r.measuredAt !== 'string') return null;
  if (!r.servers || typeof r.servers !== 'object') return null;
  return {
    method: typeof r.method === 'string' ? r.method : CROSS_CHECK_METHOD,
    cli: typeof r.cli === 'string' ? r.cli : CROSS_CHECK_CLI,
    cliVersion: r.cliVersion,
    cliArgs: Array.isArray(r.cliArgs) ? r.cliArgs.map(String) : [...CROSS_CHECK_CLI_ARGS],
    measuredAt: r.measuredAt,
    isolation: typeof r.isolation === 'string' ? r.isolation : 'not recorded',
    servers: r.servers as Record<string, CrossCheckRow>,
  };
}

/** What the CLI's JSON report contributes to a row. */
export interface CliReport {
  total: number;
  count: number;
  names: string[];
}

/**
 * Read the CLI's `--format json` report. The report is that CLI's contract, not
 * ours, so this is deliberately narrow: `.tools.total` (the number the CLI's
 * own action publishes), `.tools.count`, and the per-tool names — and a report
 * that does not carry a usable total is a named problem, never a zero.
 */
export function parseCliReport(text: string): { report?: CliReport; problem?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // `--format json` puts the report on stdout, but a launcher inside the same
    // pipe can precede it with noise; the report is the outermost JSON object.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return { problem: 'CLI stdout carried no JSON report' };
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      return { problem: 'CLI stdout carried no parseable JSON report' };
    }
  }
  const tools = (parsed as { tools?: { total?: unknown; count?: unknown; items?: unknown } }).tools;
  if (!tools || typeof tools !== 'object') return { problem: 'CLI report has no .tools object' };
  if (typeof tools.total !== 'number' || !Number.isFinite(tools.total) || tools.total < 0) {
    return { problem: 'CLI report has no usable .tools.total' };
  }
  const items = Array.isArray(tools.items) ? tools.items : [];
  const names: string[] = [];
  for (const item of items) {
    const name = ((item ?? {}) as { name?: unknown }).name;
    if (typeof name === 'string' && name !== '') names.push(name);
  }
  return {
    report: {
      total: tools.total,
      count: typeof tools.count === 'number' ? tools.count : items.length,
      names,
    },
  };
}

/** Order-insensitive equality of the two tool-name lists, repeats included. */
export function sameToolSet(ours: string[], theirs: string[]): boolean {
  if (ours.length !== theirs.length) return false;
  const a = [...ours].sort();
  const b = [...theirs].sort();
  return a.every((name, i) => name === b[i]);
}

/**
 * Build a row from our fresh measurement and the CLI's report. The caller
 * decides whether to run the CLI at all; a failed side arrives here as an
 * `error`, and the row keeps whatever the other side established.
 */
export function toCrossCheckRow(m: Measurement, cli: { report?: CliReport; problem?: string }): CrossCheckRow {
  const measured = m.status === 'measured' || m.status === 'dynamic';
  const raw = measured && Array.isArray(m.rawToolsCapture) ? m.rawToolsCapture : [];
  const ours = toolNames(raw);
  const row: CrossCheckRow = {
    ourTokens: measured && typeof m.totalTokens === 'number' ? m.totalTokens : 0,
    ourMappedTokens: raw.length > 0 ? mappedTokens(raw) : 0,
    cliTokens: cli.report?.total ?? 0,
    ourToolCount: measured && typeof m.toolCount === 'number' ? m.toolCount : 0,
    cliToolCount: cli.report?.count ?? 0,
    toolSetMatches: cli.report !== undefined && measured ? sameToolSet(ours, cli.report.names) : false,
    dynamic: m.status === 'dynamic',
    capturedSha256: measured ? m.canonicalSha256 : null,
  };
  if (!measured) row.error = `our measurement: ${m.status}: ${(m.notes ?? '').slice(0, 200)}`;
  else if (cli.problem) row.error = `cli: ${cli.problem.slice(0, 200)}`;
  return row;
}

/**
 * A row is only printable while it compares like with like: no error on either
 * side, the same tool names seen by both tools, and our capture still the one
 * published — the exact staleness rule the claude column follows.
 */
export function isComparable(
  row: CrossCheckRow | undefined,
  canonicalSha256: string | null,
): row is CrossCheckRow {
  return (
    row !== undefined &&
    row.error === undefined &&
    row.toolSetMatches &&
    !row.dynamic &&
    row.capturedSha256 !== null &&
    canonicalSha256 !== null &&
    row.capturedSha256 === canonicalSha256 &&
    row.ourTokens > 0 &&
    // A report that parsed but carries `total: 0` is not a measurement of
    // anything; published, it renders as a −100% divergence.
    row.cliTokens > 0 &&
    row.ourMappedTokens > 0
  );
}

/**
 * Signed divergence of the CLI's count from our count of the projection it
 * models, in percent. Against the mapped number and not the headline: the gap
 * to the headline is field selection, published separately per server, and
 * folding it in here would bury the number this column exists to check —
 * whether two independent counters agree on the fields both count.
 */
export function divergencePct(row: CrossCheckRow): number | null {
  if (row.ourMappedTokens <= 0) return null;
  return ((row.cliTokens - row.ourMappedTokens) / row.ourMappedTokens) * 100;
}
