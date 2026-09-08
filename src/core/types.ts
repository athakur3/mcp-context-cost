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
  /**
   * The server refused a request by naming the protocol rather than itself.
   * Distinct from `startup-failure` for the same reason `not-applicable` is:
   * the process started, the transport worked and the server answered, so "did
   * not come up" would be a claim about someone else's code that the run did
   * not establish.
   *
   * Two JSON-RPC codes reach it, both read from `schema/2026-07-28/schema.ts`
   * in the modelcontextprotocol repository on 2026-09-08:
   * `METHOD_NOT_FOUND` (-32601, line 314) *answering `initialize`*, because
   * that revision removed the handshake in favour of `server/discover` and a
   * server implementing only it has no handler; and
   * `UNSUPPORTED_PROTOCOL_VERSION` (-32022, line 450) *answering anything*,
   * because that code is a statement about the version the request carried and
   * never about the method — see `PROTOCOL_MISMATCH_EVIDENCE` in
   * `sweep/run.ts` for why the two are anchored differently. When the server
   * sends one it carries the revisions it does speak in `data.supported`.
   *
   * The status claims only that a request was refused naming the method or the
   * revision. It does NOT claim the server speaks any particular revision —
   * only `data.supported` establishes that, and the note quotes it verbatim
   * when the server sent one.
   */
  | 'protocol-mismatch'
  | 'dynamic'
  | 'remote-auth-wall';

export interface ToolMeasurement {
  name: string;
  /** Tokens of the whole tool object, canonically serialized. */
  tokens: number;
  descriptionTokens: number;
  inputSchemaTokens: number;
  /**
   * The two fields that used to sit inside `tokens` with nothing naming them.
   * Across the measured set output schemas are about a sixth of every published
   * token and annotations another thirtieth, so a reader could see that a tool
   * was expensive without being able to see that its output schema was why.
   *
   * Optional because absent and zero are different claims, the same distinction
   * `serverInstructions` draws below: `0` means the tool ships no such field,
   * absent means the record predates the attribution. Every published record
   * now carries both — the backfill that re-derived them from the stored
   * capture ran once and was removed on 2026-09-08 — so absent survives here
   * for a record read from somewhere other than this repository.
   */
  outputSchemaTokens?: number | undefined;
  annotationsTokens?: number | undefined;
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
  serverInstructions?: string | null | undefined;
  /**
   * The revision this harness asked for at `initialize`, and the one the server
   * answered with. Stored as a pair, and that is the point: a record that kept
   * only the answer would have to be read against whatever `PROTOCOL_VERSION`
   * says *today*, so the day that constant moves — the event the spec watch
   * exists to catch — every record taken before it would start reading as a
   * disagreement about a run that agreed perfectly at the time.
   *
   * `requested` is stamped on every record, measured or failed. `negotiated` is
   * the server's own word, which the 2025-06-18 schema requires it to send and
   * says "may not match the version that the client requested"; it is present
   * only where `initialize` returned. Absent means never captured — every
   * measurement predating these fields, and any server that omitted a field it
   * was required to send. Neither is ever read as the other.
   *
   * On a `measured` record the two need not agree. The specification requires
   * disconnecting only when the client *cannot support* the version the server
   * names, and the three methods this probe sends are unchanged across every
   * revision a server has answered with — so a difference is recorded and
   * measured through, never hung up on (the 2026-09-07 census found eleven of
   * eighty-eight answering an older revision, and their numbers stand). What
   * ends a run is a refusal, not a difference: `PROTOCOL_MISMATCH_EVIDENCE` in
   * sweep/run.ts.
   */
  requestedProtocolVersion?: string | undefined;
  negotiatedProtocolVersion?: string | undefined;
  measuredAt: string;
  serverName: string;
  serverVersion?: string | undefined;
  /** Exact launch command; env var NAMES only, never values. */
  launchCommand?: string | undefined;
  envVarNames?: string[] | undefined;
  /** How the server was isolated during measurement (docker image, network). */
  isolation?:
    | {
        docker: boolean;
        image?: string | undefined;
        network?: string | undefined;
        note?: string | undefined;
        /**
         * The architecture the measurement ran on, as `<platform>/<arch>` (e.g.
         * `linux/amd64`). Part of the isolation because some packages ship builds
         * for only some of them: `local-mcp` was published as a startup failure on
         * the strength of a run whose real finding was "this laptop is arm64 and
         * the package has no arm64 runtime" — a fact about the machine that the
         * record gave no way to see.
         *
         * Absent on records written before this was captured, which is why it is
         * optional; absence means unknown, never "the same as yours".
         */
        arch?: string | undefined;
      }
    | undefined;
  /** Request timeout in force during this measurement. */
  timeoutMs?: number | undefined;
  notes?: string | undefined;
}

/** Strict shields.io endpoint-badge schema — nothing extra. */
export interface BadgeJson {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
  cacheSeconds: number;
}
