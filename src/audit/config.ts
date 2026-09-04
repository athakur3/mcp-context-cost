/**
 * MCP client config discovery + parsing.
 *
 * The leaderboard measures servers one at a time; `audit` measures the set a
 * person actually has installed. That set lives in a client config file, and
 * every client spells it slightly differently:
 *
 *   Claude Desktop / Claude Code / Cursor / Windsurf   { "mcpServers": { ... } }
 *   VS Code (.vscode/mcp.json)                         { "servers": { ... } }
 *   Claude Code (~/.claude.json)                       also { "projects": { "<dir>": { "mcpServers": ... } } }
 *
 * Everything here is pure (paths in, servers out) so the discovery rules are
 * testable without touching a real home directory.
 *
 * Env var VALUES are read (a server usually needs its key to start) but are
 * never written to a report: report builders pick fields explicitly and only
 * `envVarNames` is ever serialized.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TOOL_SEARCH_VARS,
  type ToolSearchEnv,
  type ToolSearchScope,
  type ToolSearchSource,
  type ToolSearchVar,
} from './deferral.js';

export interface ConfiguredServer {
  name: string;
  /** Which client's config this came from ('claude-desktop', 'cursor', ...). */
  client: string;
  /** Absolute path of the config file. */
  source: string;
  transport: 'stdio' | 'remote';
  /** Display form of the launch command (argv joined) — stdio only. */
  command?: string;
  /** Exact argv, so paths containing spaces survive round-tripping. */
  argv?: string[];
  envVarNames: string[];
  /** Values, needed to spawn the server. NEVER serialize this. */
  env?: Record<string, string>;
  /** Remote endpoint — recorded so the report can say why it was skipped. */
  url?: string;
}

/**
 * JSON with comments and trailing commas — VS Code's mcp.json allows both, and
 * hand-edited Claude/Cursor configs often pick up a trailing comma too. String
 * literals are tracked so a `//` or `,}` inside a tool description survives.
 */
export function parseJsonc(text: string): unknown {
  let out = '';
  let inString = false;
  let escaped = false;
  let pendingComma = false;

  const flush = (next: string) => {
    if (!pendingComma) return;
    // A comma is only trailing if the next real character closes the container.
    if (next !== '}' && next !== ']') out += ',';
    pendingComma = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (c === ',') {
      pendingComma = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (!pendingComma) out += c;
      continue;
    }
    flush(c);
    out += c;
    if (c === '"') inString = true;
  }
  return JSON.parse(out);
}

interface RawEntry {
  command?: string;
  args?: unknown;
  env?: Record<string, unknown>;
  url?: string;
  type?: string;
  transport?: string;
  disabled?: boolean;
}

function toServer(name: string, raw: RawEntry, client: string, source: string): ConfiguredServer | null {
  if (raw.disabled === true) return null;
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw.env ?? {})) {
    if (typeof v === 'string') env[k] = v;
  }
  const envVarNames = Object.keys(env).sort();

  // Remote entries carry a url (and sometimes type http/sse) instead of a command.
  if (!raw.command && typeof raw.url === 'string') {
    return { name, client, source, transport: 'remote', url: raw.url, envVarNames };
  }
  if (typeof raw.command !== 'string' || raw.command.trim() === '') return null;

  const args = Array.isArray(raw.args) ? raw.args.filter((a): a is string => typeof a === 'string') : [];
  const argv = [raw.command, ...args];
  return {
    name,
    client,
    source,
    transport: 'stdio',
    // Quote only the args that need it, so the printed command stays copy-pasteable.
    command: argv.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' '),
    argv,
    envVarNames,
    env: envVarNames.length ? env : undefined,
  };
}

/**
 * Pull every server out of one parsed config document. `cwd` selects the
 * project scope in Claude Code's `~/.claude.json`, which keys per-project
 * servers by absolute directory.
 */
export function extractServers(
  doc: unknown,
  meta: { client: string; source: string; cwd?: string },
): ConfiguredServer[] {
  return extractDeclaration(doc, meta).servers;
}

/**
 * What one config document declares, servers and switched-off entries both.
 *
 * `extractServers` above answers "what is there to measure", which is the
 * question almost every caller has. This answers the wider one, because a file
 * that declares three servers and switches all three off has nothing to measure
 * and is still not a file that declares nothing — and the only place that
 * difference is still visible is here, before the off ones are dropped.
 */
