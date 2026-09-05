import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configCandidates, extractDeclaration, extractServers, loadConfigs, parseConfigText } from '../src/audit/config.js';

/**
 * Each fixture below is the shape the client's own documentation shows, read
 * 2026-09-06 (config.ts names the pages). A client whose page could not be
 * read first-hand is not here.
 */
const meta = (client: string, cwd?: string) => ({ client, source: `/${client}`, cwd });

describe('Codex CLI — ~/.codex/config.toml', () => {
  const toml = `
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
env_vars = ["LOCAL_TOKEN"]

[mcp_servers.context7.env]
MY_ENV_VAR = "MY_ENV_VALUE"

[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN"
http_headers = { "X-Figma-Region" = "us-east-1" }
env_http_headers = { "X-Org" = "FIGMA_ORG" }

[mcp_servers.off]
command = "node"
args = ["off.js"]
enabled = false
`;

  it('reads a stdio server from its table, with the env sub-table', () => {
    const s = extractServers(parseConfigText(toml, 'toml'), meta('codex')).find((x) => x.name === 'context7')!;
    expect(s).toMatchObject({ transport: 'stdio', argv: ['npx', '-y', '@upstash/context7-mcp'], envVarNames: ['MY_ENV_VAR'] });
    expect(s.env).toEqual({ MY_ENV_VAR: 'MY_ENV_VALUE' });
  });

  it('reads a streamable-HTTP server, naming every header the entry would send', () => {
    const s = extractServers(parseConfigText(toml, 'toml'), meta('codex')).find((x) => x.name === 'figma')!;
    expect(s).toMatchObject({ transport: 'remote', url: 'https://mcp.figma.com/mcp' });
    expect(s.headerNames).toEqual(['Authorization', 'X-Figma-Region', 'X-Org']);
    // No process env given: the names are the config's, the values it cannot see are absent.
    expect(s.headers).toEqual({ 'X-Figma-Region': 'us-east-1' });
  });

  it('takes the bearer token and env-sourced headers from the environment by name', () => {
    const env = { FIGMA_OAUTH_TOKEN: 'tok-123', FIGMA_ORG: 'acme' };
    const s = extractServers(parseConfigText(toml, 'toml'), { ...meta('codex'), env }).find((x) => x.name === 'figma')!;
    expect(s.headers).toEqual({ Authorization: 'Bearer tok-123', 'X-Figma-Region': 'us-east-1', 'X-Org': 'acme' });
  });

  it('treats enabled = false as switched off, in the file\'s own words', () => {
    const d = extractDeclaration(parseConfigText(toml, 'toml'), meta('codex'));
    expect(d.servers.map((s) => s.name).sort()).toEqual(['context7', 'figma']);
    expect(d.disabled).toEqual(['off']);
  });
});

describe('Gemini CLI — ~/.gemini/settings.json', () => {
  const doc = {
    mcp: { excluded: ['gone'] },
    mcpServers: {
      py: { command: 'python', args: ['-m', 'my_mcp_server'], cwd: './s', env: { DATABASE_URL: '$DB' }, timeout: 15000 },
      sse: { url: 'https://x/sse' },
      http: { httpUrl: 'https://x/mcp', headers: { Authorization: 'Bearer t' } },
      gone: { command: 'node', args: ['gone.js'] },
    },
  };

  it('reads command, url (SSE) and httpUrl (streamable HTTP) entries', () => {
    const s = extractServers(doc, meta('gemini'));
    expect(s.find((x) => x.name === 'py')).toMatchObject({ transport: 'stdio', argv: ['python', '-m', 'my_mcp_server'], envVarNames: ['DATABASE_URL'] });
    expect(s.find((x) => x.name === 'sse')).toMatchObject({ transport: 'remote', url: 'https://x/sse' });
    expect(s.find((x) => x.name === 'http')).toMatchObject({ transport: 'remote', url: 'https://x/mcp', headerNames: ['Authorization'] });
  });

  it('honours mcp.excluded as switched off', () => {
    const d = extractDeclaration(doc, meta('gemini'));
    expect(d.servers.map((s) => s.name)).not.toContain('gone');
    expect(d.disabled).toEqual(['gone']);
  });
});

