import { createHash } from 'node:crypto';
import { getEncoding } from 'js-tiktoken';
import type { Measurement, MeasurementStatus, ToolMeasurement } from './types.js';

export const METHODOLOGY_VERSION = '1.0';

const enc = getEncoding('o200k_base');

/**
 * Canonical form: JSON.stringify over the PARSED tools array (no whitespace,
 * first-occurrence key order, JSON.parse semantics — duplicate keys last-wins,
 * numbers/strings re-serialized per ECMA-404). This is deliberately defined on
 * the parsed value, not raw wire bytes: every JSON implementation reproduces it
 * from the published capture, which is what makes numbers re-derivable anywhere.
 */
export function canonicalString(tools: unknown[]): string {
  return JSON.stringify(tools);
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function countTokens(text: string): number {
  // disallowedSpecial=[] — special-token strings (e.g. "<|endoftext|>") in tool
  // descriptions are counted as ordinary text instead of throwing.
  return enc.encode(text, undefined, []).length;
}

interface ToolLike {
  name?: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  annotations?: unknown;
}

/**
 * One tool's diagnostic breakdown, from the tool object alone.
 *
 * Exported and used by `measureTools` rather than inlined there, because two
 * other callers have to agree with it exactly: the backfill that fills these
 * fields in on records written before they existed, and the test that re-derives
 * every published record's breakdown from that record's own capture. A second
 * implementation of this arithmetic would be a second answer to the same
 * question.
 *
 * A tool that ships no `outputSchema` or `annotations` records `0`. An absent
 * key means something else — a record written before this existed — which is
 * why `ToolMeasurement` makes them optional.
 */
export function measureTool(t: unknown): ToolMeasurement {
  const tool = t as ToolLike;
  return {
    name: tool.name ?? '(unnamed)',
    tokens: countTokens(JSON.stringify(t)),
    descriptionTokens: tool.description ? countTokens(tool.description) : 0,
    inputSchemaTokens: tool.inputSchema ? countTokens(JSON.stringify(tool.inputSchema)) : 0,
    outputSchemaTokens: tool.outputSchema ? countTokens(JSON.stringify(tool.outputSchema)) : 0,
    annotationsTokens: tool.annotations ? countTokens(JSON.stringify(tool.annotations)) : 0,
  };
}

/**
 * totalTokens is authoritative (tokens of the whole canonical array — array
 * punctuation included); per-tool numbers are diagnostic and won't sum to it.
 */
export function measureTools(
  tools: unknown[],
  meta: {
    serverName: string;
    serverVersion?: string;
    launchCommand?: string;
    envVarNames?: string[];
    measuredAt?: string;
    /**
     * The initialize `instructions` string, or null when the server returned
     * none. Omit it only when nothing was captured: an omitted field records
     * "never asked", which session-start.ts refuses to read as zero.
     */
    instructions?: string | null;
  },
): Measurement {
  const canonical = canonicalString(tools);
  const perTool: ToolMeasurement[] = tools.map(measureTool);
  return {
    methodologyVersion: METHODOLOGY_VERSION,
    provider: 'tiktoken',
    encoding: 'o200k_base',
    status: 'measured',
    totalTokens: countTokens(canonical),
    toolCount: tools.length,
    tools: perTool,
    canonicalSha256: sha256Hex(canonical),
    // Snapshot from the canonical string, not the live `tools` reference — the whole
    // point of a capture is that it can't change out from under its own hash later.
    rawToolsCapture: JSON.parse(canonical),
    measuredAt: meta.measuredAt ?? new Date().toISOString(),
    serverName: meta.serverName,
    serverVersion: meta.serverVersion,
    launchCommand: meta.launchCommand,
    envVarNames: meta.envVarNames,
    // Left undefined (and so absent from the JSON) when the caller had nothing
    // to record, which is exactly how a pre-field measurement reads.
    serverInstructions: meta.instructions,
  };
}

export function failedMeasurement(
  status: Exclude<MeasurementStatus, 'measured' | 'dynamic'>,
  meta: { serverName: string; serverVersion?: string; launchCommand?: string; notes?: string; measuredAt?: string },
): Measurement {
  return {
    methodologyVersion: METHODOLOGY_VERSION,
    provider: 'tiktoken',
    encoding: 'o200k_base',
    status,
    totalTokens: null,
    toolCount: null,
    tools: [],
    canonicalSha256: null,
    rawToolsCapture: null,
    measuredAt: meta.measuredAt ?? new Date().toISOString(),
    serverName: meta.serverName,
    serverVersion: meta.serverVersion,
    launchCommand: meta.launchCommand,
    notes: meta.notes,
  };
}