export function extractDeclaration(
  doc: unknown,
  meta: { client: string; source: string; cwd?: string },
): { servers: ConfiguredServer[]; disabled: string[] } {
  if (!doc || typeof doc !== 'object') return { servers: [], disabled: [] };
  const d = doc as Record<string, unknown>;
  const out: ConfiguredServer[] = [];
  const off: string[] = [];

  const addBlock = (block: unknown) => {
    if (!block || typeof block !== 'object') return;
    for (const [name, raw] of Object.entries(block as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      // Recorded before `toServer` drops it, which is the only difference this
      // can still see: an entry it returns null for because the person turned
      // it off, rather than because it is malformed or absent.
      if ((raw as RawEntry).disabled === true) off.push(name);
      const s = toServer(name, raw as RawEntry, meta.client, meta.source);
      if (s) out.push(s);
    }
  };

  addBlock(d.mcpServers);
  addBlock(d.servers); // VS Code
  if (meta.cwd && d.projects && typeof d.projects === 'object') {
    const project = (d.projects as Record<string, unknown>)[meta.cwd];
    if (project && typeof project === 'object') addBlock((project as Record<string, unknown>).mcpServers);
  }

  // A name can legitimately appear in both blocks of the same file; keep the first.
  const seen = new Set<string>();
  const servers = out.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)));
  // A name that is off in one block and live in another is a live server, not a
  // switched-off one, so it is not reported as both.
  const disabled = [...new Set(off.filter((n) => !seen.has(n)))].sort();
  return { servers, disabled };
}

export interface ConfigCandidate {
  client: string;
  path: string;
}

/** Every place a client config is known to live, whether or not it exists. */
export function configCandidates(env: {
  home: string;
  cwd: string;
  platform: NodeJS.Platform;
  appData?: string;
}): ConfigCandidate[] {
  const { home, cwd, platform } = env;
  const desktop =
    platform === 'darwin'
      ? join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
      : platform === 'win32'
        ? join(env.appData ?? join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json')
        : join(home, '.config', 'Claude', 'claude_desktop_config.json');

  return [
    { client: 'claude-desktop', path: desktop },
    { client: 'claude-code', path: join(home, '.claude.json') },
    { client: 'claude-code', path: join(cwd, '.mcp.json') },
    { client: 'cursor', path: join(home, '.cursor', 'mcp.json') },
    { client: 'cursor', path: join(cwd, '.cursor', 'mcp.json') },
    { client: 'vscode', path: join(cwd, '.vscode', 'mcp.json') },
    { client: 'windsurf', path: join(home, '.codeium', 'windsurf', 'mcp_config.json') },
  ];
}

export interface LoadedConfig {
  client: string;
  source: string;
  servers: ConfiguredServer[];
  /** Set when the file exists but could not be read/parsed. */
  error?: string;
  /**
   * Set when the file was read and parsed cleanly and declares no servers at
   * all. Such a config has nothing to total, but "this client declares nothing"
   * and "no client is installed here" are different facts about a machine and
   * only one of them is about the client, so the second is not reported as the
   * first.
   */
  declaresNothing?: true;
  /**
   * Set instead of `declaresNothing` when the file was read and parsed cleanly,
   * declares servers, and every one of them is switched off — the names, in the
   * file's own words. There is nothing to total either way, but a person who
   * turned their servers off is not a person who declared none, and telling
   * them the file declares nothing is a false statement about a file this read.
   */
  allDisabled?: string[];
}

/** Read + parse the candidates that exist. Unreadable files are reported, not thrown. */
export function loadConfigs(candidates: ConfigCandidate[], cwd: string): LoadedConfig[] {
  const out: LoadedConfig[] = [];
  // Running from your home directory nominates `~/.cursor/mcp.json` twice —
  // once as the home candidate, once as the cwd one. Loaded twice it is
  // reported twice, doubles that client's deferral scope, and under
  // `--baseline` the second copy pairs with nothing and fails the gate. One
  // path is one config however many ways it was nominated.
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!existsSync(c.path)) continue;
    if (seen.has(c.path)) continue;
    seen.add(c.path);
    try {
      const doc = parseJsonc(readFileSync(c.path, 'utf8'));
      const { servers, disabled } = extractDeclaration(doc, { client: c.client, source: c.path, cwd });
      // A config with no MCP block at all (e.g. a ~/.claude.json holding only
      // session history) is not worth a line in the report — it has no total.
      // It is still worth carrying: it is the evidence that a client is on this
      // machine, which is what tells an empty client apart from no client.
      if (servers.length === 0) {
        // ...and one whose every declared server is switched off is carried as
        // that, not as one declaring nothing: the second is a claim about the
        // file that the file itself contradicts.
        if (disabled.length) {
          out.push({ client: c.client, source: c.path, servers: [], allDisabled: disabled });
          continue;
        }
        out.push({ client: c.client, source: c.path, servers: [], declaresNothing: true });
        continue;
      }
      out.push({ client: c.client, source: c.path, servers });
    } catch (e) {
      out.push({ client: c.client, source: c.path, servers: [], error: (e as Error).message });
    }
  }
  return out;
}