describe('Zed — context_servers in settings.json', () => {
  const text = `// ~/.config/zed/settings.json
{
  "theme": "cave-light",
  "context_servers": {
    "local-mcp-server": { "command": "some-command", "args": ["arg-1", "arg-2"], "env": {} },
    "remote-mcp-server": { "url": "https://example.com/mcp", "headers": { "Authorization": "Bearer <token>" } },
    "remote-mcp-server-with-oauth": { "url": "https://mcp.example.com/mcp" },
    "from-extension": { "source": "extension", "settings": {} },
  },
}`;

  it('reads local and remote entries from a settings file that carries comments and trailing commas', () => {
    const s = extractServers(parseConfigText(text), meta('zed'));
    expect(s.map((x) => x.name)).toEqual(['local-mcp-server', 'remote-mcp-server', 'remote-mcp-server-with-oauth']);
    expect(s[0]).toMatchObject({ transport: 'stdio', argv: ['some-command', 'arg-1', 'arg-2'] });
    expect(s[1]).toMatchObject({ transport: 'remote', url: 'https://example.com/mcp', headerNames: ['Authorization'] });
  });

  it('leaves an extension-provided server alone: nothing in the file says how to launch it', () => {
    const d = extractDeclaration(parseConfigText(text), meta('zed'));
    expect(d.servers.map((s) => s.name)).not.toContain('from-extension');
    expect(d.disabled).toEqual([]);
  });
});

describe('Kiro — ~/.kiro/settings/mcp.json', () => {
  const doc = {
    mcpServers: {
      'local-server-name': { command: 'command-to-run-server', args: ['arg1'], env: { ENV_VAR1: 'v' }, disabled: false, autoApprove: ['t'], disabledTools: ['x'] },
      'remote-server-name': { url: 'https://endpoint.to.connect.to', headers: { HEADER1: 'value1' }, disabled: false },
      off: { command: 'x', disabled: true },
    },
  };
  it('reads both documented shapes and the disabled switch', () => {
    const d = extractDeclaration(doc, meta('kiro'));
    expect(d.servers.find((s) => s.name === 'local-server-name')).toMatchObject({ transport: 'stdio', envVarNames: ['ENV_VAR1'] });
    expect(d.servers.find((s) => s.name === 'remote-server-name')).toMatchObject({ transport: 'remote', url: 'https://endpoint.to.connect.to', headerNames: ['HEADER1'] });
    expect(d.disabled).toEqual(['off']);
  });
});

describe('Goose — ~/.config/goose/config.yaml', () => {
  const yaml = `
extensions:
  developer:
    type: builtin
    name: developer
    enabled: true
    timeout: 300
  filesystem:
    type: stdio
    name: filesystem
    enabled: true
    cmd: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    env_keys: []
    envs: { HOME_DIR: "/tmp" }
    timeout: 300
  remote-tools:
    type: streamable_http
    name: remote-tools
    enabled: true
    uri: "https://example.com/mcp"
    headers: { "X-Key": "k" }
  old:
    type: stdio
    name: old
    enabled: false
    cmd: node
`;
  it('reads stdio (cmd, envs) and streamable_http (uri) extensions and nothing goose provides itself', () => {
    const d = extractDeclaration(parseConfigText(yaml, 'yaml'), meta('goose'));
    expect(d.servers.map((s) => s.name)).toEqual(['filesystem', 'remote-tools']);
    expect(d.servers[0]).toMatchObject({ transport: 'stdio', argv: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '/tmp'], envVarNames: ['HOME_DIR'] });
    expect(d.servers[1]).toMatchObject({ transport: 'remote', url: 'https://example.com/mcp', headerNames: ['X-Key'] });
    expect(d.disabled).toEqual(['old']);
  });
});

describe('Windsurf — a remote is spelled serverUrl', () => {
  it('reads it as the remote it is, rather than dropping the entry', () => {
    const s = extractServers({ mcpServers: { r: { serverUrl: 'https://x/mcp', headers: { API_KEY: 'v' } } } }, meta('windsurf'));
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ transport: 'remote', url: 'https://x/mcp', headerNames: ['API_KEY'] });
  });
});

