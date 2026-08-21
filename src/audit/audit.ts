/**
 * `audit` — measure the MCP servers a person actually has installed.
 *
 * The leaderboard answers "what does server X cost?". This answers the question
 * the person paying the bill has: "what do MY servers cost, together, before I
 * type anything?" Same measurement path as the sweep (dual tools/list capture,
 * o200k_base over canonical JSON, full status taxonomy), pointed at a client
 * config instead of servers.yaml.
 *
 * Totals are per config file, never merged across clients: a context window
 * belongs to one client session, so summing Cursor's servers into Claude
 * Desktop's total would describe a session nobody is running. Identical launch
 * commands shared by two configs are still only measured once.
 */
import { METHODOLOGY_VERSION } from '../core/canonical.js';
import { isCurrent, type DivergenceRun } from '../core/divergence.js';
import type { Measurement, MeasurementStatus, ToolMeasurement } from '../core/types.js';
import type { ConfiguredServer, LoadedConfig } from './config.js';
import {
  evaluateDeferral,
  PUBLISHED_WIRE_TO_CLIENT_RATIO,
  SHELL_SOURCE,
  type DeferralVerdict,
  type ToolSearchEnv,
  type ToolSearchSource,
} from './deferral.js';
import { formatDiff, formatGate, type AuditDiff, type IncreaseGate } from './diff.js';

export const DEFAULT_CONTEXT_WINDOW = 200_000;

export type AuditStatus = MeasurementStatus | 'remote-not-measurable';

export interface AuditServerResult {
  name: string;
  transport: 'stdio' | 'remote';
  status: AuditStatus;
  tokens: number | null;
  toolCount: number | null;
  /** Share of this config's measured total, 0–1. */
  share: number | null;
  command?: string;
  url?: string;
  /** Names only — a server's env values never enter a report. */
  envVarNames: string[];
  canonicalSha256?: string | null;
  /**
   * Anthropic-request cost from the published Claude divergence run, only when
   * its captured hash matches this install (`--claude`). `null` means the
   * install doesn't match what was published — silence, not a stale guess.
   * `undefined` means `--claude` wasn't requested at all.
   */
  claudeTokens?: number | null;
  notes?: string;
}

export interface HeaviestTool {
  server: string;
  tool: string;
  tokens: number;
}

/**
 * What turning off the heaviest few tools would recover, for clients that let
 * you disable individual tools rather than whole servers (Claude Code's
 * per-tool permission rules, Cursor's per-tool toggles). `null` when there's
 * nothing worth trimming (one tool total, or no measured tokens).
 */
export interface TrimAdvice {
  tools: HeaviestTool[];
  recoverableTokens: number;
  recoverableShare: number;
}

export interface AuditConfigResult {
  client: string;
  source: string;
  totalTokens: number;
  toolCount: number;
  serverCount: number;
  contextShare: number;
  servers: AuditServerResult[];
  skipped: AuditServerResult[];
  heaviestTools: HeaviestTool[];
  trimAdvice: TrimAdvice | null;
  /**
   * Whether this client loads the total up front or defers it, and — when the
   * client decides that by a threshold — which side of it this stack is on.
   * Every config carries one: the answer "no deferral is on record for this
   * client" is a reading, not a gap.
   *
   * Configs that one session loads together share a single verdict object, so
   * `deferral.sources` can name more files than this config's own `source`.
   */
  deferral: DeferralVerdict;
}

const TRIM_TOOL_COUNT = 3;

function buildTrimAdvice(sortedTools: HeaviestTool[], totalTokens: number): TrimAdvice | null {
  if (totalTokens <= 0 || sortedTools.length < 2) return null;
  const trimmed = sortedTools.slice(0, TRIM_TOOL_COUNT);
  const recoverableTokens = trimmed.reduce((a, t) => a + t.tokens, 0);
  return { tools: trimmed, recoverableTokens, recoverableShare: recoverableTokens / totalTokens };
}

export interface BudgetFitStep {
  name: string;
  tokens: number;
  /** What the config still costs after removing this one and everything above it. */
  remaining: number;
}

export interface BudgetFit {
  /** How far over the limit the worst config starts. */
  overBy: number;
  /** Heaviest-first removals until the remainder fits. Empty if nothing can be removed. */
  drop: BudgetFitStep[];
  keptCount: number;
  keptTokens: number;
  /** False when removing every measured server still would not fit — a limit set too low. */
  feasible: boolean;
}

/**
 * The smallest heaviest-first set of servers that gets a config under its budget.
 *
 * `--budget` used to print "BUDGET FAIL: 84,455 > 20,000" and stop, which tells a reader
 * they have a problem and nothing about the shape of it. The whole point of the audit
 * surface is that the person running it is the person paying the tokens, and "you are over"
 * is a measurement where "these two are why" is a decision.
 *
 * Heaviest-first is ONE ordering, not a recommendation: this cannot know which servers you
 * need, and dropping by weight will sometimes name the one you cannot live without. That
 * caveat is printed with the result rather than left implied.
 */
