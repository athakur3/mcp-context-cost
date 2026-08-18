import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { verifyMeasurement, slugFromUrl, unknownFlags, cliVersion } from '../src/cli.js';
import { measureTools } from '../src/core/canonical.js';
import type { Measurement } from '../src/core/types.js';

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(repoRoot, 'spec/fixtures');
const tools = JSON.parse(readFileSync(join(fixtures, 'tools-basic.json'), 'utf8'));

describe('verify command (dispute drill)', () => {
  it('passes on an untampered measurement', () => {
    const m = measureTools(tools, { serverName: 'x' });
    expect(verifyMeasurement(m)).toMatchObject({ ok: true, problems: [] });
  });

  it('catches a tampered token count', () => {
    const m = measureTools(tools, { serverName: 'x' });
    m.totalTokens = (m.totalTokens ?? 0) + 1;
    const r = verifyMeasurement(m);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('token mismatch');
  });

  it('catches a tampered capture', () => {
    const m = measureTools(tools, { serverName: 'x' });
    (m.rawToolsCapture as { description?: string }[])[0].description = 'edited after the fact';
    const r = verifyMeasurement(m);
    expect(r.ok).toBe(false);
    expect(r.problems.length).toBeGreaterThanOrEqual(2); // tokens AND sha shift
  });

  it('fails a measurement with no capture', () => {
    const m = measureTools(tools, { serverName: 'x' });
    m.rawToolsCapture = null;
    expect(verifyMeasurement(m as Measurement).ok).toBe(false);
  });
});

describe('verify --json (CLI process)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-context-cost-cli-'));

  it('prints a single JSON object and exits 0 on success', () => {
    const m = measureTools(tools, { serverName: 'x' });
    const path = join(dir, 'ok.json');
    writeFileSync(path, JSON.stringify(m));
    const out = execFileSync('npx', ['tsx', 'src/cli.ts', 'verify', path, '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    const parsed = JSON.parse(out);
    expect(parsed).toMatchObject({ ok: true, serverName: 'x', problems: [] });
    expect(parsed.badge).toBeDefined();
  });

  it('exits 1 with a JSON problems array on mismatch', () => {
    const m = measureTools(tools, { serverName: 'x' });
    m.totalTokens = (m.totalTokens ?? 0) + 1;
    const path = join(dir, 'bad.json');
    writeFileSync(path, JSON.stringify(m));
    let out = '';
    let code = 0;
    try {
      execFileSync('npx', ['tsx', 'src/cli.ts', 'verify', path, '--json'], { cwd: repoRoot, encoding: 'utf8' });
    } catch (e) {
      const err = e as { status: number; stdout: string };
      code = err.status;
      out = err.stdout;
    }
    expect(code).toBe(1);
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(false);
    expect(parsed.problems.join(' ')).toContain('token mismatch');
    expect(parsed.badge).toBeUndefined();
  });

  it('exits 2 on usage error', () => {
    let code = 0;
    try {
      execFileSync('npx', ['tsx', 'src/cli.ts', 'verify'], { cwd: repoRoot, encoding: 'utf8' });
    } catch (e) {
      code = (e as { status: number }).status;
    }
    expect(code).toBe(2);
  });
});

describe('slugFromUrl', () => {
  it('strips a leading mcp./www. and non-alnum runs', () => {
    expect(slugFromUrl('https://mcp.deepwiki.com/mcp')).toBe('deepwiki-com');
    expect(slugFromUrl('https://www.example.com:443/sse')).toBe('example-com');
  });

  it('falls back to "remote" when the hostname strips to nothing', () => {
    expect(slugFromUrl('https://mcp./x')).toBe('remote');
  });
});

