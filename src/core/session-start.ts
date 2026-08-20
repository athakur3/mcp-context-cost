/**
 * Session-start load — what a client actually puts in context when it defers
 * tool definitions until they are used.
 *
 * The headline number counts every byte of `tools/list`, because that is what a
 * client loading definitions eagerly pays. Clients increasingly do not: they put
 * a *list of names* in context and fetch the definition only when the model
 * reaches for the tool. That client pays a different bill at session start, and
 * the headline number says nothing about it.
 *
 * Different, and usually far smaller — but *not* smaller by construction, and
 * nothing here may claim it is. Only one of the two halves below is bounded by
 * the definitions being deferred. Instructions are separate bytes that no part
 * of the headline counts, and their length has nothing to do with the size of
 * the tool set, so a server that re-lists its tools in its `instructions`
 * charges a deferring client *more* than an eager one. That is not
 * hypothetical: it is true of a server on the published leaderboard, which is
 * the most useful thing this measurement has found, and every renderer of these
 * numbers is expected to let the reader see it rather than smooth it away.
 *
 * Two quantities make up that bill, and only one of them is in the published
 * capture:
 *
 * 1. **Tool names.** Derivable from `rawToolsCapture` — no re-measurement
 *    needed, and re-derivable by anyone from the same published bytes.
 * 2. **Server instructions.** The `instructions` string a server returns from
 *    `initialize`. It is *not* part of `tools/list` and so is absent from every
 *    measurement recorded before this field existed.
 *
 * Which means a row can be in one of two honest states, and they are not the
 * same claim: an exact figure (both halves known), or a **floor** (names
 * measured, instructions never captured). A floor published as a figure is the
 * failure mode this module exists to prevent — see `isFloor`, which every
 * renderer must carry through to the reader.
 *
 * Versioned independently of the o200k methodology, on the same reasoning as
 * `tools-delta/v1`: this adds a second published number and does not touch the
 * definition of the first. No `totalTokens` and no canonical hash moves.
 */
import { countTokens, sha256Hex } from './canonical.js';
import type { Measurement } from './types.js';

/** Method identifier, versioned independently of METHODOLOGY_VERSION. */
export const SESSION_START_METHOD = 'deferred-load/v1';

interface NamedTool {
  name?: unknown;
}

/**
 * Tool names in server-returned order. A tool without a usable name is dropped
 * rather than given a placeholder — the same rule `toAnthropicTools` follows,
 * for the same reason: an invented name would change the count being published.
 */
export function toolNames(raw: unknown[]): string[] {
  const out: string[] = [];
  for (const t of raw) {
    const name = ((t ?? {}) as NamedTool).name;
    if (typeof name === 'string' && name !== '') out.push(name);
  }
  return out;
}

/**
 * o200k count of the canonical tool-name list: `JSON.stringify` over the name
 * array, the same serialization discipline as the headline number, so both
 * re-derive from the same capture with the same five lines.
 */
export function toolNameTokens(raw: unknown[]): number {
  return countTokens(JSON.stringify(toolNames(raw)));
}

/**
 * The two halves are counted separately and added, rather than counted over one
 * concatenated string. Concatenation would let boundary tokens merge across the
 * seam, so the published total would not equal the sum of the parts printed
 * beside it — a discrepancy of a token or two that no reader could account for.
 */
export function sessionStartTokens(raw: unknown[], instructions: string | null): number {
  return toolNameTokens(raw) + (instructions ? countTokens(instructions) : 0);
}

/** One server's instructions, captured beside — not inside — a measurement. */
export interface SessionStartRow {
  /** Exactly what `initialize` returned; '' when the server returned none. */
  instructions: string;
  instructionsTokens: number;
  /** SHA-256 of the instructions bytes — the dispute artifact, as ever. */
  instructionsSha256: string;
  /**
   * `canonicalSha256` of the measurement this capture stood beside. A re-sweep
   * moves that hash, which marks the row stale: instructions are a property of
   * the same server build that produced the tools, so a changed tool set is
   * reason enough to stop trusting the instructions captured with the old one.
   */
  capturedSha256: string | null;
  serverVersion?: string;
  /** Set when the server could not be reached; no numbers are published. */
  error?: string;
}

export interface SessionStartRun {
  method: string;
  /** UTC day the instructions were captured (YYYY-MM-DD). */
  measuredAt: string;
  /** How the servers were isolated during the capture. */
  isolation?: string;
  servers: Record<string, SessionStartRow>;
}

/** Where the instructions half of a figure came from — or that it is missing. */
export type InstructionsSource = 'measurement' | 'capture' | 'not-captured';