export function planBudgetFit(config: AuditConfigResult, limit: number): BudgetFit {
  const measured = config.servers
    .filter((srv) => typeof srv.tokens === 'number' && (srv.tokens as number) > 0)
    .sort((a, b) => (b.tokens as number) - (a.tokens as number));

  const overBy = config.totalTokens - limit;
  const drop: BudgetFitStep[] = [];
  let remaining = config.totalTokens;

  for (const srv of measured) {
    if (remaining <= limit) break;
    remaining -= srv.tokens as number;
    drop.push({ name: srv.name, tokens: srv.tokens as number, remaining });
  }

  return {
    overBy,
    drop,
    keptCount: measured.length - drop.length,
    keptTokens: remaining,
    // Removing everything measured still leaves unmeasured/base cost behind, so the
    // honest test is whether the remainder actually landed under the limit.
    feasible: remaining <= limit,
  };
}

export interface AuditReport {
  methodologyVersion: string;
  encoding: 'o200k_base';
  generatedAt: string;
  contextWindow: number;
  configs: AuditConfigResult[];
  /**
   * Client configs that were read and parsed but declare no servers. They get
   * no report line — there is nothing to total — but they are the record that a
   * client is installed here, which is not the same machine as one with no
   * client at all.
   */
  emptyConfigs: { client: string; source: string }[];
  budget?: {
    limit: number;
    worstTotal: number;
    worstSource: string;
    over: boolean;
    /** Present only when over budget: the arithmetic of getting back under it. */
    fit?: BudgetFit;
  };
  /** Present only when a divergence run was supplied (`--claude`). */
  claudeDivergence?: { model: string; measuredAt: string };
  /** Present only when a baseline report was supplied (`--baseline`). */
  diff?: AuditDiff;
  /** Present only when `--max-increase` was supplied alongside a baseline. */
  increaseGate?: IncreaseGate;
  problems: string[];
}

/** Cache key for measurement reuse: the exact argv two configs would spawn. */
export function serverKey(s: ConfiguredServer): string {
  return JSON.stringify(s.argv ?? [s.url ?? s.name]);
}

/**
 * One entry's environment, as a value two entries can be compared by.
 *
 * Values are read here and compared here, and nothing derived from them leaves
 * this function — the count that does is a count of entries. Same rule as
 * `config.ts`: env values are read to spawn a server, never written to a report.
 */
function envSignature(s: ConfiguredServer): string {
  const env = s.env ?? {};
  return JSON.stringify(Object.keys(env).sort().map((k) => [k, env[k]]));
}

/**
 * The measurement keys that stand for more than one distinct server.
 *
 * `serverKey` is the argv alone, so two entries running the same command under
 * different environments are measured once and both are given that one number.
 * Environment decides what a server serves — `GITHUB_TOOLSETS` on
 * `github-mcp-server` selects which toolsets it lists — so for entries under one
 * of these keys, the number reported is one entry's, not each one's.
 *
 * Same argv AND same environment is not collapsed: two clients pointing at an
 * identical server are one measurement, which is the reuse this key is for.
 */
export function collapsedKeys(configs: LoadedConfig[]): Set<string> {
  const envs = new Map<string, Set<string>>();
  for (const cfg of configs) {
    if (cfg.error) continue;
    for (const s of cfg.servers) {
      if (s.transport !== 'stdio') continue;
      const key = serverKey(s);
      const seen = envs.get(key);
      if (seen) seen.add(envSignature(s));
      else envs.set(key, new Set([envSignature(s)]));
    }
  }
  return new Set([...envs].filter(([, sigs]) => sigs.size > 1).map(([key]) => key));
}

function measuredOk(m: Measurement): boolean {
  return (m.status === 'measured' || m.status === 'dynamic') && typeof m.totalTokens === 'number';
}

/**
 * Clients whose several config files are read into ONE session.
 *
 * Claude Code loads user-scope `~/.claude.json` and project-scope
 * `<cwd>/.mcp.json` together, so a stack split across them faces the deferral
 * threshold as a sum. Judging each file alone tells the standard setup it is
 * under a line the session it actually runs is over.
 *
 * This does not merge the reported totals, which stay per file: a context
 * window belongs to one session, and that is the argument for adding these two
 * together — not for adding one client's servers to another's.
 */
const ONE_SESSION_PER_CLIENT = new Set(['claude-code']);

/** Which configs share a deferral verdict. */
function deferralScopeKey(client: string, source: string): string {
  return ONE_SESSION_PER_CLIENT.has(client) ? client : `${client}\0${source}`;
}