/** One file Claude Code reads its `env` block from. */
export interface SettingsCandidate {
  scope: ToolSearchScope;
  path: string;
}

/**
 * Every settings file Claude Code takes environment variables from, highest
 * precedence first.
 *
 * A client config says which servers there are; these say how the client
 * behaves — including whether it defers their tool definitions. They are a
 * different set of files from `configCandidates` above and are read for a
 * different question, so they are listed separately rather than folded in.
 *
 * Order is Claude Code's documented settings precedence (enterprise managed
 * policy, then project-local, then project, then user), read 2026-08-20. Paths
 * in, candidates out — nothing here touches a disk.
 */
export function settingsCandidates(env: {
  home: string;
  cwd: string;
  platform: NodeJS.Platform;
  programData?: string;
}): SettingsCandidate[] {
  const { home, cwd, platform } = env;
  const managed =
    platform === 'darwin'
      ? '/Library/Application Support/ClaudeCode/managed-settings.json'
      : platform === 'win32'
        ? join(env.programData ?? 'C:\\ProgramData', 'ClaudeCode', 'managed-settings.json')
        : '/etc/claude-code/managed-settings.json';

  return [
    { scope: 'managed-settings', path: managed },
    { scope: 'local-settings', path: join(cwd, '.claude', 'settings.local.json') },
    { scope: 'project-settings', path: join(cwd, '.claude', 'settings.json') },
    { scope: 'user-settings', path: join(home, '.claude', 'settings.json') },
  ];
}

/**
 * Read what each settings file sets, of the variables that decide deferral.
 *
 * Every candidate comes back, present or not, because "this file is not on the
 * machine" and "this file was never opened" are different answers to the
 * question the report asks, and only one of them means the default stands.
 *
 * Only the three tool-search variables are picked out; the rest of an `env`
 * block — which is where a person keeps their API keys — is left where it is.
 * A file that exists but cannot be parsed is `unreadable`, never silently
 * treated as setting nothing.
 */
export function loadSettingsSources(candidates: SettingsCandidate[]): ToolSearchSource[] {
  return candidates.map((c) => {
    if (!existsSync(c.path)) return { scope: c.scope, source: c.path, state: 'absent' as const, vars: {} };
    try {
      const doc = parseJsonc(readFileSync(c.path, 'utf8'));
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('not a settings object');
      const block = (doc as { env?: unknown }).env;
      const vars: ToolSearchEnv = {};
      const unreadable: ToolSearchVar[] = [];
      if (block && typeof block === 'object' && !Array.isArray(block)) {
        for (const name of TOOL_SEARCH_VARS) {
          if (!(name in (block as Record<string, unknown>))) continue;
          const v = (block as Record<string, unknown>)[name];
          if (typeof v === 'string') vars[name] = v;
          // The variable is set in this file, to something that is not a value
          // this can read — `"ENABLE_TOOL_SEARCH": false`, the JSON boolean, is
          // the one people write. Dropping it here made the file look like a
          // file that sets nothing, and the report then stated the documented
          // default at a machine whose settings say otherwise.
          else unreadable.push(name);
        }
      }
      return {
        scope: c.scope,
        source: c.path,
        state: 'read' as const,
        vars,
        ...(unreadable.length ? { unreadable } : {}),
      };
    } catch {
      return { scope: c.scope, source: c.path, state: 'unreadable' as const, vars: {} };
    }
  });
}
