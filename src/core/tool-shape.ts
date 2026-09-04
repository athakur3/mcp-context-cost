/**
 * Tool shape — where a tool's tokens actually are, and when that is worth
 * saying anything about.
 *
 * Every published measurement already splits each tool into whole /
 * description / input-schema token counts. This module turns the measured
 * set's split into a baseline — a quantile table over every measured tool —
 * so that `audit --suggest` can say something no lone number can: whether a
 * tool's description is *unusually* heavy, against the population of tools
 * people actually ship, and roughly what trimming it toward normal would
 * recover.
 *
 * Two disciplines, both this project's usual ones. Advice is only ever about
 * descriptions: a schema is functional surface and trimming it changes what
 * the tool can do, while a description is prose about the tool and trimming
 * it changes only how much every request pays to carry it. And advice is only
 * given where the data can point at something: a tool inside the measured
 * distribution gets silence, said in those words, not a suggestion invented
 * to have one. The threshold is a named constant, the baseline is a dated,
 * re-derivable artifact regenerated from the same published measurements as
 * everything else, and the recovery figure is marked approximate because
 * token boundaries make component counts sum only approximately.
 *
 * Versioned independently of the o200k methodology, like every column before
 * it: `tool-shape/v1` adds an advisory reading and moves no `totalTokens` and
 * no canonical hash.
 */
import type { ToolMeasurement } from './types.js';

/** Method identifier, versioned independently of METHODOLOGY_VERSION. */
export const TOOL_SHAPE_METHOD = 'tool-shape/v1';

/**
 * A description earns a suggestion only at or above this percentile of the
 * measured distribution. 90 keeps advice rare and confident: nine of ten
 * measured tools are "normal" by construction, and the advice names the exact
 * percentile it fired at rather than hiding behind the threshold.
 */
export const SUGGEST_DESCRIPTION_PERCENTILE = 90;

export interface ToolShapeBaseline {
  method: string;
  methodologyVersion: string;
  /** UTC day the baseline was derived (YYYY-MM-DD). */
  generatedAt: string;
  /** How many measured servers and tools the quantiles were derived from. */
  serverCount: number;
  toolCount: number;
  /**
   * Nearest-rank quantile tables, 101 values each (q[0] = min … q[100] = max),
   * in o200k tokens. Published whole so a reader can re-derive any percentile
   * claim from the same table the tool used.
   */
  quantiles: {
    tokens: number[];
    descriptionTokens: number[];
    inputSchemaTokens: number[];
  };
}

/** Nearest-rank quantile table over `values` — same rank rule as the badge-band percentiles. */
export function quantileTable(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q: number[] = [];
  for (let p = 0; p <= 100; p++) {
    q.push(p === 0 ? sorted[0] : sorted[Math.min(n - 1, Math.max(0, Math.ceil((p / 100) * n) - 1))]);
  }
  return q;
}

/**
 * The largest percentile whose quantile does not exceed `value` — read
 * directly off the published table, so "heavier than P% of measured tools" is
 * checkable by anyone holding the same JSON.
 */
export function percentileOf(quantiles: number[], value: number): number {
  // The LOWEST percentile whose quantile the value reaches, not the highest.
  // Taking the highest reports a value tied with half the measured set as p100
  // — "heavier than 100% of measured tools" about something exactly average for
  // its tie — because every percentile across the tie carries the same
  // quantile. The lowest names where the tie begins, which is what "heavier
  // than P% of tools" means.
  let p = 0;
  for (let i = 0; i <= 100; i++) {
    if (quantiles[i] <= value) {
      if (quantiles[i] < value || i === 0 || quantiles[i - 1] < quantiles[i]) p = i;
    } else break;
  }
  return p;
}

/** A tool whose measurement carries all three counts — the only kind a baseline may be built from. */
function complete(t: ToolMeasurement): boolean {
  return (
    typeof t.tokens === 'number' && typeof t.descriptionTokens === 'number' && typeof t.inputSchemaTokens === 'number'
  );
}

export function buildToolShapeBaseline(
  tools: ToolMeasurement[],
  meta: { serverCount: number; generatedAt?: string; methodologyVersion: string },
): ToolShapeBaseline {
  const usable = tools.filter(complete);
  if (usable.length < 2) throw new Error('fewer than two complete tool measurements — no distribution to derive');
  return {
    method: TOOL_SHAPE_METHOD,
    methodologyVersion: meta.methodologyVersion,
    generatedAt: meta.generatedAt ?? new Date().toISOString().slice(0, 10),
    serverCount: meta.serverCount,
    toolCount: usable.length,
    quantiles: {
      tokens: quantileTable(usable.map((t) => t.tokens)),
      descriptionTokens: quantileTable(usable.map((t) => t.descriptionTokens)),
      inputSchemaTokens: quantileTable(usable.map((t) => t.inputSchemaTokens)),
    },
  };
}

export function parseToolShapeBaseline(text: string): ToolShapeBaseline | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const b = parsed as Partial<ToolShapeBaseline>;
  if (!b || typeof b.generatedAt !== 'string' || typeof b.toolCount !== 'number') return null;
  const q = b.quantiles;
  const table = (v: unknown): v is number[] => Array.isArray(v) && v.length === 101 && v.every((x) => typeof x === 'number');
  if (!q || !table(q.tokens) || !table(q.descriptionTokens) || !table(q.inputSchemaTokens)) return null;
  return {
    method: typeof b.method === 'string' ? b.method : TOOL_SHAPE_METHOD,
    methodologyVersion: typeof b.methodologyVersion === 'string' ? b.methodologyVersion : 'unknown',
    generatedAt: b.generatedAt,
    serverCount: typeof b.serverCount === 'number' ? b.serverCount : 0,
    toolCount: b.toolCount,
    quantiles: { tokens: q.tokens, descriptionTokens: q.descriptionTokens, inputSchemaTokens: q.inputSchemaTokens },
  };
}

export interface ToolSuggestion {
  server: string;
  tool: string;
  tokens: number;
  descriptionTokens: number;
  inputSchemaTokens: number;
  /** Where this description sits in the measured distribution (0–100). */
  descriptionPercentile: number;
  /** The measured set's median description, the "normal" being suggested toward. */
  medianDescriptionTokens: number;
  /**
   * ≈ descriptionTokens − median. Approximate by construction: component
   * counts do not sum exactly to the whole, and a rewritten description
   * tokenizes as itself, not as an arithmetic difference.
   */
  approxRecoverableTokens: number;
}

/**
 * The suggestion for one tool, or null — null is the common and correct case.
 * Null when the measurement predates component counts, when the description
 * sits below the threshold percentile, or when trimming toward the median
 * would recover nothing.
 */
export function suggestFor(server: string, t: ToolMeasurement, baseline: ToolShapeBaseline): ToolSuggestion | null {
  if (!complete(t)) return null;
  const pct = percentileOf(baseline.quantiles.descriptionTokens, t.descriptionTokens);
  if (pct < SUGGEST_DESCRIPTION_PERCENTILE) return null;
  const median = baseline.quantiles.descriptionTokens[50];
  const approx = t.descriptionTokens - median;
  if (approx <= 0) return null;
  return {
    server,
    tool: t.name,
    tokens: t.tokens,
    descriptionTokens: t.descriptionTokens,
    inputSchemaTokens: t.inputSchemaTokens,
    descriptionPercentile: pct,
    medianDescriptionTokens: median,
    approxRecoverableTokens: approx,
  };
}
