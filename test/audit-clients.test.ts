import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTempRoot } from './tmp.js';
import {
  configCandidates,
  extractDeclaration,
  extractServers,
  loadConfigs,
  parseConfigText,
} from '../src/audit/config.js';
import { evaluateDeferral } from '../src/audit/deferral.js';
import { DEFAULT_CONTEXT_WINDOW, buildReport, formatReport } from '../src/audit/audit.js';

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
    const s = extractServers(parseConfigText(toml, 'toml'), meta('codex')).find(
      (x) => x.name === 'context7',
    )!;
    expect(s).toMatchObject({
      transport: 'stdio',
      argv: ['npx', '-y', '@upstash/context7-mcp'],
      envVarNames: ['MY_ENV_VAR'],
    });
    expect(s.env).toEqual({ MY_ENV_VAR: 'MY_ENV_VALUE' });
  });

  it('reads a streamable-HTTP server, naming every header the entry would send', () => {
    const s = extractServers(parseConfigText(toml, 'toml'), meta('codex')).find(
      (x) => x.name === 'figma',
    )!;
    expect(s).toMatchObject({ transport: 'remote', url: 'https://mcp.figma.com/mcp' });
    expect(s.headerNames).toEqual(['Authorization', 'X-Figma-Region', 'X-Org']);
    // No process env given: the names are the config's, the values it cannot see are absent.
    expect(s.headers).toEqual({ 'X-Figma-Region': 'us-east-1' });
  });

  it('takes the bearer token and env-sourced headers from the environment by name', () => {
    const env = { FIGMA_OAUTH_TOKEN: 'tok-123', FIGMA_ORG: 'acme' };
    const s = extractServers(parseConfigText(toml, 'toml'), { ...meta('codex'), env }).find(
      (x) => x.name === 'figma',
    )!;
    expect(s.headers).toEqual({
      Authorization: 'Bearer tok-123',
      'X-Figma-Region': 'us-east-1',
      'X-Org': 'acme',
    });
  });

  it("treats enabled = false as switched off, in the file's own words", () => {
    const d = extractDeclaration(parseConfigText(toml, 'toml'), meta('codex'));
    expect(d.servers.map((s) => s.name).toSorted()).toEqual(['context7', 'figma']);
    expect(d.disabled).toEqual(['off']);
  });
});

describe('Gemini CLI — ~/.gemini/settings.json', () => {
  const doc = {
    mcp: { excluded: ['gone'] },
    mcpServers: {
      py: {
        command: 'python',
        args: ['-m', 'my_mcp_server'],
        cwd: './s',
        env: { DATABASE_URL: '$DB' },
        timeout: 15000,
      },
      sse: { url: 'https://x/sse' },
      http: { httpUrl: 'https://x/mcp', headers: { Authorization: 'Bearer t' } },
      gone: { command: 'node', args: ['gone.js'] },
    },
  };

  it('reads command, url (SSE) and httpUrl (streamable HTTP) entries', () => {
    const s = extractServers(doc, meta('gemini'));
    expect(s.find((x) => x.name === 'py')).toMatchObject({
      transport: 'stdio',
      argv: ['python', '-m', 'my_mcp_server'],
      envVarNames: ['DATABASE_URL'],
    });
    expect(s.find((x) => x.name === 'sse')).toMatchObject({
      transport: 'remote',
      url: 'https://x/sse',
    });
    expect(s.find((x) => x.name === 'http')).toMatchObject({
      transport: 'remote',
      url: 'https://x/mcp',
      headerNames: ['Authorization'],
    });
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
    expect(s.map((x) => x.name)).toEqual([
      'local-mcp-server',
      'remote-mcp-server',
      'remote-mcp-server-with-oauth',
    ]);
    expect(s[0]).toMatchObject({ transport: 'stdio', argv: ['some-command', 'arg-1', 'arg-2'] });
    expect(s[1]).toMatchObject({
      transport: 'remote',
      url: 'https://example.com/mcp',
      headerNames: ['Authorization'],
    });
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
      'local-server-name': {
        command: 'command-to-run-server',
        args: ['arg1'],
        env: { ENV_VAR1: 'v' },
        disabled: false,
        autoApprove: ['t'],
        disabledTools: ['x'],
      },
      'remote-server-name': {
        url: 'https://endpoint.to.connect.to',
        headers: { HEADER1: 'value1' },
        disabled: false,
      },
      off: { command: 'x', disabled: true },
    },
  };
  it('reads both documented shapes and the disabled switch', () => {
    const d = extractDeclaration(doc, meta('kiro'));
    expect(d.servers.find((s) => s.name === 'local-server-name')).toMatchObject({
      transport: 'stdio',
      envVarNames: ['ENV_VAR1'],
    });
    expect(d.servers.find((s) => s.name === 'remote-server-name')).toMatchObject({
      transport: 'remote',
      url: 'https://endpoint.to.connect.to',
      headerNames: ['HEADER1'],
    });
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
    expect(d.servers[0]).toMatchObject({
      transport: 'stdio',
      argv: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      envVarNames: ['HOME_DIR'],
    });
    expect(d.servers[1]).toMatchObject({
      transport: 'remote',
      url: 'https://example.com/mcp',
      headerNames: ['X-Key'],
    });
    expect(d.disabled).toEqual(['old']);
  });
});

