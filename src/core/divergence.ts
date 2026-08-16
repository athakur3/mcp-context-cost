/**
 * Claude divergence — the gap between the published o200k index and what a
 * server's tools actually cost in an Anthropic request.
 *
 * The gap has two independent causes, and reporting them as one number hides
 * the larger of the two:
 *
 * 1. **Field selection.** An Anthropic tool definition carries exactly `name`,
 *    `description`, and `input_schema`. A `tools/list` result may additionally
 *    carry `title`, `annotations`, `outputSchema`, `execution`, `icons` — real
 *    bytes the server ships, counted by the canonical form, but never present
 *    in the `tools` array a client sends to the API. For some servers this is
 *    the majority of the payload.
 * 2. **Tokenizer and framing.** o200k_base vs Anthropic's tokenizer, plus the
 *    fixed framework overhead the API adds once when any tool is present.
 *
 * So the divergence is published as a decomposition: the headline o200k count,
 * the o200k count of the projection (isolating cause 1), and Claude's own count
 * of that same projection (isolating cause 2).
 */
import { countTokens } from './canonical.js';

/** Method identifier, versioned independently of the o200k methodology. */
export const DIVERGENCE_METHOD = 'tools-delta/v1';

/** The three fields an Anthropic tool definition carries — nothing else. */
export const ANTHROPIC_TOOL_FIELDS = ['name', 'description', 'input_schema'] as const;

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: unknown;
}

export interface DivergenceRow {
  /** o200k count of the full canonical capture — the published headline. */
  o200kFull: number;
  /** o200k count of the name/description/input_schema projection. */
  o200kMapped: number;
  /**
   * Claude tokens the projection adds to a request: count_tokens(with tools)
   * minus count_tokens(same request, no tools). Includes the one-time tool
   * framework overhead, because attaching any server pays it once.
   */
  claudeDelta: number;
  toolCount: number;
  /**
   * canonicalSha256 of the measurement this row was computed from. A re-sweep
   * changes the hash, which marks the row stale instead of silently mismatched.
   */
  capturedSha256: string;
  /** Set when count_tokens rejected the projection; no numbers are published. */
  error?: string;
}

export interface DivergenceRun {
  method: string;
  /** Exact model id the counts are pinned to — Anthropic's tokenizer drifts. */
  model: string;
  /** UTC day the counts were taken (YYYY-MM-DD). */
  measuredAt: string;
  /** count_tokens for the probe request with no tools at all. */
  baselineTokens: number;
  /**
   * A single minimal tool. Its delta is an upper bound on the fixed framework
   * overhead included in every `claudeDelta` (the probe tool itself costs > 0,
   * so the true overhead is strictly less).
   */
  probeDelta: number;
  servers: Record<string, DivergenceRow>;
}

interface RawTool {
  name?: unknown;
  description?: unknown;
  inputSchema?: unknown;
}

/**
 * Project a `tools/list` capture onto the Anthropic tool shape. Tools without a
 * usable name are dropped rather than renamed — a fabricated name would change
 * the token count being compared.
 */
export function toAnthropicTools(raw: unknown[]): AnthropicTool[] {
  const out: AnthropicTool[] = [];
  for (const t of raw) {
    const tool = (t ?? {}) as RawTool;
    if (typeof tool.name !== 'string' || tool.name === '') continue;
    out.push({
      name: tool.name,
      description: typeof tool.description === 'string' ? tool.description : '',
      // An absent schema is sent as the empty object schema, which is what the
      // API requires; every tool in the current sweep supplies one.
      input_schema: tool.inputSchema ?? { type: 'object', properties: {} },
    });
  }
  return out;
}

/** o200k count of the projection — the same tokenizer as the headline number. */
export function mappedTokens(raw: unknown[]): number {
  return countTokens(JSON.stringify(toAnthropicTools(raw)));
}

/**
 * Share of the headline number that is MCP-only metadata (cause 1 above).
 * Returns null when there is nothing to divide by.
 */
export function fieldSelectionShare(row: DivergenceRow): number | null {
  if (row.o200kFull <= 0) return null;
  return (row.o200kFull - row.o200kMapped) / row.o200kFull;
}

/**
 * Claude tokens per o200k token of the headline — the ratio a reader wants when
 * asking "does the badge over- or under-state what this costs me?".
 */
export function claudeRatio(row: DivergenceRow): number | null {
  if (row.o200kFull <= 0 || typeof row.claudeDelta !== 'number') return null;
  return row.claudeDelta / row.o200kFull;
}

/**
 * A row is only reportable if it carries numbers and was computed from the
 * capture currently on disk. Stale rows are hidden rather than shown with a
 * caveat: a wrong number next to a fresh badge is worse than no number.
 */
export function isCurrent(row: DivergenceRow | undefined, canonicalSha256: string | null): row is DivergenceRow {
  if (!row || row.error) return false;
  if (typeof row.claudeDelta !== 'number') return false;
  return !!canonicalSha256 && row.capturedSha256 === canonicalSha256;
}

/** Parse results/divergence.json; anything malformed yields null, never throws. */
export function parseDivergence(text: string): DivergenceRun | null {
  let run: unknown;
  try {
    run = JSON.parse(text);
  } catch {
    return null;
  }
  const r = run as Partial<DivergenceRun>;
  if (!r || typeof r.model !== 'string' || typeof r.measuredAt !== 'string') return null;
  if (!r.servers || typeof r.servers !== 'object') return null;
  return {
    method: typeof r.method === 'string' ? r.method : DIVERGENCE_METHOD,
    model: r.model,
    measuredAt: r.measuredAt,
    baselineTokens: typeof r.baselineTokens === 'number' ? r.baselineTokens : 0,
    probeDelta: typeof r.probeDelta === 'number' ? r.probeDelta : 0,
    servers: r.servers as Record<string, DivergenceRow>,
  };
}
