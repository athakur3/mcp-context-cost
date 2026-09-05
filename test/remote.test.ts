import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeRemote } from '../src/audit/remote.js';
import { buildReport, formatReport, serverKey } from '../src/audit/audit.js';
import { bridgeLaunch, probeRemotes } from '../src/audit/run.js';
import type { ConfiguredServer, LoadedConfig } from '../src/audit/config.js';
import { measureTools } from '../src/core/canonical.js';
import { TSX_CLI } from './tsx.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// Async, deliberately: the endpoint the CLI under test probes is served by this
// process, and a synchronous spawn would block the loop that has to answer it.
const execFileAsync = promisify(execFile);
const tools = JSON.parse(readFileSync(join(repoRoot, 'spec/fixtures/tools-basic.json'), 'utf8'));

/**
 * One local endpoint per way a remote can answer — the shapes probed on the
 * public endpoints on 2026-09-06 (remote.ts), replayed here so the suite
 * reaches no network.
 */
const WALL = 'Bearer realm="OAuth", resource_metadata="http://127.0.0.1/.well-known/oauth-protected-resource"';
function endpoint(req: IncomingMessage, res: ServerResponse): void {
  const path = (req.url ?? '/').split('?')[0];
  const sse = () => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('event: endpoint\ndata: /messages\n\n');
    req.on('close', () => res.end());
  };
  switch (path) {
    case '/walled':
      res.writeHead(401, { 'content-type': 'application/json', 'www-authenticate': WALL });
      return void res.end('{"error":"invalid_token"}');
    case '/forbidden':
      res.writeHead(403, { 'content-type': 'text/plain' });
      return void res.end('no');
    case '/open':
      if (req.method !== 'POST') {
        res.writeHead(405);
        return void res.end();
      }
      res.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'abc' });
      return void res.end('{"jsonrpc":"2.0","id":1,"result":{}}');
    case '/sse-only':
      if (req.method === 'POST') {
        res.writeHead(405);
        return void res.end();
      }
      return sse();
    case '/stream':
      return sse();
    case '/html':
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end('<h1>sign in</h1>');
    case '/echo-auth':
      if (req.headers.authorization === 'Bearer sekrit-token-value') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return void res.end('{}');
      }
      res.writeHead(401, { 'www-authenticate': 'Bearer' });
      return void res.end();
    case '/slow':
      req.on('close', () => res.end());
      return;
    default:
      res.writeHead(404, { 'content-type': 'text/plain' });
      return void res.end('not found');
  }
}

let server: Server;
let base = '';
beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = createServer(endpoint);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        base = typeof addr === 'object' && addr ? `http://127.0.0.1:${addr.port}` : '';
        resolve();
      });
    }),
);
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('probeRemote — the endpoint answers for itself', () => {
  it('reads a 401 with WWW-Authenticate as a wall, and quotes the header', async () => {
    const p = await probeRemote(`${base}/walled`);
    expect(p.kind).toBe('auth-walled');
    expect(p.status).toBe(401);
    expect(p.wwwAuthenticate).toBe(WALL);
    expect(p.detail).toBe(`HTTP 401 — WWW-Authenticate: ${WALL}`);
  });

  it('reads a bare 403 as a wall too, with nothing invented for the missing header', async () => {
    const p = await probeRemote(`${base}/forbidden`);
    expect(p).toEqual({ kind: 'auth-walled', status: 403, detail: 'HTTP 403' });
  });

  it('reads a JSON-RPC answer to initialize as open', async () => {
    const p = await probeRemote(`${base}/open`);
    expect(p).toEqual({ kind: 'open', status: 200, detail: 'HTTP 200 application/json' });
  });

  it('asks an SSE endpoint that refuses POST the way it expects, and reads the stream as open', async () => {
    const p = await probeRemote(`${base}/sse-only`);
    expect(p).toEqual({ kind: 'open', status: 200, detail: 'HTTP 200 text/event-stream' });
  });

  it('does not call an HTML page at the address an MCP endpoint', async () => {
    const p = await probeRemote(`${base}/html`);
    expect(p.kind).toBe('unreachable');
    expect(p.detail).toBe('HTTP 200 with text/html, which is not an MCP response');
  });

  it('reports a 404 on both requests as unreachable, with the status', async () => {
    const p = await probeRemote(`${base}/gone`);
    expect(p).toEqual({ kind: 'unreachable', status: 404, detail: 'HTTP 404' });
  });

  it('reports a refused connection by its code', async () => {
    const closed = createServer(() => {});
    const port = await new Promise<number>((resolve) => {
      closed.listen(0, '127.0.0.1', () => {
        const addr = closed.address();
        const p = typeof addr === 'object' && addr ? addr.port : 0;
        closed.close(() => resolve(p));
      });
    });
    const p = await probeRemote(`http://127.0.0.1:${port}/mcp`);
    expect(p.kind).toBe('unreachable');
    expect(p.detail).toBe('ECONNREFUSED');
  });

  it('gives up after the timeout it was given, and says so in milliseconds', async () => {
    const p = await probeRemote(`${base}/slow`, { timeoutMs: 300 });
    expect(p).toEqual({ kind: 'unreachable', detail: 'no answer within 300ms' });
  });

  it('sends the headers an entry carries, so a static token opens what it opens', async () => {
    expect((await probeRemote(`${base}/echo-auth`)).kind).toBe('auth-walled');
    const withToken = await probeRemote(`${base}/echo-auth`, { headers: { Authorization: 'Bearer sekrit-token-value' } });
    expect(withToken.kind).toBe('open');
  });
});

