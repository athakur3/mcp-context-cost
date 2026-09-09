/**
 * Claude Code's MCP allowlist and denylist, read from the settings files this
 * audit already opens — and nothing else.
 *
 * `allowedMcpServers` and `deniedMcpServers` filter which configured servers
 * load. Both are lists of single-key entries — `{ serverUrl }` (wildcards),
 * `{ serverCommand }` (exact argv), `{ serverName }` (exact label) — and the
 * client merges them across every settings scope, then checks the denylist
 * (nothing overrides a match) and then the allowlist (unset means everything
 * loads; empty means nothing does; populated means a remote must match a
 * `serverUrl` entry when any exists, a stdio server a `serverCommand` entry
 * when any exists, and `serverName` counts only in their absence). Source:
 * code.claude.com/docs/en/managed-mcp.md, §Policy-based control and §How a
 * server is evaluated, read **2026-09-09**.
 *
 * The two lists are treated asymmetrically here, and the reason is the
 * invariant this audit holds everywhere: a miss may only ever OVERSTATE what a
 * session pays, never understate it.
 *
 *   - A clean **deny** match is applied: the vendor says a denied server does
 *     not load regardless of any other setting, so excluding it from a
 *     session's bill states only what is certain. A deny entry this audit
 *     cannot see (server-managed settings, an MDM profile, a registry key —
 *     tiers it does not open) can only mean the real bill is lower than
 *     reported, which is the allowed direction.
 *   - An **allow** verdict is reported, never subtracted. Allowlists merge as
 *     a union across scopes, so an entry in a tier this audit does not read
 *     can only broaden what loads — subtracting a server for failing the
 *     entries read here could understate a session that an unread entry
 *     admits. What is printed is the verdict per server and where the entries
 *     came from, for the reader to check.
 *
 * Matching is deliberately narrower than the client's in two documented ways,
 * both stated rather than approximated: `${VAR}` expansion is never performed
 * (the two sides expand from environments this audit does not hold — the
 * page's §How policy entries expand), so an entry carrying `${` is returned
 * as `unevaluated`; and a URL pattern's trailing-FQDN-dot equivalence is not
 * implemented. A narrower deny matcher can only overstate; a narrower allow
 * matcher can only move a verdict to `fails`/`unevaluated`, and verdicts do
 * not subtract.
 */

/** One entry, as written: exactly one of the three keys. */
export interface PolicyEntry {
  serverUrl?: string;
  serverCommand?: string[];
  serverName?: string;
}

/** An entry this audit will not evaluate, with the reason it will not. */
export interface UnevaluatedEntry {
  /** The entry as written, printable — policy patterns, never expanded values. */
  entry: string;
  source: string;
  reason: 'contains ${} expansion' | 'not a single-key entry of a documented shape';
}

interface NormalizedEntry {
  kind: 'url' | 'command' | 'name';
  url?: string;
  command?: string[];
  name?: string;
  source: string;
  scope: string;
}

export interface SourcePolicy {
  /** Present when the file sets the key at all; 'unreadable' when not a list. */
  allowed?: PolicyEntry[] | 'unreadable';
  denied?: PolicyEntry[] | 'unreadable';
  /** `true`/`false` as written; 'unreadable' for any other type. Absent when unset. */
  allowManagedMcpServersOnly?: boolean | 'unreadable';
}

/** Pull the three policy keys off one parsed settings document. */
export function extractSourcePolicy(doc: unknown): SourcePolicy | undefined {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return undefined;
  const d = doc as Record<string, unknown>;
  const out: SourcePolicy = {};
  const allowed = d['allowedMcpServers'];
  const denied = d['deniedMcpServers'];
  if (allowed !== undefined) out.allowed = Array.isArray(allowed) ? allowed : 'unreadable';
  if (denied !== undefined) out.denied = Array.isArray(denied) ? denied : 'unreadable';
  const flag = d['allowManagedMcpServersOnly'];
  if (flag !== undefined)
    out.allowManagedMcpServersOnly = typeof flag === 'boolean' ? flag : 'unreadable';
  return out.allowed !== undefined ||
    out.denied !== undefined ||
    out.allowManagedMcpServersOnly !== undefined
    ? out
    : undefined;
}

/** The server fields a policy decision reads. */
export interface PolicyServer {
  name: string;
  transport: 'stdio' | 'remote';
  argv?: string[] | undefined;
  url?: string | undefined;
}

