/**
 * Whether the client reading this config loads MCP tool definitions up front —
 * or defers them until the model reaches for one.
 *
 * The headline audit number is what a session pays to put every tool definition
 * in the context window. Whether it pays that is a property of the client and
 * of the machine it runs on, not of the servers. So this module answers with
 * three separate things, because collapsing them is how the first version of
 * this got the common case wrong:
 *
 *   1. **What mode is in force.** Claude Code's default is to defer EVERY MCP
 *      tool definition, unconditionally — there is no threshold in the default
 *      case. A threshold exists only in the opt-in `auto` mode, and `auto:N`
 *      lets that percentage be anything from 0 to 100. Which mode is in force
 *      is decided by environment variables on the machine being audited, so
 *      they are read rather than assumed.
 *   2. **Where the threshold sits**, when there is one at all.
 *   3. **Which side of it this stack falls on** — as a range, not a point,
 *      because the audit's number and the threshold are counted in different
 *      units (see `wireToClientRatio` below).
 *
 * Sources, and their dates, because these are claims about someone else's
 * product and they will rot:
 *
 *   - Claude Code MCP documentation, §"Scale with MCP tool search", read
 *     2026-08-20. "Tool search is enabled by default. MCP tools are deferred
 *     rather than loaded into context upfront." The `ENABLE_TOOL_SEARCH` table:
 *     unset → "All MCP tools deferred and loaded on demand"; `true` → all
 *     deferred; `auto` → "Threshold mode: Claude Code loads the tools it would
 *     otherwise defer upfront while their definitions total less than 10% of
 *     the context window, and defers all of them once the definitions reach
 *     10%"; `auto:N` → "Threshold mode with a custom percentage, where `N` is
 *     0-100"; `false` → "All MCP tools loaded upfront, no deferral". Deferral
 *     also falls back to upfront loading behind a non-first-party
 *     `ANTHROPIC_BASE_URL`, on a Microsoft Foundry deployment hosted on Azure,
 *     and on Google Cloud Agent Platform models earlier than the Claude 4.5
 *     generation; `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` "keeps tool search
 *     off. You can't override it by setting `ENABLE_TOOL_SEARCH` yourself."
 *     A server with `alwaysLoad: true` loads at session start regardless.
 *
 * No default deferral is on record here for the other four clients this tool
 * discovers. That is an absence of a record, not a measurement of those
 * clients, and it is printed as such — the same rule the rest of this project
 * follows for a value it has not observed.
 */
import type { DivergenceRun } from '../core/divergence.js';

/** Share of the context window at which deferral activates under `auto`. */
export const TOOL_SEARCH_AUTO_SHARE = 0.1;

/** The variables that decide whether this machine's Claude Code defers. */
export const TOOL_SEARCH_VARS = [
  'ENABLE_TOOL_SEARCH',
  'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
  'ANTHROPIC_BASE_URL',
] as const;

export type ToolSearchVar = (typeof TOOL_SEARCH_VARS)[number];

/** The env vars that decide whether this machine's Claude Code defers. */
export interface ToolSearchEnv {
  ENABLE_TOOL_SEARCH?: string;
  CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS?: string;
  ANTHROPIC_BASE_URL?: string;
}

/** Pick the three variables that matter out of a process environment. */
export function toolSearchEnv(env: Record<string, string | undefined>): ToolSearchEnv {
  return {
    ENABLE_TOOL_SEARCH: env.ENABLE_TOOL_SEARCH,
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS,
    ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL,
  };
}

/**
 * A place the audited machine can set those variables.
 *
 * Two kinds, because Claude Code reads two kinds: the environment of the shell
 * it was started in, and the `env` block of its own settings files. Reading
 * only the first is how this reported the documented default — "these tokens
 * are NOT loaded up front at any size" — at a machine that had switched
 * deferral off in `~/.claude/settings.json`.
 */
export type ToolSearchScope =
  | 'shell'
  | 'managed-settings'
  | 'local-settings'
  | 'project-settings'
  | 'user-settings';

/** What `source` says for the process environment, which has no path. */
export const SHELL_SOURCE = '(shell environment)';