const remote = (name: string, url: string, extra: Partial<ConfiguredServer> = {}): ConfiguredServer => ({
  name,
  client: 'cursor',
  source: '/cfg.json',
  transport: 'remote',
  url,
  envVarNames: [],
  ...extra,
});

describe('probeRemotes — once per endpoint, keyed like the measurements', () => {
  it('probes each distinct url once and keys the answer by serverKey', async () => {
    const a = remote('a', `${base}/walled`);
    const twin = { ...remote('twin', `${base}/walled`), client: 'claude-code', source: '/other.json' };
    const b = remote('b', `${base}/open`);
    const configs: LoadedConfig[] = [
      { client: 'cursor', source: '/cfg.json', servers: [a, b] },
      { client: 'claude-code', source: '/other.json', servers: [twin] },
    ];
    const probes = await probeRemotes(configs);
    expect([...probes.keys()].sort()).toEqual([serverKey(a), serverKey(b)].sort());
    expect(probes.get(serverKey(a))?.kind).toBe('auth-walled');
    expect(probes.get(serverKey(b))?.kind).toBe('open');
  });
});

describe('bridgeLaunch — what an open endpoint is measured through', () => {
  it('is the mcp-remote bridge, allowing plain http only when the url is http', () => {
    expect(bridgeLaunch(remote('x', 'https://mcp.example/mcp')).argv).toEqual(['npx', '-y', 'mcp-remote', 'https://mcp.example/mcp']);
    expect(bridgeLaunch(remote('x', 'http://127.0.0.1:3001/mcp')).argv).toEqual([
      'npx',
      '-y',
      'mcp-remote',
      'http://127.0.0.1:3001/mcp',
      '--allow-http',
    ]);
  });

  it('carries header values in argv and in the shell line, and names only in the display form', () => {
    const l = bridgeLaunch(remote('x', 'https://mcp.example/mcp', { headerNames: ['Authorization'], headers: { Authorization: "Bearer it's-secret" } }));
    expect(l.argv).toEqual(['npx', '-y', 'mcp-remote', 'https://mcp.example/mcp', '--header', "Authorization: Bearer it's-secret"]);
    expect(l.command).toBe(`npx -y mcp-remote https://mcp.example/mcp --header 'Authorization: Bearer it'\\''s-secret'`);
    expect(l.display).toBe('npx -y mcp-remote https://mcp.example/mcp --header Authorization');
    expect(l.display).not.toContain('secret');
  });
});