/**
 * Give every config a deferral verdict, computed once per session scope and
 * shared by identity across the configs that scope covers — so the report can
 * print it once and a `--json` consumer can see which files it spans.
 */
function attachDeferral(
  configs: Omit<AuditConfigResult, 'deferral'>[],
  contextWindow: number,
  opts: {
    env?: ToolSearchEnv;
    settings?: ToolSearchSource[];
    divergence?: DivergenceRun | null;
    /**
     * Per config, how many of its counted servers were measured as another
     * entry's twin. Keyed by the built config itself rather than by source,
     * because that is what the scopes below are grouped from.
     */
    shared: Map<Omit<AuditConfigResult, 'deferral'>, number>;
  },
): AuditConfigResult[] {
  const scopes = new Map<string, Omit<AuditConfigResult, 'deferral'>[]>();
  for (const cfg of configs) {
    const key = deferralScopeKey(cfg.client, cfg.source);
    const group = scopes.get(key);
    if (group) group.push(cfg);
    else scopes.set(key, [cfg]);
  }

  const verdicts = new Map<string, DeferralVerdict>();
  for (const [key, group] of scopes) {
    verdicts.set(
      key,
      // Computed against the same context window the share uses, so any
      // threshold moves with `--context` instead of being pinned to 200,000.
      evaluateDeferral(
        {
          client: group[0].client,
          sources: group.map((c) => c.source),
          servers: group.flatMap((c) =>
            c.servers.map((s) => ({ tokens: s.tokens ?? 0, claudeTokens: s.claudeTokens })),
          ),
          skippedCount: group.reduce((a, c) => a + c.skipped.length, 0),
          sharedMeasurements: group.reduce((a, c) => a + (opts.shared.get(c) ?? 0), 0),
        },
        { contextWindow, env: opts.env, settings: opts.settings, divergence: opts.divergence },
      ),
    );
  }

  return configs.map((cfg) => ({
    ...cfg,
    deferral: verdicts.get(deferralScopeKey(cfg.client, cfg.source))!,
  }));
}

/**
 * Assemble the report from configs + measurements. Pure: `runAudit` does the
 * spawning, this does the arithmetic, so totals and shares are testable without
 * launching a single server.
 */
