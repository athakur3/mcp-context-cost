/**
 * Whether the client reading this config loads tool schemas up front — or defers
 * them until the model reaches for one.
 *
 * The headline audit number is what a session pays to put every tool definition
 * in the context window. Whether it pays that is now a property of the client,
 * not of the servers: Anthropic's tool search withholds tool definitions from
 * the context window entirely, and under its `auto` setting it decides by
 * counting the deferrable definition tokens against the model's context window
 * and activating at 10% of it.
 *
 * Which makes the number the audit already computes the *input to that
 * decision* rather than the answer to it — and the decision depends on the
 * config on the machine being audited, which is the one thing a scraped
 * leaderboard cannot know. So the audit states three things per config: whether
 * that client defers by default, where the threshold sits for this context
 * window, and how far this stack is from it.
 *
 * Sources, and their dates, because these are claims about someone else's
 * product and they will rot:
 *
 *   - Claude Code tool-search documentation, read 2026-08-20: "Tool search is on
 *     by default"; "tool definitions are withheld from the context window"; under
 *     `auto` the SDK "counts the tokens in the tool definitions that tool search
 *     can defer and compares the total against the model's context window",
 *     activating at 10%. It covers MCP-registered tools that are not pinned to
 *     always load, and does not apply behind a non-first-party
 *     `ANTHROPIC_BASE_URL`, on Azure Foundry deployments, on pre-4.5 models, or
 *     with betas disabled.
 *
 * No default deferral is on record here for the other four clients this tool
 * discovers. That is an absence of a record, not a measurement of those clients,
 * and it is printed as such — the same rule the rest of this project follows for
 * a value it has not observed.
 */

/** Share of the model's context window at which tool search activates under `auto`. */
export const TOOL_SEARCH_THRESHOLD_SHARE = 0.1;

export type DeferralPosture =
  /** This client withholds tool definitions by default, above a threshold. */
  | 'defers-by-default'
  /** A client we know about, with no default deferral on record. */
  | 'no-deferral-on-record'
  /** `--config <path>`: the file was read, but which client reads it is unknown. */
  | 'client-unknown';

interface ClientDeferral {
  posture: DeferralPosture;
  /** What the client calls the mechanism, for a reader who wants to look it up. */
  mechanism?: string;
  /** Fraction of the context window at which it activates. */
  thresholdShare?: number;
  /** Where the deferral does not apply, so the full number is paid after all. */
  exceptions?: string[];
}

const CLIENTS: Record<string, ClientDeferral> = {
  'claude-code': {
    posture: 'defers-by-default',
    mechanism: 'tool search',
    thresholdShare: TOOL_SEARCH_THRESHOLD_SHARE,
    exceptions: [
      'a non-first-party ANTHROPIC_BASE_URL',
      'Azure Foundry deployments',
      'models before 4.5',
      'betas disabled',
      'servers pinned to always load',
    ],
  },
  'claude-desktop': { posture: 'no-deferral-on-record' },
  cursor: { posture: 'no-deferral-on-record' },
  vscode: { posture: 'no-deferral-on-record' },
  windsurf: { posture: 'no-deferral-on-record' },
  explicit: { posture: 'client-unknown' },
};

export interface DeferralVerdict {
  client: string;
  posture: DeferralPosture;
  /** Named only when the client defers; null otherwise. */
  mechanism: string | null;
  /** Tokens at which deferral activates for this context window; null when there is no rule. */
  thresholdTokens: number | null;
  /** What this config puts on the deferrable side of that comparison. */
  deferrableTokens: number;
  /**
   * True when `deferrableTokens` is a lower bound rather than a count — some
   * server in this config could not be measured, and a session would still load
   * whatever it serves. A floor, on the same rule the leaderboard's
   * session-start column follows: absent is unknown, never zero.
   */
  deferrableIsFloor: boolean;
  /** deferrableTokens − thresholdTokens; positive is over. null when there is no rule. */
  distanceTokens: number | null;
  /**
   * true = activates, false = does not, null = cannot be said. Null happens two
   * ways: the client has no threshold rule at all, or the measured total sits
   * under the threshold while unmeasured servers could still carry it over.
   */
  crosses: boolean | null;
  /** Conditions under which a deferring client pays the full number anyway. */
  exceptions: string[];
}

/**
 * The part of a config result this reads. Stated structurally rather than
 * imported, so the verdict can be attached to the result that carries it
 * without the two modules depending on each other.
 */
export interface DeferralSubject {
  client: string;
  totalTokens: number;
  /** Entries that were discovered but produced no number. */
  skipped: unknown[];
}

/**
 * Read one config's deferral position. Pure arithmetic over a built config
 * result — no config file is re-read and no server is launched.
 */
export function evaluateDeferral(cfg: DeferralSubject, contextWindow: number): DeferralVerdict {
  const client = CLIENTS[cfg.client] ?? { posture: 'client-unknown' as const };
  // A server that could not be measured still ships tools to a real session, so
  // its absence lowers this total below the truth rather than not affecting it.
  const deferrableIsFloor = cfg.skipped.length > 0;
  const deferrableTokens = cfg.totalTokens;

  const base = {
    client: cfg.client,
    posture: client.posture,
    mechanism: client.mechanism ?? null,
    deferrableTokens,
    deferrableIsFloor,
    exceptions: client.exceptions ?? [],
  };

  if (client.posture !== 'defers-by-default' || !client.thresholdShare) {
    return { ...base, thresholdTokens: null, distanceTokens: null, crosses: null };
  }

  const thresholdTokens = Math.round(contextWindow * client.thresholdShare);
  const distanceTokens = deferrableTokens - thresholdTokens;
  // At-or-above, on the documented "activates at 10%".
  const overOnWhatWasMeasured = deferrableTokens >= thresholdTokens;
  // A floor that is already over cannot be argued back under; a floor that is
  // under has not answered the question, and says so rather than saying "no".
  const crosses = overOnWhatWasMeasured ? true : deferrableIsFloor ? null : false;

  return { ...base, thresholdTokens, distanceTokens, crosses };
}
