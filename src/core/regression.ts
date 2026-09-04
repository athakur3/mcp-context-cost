/**
 * Cost regressions — what the published set did between one measurement and
 * the next, and which half of the server moved.
 *
 * The leaderboard answers "what does this server cost today". The history
 * answers a question nobody else in the ecosystem can: *what did it cost last
 * month*. Most entries in `servers.yaml` launch unpinned (`npx -y <pkg>`), so
 * each sweep measures whatever `latest` resolved to that day — which makes a
 * change between two comparable measurements a real upstream release landing in
 * real users' context windows, silently, since no client shows the number and
 * most maintainers never measure it.
 *
 * Two rules keep a delta honest, and both are inherited rather than invented:
 *
 * 1. **Comparability is the sparkline's rule.** Two numbers taken under
 *    different isolation are not comparable (different node, different
 *    resolution of `@latest`, different ambient environment), so a step across
 *    that boundary is a property of the harness — `plottableSeries` already
 *    refuses to draw it, and this module compares only within the run it keeps.
 *    A measurement that failed contributes no row at all, so a server that
 *    stopped starting reads as a gap in the series, never as a drop to zero.
 *
 * 2. **Attribution is only claimed where two captures exist.** A change's
 *    per-tool breakdown needs both sides' tool vectors; `results/<server>/`
 *    keeps only the newest `measurement.json`, so for any change older than the
 *    vector file it is genuinely unavailable — reported as unavailable, in
 *    those words, rather than approximated from the totals. What the totals do
 *    support on their own is the *mechanism*: whether the server grew by
 *    shipping more tools or by making the tools it already had heavier.
 *
 * Versioned independently of the o200k methodology, like every reading before
 * it: no `totalTokens` and no canonical hash moves.
 */
import type { Measurement } from './types.js';

/**
 * The history fields a diff needs. Declared structurally rather than imported
 * from `src/sweep/history.ts`: `core` is the offline spec and never reaches
 * into the sweep, and a `HistoryRow` satisfies this shape as it stands.
 */
export interface DatedMeasurement {
  date: string;
  tokens: number;
  toolCount: number;
  status: string;
}

/** Method identifier, versioned independently of METHODOLOGY_VERSION. */
export const REGRESSION_METHOD = 'cost-regression/v1';

/**
 * A movement is called out only when it is both relatively and absolutely
 * meaningful. Relative alone would headline a 19% move worth 113 tokens on a
 * cheap server; absolute alone would headline 200 tokens of drift on a 54,000
 * token server as though something had happened. Everything comparable is
 * still listed — the thresholds decide emphasis, not inclusion, which is the
 * same rule the leaderboard applies to failures.
 */
export const SIGNIFICANT_PCT = 5;
export const SIGNIFICANT_TOKENS = 25;

/** One tool's contribution, as captured on a given day. */
export interface ToolVector {
  name: string;
  tokens: number;
}

export interface ToolVectorEntry {
  /** UTC day of the measurement this vector came from. */
  date: string;
  /** The capture it was taken from — the join key everything else uses. */
  canonicalSha256: string;
  totalTokens: number;
  tools: ToolVector[];
}

export interface ToolVectorFile {
  method: string;
  server: string;
  /**
   * Oldest first, deduped by capture: an entry is appended only when the
   * canonical hash differs from the newest one already stored, so a server
   * that has not changed adds nothing on every re-sweep.
   */
  entries: ToolVectorEntry[];
}

/**
 * How many captures to keep per server. Deduped by hash, a server contributes
 * an entry only when it actually changes, so this is many months of real
 * movement. Dropping the oldest means attribution for changes that old becomes
 * unavailable — which the report says, rather than implying nothing happened.
 */
export const MAX_VECTOR_ENTRIES = 12;

export function parseToolVectorFile(text: string): ToolVectorFile | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const f = parsed as Partial<ToolVectorFile>;
  if (!f || typeof f.server !== 'string' || !Array.isArray(f.entries)) return null;
  const entries: ToolVectorEntry[] = [];
  for (const e of f.entries) {
    if (!e || typeof e.date !== 'string' || typeof e.canonicalSha256 !== 'string') continue;
    if (typeof e.totalTokens !== 'number' || !Array.isArray(e.tools)) continue;
    entries.push({
      date: e.date,
      canonicalSha256: e.canonicalSha256,
      totalTokens: e.totalTokens,
      tools: e.tools
        .filter((t): t is ToolVector => !!t && typeof t.name === 'string' && typeof t.tokens === 'number')
        .map((t) => ({ name: t.name, tokens: t.tokens })),
    });
  }
  return { method: typeof f.method === 'string' ? f.method : REGRESSION_METHOD, server: f.server, entries };
}

/**
 * The vector form of a measurement, or null when it did not produce one. The
 * single place a `Measurement` becomes comparable per-tool, so the sweep's
 * accrual and the author-side gate read the same fields the same way.
 */
