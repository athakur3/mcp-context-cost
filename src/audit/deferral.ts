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
 *   - The same page, re-read 2026-09-06 (the roadmap's dated re-read). The
 *     value table stands as quoted, and four things moved around it:
 *     (1) on Google Cloud's Agent Platform, tool search is on by default for
 *     the Claude 4.5 generation and later "the same as on the Anthropic API"
 *     — "Before v2.1.221, Claude Code disabled tool search for all models on
 *     Google Cloud's Agent Platform unless you set ENABLE_TOOL_SEARCH=true";
 *     the exception below already names only the earlier models. (2) Under
 *     `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`, "your organization can keep
 *     tool search on through managed settings, on Claude Code v2.1.227 or
 *     later" — on a direct connection or a gateway set with `ANTHROPIC_BASE_URL`,
 *     and with no effect on a cloud provider or a Claude apps gateway sign-in
 *     (`code.claude.com/docs/en/llm-gateway-protocol.md`, read 2026-09-08).
 *     This IS read as of 2026-09-08: `resolveToolSearchSources` looks at the
 *     administrator tier, and where that tier sets `ENABLE_TOOL_SEARCH` to a
 *     value the vendor does not document, the disabling variable stops
 *     deciding and the posture is refused. The value that arms the override is
 *     in no vendor document, so none is named here and nothing is claimed about
 *     what it does. (3) `alwaysLoad: true` is an entry field on
 *     every server type, and a tool can carry `"anthropic/alwaysLoad": true`
 *     in its `_meta`. The entry form is read from the config now
 *     (`DeferralServer.alwaysLoad`) and counted rather than listed; the
 *     per-tool form is still a listed condition. (4) "Claude Code truncates
 *     tool descriptions and server instructions at 2KB each", which bounds what
 *     a deferring session loads at start — noted beside the session-start
 *     metric in METHODOLOGY, not applied to any number here.
 *
 * The other clients this tool discovers split in two, and what separates them
 * is what counts as a record. Until 2026-09-07 the rule read one surface — each
 * client's own MCP configuration page — and reported an absence of a record for
 * every client whose page did not mention deferring. Three of those clients say
 * the opposite elsewhere, on surfaces their own vendors control, the earliest of
 * them dated eight months before that page was read. So the rule now takes four
 * kinds of first-party statement, in METHODOLOGY §who-pays: the configuration
 * page, the vendor's dated blog or changelog, a named staff account on the
 * vendor's own forum, and the client's public source — a merged pull request or
 * a settings default in the shipping tree. None of the four is a measurement.
 *
 *   - `DEFERRAL_ON_RECORD` — Cursor, Codex CLI, VS Code. The vendor states, or
 *     the vendor's source shows, that definitions are deferred. What is printed
 *     is close to Claude Code's honest shape and stops in the same place: the
 *     vendor says so, this audit has not measured it, the conditions it depends
 *     on are listed rather than resolved, and for none of the three does a file
 *     this audit reads state the posture.
 *   - `NO_DEFERRAL_ON_RECORD` — Claude Desktop, Windsurf, Gemini CLI, Zed, Kiro,
 *     Goose. Still an absence of a record and printed as such, and now an
 *     absence that was looked for: the three of them that are open source were
 *     searched for a tool-search or deferral mechanism on 2026-09-07 and none
 *     was found, while Claude Desktop, Windsurf and Kiro are closed and only
 *     their pages have been read.
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
  /** A `managed-settings.d/*.json` drop-in: the managed file's own tier, not a rank below it. */
  | 'managed-drop-in'
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
  /**
   * A client whose vendor states, or whose source shows, that it defers tool
   * definitions — unmeasured here, and not readable from the config either.
   */
  | 'deferral-on-record'
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
 * The host of a base URL, or null if it does not parse.
 *
 * The **host**, which carries the port, and not the hostname, which does not.
 * Claude Code compares the host — `new URL(e).host` against a one-entry list
 * holding `api.anthropic.com`, read from the v2.1.233 bundle on 2026-09-08 —
 * so `https://api.anthropic.com:8443/v1` is not first-party to the client and
 * tool search is off there. Comparing the hostname made it first-party here,
 * and the report then said these tokens are NOT loaded up front at a machine
 * loading every one of them: an error in the understating direction, which is
 * the one this file does not get to make.
 *
 * Both published tables already say host, so the pages were right and this was
 * wrong. `URL` drops a scheme's default port, so `https://api.anthropic.com:443`
 * still reads first-party — the same normalisation the client's own comparison
 * gets, because it is the same parser.
 *
 * The host is the whole of what the mode decision needs, and it is also the
 * whole of what may leave this function: the rest of the value can carry a
 * credential, and a host is a name and a port, never userinfo. A value that
 * does not parse is not first-party, which is the reading that says tokens are
 * paid — never the one that says they are free.
 */
function baseUrlHost(raw: string): string | null {
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * How Claude Code reads `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`: as a boolean
 * flag, not as a marker whose presence alone is the signal.
 *
 * Sources, because this is a claim about someone else's product and it will rot:
 *
 *   - `code.claude.com/docs/en/env-vars.md`, read 2026-09-08. "For variables
 *     that turn a behavior on or off, set `1` or `true` to turn it on and `0`
 *     or `false` to turn it off, in any casing." The same page names the six
 *     variables that instead read any non-empty value —
 *     `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `DISABLE_TELEMETRY`,
 *     `DISABLE_ERROR_REPORTING`, `CLAUDE_CODE_TMUX_TRUECOLOR`,
 *     `FALLBACK_FOR_ALL_PRIMARY_MODELS` and `IS_DEMO` — and this variable is
 *     not one of them.
 *   - The Claude Code v2.1.233 bundle, read 2026-09-08. The variable is
 *     declared boolean and coerced by the helper every boolean flag uses,
 *     whose true set is `1`, `true`, `yes`, `on` and whose false set is `0`,
 *     `false`, `no`, `off`, lower-cased and trimmed. `yes` and `on` are read
 *     here on that evidence alone: no vendor page states them. If the client
 *     ever narrows to the documented pair, this over-reports cost for those
 *     two values — the direction this file is allowed to be wrong in.
 *
 * A value in neither set is read as nothing. The documentation does not cover
 * it, and the bundle leaves tool search ON there — a claim worth more than one
 * build of one product, so it is refused rather than made.
 */
const BETAS_TRUE = new Set(['1', 'true', 'yes', 'on']);
const BETAS_FALSE = new Set(['0', 'false', 'no', 'off']);

function betasReads(raw: string): 'on' | 'off' | 'unrecognized' {
  const value = raw.trim().toLowerCase();
  if (BETAS_TRUE.has(value)) return 'on';
  if (BETAS_FALSE.has(value)) return 'off';
  return 'unrecognized';
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
  // Read first: documented as not overridable by ENABLE_TOOL_SEARCH — but only
  // where it reads as true. A value that reads as false turned nothing off, so
  // it decides nothing and the read moves on. That is what the flag being a
  // boolean means, and reading its presence instead told every machine that set
  // it to `0` that it pays these tokens on every request.
  if (betas) {
    const reads = betasReads(betas);
    if (reads !== 'off') {
      return {
        mode: reads === 'on' ? 'loads-upfront' : 'setting-unrecognized',
        thresholdShare: null,
        variable: 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
        value: betas,
        source: null,
        readFromMachine: true,
      };
    }
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

  // The managed settings file and the `managed-settings.d` drop-ins beside it
  // are ONE tier — the vendor documents them as "merged together" — and it does
  // not say which file inside that tier wins. The precedence walk below answers
  // by array order, which is an answer this has no source for, so a tier that
  // disagrees with itself is refused instead. Between tiers, precedence IS
  // documented, and that walk is left alone.
  const adminTier = sources.filter(
    (s) => s.scope === 'managed-settings' || s.scope === 'managed-drop-in',
  );
  if (adminTier.length > 1) {
    for (const name of TOOL_SEARCH_VARS) {
      const held = adminTier.filter((s) => holds(s, name));
      if (new Set(held.map((s) => (s.vars[name] ?? '').trim())).size > 1) {
        return unresolved('sources-disagree', name);
      }
    }
  }

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
  /**
   * An organisation can keep tool search ON under the very variable that turns
   * it off: "On Claude Code v2.1.227 or later, your organization can keep MCP
   * tool search on under this variable through managed settings"
   * (`code.claude.com/docs/en/llm-gateway-protocol.md`, read 2026-09-08). The
   * client reads that override out of the administrator tier and never out of a
   * shell, which is why this looks only there.
   *
   * The value that arms it is in no vendor document, so this does not name one
   * and does not say what it does. What it can say is that the tier holds a
   * value the vendor does not document — and while that is true, the disabling
   * variable is not the thing deciding, so it is not read. The undocumented
   * value is then refused by the ordinary rule below, which prints the variable,
   * the value the reader wrote, and no claim.
   *
   * Reading the tier and discarding it is what this replaces: the value was
   * already in hand, and the report printed the opposite of what such a machine
   * does. Two of the override's conditions — a cloud provider, or a sign-in
   * through a Claude apps gateway, either of which makes it inert — are not
   * readable here, which is the other reason this refuses rather than claims.
   */
  const overriddenByAdminTier = adminTier.some((s) => {
    const raw = (s.vars.ENABLE_TOOL_SEARCH ?? '').trim();
    return raw !== '' && resolveToolSearch({ ENABLE_TOOL_SEARCH: raw }).mode === 'setting-unrecognized';
  });

  const betas = overriddenByAdminTier ? null : read('CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS');
  if (betas === 'conflict') return unresolved('sources-disagree', 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS');
  if (betas === 'unreadable')
    return unresolved('value-unreadable', 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS');
  // A value that reads as false must not be delegated. `resolveToolSearch` is
  // called here with this variable ALONE, so delegating a value that decided
  // nothing would answer out of an environment where ENABLE_TOOL_SEARCH is
  // unset — turning a machine that had switched deferral off in a settings file
  // into `defers-all`, a false claim in the costlier direction than the one
  // being fixed. It falls through to the ENABLE_TOOL_SEARCH read instead.
  if (betas && betasReads(betas.value) !== 'off') {
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
 * not the same number and the gap is not small; the fields below carry it, and
 * the pages state it from the run rather than from here. Comparing the wire
 * number directly against the threshold understates the deferrable side for
 * schema-heavy servers and overstates it for metadata-heavy ones, in one
 * direction each.
 *
 * The band is **marginal**: it converts a server's own bytes and excludes the
 * tool framework overhead, which `fixedOverhead` carries separately because the
 * API charges it once per request however many servers are attached. Keeping
 * them together was wrong in a way that stayed invisible while the divergence
 * run sampled the heavy end — on a 54,000-token server a fixed 328 is noise. On
 * 2026-09-05 the run widened to every measured server and reached `postgres` at
 * 32 tokens on the wire, where 328 of its 348 Claude tokens *are* the overhead:
 * a per-server ratio of 10.88× that says nothing about converting bytes. Folded
 * into the band it took the published upper bound from 1.92× to 10.88× and made
 * the audit refuse threshold questions it had been answering correctly. Held
 * apart, the band across the same 86 rows is 0.19×–1.93× — which is where it
 * already was, from a sample a quarter the size.
 */
export interface WireToClientRatio {
  low: number;
  high: number;
  /**
   * Tokens the tool framework costs once per request, whatever is attached.
   * Added to a stack a single time; never multiplied by anything.
   */
  fixedOverhead: number;
  /** How many servers the band was measured across, for the printed caveat. */
  servers: number;
  /** The run it came from, so a reader can date it. */
  source: string;
}

/**
 * The band as published in this repository's own `results/divergence.json`.
 * Used when no divergence run was supplied; `--claude` recomputes it from the
 * run it fetched.
 *
 * The model, the date and the count deliberately are not restated here. This
 * docblock said `(claude-opus-5, 2026-08-19, 20 servers)` while the field below
 * read 23 and the run on disk held 24 — prose beside a number, drifting from
 * it, which is the same failure this constant's own guard exists to catch one
 * level down. The fields are the record; `source` dates them.
 */
export const PUBLISHED_WIRE_TO_CLIENT_RATIO: WireToClientRatio = {
  low: 0.19,
  high: 1.93,
  fixedOverhead: 328,
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
  //
  // The widening then moved it by a hair rather than by the fivefold the first
  // reading suggested: 0.20×–1.92× over 23 servers, 0.19×–1.93× over 86. That a
  // quarter of the set predicted the whole of it is the interesting part, and it
  // is only true of the marginal band — see the interface above for what folding
  // the fixed overhead in did to the same numbers.
  servers: 86,
  source: 'the published claude-opus-5 divergence run',
};

/**
 * The decimal places the band is published at.
 *
 * Not a display choice: it is the precision a snapshot of the band has to stay
 * accurate to, because two numbers that round the same way decide the same
 * above/below verdict against a client threshold, and two that do not, do not.
 * The pages print the band to this many places (`published-stats.ts`) and
 * `bandSnapshotProblem` judges a snapshot at the same width, so "still right"
 * means the same thing in both places.
 */
export const BAND_PRECISION = 2;

/**
 * Is a snapshot of the band still an honest description of `derived`? The
 * problem in words, or `null` when the snapshot may lag but does not mislead.
 *
 * Two callers, one rule. The suite asks it of `PUBLISHED_WIRE_TO_CLIENT_RATIO`
 * against the run committed beside it. The release readiness gate asks it of
 * the constant the *last release* shipped against the run on trunk — that band
 * is what an installed package states offline, and nothing except cutting a
 * release can move it, so a release being due is exactly what a finding there
 * means.
 *
 * Deliberately not an equality check, and the first version of this rule was
 * one: it demanded agreement and went red on the next bot commit, which had
 * done nothing but measure a server for the first time. The run grows whenever
 * a sweep reaches a new server, and the bot that commits it cannot edit a
 * TypeScript constant. A snapshot is allowed to lag. It is not allowed to be
 * wrong:
 *
 * - the **band** must still be right to the precision it is published at,
 *   because it decides an above/below verdict against a client threshold;
 * - the **count** must never exceed the run, because a snapshot claiming more
 *   servers than were measured is a fabricated number rather than an old one.
 */
export function bandSnapshotProblem(
  snapshot: Pick<WireToClientRatio, 'low' | 'high' | 'servers'>,
  derived: Pick<WireToClientRatio, 'low' | 'high' | 'servers'>,
): string | null {
  const at = (n: number) => n.toFixed(BAND_PRECISION);
  if (snapshot.servers > derived.servers) {
    return `it is measured across ${snapshot.servers} servers where the run holds ${derived.servers}`;
  }
  if (at(snapshot.low) !== at(derived.low) || at(snapshot.high) !== at(derived.high)) {
    return (
      `it states ${at(snapshot.low)}×–${at(snapshot.high)}× where the run derives ` +
      `${at(derived.low)}×–${at(derived.high)}×`
    );
  }
  return null;
}

/**
 * The passages on the vendor's own pages that this file's model of tool search
 * rests on, and the rule for deciding whether they still say it.
 *
 * What rots here is not the client. It is these pages: the model is a reading
 * of them, they have already moved host once under this project, and the whole
 * of `resolveToolSearch` is downstream of four sentences. So the watch checks
 * the sentences rather than a page hash — a hash of a documentation page is red
 * every week for a typo and teaches everyone to ignore it.
 *
 * `tools/watch-tool-search-docs.ts` is the half that fetches. This half is the
 * rule, offline and under test, the same split as `src/core/protocol.ts` and
 * its spec watch.
 */
export interface ToolSearchDocClaim {
  /** The page it was read from. */
  url: string;
  /** What this file does because of it, so a drift report says what broke. */
  because: string;
  /** Text that must still be on that page. Compared with whitespace collapsed. */
  quote: string;
}

/** When every claim below was last read against the live page. */
export const TOOL_SEARCH_DOC_READ_ON = '2026-09-08';

export const ENV_VARS_DOC = 'https://code.claude.com/docs/en/env-vars.md';
export const GATEWAY_DOC = 'https://code.claude.com/docs/en/llm-gateway-protocol.md';
export const MANAGED_SETTINGS_DOC = 'https://code.claude.com/docs/en/managed-settings.md';

export const TOOL_SEARCH_DOC_CLAIMS: ToolSearchDocClaim[] = [
  {
    url: ENV_VARS_DOC,
    because:
      'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS is read as a boolean rather than as a marker whose presence is the signal',
    quote: 'set `1` or `true` to turn it on and `0` or `false` to turn it off, in any casing',
  },
  {
    url: ENV_VARS_DOC,
    because:
      'the variables that instead read any non-empty value are an enumerated exception, and this one is not among them',
    quote: 'Some variables read only whether you set them at all',
  },
  {
    url: GATEWAY_DOC,
    because:
      'an administrator tier holding an undocumented ENABLE_TOOL_SEARCH value stops the disabling variable deciding',
    quote:
      'your organization can keep [MCP tool search](/docs/en/mcp#scale-with-mcp-tool-search) on under this variable through [managed settings](/docs/en/managed-settings)',
  },
  {
    url: GATEWAY_DOC,
    because:
      'the override is refused rather than answered, because two of its own conditions are not readable from a file',
    quote: 'On a cloud provider, or signed in through a [Claude apps gateway]',
  },
  {
    url: MANAGED_SETTINGS_DOC,
    because:
      'the managed file and its managed-settings.d drop-ins are read as one tier, and the Windows path is not the ProgramData one',
    quote:
      "Claude Code doesn't read the legacy Windows path `C:\\ProgramData\\ClaudeCode\\managed-settings.json`",
  },
];

/**
 * The variables that page names as reading any non-empty value, read on the date
 * above. The one that matters is the one that is NOT here.
 */
export const ANY_NON_EMPTY_VARS = [
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'DISABLE_TELEMETRY',
  'DISABLE_ERROR_REPORTING',
  'CLAUDE_CODE_TMUX_TRUECOLOR',
  'FALLBACK_FOR_ALL_PRIMARY_MODELS',
  'IS_DEMO',
];

/** The intro the exception list hangs off, on the env-vars page. */
const ANY_NON_EMPTY_INTRO = 'Some variables read only whether you set them at all';

/**
 * The variable names in that exception list, or null when the list could not be
 * found in the shape this knows how to read — which is a reason to look, not a
 * reason to report the list unchanged.
 */
export function anyNonEmptyVars(page: string): string[] | null {
  const at = page.indexOf(ANY_NON_EMPTY_INTRO);
  if (at < 0) return null;
  const names: string[] = [];
  for (const line of page.slice(at).split('\n').slice(1)) {
    const bullet = /^\s*[*-]\s+`([A-Z0-9_]+)`\s*$/.exec(line);
    if (bullet) {
      names.push(bullet[1]);
      continue;
    }
    // Blank lines sit between the intro and its list; anything else ends it.
    if (line.trim() !== '') break;
  }
  return names.length > 0 ? names : null;
}

/** A page too short to be the page asked for — an error body, or a redirect stub. */
const SHORTEST_PLAUSIBLE_PAGE = 1_000;

/**
 * What is wrong with the live pages, in words. Empty means the model still has
 * its sources.
 *
 * A page that could not be fetched is reported, never skipped: a watch that is
 * green when it is blind is worse than no watch, which is the rule the spec
 * watch is built on and the same one here.
 */
export function toolSearchDocProblems(pages: Map<string, string | null>): string[] {
  const problems: string[] = [];
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

  for (const url of [...new Set(TOOL_SEARCH_DOC_CLAIMS.map((c) => c.url))]) {
    const page = pages.get(url);
    if (page === undefined || page === null) {
      problems.push(`${url} could not be read, so nothing here was checked against it`);
      continue;
    }
    if (page.length < SHORTEST_PLAUSIBLE_PAGE) {
      problems.push(
        `${url} came back as ${page.length} characters, too short to be that page — read as could not look, not as changed`,
      );
      continue;
    }
    const body = flat(page);
    for (const claim of TOOL_SEARCH_DOC_CLAIMS.filter((c) => c.url === url)) {
      if (!body.includes(flat(claim.quote))) {
        problems.push(
          `${url} no longer says "${claim.quote}" — the page this rests on moved: ${claim.because}`,
        );
      }
    }
    if (url === ENV_VARS_DOC) {
      const listed = anyNonEmptyVars(page);
      if (listed === null) {
        problems.push(
          `${url} still names an any-non-empty exception list, and it is no longer in a shape this can read — check by hand whether CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS has joined it`,
        );
      } else if (listed.includes('CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS')) {
        problems.push(
          `${url} now lists CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS among the variables that read any non-empty value — the boolean reading here is wrong and every value outside 1/true/yes/on is being read as leaving tool search on when it does not`,
        );
      }
    }
  }
  return problems;
}

/** Derive the band from a supplied divergence run, falling back to the published one. */
export function wireToClientRatio(run?: DivergenceRun | null): WireToClientRatio {
  if (!run) return PUBLISHED_WIRE_TO_CLIENT_RATIO;
  // `probeDelta` is the run's own reading of the fixed overhead: one tiny tool
  // attached, minus the same request with none. An upper bound, and the only
  // measurement of it there is. A run that does not carry one converts as it
  // always did rather than guessing at a correction.
  const fixedOverhead = typeof run.probeDelta === 'number' && run.probeDelta > 0 ? run.probeDelta : 0;
  let low = Infinity;
  let high = -Infinity;
  let servers = 0;
  for (const row of Object.values(run.servers)) {
    if (!row || row.error || typeof row.claudeDelta !== 'number' || !(row.o200kFull > 0)) continue;
    const ratio = (row.claudeDelta - fixedOverhead) / row.o200kFull;
    // A server whose entire Claude cost is the overhead says nothing about
    // converting bytes, and a negative ratio is not a conversion at all.
    if (!(ratio > 0)) continue;
    low = Math.min(low, ratio);
    high = Math.max(high, ratio);
    servers++;
  }
  if (servers === 0) return PUBLISHED_WIRE_TO_CLIENT_RATIO;
  return { low, high, fixedOverhead, servers, source: `the ${run.measuredAt} ${run.model} divergence run` };
}

/** One measured server, as the deferral arithmetic needs it. */
export interface DeferralServer {
  /** For naming the servers a verdict singles out; the arithmetic never reads it. */
  name?: string;
  /** o200k tokens over the wire capture — the audit's own unit. */
  tokens: number;
  /**
   * The entry is pinned `alwaysLoad: true`, so its tools load at session start
   * whatever the tool-search setting says, and it does not count toward a
   * threshold — the documented `auto` mode counts "the tools it would
   * otherwise defer".
   */
  alwaysLoad?: boolean;
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
  /**
   * What the client's vendor is on record as doing, where that is not Claude
   * Code and a record exists. Null in every other mode, including the absence
   * of a record, which is a different fact and is printed as one.
   */
  record: DeferralRecord | null;
  /**
   * Servers in this scope pinned `alwaysLoad: true` in their entry, and their
   * wire tokens. Read from the config, so it is stated rather than listed as a
   * condition: whatever the mode, these load at session start.
   */
  alwaysLoad: { servers: string[]; tokens: number };
}

/**
 * What a vendor is on record as doing, for a client this audit cannot measure.
 *
 * Every line here is printed, so every line is written to be checked: the claim
 * is the vendor's, the conditions are the ones the vendor's own record leaves
 * open, and the sources carry the address and the date they were read at. What
 * this type deliberately cannot express is a verdict. A record establishes what
 * a vendor says or ships; nothing in it says what a session paid.
 */
export interface DeferralRecord {
  /** The vendor's own name for the mechanism, so a reader can look it up. */
  mechanism: string;
  /** What the record establishes. Lines, wrapped for the report. */
  states: string[];
  /** Why the posture still cannot be read off the audited machine. */
  notReadable: string[];
  /** What the record leaves open — printed as conditions, never resolved. */
  conditions: string[];
  /** First-party sources, each with the date it was read. */
  sources: string[];
}

/**
 * Clients whose vendor is on record as deferring tool definitions.
 *
 * These three were printed as "no default deferral on record" until 2026-09-07,
 * because the rule read each client's MCP configuration page and nothing else,
 * and all three pages are silent. Silence on one page is not a denial: the
 * vendors say it in a blog post, in staff replies on their own forum, and in
 * merged pull requests and settings defaults in their own source. The rule that
 * admits those is in METHODOLOGY §who-pays.
 *
 * None of this is a measurement, and the report says so in as many words. It
 * also refuses the other tempting shortcut — reporting these stacks as deferred
 * and therefore free — because what a session actually pays depends on
 * conditions no config file on the audited machine states.
 */
const DEFERRAL_ON_RECORD = new Map<string, DeferralRecord>([
  [
    'cursor',
    {
      mechanism: 'dynamic context discovery',
      states: [
        'cursor is on record as deferring MCP tool definitions (dynamic context',
        'discovery): the agent gets tool names, and a tool\'s description and input',
        'schema load when it reaches for one. Cursor states it does not put every',
        'attached tool\'s schema in every request.',
      ],
      notReadable: [
        'No Cursor setting on record turns this on or off, and the MCP configuration',
        'page does not mention the mechanism at all — so no Cursor config file states',
        'a posture, and this audit has not measured one.',
      ],
      conditions: [
        'definitions and tool results pulled in during a session stay in that session\'s history, so a deferring session is not a free one (Cursor staff, same post)',
        "the vendor's own figure — 46.9% fewer total agent tokens — is an A/B result over runs that called an MCP tool, not a saving for this stack",
        "Cursor's context tray is not a check on the number above either: staff describe its count as a calibrated estimate rather than a tokenizer count (forum.cursor.com/t/168744 post 5, 2026-08-20)",
      ],
      sources: [
        'cursor.com/blog/dynamic-context-discovery, dated 2026-01-06, read 2026-09-07 — Cursor syncs MCP tool descriptions to a folder and sends the agent the names',
        'forum.cursor.com/t/166405 post 5, a staff account, 2026-07-22, read 2026-09-07 — current Cursor uses dynamic context discovery for MCP',
        'cursor.com/docs/context/mcp, read 2026-09-07 — silent on the mechanism, and offers no setting for it',
      ],
    },
  ],
  [
    'codex',
    {
      mechanism: 'tool search',
      states: [
        'codex is on record as deferring MCP tool definitions (tool search): its',
        'source defers every effective MCP tool behind a tool-search tool when the',
        'model supports that tool and the provider supports namespaced tools, and',
        'exposes them directly when either does not — which is the full total.',
      ],
      notReadable: [
        'config.toml carries no switch for it. The two feature keys that once forced',
        'the behaviour are marked removed and skipped when the features table is',
        'applied, though both still appear in the published config schema.',
      ],
      conditions: [
        'the model must support the search tool and the provider must support namespaced tools — both are read from the running session, not from config.toml, and this audit reads neither',
        'an older or unsupported model/provider combination is served the definitions directly, and pays the total above in full',
        'the deferral reached a stable release at rust-v0.142.2; a machine pinned below that tag is on the older rule, where tool search applied only above 100 tools or behind a feature flag',
      ],
      sources: [
        'github.com/openai/codex/pull/29486, merged 2026-06-22, read 2026-09-07 — defer all effective MCP tools when tool search and namespaced tools are supported, and treat the old feature keys as removed',
        'openai/codex tag rust-v0.142.2, published 2026-06-25, read 2026-09-07 — the first stable release carrying it',
        'codex-rs/core/src/tools/spec_plan.rs at main, read 2026-09-07 — the condition is the model\'s support for the search tool AND the provider\'s for namespaced tools',
        'codex-rs/features/src/lib.rs at main, read 2026-09-07 — tool_search and tool_search_always_defer_mcp_tools are Stage::Removed, and the config table skips them',
      ],
    },
  ],
  [
    'vscode',
    {
      mechanism: 'virtual tools, and the agent host\'s tool search',
      states: [
        'vscode ships two mechanisms that can defer tool definitions, and this is a',
        'record of them rather than a verdict about your session. It documents a hard',
        'cap of 128 tools per chat request, and virtual tools — grouped sets the model',
        'activates on demand — above a threshold that defaults to 128. Separately its',
        'agent host defers MCP and non-core tools behind a tool-search tool, on by',
        'default in source.',
      ],
      notReadable: [
        'Both switches live in VS Code\'s own settings, not in the .vscode/mcp.json',
        'this audit reads, and neither is in the published settings documentation.',
        'So no file read here states a posture, and none of it has been measured.',
      ],
      conditions: [
        'virtual tools group only above the threshold: at or below 128 tools nothing documented defers, and the cap itself is an error rather than a saving',
        "the agent host's tool search is gated on the model — the GPT-5.4, 5.5 and 5.6 families, and Claude 4.5 or later",
        'which VS Code release runs Copilot sessions on that agent host by default is not established here, so whether the source default reaches a given install is unknown',
      ],
      sources: [
        'code.visualstudio.com agent tools documentation, read 2026-09-07 — 128 tools per request, and github.copilot.chat.virtualTools.threshold, an experimental setting defaulting to 128',
        'microsoft/vscode src/vs/platform/agentHost/common/copilotCliConfig.ts at main, read 2026-09-07 — chat.agentHost.copilot.toolSearch.enabled defaults true, its deferThreshold to 1',
        'microsoft/vscode src/vs/platform/agentHost/node/copilot/toolSearchDeferral.ts at main, read 2026-09-07 — the model allowlist',
        'github.com/microsoft/vscode/pull/326213, merged 2026-07-23, read 2026-09-07 — the change that added it',
      ],
    },
  ],
]);

/**
 * Clients this tool discovers with no default deferral on record.
 *
 * Each client's own MCP configuration page was read on the date config.ts gives
 * and says nothing about deferring tool definitions — Windsurf's states a cap
 * of 100 tools, which is a different thing and not a deferral. Since 2026-09-07
 * the record is wider than that page (see `DEFERRAL_ON_RECORD`), so this is an
 * absence that was searched for and not only an absence on one page: Gemini
 * CLI, Zed and Goose are open source and were searched that day for a
 * tool-search or deferral mechanism, with nothing found. Claude Desktop,
 * Windsurf and Kiro are closed, and only their pages have been read.
 */
const NO_DEFERRAL_ON_RECORD = new Set([
  'claude-desktop',
  'windsurf',
  'gemini',
  'zed',
  'kiro',
  'goose',
]);

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
  'a tool whose _meta carries "anthropic/alwaysLoad": true, which this audit does not read from a capture',
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
  // Once per request, not once per server — the band is marginal precisely so
  // that this is added here and exactly one time. A published Anthropic count
  // already carries a copy of it, which is why a stack holding one is left
  // alone: adding another would be the same double count in the other
  // direction.
  if (exact === 0 && estimated > 0) {
    low += ratio.fixedOverhead;
    high += ratio.fixedOverhead;
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
  const pinned = scope.servers.filter((s) => s.alwaysLoad === true);
  const alwaysLoad = {
    servers: pinned.map((s) => s.name ?? '(unnamed)'),
    tokens: pinned.reduce((a, s) => a + s.tokens, 0),
  };

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
    record: null,
    alwaysLoad,
  };

  if (scope.client !== 'claude-code') {
    const record = DEFERRAL_ON_RECORD.get(scope.client);
    // Three answers, not two. A vendor's record is not a measurement, so it
    // does not become a posture — it becomes a printed record with the
    // conditions it leaves open, and `crosses` stays null as it does for the
    // clients nothing is on record about.
    if (record) return { ...base, mode: 'deferral-on-record', mechanism: record.mechanism, record };
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
  // Only what the client would otherwise defer is held against the threshold;
  // a pinned server loads either way and is not part of the question.
  const clientTokens = estimate(
    scope.servers.filter((s) => s.alwaysLoad !== true),
    ratio,
  );

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