describe('measure --remote (usage validation, no network)', () => {
  it('exits 2 when --remote is not an http(s) URL', () => {
    let code = 0;
    let stderr = '';
    try {
      execFileSync('npx', ['tsx', 'src/cli.ts', 'measure', '--remote', 'not-a-url'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
    } catch (e) {
      const err = e as { status: number; stderr: string };
      code = err.status;
      stderr = err.stderr;
    }
    expect(code).toBe(2);
    expect(stderr).toContain('must be an http(s) URL');
  });

  it('exits 2 when neither --command nor --remote is given', () => {
    let code = 0;
    try {
      execFileSync('npx', ['tsx', 'src/cli.ts', 'measure', '--name', 'x'], { cwd: repoRoot, encoding: 'utf8' });
    } catch (e) {
      code = (e as { status: number }).status;
    }
    expect(code).toBe(2);
  });
});

describe('verify --remote', () => {
  const m = measureTools(tools, { serverName: 'x' });
  const server = createServer((req, res) => {
    if (req.url === '/ok.json') {
      res.end(JSON.stringify(m));
    } else {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  let base = '';
  const ready = new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      base = typeof addr === 'object' && addr ? `http://127.0.0.1:${addr.port}` : '';
      resolve();
    });
  });

  afterAll(() => {
    server.close();
  });

  it('fetches and verifies a remote measurement', async () => {
    await ready;
    // execFileSync would block this process's event loop while the child's fetch
    // tries to reach the server that lives in this same process — deadlock.
    const { stdout } = await execFileAsync('npx', ['tsx', 'src/cli.ts', 'verify', '--remote', `${base}/ok.json`, '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    const parsed = JSON.parse(stdout);
    expect(parsed).toMatchObject({ ok: true, serverName: 'x', problems: [] });
    expect(parsed.badge).toBeDefined();
  });

  it('exits 1 with a JSON problem on a 404', async () => {
    await ready;
    let out = '';
    let code = 0;
    try {
      await execFileAsync('npx', ['tsx', 'src/cli.ts', 'verify', '--remote', `${base}/missing.json`, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
    } catch (e) {
      const err = e as { code: number; stdout: string };
      code = err.code;
      out = err.stdout;
    }
    expect(code).toBe(1);
    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(false);
    expect(parsed.problems.join(' ')).toContain('HTTP 404');
  });
});


// ---------------------------------------------------------------------------
// Unknown flags must fail loud. Regression for a real silent-pass defect:
// `audit --baseline b.json --max-increase 2000` on a build without those flags
// ran a plain audit and exited 0 — a green CI check on a gate that never ran.
// ---------------------------------------------------------------------------

describe('unknownFlags', () => {
  const AUDIT = {
    value: ['config', 'budget', 'baseline', 'max-increase', 'context', 'timeout', 'concurrency', 'divergence-url'],
    boolean: ['json', 'docker', 'claude'],
  };

  it('accepts every flag the audit command actually supports', () => {
    const argv = ['--config', 'a.json', '--budget', '20000', '--baseline', 'b.json', '--max-increase', '2000',
                  '--context', '200000', '--timeout', '60000', '--concurrency', '3', '--docker', '--claude', '--json'];
    expect(unknownFlags(argv, AUDIT)).toEqual([]);
  });

  it('names an unknown flag, and every unknown flag', () => {
    expect(unknownFlags(['--config', 'a.json', '--nope'], AUDIT)).toEqual(['--nope']);
    expect(unknownFlags(['--nope', '--also-nope'], AUDIT)).toEqual(['--nope', '--also-nope']);
  });

  it('does not read a value-taking flag\'s value as a flag', () => {
    // `measure --command "npx -y foo --bar"` is one argv element and must stay a value.
    const MEASURE = { value: ['name', 'command', 'remote', 'timeout', 'docker-image'], boolean: ['docker'] };
    expect(unknownFlags(['--command', '--weird-looking-value', '--docker'], MEASURE)).toEqual([]);
    expect(unknownFlags(['--command', 'npx -y foo --bar'], MEASURE)).toEqual([]);
  });

  it('handles --flag=value form', () => {
    expect(unknownFlags(['--budget=20000'], AUDIT)).toEqual([]);
    expect(unknownFlags(['--nope=1'], AUDIT)).toEqual(['--nope']);
  });

  it('reports a real version so the message can explain a version skew', () => {
    expect(cliVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('CLI rejects unknown flags', () => {
  const run = (args: string[]) => {
    try {
      execFileSync('npx', ['tsx', 'src/cli.ts', ...args], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { code: 0, stderr: '' };
    } catch (e) {
      const err = e as { status: number; stderr: string };
      return { code: err.status, stderr: err.stderr ?? '' };
    }
  };

  it('exits 2 and names the version, not 0', () => {
    const r = run(['audit', '--config', 'nope.json', '--totally-made-up']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('unknown flag');
    expect(r.stderr).toContain('--totally-made-up');
    expect(r.stderr).toContain(cliVersion());
    expect(r.stderr).toContain('older than the docs');
  }, 60_000);

  it('covers verify and measure too', () => {
    expect(run(['verify', 'x.json', '--bogus']).code).toBe(2);
    expect(run(['measure', '--name', 'x', '--command', 'true', '--bogus']).code).toBe(2);
  }, 60_000);
});