export function vectorEntryOf(m: Measurement): ToolVectorEntry | null {
  if (m.status !== 'measured' && m.status !== 'dynamic') return null;
  if (typeof m.totalTokens !== 'number' || !m.canonicalSha256 || !Array.isArray(m.tools)) return null;
  const date = String(m.measuredAt ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    date,
    canonicalSha256: m.canonicalSha256,
    totalTokens: m.totalTokens,
    tools: m.tools.map((t) => ({ name: t.name, tokens: t.tokens })),
  };
}

/** Append a capture, unless the newest stored entry is already that capture. */
export function appendVector(file: ToolVectorFile, entry: ToolVectorEntry): ToolVectorFile {
  const last = file.entries[file.entries.length - 1];
  if (last && last.canonicalSha256 === entry.canonicalSha256) {
    // Same bytes, possibly a later date: keep the *first* date this capture was
    // seen, which is when the server actually changed to it.
    return file;
  }
  const entries = [...file.entries, entry];
  return { ...file, entries: entries.slice(-MAX_VECTOR_ENTRIES) };
}

/**
 * Which half of the server moved, derived from the totals alone — no capture
 * needed, so it is available for every comparable pair including historical
 * ones.
 */
export type Mechanism = 'tools-added' | 'tools-removed' | 'definitions-changed' | 'mixed';

export function mechanismOf(deltaTokens: number, deltaTools: number): Mechanism {
  if (deltaTools === 0) return 'definitions-changed';
  if (deltaTools > 0 && deltaTokens > 0) return 'tools-added';
  if (deltaTools < 0 && deltaTokens < 0) return 'tools-removed';
  // Tool count and cost moved in opposite directions: something was both added
  // and rewritten, and the totals cannot separate the two.
  return 'mixed';
}

export interface ToolAttribution {
  added: ToolVector[];
  removed: ToolVector[];
  grew: { name: string; from: number; to: number; delta: number }[];
  shrank: { name: string; from: number; to: number; delta: number }[];
  /**
   * Total delta minus the sum of the per-tool deltas above. Rarely zero: the
   * headline counts the canonical JSON of the whole array, whose framing bytes
   * and token boundaries belong to no single tool. Published rather than
   * hidden, so the parts visibly do not have to sum to the whole.
   */
  unexplainedTokens: number;
}

/**
 * Per-tool attribution, or null when the names cannot carry it.
 *
 * The breakdown matches tools by name, so a name that appears twice on either
 * side makes the maps below lose one of them silently — and the lost tokens
 * resurface as `unexplainedTokens`, which the report explains to the reader as
 * canonical-array framing bytes. That is a confident false explanation. Two
 * ways it happens: a server that ships duplicate or namespaced-collapsed tool
 * names, and `measureTools` recording every nameless tool as the single key
 * `(unnamed)` — an invented name, where `toolNames` and `toAnthropicTools`
 * deliberately drop nameless tools rather than invent one. Where the names
 * cannot identify the tools, there is no attribution to give.
 */
export function attribute(from: ToolVectorEntry, to: ToolVectorEntry, deltaTokens: number): ToolAttribution | null {
  const unique = (ts: ToolVector[]) => new Set(ts.map((t) => t.name)).size === ts.length;
  if (!unique(from.tools) || !unique(to.tools)) return null;
  const before = new Map(from.tools.map((t) => [t.name, t.tokens]));
  const after = new Map(to.tools.map((t) => [t.name, t.tokens]));
  const added: ToolVector[] = [];
  const removed: ToolVector[] = [];
  const grew: ToolAttribution['grew'] = [];
  const shrank: ToolAttribution['shrank'] = [];
  let accounted = 0;

  for (const [name, tokens] of after) {
    const prev = before.get(name);
    if (prev === undefined) {
      added.push({ name, tokens });
      accounted += tokens;
    } else if (tokens !== prev) {
      const entry = { name, from: prev, to: tokens, delta: tokens - prev };
      (tokens > prev ? grew : shrank).push(entry);
      accounted += entry.delta;
    }
  }
  for (const [name, tokens] of before) {
    if (!after.has(name)) {
      removed.push({ name, tokens });
      accounted -= tokens;
    }
  }
  added.sort((a, b) => b.tokens - a.tokens);
  removed.sort((a, b) => b.tokens - a.tokens);
  grew.sort((a, b) => b.delta - a.delta);
  shrank.sort((a, b) => a.delta - b.delta);
  return { added, removed, grew, shrank, unexplainedTokens: deltaTokens - accounted };
}

export interface CostChange {
  server: string;
  fromDate: string;
  toDate: string;
  fromTokens: number;
  toTokens: number;
  deltaTokens: number;
  /** Signed, in percent of the earlier measurement. */
  deltaPct: number;
  fromToolCount: number;
  toToolCount: number;
  deltaTools: number;
  mechanism: Mechanism;
  /** True when the movement clears both thresholds. */
  significant: boolean;
  /**
   * The newest measurement on record. Later than `toDate` when the server has
   * held its new cost across subsequent sweeps — the movement is real and
   * dated, and so is the fact that it has not moved since.
   */
  measuredThrough: string;
  /** Per-tool breakdown, or null when the two captures are not both on record. */
  attribution: ToolAttribution | null;
}