describe('Windsurf — a remote is spelled serverUrl', () => {
  it('reads it as the remote it is, rather than dropping the entry', () => {
    const s = extractServers(
      { mcpServers: { r: { serverUrl: 'https://x/mcp', headers: { API_KEY: 'v' } } } },
      meta('windsurf'),
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      transport: 'remote',
      url: 'https://x/mcp',
      headerNames: ['API_KEY'],
    });
  });
});

describe('Claude Code — what its own file adds', () => {
  it('reads alwaysLoad from the entry, on either transport', () => {
    const s = extractServers(
      {
        mcpServers: {
          core: { type: 'http', url: 'https://x/mcp', alwaysLoad: true },
          fs: { command: 'node', args: ['fs.js'], alwaysLoad: true },
          plain: { command: 'node' },
        },
      },
      meta('claude-code'),
    );
    expect(s.map((x) => [x.name, x.alwaysLoad ?? null])).toEqual([
      ['core', true],
      ['fs', true],
      ['plain', null],
    ]);
  });

  it("honours the project's disabledMcpServers list in ~/.claude.json", () => {
    const doc = {
      mcpServers: {
        a: { command: 'node', args: ['a.js'] },
        b: { command: 'node', args: ['b.js'] },
      },
      projects: {
        '/proj': {
          mcpServers: { c: { command: 'node', args: ['c.js'] } },
          disabledMcpServers: ['a', 'c'],
        },
      },
    };
    const d = extractDeclaration(doc, meta('claude-code', '/proj'));
    expect(d.servers.map((s) => s.name)).toEqual(['b']);
    expect(d.disabled).toEqual(['a', 'c']);
    // Another project's list says nothing about this one.
    expect(
      extractDeclaration(doc, meta('claude-code', '/other')).servers.map((s) => s.name),
    ).toEqual(['a', 'b']);
  });
});

describe('configCandidates — where each client documents its file', () => {
  it('nominates the documented paths on macOS and Linux, with the format each is written in', () => {
    const mac = configCandidates({ home: '/Users/me', cwd: '/proj', platform: 'darwin' });
    const byClient = (c: string) =>
      mac.filter((x) => x.client === c).map((x) => `${x.path}${x.format ? ` (${x.format})` : ''}`);
    expect(byClient('codex')).toEqual([
      '/Users/me/.codex/config.toml (toml)',
      '/proj/.codex/config.toml (toml)',
    ]);
    expect(byClient('gemini')).toEqual([
      '/Users/me/.gemini/settings.json',
      '/proj/.gemini/settings.json',
    ]);
    expect(byClient('zed')).toEqual([
      '/Users/me/.config/zed/settings.json',
      '/proj/.zed/settings.json',
    ]);
    expect(byClient('kiro')).toEqual([
      '/Users/me/.kiro/settings/mcp.json',
      '/proj/.kiro/settings/mcp.json',
    ]);
    expect(byClient('goose')).toEqual(['/Users/me/.config/goose/config.yaml (yaml)']);
  });

  it("uses Goose's documented %APPDATA% path on Windows, and nominates no Zed user file there", () => {
    const win = configCandidates({
      home: 'C:\\Users\\me',
      cwd: 'C:\\proj',
      platform: 'win32',
      appData: 'C:\\Users\\me\\AppData\\Roaming',
    });
    expect(win.find((c) => c.client === 'goose')?.path).toBe(
      join('C:\\Users\\me\\AppData\\Roaming', 'Block', 'goose', 'config', 'config.yaml'),
    );
    expect(win.filter((c) => c.client === 'zed').map((c) => c.path)).toEqual([
      join('C:\\proj', '.zed', 'settings.json'),
    ]);
  });
});

