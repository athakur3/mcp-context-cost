/** Status taxonomy — every swept server gets exactly one; no silent drops. */
export type MeasurementStatus =
  | 'measured'
  | 'auth-required'
  | 'startup-failure'
  | 'timeout'
  /**
   * This harness cannot run the server, for a reason that is a property of the
   * harness rather than of the software: an OS or architecture the package does
   * not ship for, or a backing service the isolation deliberately does not
   * provide. Distinct from `startup-failure`, which asserts the server did not
   * come up — a claim about someone else's code that these entries do not
   * support. Only ever set when the entry declares the reason AND the failure's
   * own text corroborates it (see `notApplicable` in report.ts).
   */
  | 'not-applicable'
  | 'dynamic'
  | 'remote-auth-wall';

export interface ToolMeasurement {
  name: string;
  /** Tokens of the whole tool object, canonically serialized. */
  tokens: number;
  descriptionTokens: number;
  inputSchemaTokens: number;
}

/**
 * The full reproducibility record published next to every badge.
 * Re-tokenizing `rawToolsCapture` must reproduce `totalTokens` exactly.
 */
export interface Measurement {
  methodologyVersion: string;
  provider: 'tiktoken';
  encoding: 'o200k_base';
  status: MeasurementStatus;
  totalTokens: number | null;
  toolCount: number | null;
  tools: ToolMeasurement[];
  /** SHA-256 hex of the canonical bytes (see canonical.ts). */
  canonicalSha256: string | null;
  /** The tools array exactly as returned by tools/list, all pages concatenated. */
  rawToolsCapture: unknown[] | null;
  /**
   * The `instructions` string returned by `initialize` — half of the
   * session-start load (see core/session-start.ts). Three states, and they are
   * different claims: a string (the server sent this), `null` (the server sent
   * none), absent (never captured — every measurement predating this field).
   * Absent is never read as zero.
   */
  serverInstructions?: string | null;
  measuredAt: string;
  serverName: string;
  serverVersion?: string;
  /** Exact launch command; env var NAMES only, never values. */
  launchCommand?: string;
  envVarNames?: string[];
  /** How the server was isolated during measurement (docker image, network). */
  isolation?: { docker: boolean; image?: string; network?: string; note?: string };
  /** Request timeout in force during this measurement. */
  timeoutMs?: number;
  notes?: string;
}

/** Strict shields.io endpoint-badge schema — nothing extra. */
export interface BadgeJson {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
  cacheSeconds: number;
}