export function isSignificant(deltaTokens: number, deltaPct: number): boolean {
  return Math.abs(deltaPct) >= SIGNIFICANT_PCT && Math.abs(deltaTokens) >= SIGNIFICANT_TOKENS;
}

/**
 * The most recent comparable *movement* for one server, or null when there
 * isn't one: fewer than two comparable measurements, or a series that has never
 * changed.
 *
 * Deliberately not "the newest pair". A server that grew 82% one week and held
 * that cost since has a newest pair of zero, and reporting only that would hide
 * the largest movement in the set behind a week of stability. So the walk goes
 * back through the trailing run of identical measurements to the change that
 * produced the current cost, and the window it reports is when that change
 * actually happened — `2026-08-19 → 2026-08-26`, not a span up to today.
 * `measuredThrough` then carries how long the new cost has held.
 *
 * `rows` is that server's history, already narrowed to the run a trend may be
 * drawn across (`plottableSeries`), so the isolation rule is applied once, in
 * the place that owns it.
 */
export function latestChange(
  server: string,
  rows: DatedMeasurement[],
  vectors?: ToolVectorFile | null,
): CostChange | null {
  const usable = rows.filter((r) => r.status === 'measured' || r.status === 'dynamic');
  if (usable.length < 2) return null;
  const newest = usable[usable.length - 1]!;
  // Walk back over measurements identical to the newest: the first of that run
  // is when the current cost arrived.
  let toIdx = usable.length - 1;
  while (toIdx > 0) {
    const prev = usable[toIdx - 1]!;
    if (prev.tokens !== newest.tokens || prev.toolCount !== newest.toolCount) break;
    toIdx--;
  }
  if (toIdx === 0) return null; // the series has never changed
  const to = usable[toIdx]!;
  const from = usable[toIdx - 1]!;
  const deltaTokens = to.tokens - from.tokens;
  const deltaTools = to.toolCount - from.toolCount;
  if (deltaTokens === 0 && deltaTools === 0) return null;
  const deltaPct = from.tokens > 0 ? (deltaTokens / from.tokens) * 100 : 0;

  // Attribution needs both sides on record. Matched by *cost as of that date*,
  // not by date equality: vectors are deduped by capture and keep the first
  // date a capture was seen, while `from` is the last row of the previous
  // plateau — so the two dates coincide only when the previous cost was
  // measured exactly once. With weekly sweeps and less frequent releases they
  // almost never do, and a date-equality join therefore reported "only one of
  // the two captures is on record" while holding both. The vector in force on a
  // given day is the newest one recorded on or before it.
  let attribution: ToolAttribution | null = null;
  const inForceOn = (date: string, tokensThatDay: number): ToolVectorEntry | undefined => {
    const upto = (vectors?.entries ?? []).filter((e) => e.date <= date);
    // A same-day re-sweep replaces that day's history row but *appends* a
    // capture, so one date can carry two. Only one of them is the one the row
    // describes: prefer the capture whose total is the number history recorded.
    const agreeing = upto.filter((e) => e.totalTokens === tokensThatDay);
    const pool = agreeing.length > 0 ? agreeing : upto;
    return pool.reduce<ToolVectorEntry | undefined>((best, e) => (!best || e.date >= best.date ? e : best), undefined);
  };
  const fromVec = inForceOn(from.date, from.tokens);
  const toVec = inForceOn(to.date, to.tokens);
  // A vector only explains the row it agrees with. If the totals disagree the
  // file does not cover this change — say so rather than attributing a delta
  // to the wrong capture and publishing the mismatch as framing bytes.
  if (
    fromVec &&
    toVec &&
    fromVec.canonicalSha256 !== toVec.canonicalSha256 &&
    fromVec.totalTokens === from.tokens &&
    toVec.totalTokens === to.tokens
  ) {
    attribution = attribute(fromVec, toVec, deltaTokens);
  }

  return {
    server,
    fromDate: from.date,
    toDate: to.date,
    fromTokens: from.tokens,
    toTokens: to.tokens,
    deltaTokens,
    deltaPct,
    fromToolCount: from.toolCount,
    toToolCount: to.toolCount,
    deltaTools,
    mechanism: mechanismOf(deltaTokens, deltaTools),
    significant: isSignificant(deltaTokens, deltaPct),
    measuredThrough: newest.date,
    attribution,
  };
}

export interface RegressionSummary {
  changes: CostChange[];
  grew: number;
  shrank: number;
  significant: number;
  /** Net tokens the measured set gained (or lost) across every listed movement. */
  netTokens: number;
  /** Servers with a measurement but no second comparable one to diff against. */
  withoutComparison: number;
}

export function summarize(changes: CostChange[], withoutComparison: number): RegressionSummary {
  const sorted = [...changes].sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  return {
    changes: sorted,
    grew: sorted.filter((c) => c.deltaTokens > 0).length,
    shrank: sorted.filter((c) => c.deltaTokens < 0).length,
    significant: sorted.filter((c) => c.significant).length,
    netTokens: sorted.reduce((a, c) => a + c.deltaTokens, 0),
    withoutComparison,
  };
}