export function buildReport(
  configs: LoadedConfig[],
  measured: Map<string, Measurement>,
  opts: {
    contextWindow?: number;
    budget?: number;
    generatedAt?: string;
    /** Published `tools-delta/v1` run to join against (`--claude`); omit to skip the join. */
    divergence?: DivergenceRun | null;
    /**
     * The audited machine's SHELL tool-search variables. Passed in rather than
     * read here so this stays pure and a report is reproducible from its
     * inputs; `runAudit` supplies the real environment. Omitted means the shell
     * set nothing.
     */
    env?: ToolSearchEnv;
    /**
     * The other place those variables come from: Claude Code's own settings
     * files, highest precedence first, as `loadSettingsSources` read them.
     * `runAudit` supplies these. Omitted means they were not read here — which
     * the report says, rather than reporting a default it did not establish.
     */
    settings?: ToolSearchSource[];
  } = {},
): AuditReport {
  const contextWindow = opts.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const problems: string[] = [];
  const emptyConfigs: { client: string; source: string }[] = [];
  const built: Omit<AuditConfigResult, 'deferral'>[] = [];
  // Across every config at once: a twin in one client's file is measured for
  // the other client's entry just the same.
  const collapsed = collapsedKeys(configs);
  const shared = new Map<Omit<AuditConfigResult, 'deferral'>, number>();

  for (const cfg of configs) {
    if (cfg.error) {
      problems.push(`${cfg.source}: ${cfg.error}`);
      continue;
    }
    // Parsed, and declares nothing. Not a problem and not a report line: it is
    // recorded as itself, so a reader is told what this machine actually has.
    if (cfg.declaresNothing || cfg.servers.length === 0) {
      emptyConfigs.push({ client: cfg.client, source: cfg.source });
      continue;
    }
    const ok: AuditServerResult[] = [];
    const skipped: AuditServerResult[] = [];
    const tools: HeaviestTool[] = [];
    // Counted only for servers that put a number into the total: a twin that
    // failed to launch is already a floor, and adds nothing to a sum.
    let sharedHere = 0;

    for (const s of cfg.servers) {
      const base = {
        name: s.name,
        transport: s.transport,
        command: s.command,
        url: s.url,
        envVarNames: s.envVarNames,
      };
      if (s.transport === 'remote') {
        skipped.push({
          ...base,
          status: 'remote-not-measurable',
          tokens: null,
          toolCount: null,
          share: null,
          notes: `remote endpoint (${s.url ?? 'url'}) — stdio measurement does not apply`,
        });
        continue;
      }
      const m = measured.get(serverKey(s));
      if (!m) {
        skipped.push({ ...base, status: 'startup-failure', tokens: null, toolCount: null, share: null, notes: 'not measured' });
        continue;
      }
      if (!measuredOk(m)) {
        skipped.push({
          ...base,
          status: m.status,
          tokens: null,
          toolCount: null,
          share: null,
          notes: m.notes?.split('\n')[0]?.slice(0, 200),
        });
        continue;
      }
      if (collapsed.has(serverKey(s))) sharedHere++;
      const divRow = opts.divergence?.servers[s.name];
      ok.push({
        ...base,
        status: m.status,
        tokens: m.totalTokens,
        toolCount: m.toolCount,
        share: null, // filled once the total is known
        canonicalSha256: m.canonicalSha256,
        claudeTokens: opts.divergence ? (isCurrent(divRow, m.canonicalSha256 ?? null) ? divRow.claudeDelta : null) : undefined,
        notes: m.status === 'dynamic' ? m.notes : undefined,
      });
      for (const t of m.tools) tools.push({ server: s.name, tool: t.name, tokens: t.tokens });
    }

    const totalTokens = ok.reduce((a, s) => a + (s.tokens ?? 0), 0);
    const toolCount = ok.reduce((a, s) => a + (s.toolCount ?? 0), 0);
    ok.sort((a, b) => (b.tokens ?? 0) - (a.tokens ?? 0));
    for (const s of ok) s.share = totalTokens > 0 ? (s.tokens ?? 0) / totalTokens : 0;
    tools.sort((a, b) => b.tokens - a.tokens);

    const result = {
      client: cfg.client,
      source: cfg.source,
      totalTokens,
      toolCount,
      serverCount: ok.length,
      // Deliberately no band: the color bands were frozen against the per-server
      // distribution (n=57). A config total is a different population, so calling
      // a 7,901-token *stack* "moderate" would borrow a scale that doesn't mean
      // that here. Share of the context window is the honest framing.
      contextShare: totalTokens / contextWindow,
      servers: ok,
      skipped,
      heaviestTools: tools.slice(0, 5),
      trimAdvice: buildTrimAdvice(tools, totalTokens),
    };
    built.push(result);
    shared.set(result, sharedHere);
  }

  built.sort((a, b) => b.totalTokens - a.totalTokens);
  const results = attachDeferral(built, contextWindow, { ...opts, shared });

  const report: AuditReport = {
    methodologyVersion: METHODOLOGY_VERSION,
    encoding: 'o200k_base',
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    contextWindow,
    configs: results,
    emptyConfigs,
    problems,
  };

  if (opts.divergence) {
    report.claudeDivergence = { model: opts.divergence.model, measuredAt: opts.divergence.measuredAt };
  }

  if (typeof opts.budget === 'number') {
    // The worst config is the gate: passing because your *lightest* client fits
    // would be a green check on a session you don't run.
    const worst = results[0];
    const over = (worst?.totalTokens ?? 0) > opts.budget;
    report.budget = {
      limit: opts.budget,
      worstTotal: worst?.totalTokens ?? 0,
      worstSource: worst?.source ?? '(none)',
      over,
      fit: over && worst ? planBudgetFit(worst, opts.budget) : undefined,
    };
  }
  return report;
}

const n = (x: number) => x.toLocaleString('en-US');
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** The measurement itself — unconditional, and separate from any claim about who pays it. */
function measurementLine(cfg: AuditConfigResult, contextWindow: number): string {
  return (
    `  ${n(cfg.totalTokens)} tokens of tool schemas — ${pct(cfg.contextShare)} of a ` +
    `${n(contextWindow)}-token context window.`
  );
}

/** How a place is named in a sentence; the shell has a path-shaped stand-in in JSON. */
function sourceName(source: string): string {
  return source === SHELL_SOURCE ? 'this shell' : source;
}

/** "ENABLE_TOOL_SEARCH=auto on this machine" / "unset here, the documented default". */
function settingPhrase(d: DeferralVerdict): string {
  const s = d.setting;
  if (!s || !s.variable) return 'by default';
  // Which place it was read in is not spelled here: a settings path is longer
  // than this report's line, and both cases — the value and the silence — are
  // answered by the list `postureSourceLines` prints directly underneath, which
  // marks the place that decided it.
  if (!s.readFromMachine) return `${s.variable} is unset here, which is the documented default`;
  // A base URL is reported by hostname only (see ToolSearchSetting.value), so it
  // is phrased as where the variable points and never as what it equals.
  if (s.variable === 'ANTHROPIC_BASE_URL') return `${s.variable} points at ${s.value} on this machine`;
  return `${s.variable}=${s.value} on this machine`;
}

