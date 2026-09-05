/**
 * MCP client config discovery + parsing.
 *
 * The leaderboard measures servers one at a time; `audit` measures the set a
 * person actually has installed. That set lives in a client config file, and
 * every client spells it slightly differently — each shape below is the one
 * its client's own documentation shows, read on the date given:
 *
 *   Claude Desktop / Claude Code / Cursor / Windsurf / Kiro   { "mcpServers": { ... } }   JSON
 *   VS Code (.vscode/mcp.json)                                { "servers": { ... } }      JSON
 *   Claude Code (~/.claude.json)                              also { "projects": { "<dir>": { "mcpServers": ... } } }
 *   Gemini CLI (~/.gemini/settings.json, 2026-09-06)          { "mcpServers": { ... } }, remotes as `url` (SSE) or `httpUrl`
 *   Zed (~/.config/zed/settings.json, 2026-09-06)             { "context_servers": { ... } }, comments allowed
 *   Codex CLI (~/.codex/config.toml, 2026-09-06)              [mcp_servers.<name>]         TOML
 *   Goose (~/.config/goose/config.yaml, 2026-09-06)           extensions: { <name>: { type: stdio | streamable_http } }   YAML
 *
 * A remote is `url` in most files, `serverUrl` in Windsurf's, `httpUrl` or
 * `url` in Gemini's, `uri` in Goose's. An entry is off under `disabled: true`
 * (Claude, Cursor, Kiro), `enabled = false` (Codex, Goose), a name in Gemini's
 * `mcp.excluded` list, or a name in the project's `disabledMcpServers` list in
 * `~/.claude.json`.
 *
 * Everything here is pure (paths in, servers out) so the discovery rules are
 * testable without touching a real home directory.
 *
 * Env var VALUES are read (a server usually needs its key to start) but are
 * never written to a report: report builders pick fields explicitly and only
 * `envVarNames` is ever serialized. Header values a remote entry carries (a
 * static bearer token, or one Codex sources from an environment variable by
 * name) are held to the same rule: sent with the request, never reported —
 * only `headerNames` is.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';
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
  /** Remote endpoint — probed, then measured through the bridge or reported as walled. */
  url?: string;
  /** Names only — a remote entry's header values never enter a report. Absent means none. */
  headerNames?: string[];
  /** Values, sent with the probe and the bridge. NEVER serialize this. */
  headers?: Record<string, string>;
  /**
   * Claude Code's `alwaysLoad: true`: this server's tools load at session
   * start whatever the tool-search setting says (its MCP documentation, §"Exempt
   * a server from deferral", read 2026-09-06). Read from the entry, so the
   * deferral verdict can count it rather than list it as a condition.
   */
  alwaysLoad?: true;
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

/** Every key any of the documented shapes uses; a client reads the ones it spells. */
interface RawEntry {
  command?: string;
  /** Goose spells the launcher `cmd`. */
  cmd?: string;
  args?: unknown;
  env?: Record<string, unknown>;
  /** Goose spells the values `envs`. */
  envs?: Record<string, unknown>;
  url?: string;
  /** Windsurf's remote endpoint. */
  serverUrl?: string;
  /** Gemini's streamable-HTTP endpoint (`url` there is the SSE one). */
  httpUrl?: string;
  /** Goose's remote endpoint. */
  uri?: string;
  type?: string;
  transport?: string;
  /** Zed: `extension` entries are provided by an extension, not launched from this file. */
  source?: string;
  disabled?: boolean;
  /** Codex and Goose spell the switch the other way round. */
  enabled?: boolean;
  headers?: Record<string, unknown>;
  /** Codex: static headers. */
  http_headers?: Record<string, unknown>;
  /** Codex: header name → environment variable that holds its value. */
  env_http_headers?: Record<string, unknown>;
  /** Codex: environment variable that holds the bearer token. */
  bearer_token_env_var?: string;
  alwaysLoad?: boolean;
}

const firstString = (...vs: unknown[]): string | undefined =>
  vs.find((v): v is string => typeof v === 'string' && v.trim() !== '');