const printable = (e: PolicyEntry): string =>
  e.serverUrl !== undefined
    ? `serverUrl ${e.serverUrl}`
    : e.serverCommand !== undefined
      ? `serverCommand [${e.serverCommand.join(', ')}]`
      : `serverName ${e.serverName}`;

function normalize(
  entries: PolicyEntry[],
  source: string,
  scope: string,
): { ok: NormalizedEntry[]; bad: UnevaluatedEntry[] } {
  const ok: NormalizedEntry[] = [];
  const bad: UnevaluatedEntry[] = [];
  for (const e of entries) {
    const keys = e && typeof e === 'object' ? Object.keys(e) : [];
    const single =
      keys.length === 1 &&
      (keys[0] === 'serverUrl' || keys[0] === 'serverCommand' || keys[0] === 'serverName');
    const shapeOk =
      single &&
      (typeof e.serverUrl === 'string' ||
        typeof e.serverName === 'string' ||
        (Array.isArray(e.serverCommand) && e.serverCommand.every((a) => typeof a === 'string')));
    if (!shapeOk) {
      bad.push({
        entry: JSON.stringify(e),
        source,
        reason: 'not a single-key entry of a documented shape',
      });
      continue;
    }
    const text = e.serverUrl ?? e.serverName ?? e.serverCommand!.join(' ');
    if (text.includes('${')) {
      bad.push({ entry: printable(e), source, reason: 'contains ${} expansion' });
      continue;
    }
    if (e.serverUrl !== undefined) ok.push({ kind: 'url', url: e.serverUrl, source, scope });
    else if (e.serverCommand !== undefined)
      ok.push({ kind: 'command', command: e.serverCommand, source, scope });
    else ok.push({ kind: 'name', name: e.serverName!, source, scope });
  }
  return { ok, bad };
}