describe('buildReport — a remote entry is what its endpoint said', () => {
  const cfg = (servers: ConfiguredServer[]): LoadedConfig[] => [{ client: 'cursor', source: '/cfg.json', servers }];
  const measurement = (name: string) => measureTools(tools, { serverName: name });

  it('reports a walled endpoint as auth-walled, in the server\'s own words, with the url', () => {
    const linear = remote('linear', 'https://mcp.linear.app/mcp');
    const remotes = new Map([[serverKey(linear), { kind: 'auth-walled' as const, status: 401, wwwAuthenticate: WALL, detail: `HTTP 401 — WWW-Authenticate: ${WALL}` }]]);
    const r = buildReport(cfg([linear]), new Map(), { generatedAt: 'T', remotes });
    const row = r.configs[0].skipped[0];
    expect(row).toMatchObject({ name: 'linear', transport: 'remote', status: 'auth-walled', url: 'https://mcp.linear.app/mcp', tokens: null });
    expect(row.notes).toContain('https://mcp.linear.app/mcp answered HTTP 401 — WWW-Authenticate: Bearer realm="OAuth"');
    expect(row.notes).toContain('credential this audit does not hold');
    expect(r.configs[0].totalTokens).toBe(0);
    expect(formatReport(r)).toContain('auth-walled');
  });

  it('reports an endpoint that gave no MCP answer as unreachable, with the reason', () => {
    const gone = remote('gone', 'https://mcp.example/sse');
    const remotes = new Map([[serverKey(gone), { kind: 'unreachable' as const, detail: 'ENOTFOUND' }]]);
    const r = buildReport(cfg([gone]), new Map(), { generatedAt: 'T', remotes });
    expect(r.configs[0].skipped[0]).toMatchObject({ status: 'unreachable', notes: 'https://mcp.example/sse: ENOTFOUND' });
  });

  it('counts an open endpoint measured through the bridge in the total, as a remote', () => {
    const wiki = remote('wiki', 'https://mcp.deepwiki.com/mcp');
    const remotes = new Map([[serverKey(wiki), { kind: 'open' as const, status: 200, detail: 'HTTP 200 text/event-stream' }]]);
    const measured = new Map([[serverKey(wiki), measurement('wiki')]]);
    const r = buildReport(cfg([wiki]), measured, { generatedAt: 'T', remotes });
    expect(r.configs[0].skipped).toEqual([]);
    expect(r.configs[0].servers[0]).toMatchObject({ name: 'wiki', transport: 'remote', status: 'measured', url: 'https://mcp.deepwiki.com/mcp' });
    expect(r.configs[0].totalTokens).toBe(measurement('wiki').totalTokens);
  });

  it('says a remote it was given no probe for was not probed, rather than anything about the endpoint', () => {
    const r = buildReport(cfg([remote('r', 'https://x/mcp')]), new Map(), { generatedAt: 'T' });
    expect(r.configs[0].skipped[0]).toMatchObject({ status: 'unreachable', notes: 'https://x/mcp — not probed' });
  });

  it('never carries a header value into a report, only the name, and never the retired status word', () => {
    const r1 = remote('r', `${base}/echo-auth`, { headerNames: ['Authorization'], headers: { Authorization: 'Bearer sekrit-token-value' } });
    const remotes = new Map([[serverKey(r1), { kind: 'auth-walled' as const, status: 401, detail: 'HTTP 401' }]]);
    const r = buildReport(cfg([r1]), new Map(), { generatedAt: 'T', remotes });
    const text = JSON.stringify(r) + formatReport(r);
    expect(r.configs[0].skipped[0].headerNames).toEqual(['Authorization']);
    expect(text).not.toContain('sekrit-token-value');
    expect(text).not.toContain('remote-not-measurable');
  });

  it('redacts a secret the server echoed into its own failure text', () => {
    const s: ConfiguredServer = {
      name: 'leaky',
      client: 'cursor',
      source: '/cfg.json',
      transport: 'stdio',
      command: 'node leaky.js',
      argv: ['node', 'leaky.js'],
      envVarNames: ['API_KEY'],
      env: { API_KEY: 'sekrit-token-value' },
    };
    const failed = { ...measurement('leaky'), status: 'startup-failure' as const, totalTokens: null, notes: 'exit 1: bad key sekrit-token-value rejected' };
    const r = buildReport(cfg([s]), new Map([[serverKey(s), failed]]), { generatedAt: 'T' });
    expect(r.configs[0].skipped[0].notes).toBe('exit 1: bad key <redacted> rejected');
  });
});

describe('audit CLI — a config with an http entry', () => {
  it('prints an auth-walled line for a walled endpoint, never remote-not-measurable, and opens no browser', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-audit-remote-'));
    writeFileSync(
      join(dir, 'mcp.json'),
      JSON.stringify({ mcpServers: { linear: { type: 'http', url: `${base}/walled` }, gone: { type: 'sse', url: `${base}/gone` } } }),
    );
    const run = async (...flags: string[]) =>
      (
        await execFileAsync(process.execPath, [TSX_CLI, join(repoRoot, 'src/cli.ts'), 'audit', '--config', join(dir, 'mcp.json'), ...flags], {
          cwd: dir,
          encoding: 'utf8',
          timeout: 60_000,
        })
      ).stdout;
    const report = JSON.parse(await run('--json'));
    const byName = Object.fromEntries(report.configs[0].skipped.map((s: { name: string }) => [s.name, s]));
    expect(byName.linear).toMatchObject({ status: 'auth-walled', url: `${base}/walled` });
    expect(byName.linear.notes).toContain('WWW-Authenticate');
    expect(byName.gone).toMatchObject({ status: 'unreachable', notes: `${base}/gone: HTTP 404` });
    expect(JSON.stringify(report)).not.toContain('remote-not-measurable');
    const text = await run();
    expect(text).toContain('auth-walled');
    expect(text).not.toContain('remote-not-measurable');
    expect(readdirSync(dir).sort()).toEqual(['mcp.json']);
  }, 90_000);
});