/**
 * The headers a remote entry would send, by name and by value.
 *
 * Codex sources two of its forms from the environment by name
 * (`bearer_token_env_var`, `env_http_headers`), so a name the config carries
 * is recorded whether or not this process can see a value for it — the config
 * says the header exists; only the process decides whether it can be sent.
 */
function collectHeaders(
  raw: RawEntry,
  processEnv: Record<string, string | undefined>,
): { names: string[]; values: Record<string, string> } {
  const values: Record<string, string> = {};
  const names = new Set<string>();
  for (const block of [raw.headers, raw.http_headers]) {
    for (const [k, v] of Object.entries(block ?? {})) {
      names.add(k);
      if (typeof v === 'string') values[k] = v;
    }
  }
  for (const [k, v] of Object.entries(raw.env_http_headers ?? {})) {
    names.add(k);
    const fromEnv = typeof v === 'string' ? processEnv[v] : undefined;
    if (fromEnv !== undefined) values[k] = fromEnv;
  }
  if (typeof raw.bearer_token_env_var === 'string') {
    names.add('Authorization');
    const token = processEnv[raw.bearer_token_env_var];
    if (token !== undefined) values.Authorization = `Bearer ${token}`;
  }
  return { names: [...names].sort(), values };
}

function toServer(
  name: string,
  raw: RawEntry,
  client: string,
  source: string,
  processEnv: Record<string, string | undefined>,
): ConfiguredServer | null {
  if (raw.disabled === true || raw.enabled === false) return null;
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw.env ?? raw.envs ?? {})) {
    if (typeof v === 'string') env[k] = v;
  }
  const envVarNames = Object.keys(env).sort();
  const pinned = raw.alwaysLoad === true ? { alwaysLoad: true as const } : {};

  const command = firstString(raw.command, raw.cmd);
  const url = firstString(raw.url, raw.serverUrl, raw.httpUrl, raw.uri);
  // Remote entries carry an endpoint (and sometimes a type) instead of a command.
  if (!command && url) {
    const { names, values } = collectHeaders(raw, processEnv);
    return {
      name,
      client,
      source,
      transport: 'remote',
      url,
      envVarNames,
      ...(names.length ? { headerNames: names, headers: values } : {}),
      ...pinned,
    };
  }
  if (!command) return null;

  const args = Array.isArray(raw.args) ? raw.args.filter((a): a is string => typeof a === 'string') : [];
  const argv = [command, ...args];
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
    ...pinned,
  };
}

/**
 * Pull every server out of one parsed config document. `cwd` selects the
 * project scope in Claude Code's `~/.claude.json`, which keys per-project
 * servers by absolute directory.
 */
export function extractServers(
  doc: unknown,
  meta: { client: string; source: string; cwd?: string; env?: Record<string, string | undefined> },
): ConfiguredServer[] {
  return extractDeclaration(doc, meta).servers;
}

/** Goose extension types this file can launch; `builtin` and `platform` live inside goose itself. */
const GOOSE_LAUNCHABLE = new Set(['stdio', 'streamable_http']);