/**
 * Which places this posture was read from, and what each one held.
 *
 * The sentence above this list states a verdict about tokens on somebody's
 * machine, and the commonest of those verdicts — the documented default — is
 * an argument from silence. Silence is only evidence across the places that
 * were opened, so they are named: a reader who sets `ENABLE_TOOL_SEARCH` in a
 * file this audit did not read can see that from the report instead of
 * believing a default that does not apply to them.
 */
function postureSourceLines(d: DeferralVerdict): string[] {
  const recs = d.setting?.sources ?? [];
  if (recs.length === 0) return [];
  const lines = [
    '  Where this was read — Claude Code takes these variables from the shell it',
    '  starts in and from the env block of its own settings files:',
  ];
  let absent = 0;
  for (const r of recs) {
    if (r.state === 'absent') {
      absent++;
      continue;
    }
    // A place that sets one of them to something unreadable is neither a place
    // that sets it nor a place that sets none of them, and printing it as the
    // second is the silence this report would then argue from.
    const unreadableVars = r.unreadable?.length
      ? `sets ${r.unreadable.join(', ')} to a value this cannot read`
      : '';
    const held =
      r.state === 'unreadable'
        ? 'could not be read — what it sets is unknown'
        : [r.sets.length ? `sets ${r.sets.join(', ')}` : '', unreadableVars].filter(Boolean).join(', and ') ||
          'sets none of them';
    // Which place the verdict came out of, said once rather than left to a
    // reader to work out from two lists.
    const decided = d.setting?.source === r.source ? ', which decided this' : '';
    lines.push(`    ${sourceName(r.source)} — ${held}${decided}`);
  }
  if (absent > 0) {
    lines.push(`    ${absent} other settings file(s) it reads are not on this machine`);
  }
  if (!recs.some((r) => r.scope !== 'shell')) {
    lines.push("    its settings files were NOT read here, so what they set is unknown");
  }
  return lines;
}

/**
 * The total the lines around this one are about was summed from a measurement
 * that stood for more than one entry, so it is not a number to reason from.
 *
 * Printed in EVERY mode, not only the one that weighs the total against a
 * threshold. The other modes state what these tokens cost just as plainly —
 * `loads-upfront` says every request carries them, and there the number IS the
 * whole cost claim — so a total this report will not stand behind must not be
 * left uncaveated in any of them. `evaluateDeferral` additionally withholds
 * `clientTokens` and `crosses`, which only threshold mode derives; the other
 * modes derive nothing from the total, so this paragraph is the whole of the
 * rule there.
 */
function sharedMeasurementLines(
  d: DeferralVerdict,
  skippedNames: number,
  consequence: readonly string[],
): string[] {
  const lines = [
    `  How big this stack is cannot be said here: ${d.sharedMeasurements} of the servers above run`,
    '  the same command as another entry and differ only in the environment they',
    '  are given, so one launch was measured and its number counted for each of',
    '  them. Environment decides what a server serves, so that sum can be wrong in',
    ...consequence,
  ];
  if (d.isFloor) {
    lines.push(`  ${skippedNames} server(s) here also produced no number — see "not measured" above.`);
  }
  return lines;
}

/** Where a threshold is in play, the unknown size is the whole verdict. */
const SIDE_UNKNOWN = [
  '  either direction — which side of the threshold this stack falls on cannot be',
  '  read off it. Measurements here are keyed by command line alone; nothing is',
  '  wrong with the config.',
] as const;

/** Where none is, the size is simply not a figure to quote. */
const SIZE_UNKNOWN = [
  '  either direction — how many tokens this stack costs cannot be read off it.',
  '  Measurements here are keyed by command line alone; nothing is wrong with',
  '  the config.',
] as const;

/**
 * Whether the tokens above are paid up front, and — only where the client
 * decides that by a threshold — which side of it this stack is on.
 *
 * Two things this must not do, both of which an earlier version did. It must
 * not present the threshold as what decides the default case: Claude Code's
 * default defers every MCP tool definition unconditionally, so a stack of any
 * size is deferred and telling its owner they pay those tokens is wrong in the
 * commonest case there is. And where a threshold does apply, it must not
 * compare the audit's wire count against it as though they were the same unit;
 * they differ by a factor this repository publishes and cannot narrow, so the
 * answer is a range and sometimes an admission.
 */