export interface ToolSearchSource {
  scope: ToolSearchScope;
  /** Path of the settings file, or `SHELL_SOURCE`. */
  source: string;
  /**
   * `read` — consulted, and `vars` is what it sets.
   * `absent` — not on this machine, so it sets nothing.
   * `unreadable` — it exists and could not be read: what it sets is UNKNOWN,
   * which is not the same as nothing and is never resolved as though it were.
   */
  state: 'read' | 'absent' | 'unreadable';
  /** What this place sets, of the three. Values are read here, never reported. */
  vars: ToolSearchEnv;
  /**
   * Variables this place sets to something that is not a value this audit can
   * read — an env block holding a JSON boolean, a number, or null.
   *
   * The file parsed and the variable IS set in it; what it is set to is
   * unknown. That is not the same as unset, and reading it as unset is how a
   * machine whose `~/.claude/settings.json` held `"ENABLE_TOOL_SEARCH": false`
   * — the boolean, not the string — was told the documented default stands and
   * these tokens are never loaded up front.
   */
  unreadable?: ToolSearchVar[];
}

/**
 * A source as it appears in a report: names of what it sets, never values.
 *
 * This is the record that lets a reader tell "nothing is set anywhere" from
 * "that place was never opened" — the two states `readFromMachine: false`
 * cannot distinguish on its own.
 */
export interface ToolSearchSourceRecord {
  scope: ToolSearchScope;
  source: string;
  state: ToolSearchSource['state'];
  /** Variable NAMES set here. A value can be a base URL carrying a credential. */
  sets: ToolSearchVar[];
  /**
   * Variable NAMES this place sets to something unreadable, when it does.
   * Omitted otherwise, so the common source record keeps its shape — a reader
   * meets this field only where there is an unknown to meet.
   */
  unreadable?: ToolSearchVar[];
}

/** A source as it is published: what it sets, by name. */
export function toolSearchSourceRecord(s: ToolSearchSource): ToolSearchSourceRecord {
  const unreadable = TOOL_SEARCH_VARS.filter((n) => (s.unreadable ?? []).includes(n));
  return {
    scope: s.scope,
    source: s.source,
    state: s.state,
    sets: TOOL_SEARCH_VARS.filter((n) => (s.vars[n] ?? '').trim() !== ''),
    ...(unreadable.length ? { unreadable } : {}),
  };
}

export type DeferralMode =
  /** Every MCP tool definition is deferred, at any size. No threshold applies. */
  | 'defers-all'
  /** Deferral activates only once the definitions reach a share of the window. */
  | 'threshold'
  /** Deferral is off here: every definition is in context at session start. */
  | 'loads-upfront'
  /** ENABLE_TOOL_SEARCH holds a value Claude Code does not document. */
  | 'setting-unrecognized'
  /** More than one place sets the variable, or one of them could not be read. */
  | 'setting-unresolved'
  /** A client we know about, with no default deferral on record. */
  | 'no-deferral-on-record'
  /** `--config <path>`: the file was read, but which client reads it is unknown. */
  | 'client-unknown';

/** How the mode was decided — printed, so a reader can check it against their own shell. */
export interface ToolSearchSetting {
  /** The variable that decided it, or null when nothing was set and the default stands. */
  variable: string | null;
  /**
   * What is printed for that variable. Null when the decision came from the
   * documented default.
   *
   * This is the value as read for `ENABLE_TOOL_SEARCH` and
   * `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`, whose values are settings and not
   * secrets. For `ANTHROPIC_BASE_URL` it is the hostname alone — never the
   * value — because a base URL routed through a proxy commonly carries a
   * credential in its userinfo or query, and a report is a thing meant to be
   * shared (`examples/github-actions.yml` runs it in CI, `--baseline` reads a
   * committed one). Same rule as `config.ts`: values are read, never written to
   * a report.
   */
  value: string | null;
  /** True when a variable on the audited machine decided this, false for the default. */
  readFromMachine: boolean;
  /**
   * Which place the deciding value was read from — a settings file's path, or
   * `SHELL_SOURCE`. Null when nothing was set anywhere and the documented
   * default stands.
   */
  source: string | null;
  /**
   * Every place that was consulted, in the order Claude Code would take them,
   * and what each one sets — by name. Printed and serialized so a reader can
   * see what was opened, and a `--json` consumer can tell a variable that is
   * set nowhere from a place this audit never read.
   */
  sources: ToolSearchSourceRecord[];
  /** Set only in `setting-unresolved`: why no mode could be read off them. */
  unresolved?: 'sources-disagree' | 'source-unreadable' | 'value-unreadable';
}