export interface SessionStartLoad {
  toolCount: number;
  toolNameTokens: number;
  /** null when instructions have never been captured for this server. */
  instructionsTokens: number | null;
  /** Names plus instructions; names alone when instructions are unknown. */
  totalTokens: number;
  /** True when `totalTokens` is a lower bound, not a measurement. */
  isFloor: boolean;
  instructionsSource: InstructionsSource;
}

/**
 * The instructions recorded *inside* a measurement, distinguishing three states
 * that JSON round-trips faithfully:
 *   - a string  → captured, the server sent this
 *   - null      → captured, the server sent none
 *   - undefined → never captured (every measurement predating the field)
 *
 * Absent-means-unknown rather than absent-means-zero, on the precedent set by
 * history.csv's `isolation` column: an old row reads as unknown and is never
 * back-filled from a value it did not record.
 */
export function measuredInstructions(m: Measurement): string | undefined {
  if (typeof m.serverInstructions === 'string') return m.serverInstructions;
  if (m.serverInstructions === null) return '';
  return undefined;
}

/**
 * Resolve one server's session-start load from its measurement and, if it has
 * one, the instructions captured beside it.
 *
 * Precedence is measurement over capture and never the other way round: the
 * measurement's instructions came off the same server process as its tools, in
 * the same run, so it cannot be stale relative to itself. The side capture is
 * the backfill for measurements taken before the field existed, and it is used
 * only while it still points at the measurement on disk.
 *
 * Returns null for a measurement with no capture to read names from — a
 * `startup-failure` has no session-start load because it has no session.
 */
export function sessionStartLoad(m: Measurement, row?: SessionStartRow): SessionStartLoad | null {
  if (!Array.isArray(m.rawToolsCapture)) return null;
  const names = toolNameTokens(m.rawToolsCapture);
  const toolCount = toolNames(m.rawToolsCapture).length;

  const inMeasurement = measuredInstructions(m);
  if (inMeasurement !== undefined) {
    const t = inMeasurement ? countTokens(inMeasurement) : 0;
    return {
      toolCount,
      toolNameTokens: names,
      instructionsTokens: t,
      totalTokens: names + t,
      isFloor: false,
      instructionsSource: 'measurement',
    };
  }

  if (isCurrentInstructions(row, m.canonicalSha256)) {
    return {
      toolCount,
      toolNameTokens: names,
      instructionsTokens: row.instructionsTokens,
      totalTokens: names + row.instructionsTokens,
      isFloor: false,
      instructionsSource: 'capture',
    };
  }

  return {
    toolCount,
    toolNameTokens: names,
    instructionsTokens: null,
    totalTokens: names,
    isFloor: true,
    instructionsSource: 'not-captured',
  };
}

/**
 * A side capture is usable only if it carries a number and still points at the
 * measurement on disk. Unlike a stale divergence row — which is hidden, because
 * there is nothing else to print — a stale row here degrades the figure to its
 * names-only floor. The column never blanks; it only ever stops claiming to
 * know the half it no longer knows.
 */
export function isCurrentInstructions(
  row: SessionStartRow | undefined,
  canonicalSha256: string | null,
): row is SessionStartRow {
  if (!row || row.error) return false;
  if (typeof row.instructionsTokens !== 'number') return false;
  return !!canonicalSha256 && row.capturedSha256 === canonicalSha256;
}

/** Build a row from a freshly captured instructions string. */
export function toSessionStartRow(
  instructions: string | null,
  meta: { capturedSha256: string | null; serverVersion?: string },
): SessionStartRow {
  const text = instructions ?? '';
  return {
    instructions: text,
    instructionsTokens: text ? countTokens(text) : 0,
    instructionsSha256: sha256Hex(text),
    capturedSha256: meta.capturedSha256,
    serverVersion: meta.serverVersion,
  };
}

/** Parse results/session-start.json; anything malformed yields null, never throws. */
export function parseSessionStart(text: string): SessionStartRun | null {
  let run: unknown;
  try {
    run = JSON.parse(text);
  } catch {
    return null;
  }
  const r = run as Partial<SessionStartRun>;
  if (!r || typeof r.measuredAt !== 'string') return null;
  if (!r.servers || typeof r.servers !== 'object') return null;
  return {
    method: typeof r.method === 'string' ? r.method : SESSION_START_METHOD,
    measuredAt: r.measuredAt,
    isolation: typeof r.isolation === 'string' ? r.isolation : undefined,
    servers: r.servers as Record<string, SessionStartRow>,
  };
}