function deferralLines(d: DeferralVerdict, skippedNames: number): string[] {
  const lines: string[] = [];

  if (d.sources.length > 1) {
    lines.push(`  These ${d.sources.length} config files are read into one ${d.client} session:`);
    for (const s of d.sources) lines.push(`    ${s}`);
    lines.push('  so they face the question below together, as their sum.');
  }

  if (d.mode === 'client-unknown') {
    lines.push('  Which client reads this config is not known here, so whether it defers');
    lines.push('  tool definitions by default is not known either. Read as loaded up front.');
    if (d.sharedMeasurements > 0) lines.push(...sharedMeasurementLines(d, skippedNames, SIZE_UNKNOWN));
    return lines;
  }

  if (d.mode === 'no-deferral-on-record') {
    lines.push(`  No default deferral is on record for ${d.client}, so every request`);
    lines.push('  carries these tokens before you type anything — an absence of a record');
    lines.push('  about the client, not a measurement of it.');
    if (d.sharedMeasurements > 0) lines.push(...sharedMeasurementLines(d, skippedNames, SIZE_UNKNOWN));
    return lines;
  }

  if (d.mode === 'setting-unrecognized') {
    lines.push(`  ${d.setting?.variable} is set to "${d.setting?.value}" on this machine, which is not`);
    lines.push('  one of the values Claude Code documents (unset, true, false, auto, auto:N).');
    lines.push('  Whether these tokens are deferred cannot be said from it.');
    lines.push(...postureSourceLines(d));
    if (d.sharedMeasurements > 0) lines.push(...sharedMeasurementLines(d, skippedNames, SIZE_UNKNOWN));
    return lines;
  }

  if (d.mode === 'setting-unresolved') {
    if (d.setting?.unresolved === 'sources-disagree') {
      lines.push(`  ${d.setting.variable} is set to different values by more than one place this`);
      lines.push('  machine reads it from, and which one Claude Code takes is not on record');
      lines.push('  here. Whether these tokens are deferred cannot be said from them.');
    } else if (d.setting?.unresolved === 'value-unreadable') {
      lines.push(`  ${d.setting.variable} is set by a settings file Claude Code reads, to`);
      lines.push('  something that is not a value this can read — an env block holds it as a');
      lines.push('  JSON boolean, a number or null rather than a string. It is set there, and');
      lines.push('  what it is set to is unknown, so whether these tokens are deferred cannot');
      lines.push('  be said from it.');
    } else {
      lines.push('  A settings file Claude Code reads exists here and could not be read, so');
      lines.push('  what it sets is unknown — and it can set the variable that decides this.');
      lines.push('  Whether these tokens are deferred cannot be said from them.');
    }
    lines.push(...postureSourceLines(d));
    if (d.sharedMeasurements > 0) lines.push(...sharedMeasurementLines(d, skippedNames, SIZE_UNKNOWN));
    return lines;
  }

  if (d.mode === 'loads-upfront') {
    lines.push(`  ${d.client} loads every tool definition up front here: ${d.mechanism} is off`);
    lines.push(`  because ${settingPhrase(d)}. Every request carries these`);
    lines.push('  tokens before you type anything.');
    lines.push(...postureSourceLines(d));
    if (d.sharedMeasurements > 0) lines.push(...sharedMeasurementLines(d, skippedNames, SIZE_UNKNOWN));
    return lines;
  }

  if (d.mode === 'defers-all') {
    lines.push(`  ${d.client} defers every MCP tool definition (${d.mechanism}), with no threshold —`);
    lines.push(`  ${settingPhrase(d)}. These tokens are NOT loaded`);
    lines.push('  up front at any size; they load when the model reaches for a tool. Size');
    lines.push('  decides nothing here, so none of the arithmetic above changes the answer.');
    lines.push(...postureSourceLines(d));
    if (d.sharedMeasurements > 0) lines.push(...sharedMeasurementLines(d, skippedNames, SIZE_UNKNOWN));
    lines.push('  The full number is paid where deferral does not apply:');
    for (const e of d.exceptions) lines.push(`    ${e}`);
    return lines;
  }

  // Threshold mode: the only mode where how big this stack is matters at all.
  const t = d.thresholdTokens ?? 0;
  lines.push(`  ${d.client} defers tool definitions above a threshold here (${d.mechanism}):`);
  lines.push(`  ${settingPhrase(d)}, so deferral activates once the`);
  lines.push(`  definitions reach ${n(t)} tokens — ${pct(d.thresholdShare ?? 0)} of the context window.`);
  lines.push(...postureSourceLines(d));

  const c = d.clientTokens;
  if (!c) {
    // No total was established, so there is no side to be on and no number to
    // say it with. Both are withheld together: printing the sum here and only
    // withholding the verdict would leave a figure a reader would compare
    // against the threshold themselves.
    lines.push(...sharedMeasurementLines(d, skippedNames, SIDE_UNKNOWN));
    return lines;
  }

  const total = d.isFloor ? `at least ${n(d.wireTokens)}` : n(d.wireTokens);
  if (c.estimated === 0) {
    lines.push(`  This stack is ${total} tokens on the wire, and ${n(c.low)} by the published`);
    lines.push(`  Anthropic counts for all ${c.exact} measured server(s) — which is the side the`);
    lines.push('  threshold is counted on.');
  } else {
    lines.push(`  This stack is ${total} tokens on the wire. The threshold is counted in what`);
    lines.push(`  the client sends to the API, which is a different number: across ${d.ratio!.servers}`);
    lines.push(
      `  servers in ${d.ratio!.source} the two differ by ${ratioBand(d)}, putting this stack`,
    );
    lines.push(
      `  between ${n(c.low)} and ${n(c.high)} tokens on that side` +
        (c.exact > 0 ? `, with ${c.exact} of them taken from published counts.` : '.'),
    );
  }

  if (d.crosses === true) {
    lines.push(`  That is at or above the threshold — over by ${n(d.distanceTokens!.low)} at the low end —`);
    lines.push('  so these tokens are NOT loaded up front. The full number is still paid');
    lines.push('  where deferral does not apply:');
    for (const e of d.exceptions) lines.push(`    ${e}`);
  } else if (d.crosses === false) {
    lines.push(`  That is below the threshold — under by ${n(-d.distanceTokens!.high)} at the high end —`);
    lines.push('  so deferral does not activate and every request carries these tokens');
    lines.push('  before you type anything.');
  } else {
    lines.push('  Which side this stack falls on cannot be said:');
    if (c.low < t && c.high >= t) {
      lines.push(`    that range straddles the ${n(t)}-token threshold`);
    }
    if (d.isFloor) {
      lines.push(`    ${skippedNames} server(s) here produced no number, and what they serve`);
      lines.push('    counts toward it too — see "not measured" above');
    }
    if (c.estimated > 0) {
      lines.push('    run with --claude to replace the estimate with published Anthropic');
      lines.push('    counts wherever a capture still matches');
    }
  }
  return lines;
}