interface ResolvedToolSearch extends Omit<ToolSearchSetting, 'sources'> {
  mode: Extract<
    DeferralMode,
    'defers-all' | 'threshold' | 'loads-upfront' | 'setting-unrecognized' | 'setting-unresolved'
  >;
  thresholdShare: number | null;
}

/** The one host Claude Code treats as first-party for the tool-search fallback. */
const FIRST_PARTY_API_HOST = 'api.anthropic.com';

/** What is printed for a base URL we could not parse — a marker, not the value. */
const UNREADABLE_BASE_URL = '(unreadable URL)';

/**
 * The hostname of a base URL, or null if it does not parse.
 *
 * The hostname is the whole of what the mode decision needs, and it is also the
 * whole of what may leave this function: the rest of the value can carry a
 * credential. A value that does not parse is not first-party, which is the
 * reading that says tokens are paid — never the one that says they are free.
 */
function baseUrlHost(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Read the tool-search setting out of ONE environment. Values are matched
 * exactly as documented: an unrecognized value produces `setting-unrecognized`
 * rather than a guess, because guessing here would print a definite verdict
 * about tokens the reader may or may not be paying.
 *
 * `source` is left null here: this function is given one environment and has no
 * way to say which of the machine's places it came from. `resolveToolSearchSources`,
 * which does, fills it in.
 */
export function resolveToolSearch(env: ToolSearchEnv): ResolvedToolSearch {
  const betas = env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS?.trim();
  // Read first: documented as not overridable by ENABLE_TOOL_SEARCH.
  if (betas) {
    return {
      mode: 'loads-upfront',
      thresholdShare: null,
      variable: 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
      value: betas,
      source: null,
      readFromMachine: true,
    };
  }

  const raw = env.ENABLE_TOOL_SEARCH?.trim();
  const set = (
    mode: ResolvedToolSearch['mode'],
    thresholdShare: number | null,
  ): ResolvedToolSearch => ({
    mode,
    thresholdShare,
    variable: 'ENABLE_TOOL_SEARCH',
    value: raw ?? null,
    source: null,
    readFromMachine: true,
  });

  if (raw === undefined || raw === '') {
    const base = env.ANTHROPIC_BASE_URL?.trim();
    if (base) {
      const host = baseUrlHost(base);
      if (host !== FIRST_PARTY_API_HOST) {
        return {
          mode: 'loads-upfront',
          thresholdShare: null,
          variable: 'ANTHROPIC_BASE_URL',
          // The hostname alone. `base` itself is never carried out of here.
          value: host ?? UNREADABLE_BASE_URL,
          source: null,
          readFromMachine: true,
        };
      }
    }
    return {
      mode: 'defers-all',
      thresholdShare: null,
      variable: 'ENABLE_TOOL_SEARCH',
      value: null,
      source: null,
      readFromMachine: false,
    };
  }

  if (raw === 'true') return set('defers-all', null);
  if (raw === 'false') return set('loads-upfront', null);
  if (raw === 'auto') return set('threshold', TOOL_SEARCH_AUTO_SHARE);
  const custom = /^auto:(\d{1,3})$/.exec(raw);
  if (custom) {
    const pct = Number(custom[1]);
    if (pct >= 0 && pct <= 100) return set('threshold', pct / 100);
  }
  return set('setting-unrecognized', null);
}

/**
 * Read the posture from every place the audited machine can set it.
 *
 * Claude Code takes these variables from the shell it was started in AND from
 * the `env` block of its own settings files, so an audit that reads only the
 * shell answers the machine's question with someone else's environment. The
 * case that made this necessary: `~/.claude/settings.json` sets
 * `ENABLE_TOOL_SEARCH: "false"`, the shell running the audit sets nothing, and
 * every request on that machine pays for every tool definition while the report
 * calls it the documented default and says the tokens are not loaded at all.
 *
 * Among the settings files the order is Claude Code's documented precedence —
 * enterprise managed policy, then project-local, then project, then user
 * (Claude Code settings documentation, §"Settings files", read 2026-08-20) — so
 * the first of them that sets a variable is the one that would win.
 *
 * Between the settings files and the shell there is NO order on record here, so
 * a disagreement is refused rather than resolved: `setting-unresolved` names the
 * variable and every place, and no verdict is given. A place that exists and
 * could not be read is the same refusal for the same reason — what it sets is
 * unknown, and an unknown that could flip the answer is not a default. So is a
 * place that parsed and sets the deciding variable to something that is not a
 * readable value: the variable is set there, and dropping it leaves the report
 * arguing from a silence that is not silent.
 *
 * Not visible from here at all, and so not claimed: a variable set on Claude
 * Code's own command line.
 */
export function resolveToolSearchSources(sources: ToolSearchSource[]): ResolvedToolSearch {
  const unresolved = (
    reason: 'sources-disagree' | 'source-unreadable' | 'value-unreadable',
    variable: string | null,
  ): ResolvedToolSearch => ({
    mode: 'setting-unresolved',
    thresholdShare: null,
    variable,
    value: null,
    source: null,
    readFromMachine: false,
    unresolved: reason,
  });

  if (sources.some((s) => s.state === 'unreadable')) return unresolved('source-unreadable', null);

  const settings = sources.filter((s) => s.scope !== 'shell');
  const shell = sources.find((s) => s.scope === 'shell');

  /** Whether a place sets this variable at all — readably or not. */
  const holds = (s: ToolSearchSource, name: ToolSearchVar): boolean =>
    (s.vars[name] ?? '').trim() !== '' || (s.unreadable ?? []).includes(name);

  /**
   * The value that would win for one variable, or the fact that it cannot be
   * had: two places disagree, or the place that would win sets it to something
   * unreadable.
   *
   * Precedence is what makes the unreadable case worth separating from a blanket
   * refusal. A higher-precedence file setting a value Claude Code documents is
   * the value in force, and an unreadable one underneath it decides nothing —
   * the same reasoning that keeps a disagreement over `ANTHROPIC_BASE_URL` from
   * refusing an answer an explicit `ENABLE_TOOL_SEARCH` already gave.
   */
  const read = (
    name: ToolSearchVar,
  ): { value: string; source: string } | 'conflict' | 'unreadable' | null => {
    const winner = settings.find((s) => holds(s, name));
    const shellValue = (shell?.vars[name] ?? '').trim();
    // Whichever place would decide holds an unknown: it could be any of the
    // documented values or none of them, and the ones it could be do not agree.
    if (winner && (winner.vars[name] ?? '').trim() === '') return 'unreadable';
    if (shell && holds(shell, name) && shellValue === '') return 'unreadable';
    if (winner && shellValue && (winner.vars[name] ?? '').trim() !== shellValue) return 'conflict';
    if (winner) return { value: (winner.vars[name] ?? '').trim(), source: winner.source };
    if (shellValue && shell) return { value: shellValue, source: shell.source };
    return null;
  };

  // Consulted in the same order `resolveToolSearch` consults them, so a
  // disagreement over a variable that would not have decided anything —
  // ANTHROPIC_BASE_URL behind an explicit ENABLE_TOOL_SEARCH — does not refuse
  // an answer the machine actually gives.
  const betas = read('CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS');
  if (betas === 'conflict') return unresolved('sources-disagree', 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS');
  if (betas === 'unreadable')
    return unresolved('value-unreadable', 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS');
  if (betas) {
    return {
      ...resolveToolSearch({ CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: betas.value }),
      source: betas.source,
    };
  }

  const enable = read('ENABLE_TOOL_SEARCH');
  if (enable === 'conflict') return unresolved('sources-disagree', 'ENABLE_TOOL_SEARCH');
  if (enable === 'unreadable') return unresolved('value-unreadable', 'ENABLE_TOOL_SEARCH');
  if (enable) {
    return { ...resolveToolSearch({ ENABLE_TOOL_SEARCH: enable.value }), source: enable.source };
  }

  const base = read('ANTHROPIC_BASE_URL');
  if (base === 'conflict') return unresolved('sources-disagree', 'ANTHROPIC_BASE_URL');
  if (base === 'unreadable') return unresolved('value-unreadable', 'ANTHROPIC_BASE_URL');
  const resolved = resolveToolSearch(base ? { ANTHROPIC_BASE_URL: base.value } : {});
  return { ...resolved, source: resolved.readFromMachine ? (base?.source ?? null) : null };
}

/**
 * The factor between the number this audit counts and the number the threshold
 * is counted in.
 *
 * The audit's total is o200k_base over the bytes a server puts on the wire. The
 * threshold is a share of the context window measured in what the client
 * actually sends to the API — the name/description/input_schema projection,
 * counted by Anthropic's tokenizer, plus the tool framework overhead. Those are
 * not the same number and the gap is not small: across the published
 * divergence run it runs from 0.20× to 1.92×, so a single stack total maps to a
 * range roughly ten times as wide as itself. Comparing the wire number directly
 * against the threshold understates the deferrable side for schema-heavy
 * servers and overstates it for metadata-heavy ones, in one direction each.
 */
export interface WireToClientRatio {
  low: number;
  high: number;
  /** How many servers the band was measured across, for the printed caveat. */
  servers: number;
  /** The run it came from, so a reader can date it. */
  source: string;
}

/**
 * The band as published in this repository's own `results/divergence.json`
 * (claude-opus-5, 2026-08-19, 20 servers). Used when no divergence run was
 * supplied; `--claude` recomputes it from the run it fetched.
 */
export const PUBLISHED_WIRE_TO_CLIENT_RATIO: WireToClientRatio = {
  low: 0.2,
  high: 1.92,
  // A snapshot of the run this package was cut against, which is what `source`
  // below says it is — the installed package has no `results/` to read, so when
  // a live run is supplied `wireToClientRatio` uses that instead and this is
  // never consulted. It may therefore lag the run on trunk, and a test holds it
  // to the two things that matter: the band must still be accurate to the
  // precision it is published at, because a wrong band gives a wrong
  // above/below verdict, and the count must never *exceed* the run, because
  // that would be a claim about servers nobody measured.
  //
  // It read 20 from the day the run covered the top 20 until the run widened to
  // every measured server on 2026-09-05, with nothing comparing the two. The
  // band had not moved — the servers added sat inside it — which is exactly how
  // a number like this goes wrong quietly.
  servers: 23,
  source: 'the published claude-opus-5 divergence run',
};

/** Derive the band from a supplied divergence run, falling back to the published one. */
export function wireToClientRatio(run?: DivergenceRun | null): WireToClientRatio {
  if (!run) return PUBLISHED_WIRE_TO_CLIENT_RATIO;
  let low = Infinity;
  let high = -Infinity;
  let servers = 0;
  for (const row of Object.values(run.servers)) {
    if (!row || row.error || typeof row.claudeDelta !== 'number' || !(row.o200kFull > 0)) continue;
    const ratio = row.claudeDelta / row.o200kFull;
    low = Math.min(low, ratio);
    high = Math.max(high, ratio);
    servers++;
  }
  if (servers === 0) return PUBLISHED_WIRE_TO_CLIENT_RATIO;
  return { low, high, servers, source: `the ${run.measuredAt} ${run.model} divergence run` };
}

/** One measured server, as the deferral arithmetic needs it. */
export interface DeferralServer {
  /** o200k tokens over the wire capture — the audit's own unit. */
  tokens: number;
  /**
   * Anthropic's own count for this server from a current divergence row, when
   * `--claude` supplied one. `null` means no current match, `undefined` means
   * the join was not requested — either way it is converted through the band.
   */
  claudeTokens?: number | null;
}

/**
 * The configs one session of one client loads together.
 *
 * Claude Code reads both `~/.claude.json` and `<cwd>/.mcp.json` into a single
 * session, so they get one verdict against their sum rather than two verdicts
 * each judged alone. The report still totals each config file separately — a
 * context window belongs to one session, which is the argument for adding these
 * two together, not for adding one client's servers to another's.
 */
export interface DeferralScope {
  client: string;
  /** Every config file this verdict covers. */
  sources: string[];
  servers: DeferralServer[];
  /** Entries discovered across those configs that produced no number. */
  skippedCount: number;
  /**
   * Entries here whose number came from a measurement shared with another entry
   * that differs only in its environment.
   *
   * Measurements are cached per command line, so two entries running the same
   * command under different environments are launched once and both carry the
   * one number. Environment decides what a server serves — `GITHUB_TOOLSETS` on
   * `github-mcp-server` selects which toolsets it lists — so that number belongs
   * to at most one of them, and which one is not knowable from here.
   *
   * Counted rather than flagged so the report can say how much of the stack it
   * covers. Every entry sharing such a measurement counts, including whichever
   * one was really launched.
   */
  sharedMeasurements: number;
}

/** What the client would count for this stack, as a range. */
export interface ClientSideEstimate {
  low: number;
  high: number;
  /** Servers taken from a published Anthropic count rather than converted. */
  exact: number;
  /** Servers converted through the ratio band. */
  estimated: number;
}

export interface DeferralVerdict {
  client: string;
  mode: DeferralMode;
  /** What the client calls the mechanism, for a reader who wants to look it up. */
  mechanism: string | null;
  /** Every config file this one verdict covers. */
  sources: string[];
  /** Which variable decided the mode, and whether it was read or defaulted. */
  setting: ToolSearchSetting | null;
  /** Null whenever no threshold applies — which includes the default case. */
  thresholdShare: number | null;
  thresholdTokens: number | null;
  /**
   * o200k tokens summed across the scope — what this audit measured.
   *
   * Read together with `sharedMeasurements`: where that is non-zero this sum
   * counts one measurement for several entries, so it is not the stack's total
   * and nothing here is derived from it.
   */
  wireTokens: number;
  /** Null when there is no threshold to compare against, or no total to convert. */
  clientTokens: ClientSideEstimate | null;
  ratio: WireToClientRatio | null;
  /**
   * True when the stack total is a lower bound rather than a count — some
   * server in this scope could not be measured, and a session would still load
   * whatever it serves. Absent is unknown, never zero.
   */
  isFloor: boolean;
  /** clientTokens − thresholdTokens, at each end of the range. Positive is over. */
  distanceTokens: { low: number; high: number } | null;
  /**
   * true = deferral activates, false = it does not, null = cannot be said.
   * Null has four causes, all of them real: there is no threshold rule to be
   * on a side of, the unit conversion straddles the threshold, an unmeasured
   * server could carry an under-threshold stack over, or the stack has no
   * established total at all (`sharedMeasurements`).
   */
  crosses: boolean | null;
  /**
   * How many entries in this scope carry a number measured for a twin that
   * differs only in environment. Non-zero means the sum above is not this
   * stack's total, in either direction, so no side of the threshold is claimed.
   */
  sharedMeasurements: number;
  /** Conditions this cannot read, under which a deferring client pays in full. */
  exceptions: string[];
}

/** Clients this tool discovers that have no default deferral on record. */
const NO_DEFERRAL_ON_RECORD = new Set(['claude-desktop', 'cursor', 'vscode', 'windsurf']);

/**
 * Where deferral does not apply even when the machine's setting says it should.
 * None of these can be read from the config or the environment, so they are
 * printed as conditions for the reader to check rather than folded into the
 * verdict.
 */
const EXCEPTIONS = [
  'a Microsoft Foundry deployment hosted on Azure, which rejects tool search server-side',
  "Google Cloud's Agent Platform on a model earlier than the Claude 4.5 generation",
  'a model without support for tool_reference blocks (before Sonnet 4.5 / Haiku 4.5 / Opus 4.5)',
  'a server pinned with "alwaysLoad": true, whose tools load at session start regardless',
];

function estimate(servers: DeferralServer[], ratio: WireToClientRatio): ClientSideEstimate {
  let low = 0;
  let high = 0;
  let exact = 0;
  let estimated = 0;
  for (const s of servers) {
    if (typeof s.claudeTokens === 'number') {
      // A published Anthropic count for this exact capture. It carries the tool
      // framework overhead the API charges once per request rather than once
      // per server, so a multi-server sum leans high by at most that overhead —
      // far inside the band the converted servers already contribute.
      low += s.claudeTokens;
      high += s.claudeTokens;
      exact++;
    } else {
      low += s.tokens * ratio.low;
      high += s.tokens * ratio.high;
      estimated++;
    }
  }
  return { low: Math.round(low), high: Math.round(high), exact, estimated };
}

/**
 * Read one session's deferral position. Pure arithmetic over a built scope — no
 * config file is re-read and no server is launched. The environment is passed
 * in rather than read here, so the answer is reproducible from its inputs.
 */
export function evaluateDeferral(
  scope: DeferralScope,
  opts: {
    contextWindow: number;
    /** The audited machine's SHELL variables. Omitted means the shell set nothing. */
    env?: ToolSearchEnv;
    /**
     * The Claude Code settings files read on that machine, highest precedence
     * first — the other place these variables come from. Omitted means they
     * were not read here, which is published as such rather than as an absence
     * of settings: see `ToolSearchSetting.sources`.
     */
    settings?: ToolSearchSource[];
    /** Supplied by `--claude`; sharpens the unit conversion where rows match. */
    divergence?: DivergenceRun | null;
  },
): DeferralVerdict {
  const wireTokens = scope.servers.reduce((a, s) => a + s.tokens, 0);
  const isFloor = scope.skippedCount > 0;
  const sharedMeasurements = scope.sharedMeasurements;

  // Every field a verdict carries, at its "nothing to say" value. Each mode
  // below overrides only what it can actually answer.
  const base: Omit<DeferralVerdict, 'mode'> = {
    client: scope.client,
    sources: scope.sources,
    wireTokens,
    isFloor,
    // Carried by every mode, not just the one that returns early on it below.
    // That early return withholds `clientTokens` and `crosses`, which only
    // threshold mode ever computes; the other modes derive nothing from the
    // total and so have nothing to withhold. What they do all do is PRINT it,
    // so the caveat belongs in every branch of the report — see
    // `sharedMeasurementLines` in audit.ts, which every mode calls.
    sharedMeasurements,
    mechanism: null,
    setting: null,
    thresholdShare: null,
    thresholdTokens: null,
    clientTokens: null,
    ratio: null,
    distanceTokens: null,
    crosses: null,
    exceptions: [],
  };

  if (scope.client !== 'claude-code') {
    return {
      ...base,
      mode: NO_DEFERRAL_ON_RECORD.has(scope.client) ? 'no-deferral-on-record' : 'client-unknown',
    };
  }

  // The shell is one place among several, not the machine. Everything Claude
  // Code would read is resolved together, and a disagreement between them is
  // refused rather than decided by whichever this happened to open.
  const sources: ToolSearchSource[] = [
    { scope: 'shell', source: SHELL_SOURCE, state: 'read', vars: opts.env ?? {} },
    ...(opts.settings ?? []),
  ];
  const resolved = resolveToolSearchSources(sources);
  const setting: ToolSearchSetting = {
    variable: resolved.variable,
    value: resolved.value,
    source: resolved.source,
    readFromMachine: resolved.readFromMachine,
    sources: sources.map(toolSearchSourceRecord),
    ...(resolved.unresolved ? { unresolved: resolved.unresolved } : {}),
  };

  if (resolved.mode !== 'threshold') {
    return {
      ...base,
      mode: resolved.mode,
      mechanism: 'tool search',
      setting,
      // Nothing is deferred in the other two modes, so the conditions under
      // which deferral fails to apply are not worth printing there.
      exceptions: resolved.mode === 'defers-all' ? EXCEPTIONS : [],
    };
  }

  const thresholdShare = resolved.thresholdShare ?? TOOL_SEARCH_AUTO_SHARE;
  const thresholdTokens = Math.round(opts.contextWindow * thresholdShare);

  if (sharedMeasurements > 0) {
    // There is a threshold, and no total to hold against it. A shared
    // measurement is not a floor: a twin can serve more tools than the one that
    // was launched or fewer, so the sum can be wrong in either direction and
    // neither side can be ruled out. The same machine has already been seen to
    // report 13,834 wire tokens or 392 for one stack depending on which twin
    // the cache happened to hold, and to print a confident — opposite — side
    // each time. This is the rule `evaluateIncreaseGate` states and `crosses`
    // already follows: an answer that could not be established fails rather
    // than resolves. The threshold itself is still reported, because where the
    // line sits is known even when this stack's distance from it is not.
    return {
      ...base,
      mode: 'threshold',
      mechanism: 'tool search',
      setting,
      thresholdShare,
      thresholdTokens,
      exceptions: EXCEPTIONS,
    };
  }

  const ratio = wireToClientRatio(opts.divergence);
  const clientTokens = estimate(scope.servers, ratio);

  // At-or-above, on the documented "defers all of them once the definitions
  // reach 10%". A range that is entirely over is over even if it is a floor:
  // more unmeasured tokens cannot take it back under.
  const crosses =
    clientTokens.low >= thresholdTokens
      ? true
      : isFloor || clientTokens.high >= thresholdTokens
        ? null
        : false;

  return {
    ...base,
    mode: 'threshold',
    mechanism: 'tool search',
    setting,
    thresholdShare,
    thresholdTokens,
    clientTokens,
    ratio,
    distanceTokens: { low: clientTokens.low - thresholdTokens, high: clientTokens.high - thresholdTokens },
    crosses,
    exceptions: EXCEPTIONS,
  };
}