describe('Claude Code — what its own file adds', () => {
  it('reads alwaysLoad from the entry, on either transport', () => {
    const s = extractServers(
      { mcpServers: { core: { type: 'http', url: 'https://x/mcp', alwaysLoad: true }, fs: { command: 'node', args: ['fs.js'], alwaysLoad: true }, plain: { command: 'node' } } },
      meta('claude-code'),
    );
    expect(s.map((x) => [x.name, x.alwaysLoad ?? null])).toEqual([['core', true], ['fs', true], ['plain', null]]);
  });

  it('honours the project\'s disabledMcpServers list in ~/.claude.json', () => {
    const doc = {
      mcpServers: { a: { command: 'node', args: ['a.js'] }, b: { command: 'node', args: ['b.js'] } },
      projects: { '/proj': { mcpServers: { c: { command: 'node', args: ['c.js'] } }, disabledMcpServers: ['a', 'c'] } },
    };
    const d = extractDeclaration(doc, meta('claude-code', '/proj'));
    expect(d.servers.map((s) => s.name)).toEqual(['b']);
    expect(d.disabled).toEqual(['a', 'c']);
    // Another project's list says nothing about this one.
    expect(extractDeclaration(doc, meta('claude-code', '/other')).servers.map((s) => s.name)).toEqual(['a', 'b']);
  });
});

describe('configCandidates — where each client documents its file', () => {
  it('nominates the documented paths on macOS and Linux, with the format each is written in', () => {
    const mac = configCandidates({ home: '/Users/me', cwd: '/proj', platform: 'darwin' });
    const byClient = (c: string) => mac.filter((x) => x.client === c).map((x) => `${x.path}${x.format ? ` (${x.format})` : ''}`);
    expect(byClient('codex')).toEqual(['/Users/me/.codex/config.toml (toml)', '/proj/.codex/config.toml (toml)']);
    expect(byClient('gemini')).toEqual(['/Users/me/.gemini/settings.json', '/proj/.gemini/settings.json']);
    expect(byClient('zed')).toEqual(['/Users/me/.config/zed/settings.json', '/proj/.zed/settings.json']);
    expect(byClient('kiro')).toEqual(['/Users/me/.kiro/settings/mcp.json', '/proj/.kiro/settings/mcp.json']);
    expect(byClient('goose')).toEqual(['/Users/me/.config/goose/config.yaml (yaml)']);
  });

  it("uses Goose's documented %APPDATA% path on Windows, and nominates no Zed user file there", () => {
    const win = configCandidates({ home: 'C:\\Users\\me', cwd: 'C:\\proj', platform: 'win32', appData: 'C:\\Users\\me\\AppData\\Roaming' });
    expect(win.find((c) => c.client === 'goose')?.path).toBe(join('C:\\Users\\me\\AppData\\Roaming', 'Block', 'goose', 'config', 'config.yaml'));
    expect(win.filter((c) => c.client === 'zed').map((c) => c.path)).toEqual([join('C:\\proj', '.zed', 'settings.json')]);
  });
});

describe('loadConfigs — the format follows the candidate', () => {
  it('parses TOML and YAML files by their declared format, and reports one that does not parse', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-audit-formats-'));
    writeFileSync(join(dir, 'config.toml'), '[mcp_servers.a]\ncommand = "node"\nargs = ["a.js"]\n');
    writeFileSync(join(dir, 'config.yaml'), 'extensions:\n  b:\n    type: stdio\n    cmd: node\n    args: ["b.js"]\n');
    writeFileSync(join(dir, 'broken.toml'), '[mcp_servers.a\ncommand = 1\n');
    const loaded = loadConfigs(
      [
        { client: 'codex', path: join(dir, 'config.toml'), format: 'toml' },
        { client: 'goose', path: join(dir, 'config.yaml'), format: 'yaml' },
        { client: 'codex', path: join(dir, 'broken.toml'), format: 'toml' },
      ],
      dir,
      {},
    );
    expect(loaded[0].servers.map((s) => s.argv)).toEqual([['node', 'a.js']]);
    expect(loaded[1].servers.map((s) => s.argv)).toEqual([['node', 'b.js']]);
    expect(loaded[2].error).toMatch(/TOML/i);
  });
});