/** "0.20×–1.92×", from whichever band the verdict was actually computed against. */
function ratioBand(d: DeferralVerdict): string {
  const r = d.ratio ?? PUBLISHED_WIRE_TO_CLIENT_RATIO;
  return `${r.low.toFixed(2)}×–${r.high.toFixed(2)}×`;
}

/** Human output. JSON output is the report object itself. */
export function formatReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(
    `mcp-context-cost audit · methodology ${report.methodologyVersion} · ${report.encoding} · context window ${n(report.contextWindow)}`,
  );

  const showClaude = !!report.claudeDivergence;
  // Configs one session loads together share a verdict object; it answers for
  // all of them at once, so it is printed under the first one and not repeated.
  const verdictPrinted = new Set<DeferralVerdict>();

  for (const cfg of report.configs) {
    lines.push('');
    lines.push(`${cfg.client}  ${cfg.source}`);

    const rows = cfg.servers.map((s) => ({
      name: s.name,
      tools: s.toolCount === null ? '—' : String(s.toolCount),
      tokens: s.tokens === null ? '—' : n(s.tokens),
      share: s.share === null ? '—' : pct(s.share),
      claude: s.claudeTokens == null ? '—' : n(s.claudeTokens),
    }));
    const w = {
      name: Math.max(6, ...rows.map((r) => r.name.length), 'total'.length),
      tools: Math.max(5, ...rows.map((r) => r.tools.length)),
      tokens: Math.max(6, ...rows.map((r) => r.tokens.length), n(cfg.totalTokens).length),
      claude: Math.max(6, ...rows.map((r) => r.claude.length)),
    };
    const line = (name: string, tools: string, tokens: string, share: string, claude: string) =>
      `  ${name.padEnd(w.name)}  ${tools.padStart(w.tools)}  ${tokens.padStart(w.tokens)}  ${share.padStart(6)}` +
      (showClaude ? `  ${claude.padStart(w.claude)}` : '');

    lines.push(line('server', 'tools', 'tokens', 'share', 'claude'));
    for (const r of rows) lines.push(line(r.name, r.tools, r.tokens, r.share, r.claude));
    lines.push(`  ${'─'.repeat(w.name + w.tools + w.tokens + 14 + (showClaude ? w.claude + 2 : 0))}`);
    lines.push(line('total', String(cfg.toolCount), n(cfg.totalTokens), '', ''));

    lines.push('');
    lines.push(measurementLine(cfg, report.contextWindow));
    if (!verdictPrinted.has(cfg.deferral)) {
      verdictPrinted.add(cfg.deferral);
      const skippedInScope = report.configs
        .filter((c) => c.deferral === cfg.deferral)
        .reduce((a, c) => a + c.skipped.length, 0);
      for (const line of deferralLines(cfg.deferral, skippedInScope)) lines.push(line);
    }

    if (cfg.heaviestTools.length) {
      lines.push('');
      lines.push('  heaviest tools');
      const tw = Math.max(...cfg.heaviestTools.map((t) => `${t.server} · ${t.tool}`.length));
      for (const t of cfg.heaviestTools) {
        lines.push(`    ${`${t.server} · ${t.tool}`.padEnd(tw)}  ${n(t.tokens).padStart(7)}`);
      }
    }

    if (cfg.trimAdvice) {
      const names = cfg.trimAdvice.tools.map((t) => `${t.server}·${t.tool}`).join(', ');
      lines.push('');
      lines.push(
        `  trim: disabling ${cfg.trimAdvice.tools.length} tool${cfg.trimAdvice.tools.length === 1 ? '' : 's'} ` +
          `(${names}) would recover ${n(cfg.trimAdvice.recoverableTokens)} tokens ` +
          `(${pct(cfg.trimAdvice.recoverableShare)} of this config) — if your client supports per-tool filtering.`,
      );
    }

    if (cfg.skipped.length) {
      lines.push('');
      lines.push('  not measured');
      const sw = Math.max(...cfg.skipped.map((s) => s.name.length));
      for (const s of cfg.skipped) {
        lines.push(`    ${s.name.padEnd(sw)}  ${s.status}${s.notes ? ` — ${s.notes}` : ''}`);
      }
    }
  }

  if (showClaude) {
    lines.push('');
    lines.push(
      `  claude = Anthropic-request cost from the ${report.claudeDivergence!.measuredAt} ${report.claudeDivergence!.model} ` +
        `divergence run, shown only where the published capture hash matches this install; '—' means no current match.`,
    );
  }

  if (report.problems.length) {
    lines.push('');
    lines.push('problems');
    for (const p of report.problems) lines.push(`  ${p}`);
  }

  if (report.budget) {
    const b = report.budget;
    lines.push('');
    if (!b.over) {
      const headroom = b.limit - b.worstTotal;
      lines.push(`budget ok: ${n(b.worstTotal)} ≤ ${n(b.limit)} — ${n(headroom)} to spare`);
    } else {
      lines.push(`BUDGET FAIL: ${n(b.worstTotal)} > ${n(b.limit)} (${b.worstSource})`);
      const fit = b.fit;
      if (fit && fit.drop.length) {
        lines.push('');
        lines.push(`  over by ${n(fit.overBy)}. Heaviest-first, this is what gets you under:`);
        for (const step of fit.drop) {
          const verdict = step.remaining <= b.limit ? 'fits' : 'still over';
          lines.push(
            `    drop  ${step.name.padEnd(22)} ${n(step.tokens).padStart(9)}  →  ${n(step.remaining).padStart(9)}  ${verdict}`,
          );
        }
        lines.push('');
        if (fit.feasible && fit.keptCount === 0) {
          // Arithmetically it fits, and the answer is useless: the only way under this
          // limit is to run no servers at all. Saying "fits" here would be true and
          // misleading, which is the pair this whole tool exists to keep apart.
          lines.push(
            `  no subset fits: every measured server would have to go. The limit is below`,
          );
          lines.push(`  what any one of these servers costs.`);
        } else if (fit.feasible) {
          const share = b.limit > 0 ? ` (${pct(fit.keptTokens / b.limit)} of budget)` : '';
          lines.push(
            `  keeps ${fit.keptCount} server(s) at ${n(fit.keptTokens)} tokens${share}`,
          );
        } else {
          lines.push(
            `  even removing every measured server leaves ${n(fit.keptTokens)} — the limit is below this config's floor`,
          );
        }
        lines.push('');
        lines.push(
          '  This is arithmetic, not advice: it cannot know which servers you need, and by',
        );
        lines.push(
          '  weight alone it will sometimes name the one you cannot work without. Use --json',
        );
        lines.push('  for the full per-server list and pick your own order.');
      } else if (fit) {
        lines.push('  nothing measured could be removed to get under the limit.');
      }
    }
  }

  if (report.diff) lines.push(formatDiff(report.diff, report.contextWindow));
  if (report.increaseGate) {
    lines.push('');
    lines.push(formatGate(report.increaseGate));
  }

  lines.push('');
  lines.push(
    'These are wire tokens — what the server puts on the wire, counted with o200k_base. What your model is billed',
  );
  lines.push(
    `differs per provider: measured ratios run ${PUBLISHED_WIRE_TO_CLIENT_RATIO.low.toFixed(2)}×–` +
      `${PUBLISHED_WIRE_TO_CLIENT_RATIO.high.toFixed(2)}× on Anthropic requests. See docs/METHODOLOGY.md §claude-divergence.`,
  );
  return lines.map((l) => l.replace(/\s+$/, '')).join('\n');
}

/** Top-level tool list across every config — used by nothing yet, handy for --json consumers. */
export function allHeaviestTools(report: AuditReport, limit = 10): HeaviestTool[] {
  return report.configs
    .flatMap((c) => c.heaviestTools)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, limit);
}

export type { ToolMeasurement };
