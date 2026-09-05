import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeRemote } from '../src/audit/remote.js';
import { TSX_CLI } from './tsx.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The phase-4 exit, end to end: a config with an `http` entry produces a
 * number. The endpoint is the reference "everything" server on its streamable
 * HTTP transport (`PORT` env, `/mcp`), pinned so the fixture cannot move under
 * the test; the audit probes it, finds it open, and measures it through the
 * `mcp-remote` bridge the leaderboard's remote rows take. Two packages come
 * from npm on the way, as the stdio CLI test already accepts for one.
 */
const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close(() => resolve(port));
    });
  });

let child: ChildProcess | undefined;
let url = '';

beforeAll(async () => {
  const port = await freePort();
  url = `http://127.0.0.1:${port}/mcp`;
  child = spawn('npx', ['-y', '@modelcontextprotocol/server-everything@2026.8.31', 'streamableHttp'], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: true,
  });
  let stderr = '';
  child.stderr?.on('data', (c) => (stderr += String(c)));
  const deadline = Date.now() + 180_000;
  for (;;) {
    const p = await probeRemote(url, { timeoutMs: 2_000 });
    if (p.kind === 'open') return;
    if (child.exitCode !== null) throw new Error(`everything server exited ${child.exitCode}: ${stderr.slice(-500)}`);
    if (Date.now() > deadline) throw new Error(`everything server never answered at ${url}: ${p.detail}; ${stderr.slice(-500)}`);
    await new Promise((r) => setTimeout(r, 1_000));
  }
}, 200_000);

afterAll(() => {
  // npx wraps the server in its own process; the group is what has to go.
  if (child?.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
});

describe('audit — an open http entry is a number', () => {
  it('measures the endpoint through the bridge, as a remote, and writes nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-audit-bridge-'));
    writeFileSync(join(dir, 'mcp.json'), JSON.stringify({ mcpServers: { everything: { type: 'http', url } } }));
    const out = execFileSync(
      process.execPath,
      [TSX_CLI, join(repoRoot, 'src/cli.ts'), 'audit', '--config', join(dir, 'mcp.json'), '--json'],
      { cwd: dir, encoding: 'utf8', timeout: 240_000 },
    );
    const report = JSON.parse(out);
    const cfg = report.configs[0];
    expect(cfg.skipped).toEqual([]);
    expect(cfg.servers[0]).toMatchObject({ name: 'everything', transport: 'remote', status: 'measured', url });
    expect(cfg.servers[0].tokens).toBeGreaterThan(100);
    expect(cfg.servers[0].toolCount).toBeGreaterThan(3);
    expect(cfg.totalTokens).toBe(cfg.servers[0].tokens);
    expect(JSON.stringify(report)).not.toContain('remote-not-measurable');
    expect(readdirSync(dir).sort()).toEqual(['mcp.json']);
  }, 260_000);
});
