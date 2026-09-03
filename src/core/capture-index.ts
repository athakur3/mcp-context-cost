/**
 * Which published version is this, by its bytes?
 *
 * `audit --changed` answers "did the servers in my config get heavier?" — and
 * the whole question turns on joining a machine's installed server to the
 * published history. Matching by *name* would be a lie waiting to happen: a
 * config's keys are arbitrary local labels, so a server a user calls `github`
 * may be a fork, a pin, or something else entirely, and reporting the official
 * server's movement against it would be a confident false statement.
 *
 * So the join is byte identity — the same discipline the Claude column already
 * uses to decide whether it may print. `results/capture-index.json` maps the
 * `canonicalSha256` of every capture the project has ever published to the
 * server and date it belongs to. A local measurement either *is* one of those
 * captures, exactly, or it is not in the published history at all, and there is
 * no third state to be fuzzy about.
 *
 * The index is derivable from the per-server tool vectors, which is why it can
 * only see as far back as those vectors go: a version published before the
 * vectors existed is not in the index and reads as unknown, not as absent from
 * history. Versioned independently, like every published artifact.
 */

/** Method identifier, versioned independently of METHODOLOGY_VERSION. */
export const CAPTURE_INDEX_METHOD = 'capture-index/v1';

export interface IndexedCapture {
  server: string;
  /** The day this capture was first measured. */
  date: string;
  totalTokens: number;
  toolCount: number;
}

export interface CaptureIndex {
  method: string;
  /** UTC day the index was derived (YYYY-MM-DD). */
  generatedAt: string;
  /** canonicalSha256 → the capture it identifies. */
  captures: Record<string, IndexedCapture>;
  /** server → the newest published capture's hash. */
  current: Record<string, string>;
}

export function parseCaptureIndex(text: string): CaptureIndex | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const i = parsed as Partial<CaptureIndex>;
  if (!i || typeof i.generatedAt !== 'string') return null;
  if (!i.captures || typeof i.captures !== 'object') return null;
  if (!i.current || typeof i.current !== 'object') return null;
  const captures: Record<string, IndexedCapture> = {};
  for (const [sha, c] of Object.entries(i.captures)) {
    const v = c as Partial<IndexedCapture>;
    if (typeof v?.server !== 'string' || typeof v.date !== 'string') continue;
    if (typeof v.totalTokens !== 'number' || typeof v.toolCount !== 'number') continue;
    captures[sha] = { server: v.server, date: v.date, totalTokens: v.totalTokens, toolCount: v.toolCount };
  }
  const current: Record<string, string> = {};
  for (const [server, sha] of Object.entries(i.current)) if (typeof sha === 'string') current[server] = sha;
  return {
    method: typeof i.method === 'string' ? i.method : CAPTURE_INDEX_METHOD,
    generatedAt: i.generatedAt,
    captures,
    current,
  };
}

/**
 * What the index can say about one locally measured server.
 *
 * `unknown` is the honest and common outcome: users install versions this
 * project has never measured, and versions published before the capture index
 * existed are not in it either. It is reported, not hidden — an absence of a
 * record about that version, not a statement that nothing changed.
 */
export type CaptureVerdict =
  | {
      kind: 'behind';
      /** The published server this capture belongs to — established by bytes, not by name. */
      server: string;
      yourDate: string;
      yourTokens: number;
      currentDate: string;
      currentTokens: number;
      /** What moving to the current published version would add to every request. */
      deltaTokens: number;
    }
  | { kind: 'current'; server: string; date: string; tokens: number }
  | { kind: 'unknown' };

/**
 * Identify a local capture against the published index.
 *
 * A hash that matches the server's newest published capture is `current`; one
 * that matches an older capture is `behind`, carrying the exact delta to
 * current. Anything else — including a version newer than anything published —
 * is `unknown`, because the index cannot describe what it has never measured.
 */
export function identify(canonicalSha256: string | null | undefined, index: CaptureIndex): CaptureVerdict {
  if (!canonicalSha256) return { kind: 'unknown' };
  const mine = index.captures[canonicalSha256];
  if (!mine) return { kind: 'unknown' };
  const currentSha = index.current[mine.server];
  if (!currentSha || currentSha === canonicalSha256) {
    return { kind: 'current', server: mine.server, date: mine.date, tokens: mine.totalTokens };
  }
  const current = index.captures[currentSha];
  // A `current` pointer with no capture behind it describes nothing; treat the
  // version as identified but with nothing to compare it against.
  if (!current) return { kind: 'current', server: mine.server, date: mine.date, tokens: mine.totalTokens };
  return {
    kind: 'behind',
    server: mine.server,
    yourDate: mine.date,
    yourTokens: mine.totalTokens,
    currentDate: current.date,
    currentTokens: current.totalTokens,
    deltaTokens: current.totalTokens - mine.totalTokens,
  };
}
