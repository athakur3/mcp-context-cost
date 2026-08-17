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
  if (!doc || typeof doc !== 'object') return [];
  const d = doc as Record<string, unknown>;
  const out: ConfiguredServer[] = [];

  const addBlock = (block: unknown) => {
    if (!block || typeof block !== 'object') return;
    for (const [name, raw] of Object.entries(block as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
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
  return out.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)));
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
}

/** Read + parse the candidates that exist. Unreadable files are reported, not thrown. */
export function loadConfigs(candidates: ConfigCandidate[], cwd: string): LoadedConfig[] {
  const out: LoadedConfig[] = [];
  for (const c of candidates) {
    if (!existsSync(c.path)) continue;
    try {
      const doc = parseJsonc(readFileSync(c.path, 'utf8'));
      const servers = extractServers(doc, { client: c.client, source: c.path, cwd });
      // A config with no MCP block at all (e.g. a ~/.claude.json holding only
      // session history) is not worth a line in the report.
      if (servers.length === 0) continue;
      out.push({ client: c.client, source: c.path, servers });
    } catch (e) {
      out.push({ client: c.client, source: c.path, servers: [], error: (e as Error).message });
    }
  }
  return out;
}