const globToRegExp = (s: string): RegExp =>
  new RegExp('^' + s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

/**
 * The documented URL match: `*` anywhere (scheme included), a pattern with no
 * path matching any path on that origin, scheme and host case-insensitive,
 * path case-sensitive. Implemented by lowercasing both sides up to the first
 * `/` after `://` (or the whole string when there is none) and compiling `*`
 * to `.*` over the escaped remainder.
 */
export function urlMatches(pattern: string, url: string): boolean {
  const foldHost = (s: string): string => {
    const at = s.indexOf('://');
    const from = at >= 0 ? at + 3 : 0;
    const slash = s.indexOf('/', from);
    return slash >= 0 ? s.slice(0, slash).toLowerCase() + s.slice(slash) : s.toLowerCase();
  };
  const p = foldHost(pattern);
  const u = foldHost(url);
  if (globToRegExp(p).test(u)) return true;
  // A pattern with no path matches any path on that origin.
  const at = p.indexOf('://');
  const afterScheme = at >= 0 ? p.slice(at + 3) : p;
  if (!afterScheme.includes('/'))
    return new RegExp(
      '^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '(/.*)?$',
    ).test(u);
  return false;
}

function entryMatches(server: PolicyServer, e: NormalizedEntry): boolean {
  if (e.kind === 'name') return server.name === e.name;
  if (e.kind === 'command')
    return (
      server.transport === 'stdio' &&
      Array.isArray(server.argv) &&
      server.argv.length === e.command!.length &&
      server.argv.every((a, i) => a === e.command![i])
    );
  return server.transport === 'remote' && !!server.url && urlMatches(e.url!, server.url);
}

export interface DenyVerdict {
  server: string;
  /** The entry that matched, printable, and the file it came from. */
  entry: string;
  source: string;
}

export interface AllowVerdictRow {
  server: string;
  verdict: 'matches' | 'fails' | 'unevaluated';
  /** Set for 'matches': the entry that admitted it. */
  via?: string | undefined;
}

export interface McpPolicyEvaluation {
  /** Every read source that set either list or the managed-only flag, in read order. */
  sources: { scope: string; source: string; policy: SourcePolicy }[];
  /** Servers a clean deny entry matches — they do not load; nothing overrides a deny. */
  denied: DenyVerdict[];
  /** Deny entries this audit did not evaluate. Their misses can only overstate. */
  denyUnevaluated: UnevaluatedEntry[];
  /**
   * The allowlist's verdicts — reported, never applied. Absent when no read
   * source sets `allowedMcpServers`.
   */
  allow?:
    | {
        sources: string[];
        /**
         * Set when `allowManagedMcpServersOnly: true` was read from a managed
         * source: only managed-tier allow entries counted, per the page. When
         * the flag is set anywhere to something unreadable, every verdict is
         * `unevaluated` instead — which pool applies cannot be said.
         */
        managedOnly?: { source: string } | undefined;
        rows: AllowVerdictRow[];
        unevaluated: UnevaluatedEntry[];
      }
    | undefined;
}

const MANAGED_SCOPES = new Set(['managed-settings', 'managed-drop-in']);

/**
 * Evaluate both lists over one session's servers.
 *
 * `sources` are settings files in the loader's order, each with what it set.
 * Only entries read cleanly participate; everything else is returned as
 * `unevaluated`, by name and source, because an entry this cannot evaluate is
 * set — dropping it would argue from a silence that is not silent.
 */
export function evaluateMcpPolicy(
  servers: PolicyServer[],
  sources: { scope: string; source: string; state: string; policy?: SourcePolicy | undefined }[],
): McpPolicyEvaluation {
  const withPolicy = sources
    .filter((s) => s.state === 'read' && s.policy)
    .map((s) => ({ scope: s.scope, source: s.source, policy: s.policy! }));

  const denyOk: NormalizedEntry[] = [];
  const denyBad: UnevaluatedEntry[] = [];
  const allowOk: NormalizedEntry[] = [];
  const allowBad: UnevaluatedEntry[] = [];
  const allowSources: string[] = [];
  let managedOnly: { source: string } | undefined;
  let managedOnlyUnreadable: string | undefined;

  for (const s of withPolicy) {
    if (s.policy.denied === 'unreadable')
      denyBad.push({
        entry: 'deniedMcpServers',
        source: s.source,
        reason: 'not a single-key entry of a documented shape',
      });
    else if (s.policy.denied) {
      const n = normalize(s.policy.denied, s.source, s.scope);
      denyOk.push(...n.ok);
      denyBad.push(...n.bad);
    }
    if (s.policy.allowed === 'unreadable') {
      allowSources.push(s.source);
      allowBad.push({
        entry: 'allowedMcpServers',
        source: s.source,
        reason: 'not a single-key entry of a documented shape',
      });
    } else if (s.policy.allowed) {
      allowSources.push(s.source);
      const n = normalize(s.policy.allowed, s.source, s.scope);
      allowOk.push(...n.ok);
      allowBad.push(...n.bad);
    }
    if (s.policy.allowManagedMcpServersOnly === true && MANAGED_SCOPES.has(s.scope)) {
      managedOnly ??= { source: s.source };
    } else if (s.policy.allowManagedMcpServersOnly === 'unreadable') {
      managedOnlyUnreadable ??= s.source;
    }
  }

  const asEntry = (n: NormalizedEntry): PolicyEntry =>
    n.kind === 'url'
      ? { serverUrl: n.url! }
      : n.kind === 'command'
        ? { serverCommand: n.command! }
        : { serverName: n.name! };

  const denied: DenyVerdict[] = [];
  for (const srv of servers) {
    const hit = denyOk.find((e) => entryMatches(srv, e));
    if (hit) denied.push({ server: srv.name, entry: printable(asEntry(hit)), source: hit.source });
  }

  let allow: McpPolicyEvaluation['allow'];
  if (allowSources.length) {
    const pool = managedOnly ? allowOk.filter((e) => MANAGED_SCOPES.has(e.scope)) : allowOk;
    const scopeOf = new Map(withPolicy.map((s) => [s.source, s.scope]));
    const poolBad = managedOnly
      ? allowBad.filter((e) => MANAGED_SCOPES.has(scopeOf.get(e.source) ?? ''))
      : allowBad;
    const urlEntries = pool.some((e) => e.kind === 'url');
    const cmdEntries = pool.some((e) => e.kind === 'command');
    const rows: AllowVerdictRow[] = servers.map((srv) => {
      if (managedOnlyUnreadable) return { server: srv.name, verdict: 'unevaluated' };
      const eligible = pool.filter((e) => {
        if (srv.transport === 'remote')
          return e.kind === 'url' || (e.kind === 'name' && !urlEntries);
        return e.kind === 'command' || (e.kind === 'name' && !cmdEntries);
      });
      const hit = eligible.find((e) => entryMatches(srv, e));
      if (hit) return { server: srv.name, verdict: 'matches', via: printable(asEntry(hit)) };
      // An entry this audit did not evaluate might have admitted it.
      if (poolBad.length) return { server: srv.name, verdict: 'unevaluated' };
      return { server: srv.name, verdict: 'fails' };
    });
    allow = { sources: allowSources, managedOnly, rows, unevaluated: allowBad };
  }

  return { sources: withPolicy, denied, denyUnevaluated: denyBad, allow };
}