describe('loadConfigs — the format follows the candidate', () => {
  const tmpDirs: string[] = [];
  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) removeTempRoot(dir);
  });

  it('parses TOML and YAML files by their declared format, and reports one that does not parse', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-audit-formats-'));
    tmpDirs.push(dir);
    writeFileSync(join(dir, 'config.toml'), '[mcp_servers.a]\ncommand = "node"\nargs = ["a.js"]\n');
    writeFileSync(
      join(dir, 'config.yaml'),
      'extensions:\n  b:\n    type: stdio\n    cmd: node\n    args: ["b.js"]\n',
    );
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

/**
 * What this project holds about each discovered client's deferral, and where it
 * got it.
 *
 * Until 2026-09-07 the rule that decided this read one surface per client — the
 * client's own MCP configuration page — and printed "no default deferral is on
 * record" for every client whose page did not mention deferring. Cursor's page
 * did not, and does not; Cursor's engineering blog had described the mechanism
 * eight months earlier, and its staff repeated it on Cursor's own forum. So the
 * absence being printed was an absence in one place, reported as an absence
 * everywhere, for three of the nine clients here.
 *
 * These check the property that failure had: that every client this tool
 * discovers has been decided, that the three with a record are not printed as
 * having none, and that a record cannot quietly become a verdict — it has to
 * carry dated sources and name what it leaves open.
 */
describe('each discovered client has a deferral answer, and it is the right kind', () => {
  const CFG = '/machine/cfg.json';
  const verdict = (client: string) =>
    evaluateDeferral(
      {
        client,
        sources: [CFG],
        servers: [{ name: 'a', tokens: 5_000 }],
        skippedCount: 0,
        sharedMeasurements: 0,
      },
      { contextWindow: DEFAULT_CONTEXT_WINDOW },
    );
  const rendered = (client: string) =>
    formatReport(
      buildReport(
        [
          {
            client,
            source: CFG,
            servers: [
              {
                name: 'a',
                client,
                source: CFG,
                transport: 'stdio',
                command: 'node a.js',
                argv: ['node', 'a.js'],
                envVarNames: [],
              },
            ],
          },
        ],
        new Map(),
        { generatedAt: 'T' },
      ),
    ).replace(/\s+/g, ' ');

  /** Every client id `configCandidates` can hand the report, on any platform. */
  const discovered = [
    ...new Set(
      (['darwin', 'linux', 'win32'] as const).flatMap((platform) =>
        configCandidates({ home: '/home/me', cwd: '/proj', platform, appData: 'C:\\AppData' }).map(
          (c) => c.client,
        ),
      ),
    ),
  ];

  it('decides every client it discovers — a new one cannot arrive undecided', () => {
    expect(discovered.length).toBeGreaterThan(8);
    for (const client of discovered) {
      expect(
        verdict(client).mode,
        `${client} is discovered but no deferral rule covers it`,
      ).not.toBe('client-unknown');
    }
  });

  it('does not print an absence of a record for the three clients that have one', () => {
    for (const client of ['cursor', 'codex', 'vscode']) {
      const v = verdict(client);
      expect(v.mode, `${client}'s vendor is on record as deferring`).toBe('deferral-on-record');
      const out = rendered(client);
      expect(out, `${client} is still printed as an absence of a record`).not.toContain(
        'No default deferral is on record',
      );
      expect(out).not.toContain('an absence of a record about the client');
      expect(out).toContain('What the vendor is on record with, and when it was read:');
    }
  });

  it('says a default is on record only for the two clients whose vendors state one', () => {
    // VS Code is the third client with a record and the one without a stated
    // default: what its vendor publishes is a cap and a threshold, and what its
    // source shows is a setting whose reach is not established. Printing it in
    // the same words as Cursor and Codex would make a verdict out of it.
    for (const client of ['cursor', 'codex']) {
      expect(rendered(client)).toContain(
        `${client} is on record as deferring MCP tool definitions`,
      );
    }
    const vscode = rendered('vscode');
    expect(vscode).not.toContain('vscode is on record as deferring MCP tool definitions');
    expect(vscode).toContain('a record of them rather than a verdict about your session');
  });

  it('still prints an absence of a record where there is one', () => {
    for (const client of ['claude-desktop', 'windsurf', 'gemini', 'zed', 'kiro', 'goose']) {
      expect(verdict(client).mode).toBe('no-deferral-on-record');
      expect(rendered(client)).toContain(`No default deferral is on record for ${client}`);
    }
  });

  it('carries dated first-party sources for each record, and prints all of them', () => {
    for (const client of ['cursor', 'codex', 'vscode']) {
      const r = verdict(client).record!;
      expect(r, `${client} has no record`).toBeTruthy();
      expect(r.sources.length, `${client}'s record cites fewer than two sources`).toBeGreaterThan(
        1,
      );
      for (const source of r.sources) {
        // A source without a date is a claim that cannot be re-checked later,
        // which is the shape of claim this whole section exists to refuse.
        expect(source, `a source for ${client} carries no date: ${source}`).toMatch(
          /20\d\d-\d\d-\d\d/,
        );
      }
      const out = rendered(client);
      for (const source of r.sources)
        expect(out, `${client} does not print ${source}`).toContain(source.slice(0, 40));
    }
  });

  it('never lets a record stand as a verdict: each names what it leaves open, and claims no side', () => {
    for (const client of ['cursor', 'codex', 'vscode']) {
      const v = verdict(client);
      expect(
        v.record!.conditions.length,
        `${client}'s record resolves into a verdict`,
      ).toBeGreaterThan(0);
      expect(v.crosses, `${client} is put on a side of a threshold it has none of`).toBeNull();
      expect(v.thresholdTokens).toBeNull();
      expect(
        v.setting,
        `${client}'s posture cannot be read from a machine this audit reads`,
      ).toBeNull();
      const out = rendered(client);
      expect(out).toContain('not as a bill every request is known to carry');
    }
  });

  it("names VS Code's record as conditions rather than a default", () => {
    const r = verdict('vscode').record!;
    expect(r.states.join(' ')).toContain('record of them rather than a verdict');
    expect(r.conditions.join(' ')).toContain('128 tools');
    expect(r.conditions.join(' ')).toContain('is not established here');
  });

  it("says where Codex's and Cursor's posture cannot be read from, since neither config states it", () => {
    expect(verdict('codex').record!.notReadable.join(' ')).toContain(
      'config.toml carries no switch',
    );
    expect(verdict('cursor').record!.notReadable.join(' ')).toContain(
      'No Cursor setting on record turns this on or off',
    );
    expect(verdict('vscode').record!.notReadable.join(' ')).toContain('.vscode/mcp.json');
  });

  it('refuses rather than falls through when the mode arrives without its record', () => {
    // Everything this branch prints is quotation, so a record that did not
    // arrive is not a milder answer — it is none. The alternative is worse than
    // silence: the next branch is Claude Code's threshold arithmetic, which
    // would be printed over a client that has no threshold at all.
    const report = buildReport(
      [
        {
          client: 'cursor',
          source: CFG,
          servers: [
            {
              name: 'a',
              client: 'cursor',
              source: CFG,
              transport: 'stdio',
              command: 'node a.js',
              argv: ['node', 'a.js'],
              envVarNames: [],
            },
          ],
        },
      ],
      new Map(),
      { generatedAt: 'T' },
    );
    report.configs[0].deferral = { ...report.configs[0].deferral, record: null };
    const out = formatReport(report).replace(/\s+/g, ' ');
    expect(out).toContain('the record itself did not reach this report');
    expect(out).not.toContain('defers tool definitions above a threshold');
  });

  it('keeps the measurement itself unconditional — a record changes who pays, never the count', () => {
    for (const client of ['cursor', 'claude-desktop']) {
      expect(rendered(client)).toContain('tokens of tool schemas');
    }
  });
});