const stringList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

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
  meta: { client: string; source: string; cwd?: string; env?: Record<string, string | undefined> },
): { servers: ConfiguredServer[]; disabled: string[] } {
  if (!doc || typeof doc !== 'object') return { servers: [], disabled: [] };
  const d = doc as Record<string, unknown>;
  const out: ConfiguredServer[] = [];
  const off: string[] = [];
  const processEnv = meta.env ?? {};

  // Names a list elsewhere in the same file switches off: Gemini's
  // `mcp.excluded` ("Servers in this list will not be connected to"), and the
  // per-project `disabledMcpServers` Claude Code writes into `~/.claude.json`
  // when a server is toggled off in its /mcp panel (both read 2026-09-06).
  const listedOff = new Set<string>();
  const mcp = d.mcp;
  if (mcp && typeof mcp === 'object') for (const n of stringList((mcp as Record<string, unknown>).excluded)) listedOff.add(n);
  const project =
    meta.cwd && d.projects && typeof d.projects === 'object'
      ? ((d.projects as Record<string, unknown>)[meta.cwd] as Record<string, unknown> | undefined)
      : undefined;
  if (project && typeof project === 'object') for (const n of stringList(project.disabledMcpServers)) listedOff.add(n);

  const addBlock = (block: unknown, launchable: (raw: RawEntry) => boolean = () => true) => {
    if (!block || typeof block !== 'object') return;
    for (const [name, raw] of Object.entries(block as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as RawEntry;
      if (!launchable(entry)) continue;
      // Recorded before `toServer` drops it, which is the only difference this
      // can still see: an entry it returns null for because the person turned
      // it off, rather than because it is malformed or absent.
      if (entry.disabled === true || entry.enabled === false || listedOff.has(name)) {
        off.push(name);
        continue;
      }
      const s = toServer(name, entry, meta.client, meta.source, processEnv);
      if (s) out.push(s);
    }
  };

  addBlock(d.mcpServers);
  addBlock(d.servers); // VS Code
  // Zed: an `extension` entry is provided by an installed extension, and
  // nothing in this file says how to launch it.
  addBlock(d.context_servers, (raw) => raw.source !== 'extension');
  addBlock(d.mcp_servers); // Codex
  // Goose: only the two types that name a process or an endpoint are servers
  // this file can reach; `builtin` and `platform` are goose's own.
  addBlock(d.extensions, (raw) => typeof raw.type === 'string' && GOOSE_LAUNCHABLE.has(raw.type));
  if (project && typeof project === 'object') addBlock(project.mcpServers);

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
  /** How the file is written. Absent means JSON, with comments and trailing commas tolerated. */
  format?: 'json' | 'toml' | 'yaml';
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

  // Paths each client's own documentation gives, read 2026-09-06. Zed's user
  // settings path is documented for macOS and Linux only; Goose's Windows path
  // is under %APPDATA%\Block\goose. A project-level file is nominated wherever
  // the client documents one (Codex: trusted projects; Gemini, Zed, Kiro).
  const appData = env.appData ?? join(home, 'AppData', 'Roaming');
  const goose =
    platform === 'win32'
      ? join(appData, 'Block', 'goose', 'config', 'config.yaml')
      : join(home, '.config', 'goose', 'config.yaml');
  return [
    { client: 'claude-desktop', path: desktop },
    { client: 'claude-code', path: join(home, '.claude.json') },
    { client: 'claude-code', path: join(cwd, '.mcp.json') },
    { client: 'cursor', path: join(home, '.cursor', 'mcp.json') },
    { client: 'cursor', path: join(cwd, '.cursor', 'mcp.json') },
    { client: 'vscode', path: join(cwd, '.vscode', 'mcp.json') },
    { client: 'windsurf', path: join(home, '.codeium', 'windsurf', 'mcp_config.json') },
    { client: 'codex', path: join(home, '.codex', 'config.toml'), format: 'toml' },
    { client: 'codex', path: join(cwd, '.codex', 'config.toml'), format: 'toml' },
    { client: 'gemini', path: join(home, '.gemini', 'settings.json') },
    { client: 'gemini', path: join(cwd, '.gemini', 'settings.json') },
    ...(platform === 'win32' ? [] : [{ client: 'zed', path: join(home, '.config', 'zed', 'settings.json') }]),
    { client: 'zed', path: join(cwd, '.zed', 'settings.json') },
    { client: 'kiro', path: join(home, '.kiro', 'settings', 'mcp.json') },
    { client: 'kiro', path: join(cwd, '.kiro', 'settings', 'mcp.json') },
    { client: 'goose', path: goose, format: 'yaml' },
  ];
}

/** Parse one config file's text in the format its candidate declares. */
export function parseConfigText(text: string, format: ConfigCandidate['format'] = 'json'): unknown {
  if (format === 'toml') return parseToml(text);
  if (format === 'yaml') return parseYaml(text);
  return parseJsonc(text);
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
export function loadConfigs(
  candidates: ConfigCandidate[],
  cwd: string,
  processEnv: Record<string, string | undefined> = process.env,
): LoadedConfig[] {
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
      const doc = parseConfigText(readFileSync(c.path, 'utf8'), c.format);
      const { servers, disabled } = extractDeclaration(doc, { client: c.client, source: c.path, cwd, env: processEnv });
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
