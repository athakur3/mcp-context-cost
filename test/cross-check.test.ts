import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CROSS_CHECK_CLI_ARGS,
  CROSS_CHECK_CLI_VERSION,
  CROSS_CHECK_METHOD,
  divergencePct,
  isComparable,
  parseCliReport,
  parseCrossCheck,
  sameToolSet,
  toCrossCheckRow,
  type CrossCheckRow,
} from '../src/core/cross-check.js';
import { measureTools } from '../src/core/canonical.js';
import { mappedTokens } from '../src/core/divergence.js';
import { cliTriple, ensureCliBinary, runCli } from '../src/sweep/cross-check.js';
import { writeLeaderboard, type ServerEntry } from '../src/sweep/report.js';

/**
 * The cross-check column publishes another tool's number beside ours, so the
 * failure modes worth testing are the ones that would publish a comparison
 * that is not one: a CLI report read wrong, a row that outlived its capture, a
 * divergence computed across two different tool sets. The gating below is the
 * same silence-over-staleness contract the claude column carries.
 */

const TOOLS = [
  { name: 'alpha', description: 'First tool, with a description long enough to cost tokens.', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } },
  { name: 'beta', description: 'Second tool.', inputSchema: { type: 'object', properties: {} } },
];

const CLI_REPORT = JSON.stringify({
  counter: { provider: 'tiktoken', model: 'gpt-4o' },
  server_info: { name: 'stub', version: '1.0.0' },
  total_tokens: 130,
  tools: { total: 120, count: 2, items: [{ name: 'alpha', tokens: 70 }, { name: 'beta', tokens: 50 }] },
});

const measurement = () => measureTools(TOOLS, { serverName: 'stub', launchCommand: 'npx -y stub', envVarNames: [] });

describe('parseCliReport', () => {
  it('reads total, count and names from the report shape the CLI publishes', () => {
    const { report, problem } = parseCliReport(CLI_REPORT);
    expect(problem).toBeUndefined();
    expect(report).toEqual({ total: 120, count: 2, names: ['alpha', 'beta'] });
  });

  it('finds the report behind launcher noise on the same pipe', () => {
    const { report } = parseCliReport(`npm warn something\n${CLI_REPORT}\n`);
    expect(report?.total).toBe(120);
  });

  it('names the problem when there is no report, never a zero', () => {
    expect(parseCliReport('no json here').problem).toContain('no JSON report');
    expect(parseCliReport('{"tools":{}}').problem).toContain('.tools.total');
    expect(parseCliReport('{"tools":{"total":-1}}').problem).toContain('.tools.total');
  });
});

describe('sameToolSet', () => {
  it('ignores order but not multiplicity', () => {
    expect(sameToolSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameToolSet(['a', 'a'], ['a'])).toBe(false);
    expect(sameToolSet(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('toCrossCheckRow', () => {
  it('files a clean pair under the fresh capture hash, with the mapped baseline beside it', () => {
    const m = measurement();
    const row = toCrossCheckRow(m, parseCliReport(CLI_REPORT));
    expect(row.error).toBeUndefined();
    expect(row.toolSetMatches).toBe(true);
    expect(row.ourTokens).toBe(m.totalTokens);
    expect(row.ourMappedTokens).toBe(mappedTokens(TOOLS));
    expect(row.cliTokens).toBe(120);
    expect(row.capturedSha256).toBe(m.canonicalSha256);
  });

  it('records a tool-set mismatch as data, not as a comparison', () => {
    const other = JSON.parse(CLI_REPORT);
    other.tools.items = [{ name: 'gamma', tokens: 120 }];
    const row = toCrossCheckRow(measurement(), parseCliReport(JSON.stringify(other)));
    expect(row.error).toBeUndefined();
    expect(row.toolSetMatches).toBe(false);
  });

  it('carries a CLI problem as the row error, keeping our side', () => {
    const m = measurement();
    const row = toCrossCheckRow(m, { problem: 'exited 3: boom' });
    expect(row.error).toContain('cli: exited 3');
    expect(row.ourTokens).toBe(m.totalTokens);
    expect(row.cliTokens).toBe(0);
  });

  it('records our own failure with no capture to file anything under', () => {
    const m = measurement();
    m.status = 'startup-failure';
    m.notes = 'server exited (code 1)';
    const row = toCrossCheckRow(m, {});
    expect(row.error).toContain('our measurement: startup-failure');
    expect(row.capturedSha256).toBeNull();
  });
});

describe('isComparable — the printing gate', () => {
  const clean = (): CrossCheckRow => toCrossCheckRow(measurement(), parseCliReport(CLI_REPORT));
  const sha = measurement().canonicalSha256;

  it('prints a clean, current row', () => {
    expect(isComparable(clean(), sha)).toBe(true);
  });

  it('goes silent when the published capture has moved on', () => {
    expect(isComparable(clean(), 'f'.repeat(64))).toBe(false);
  });

  it('goes silent on an errored row, a mismatched tool set, or no row at all', () => {
    const errored = { ...clean(), error: 'cli: boom' };
    const mismatched = { ...clean(), toolSetMatches: false };
    expect(isComparable(errored, sha)).toBe(false);
    expect(isComparable(mismatched, sha)).toBe(false);
    expect(isComparable(undefined, sha)).toBe(false);
  });

  it('goes silent on a dynamic listing — matching names still span three different captures', () => {
    expect(isComparable({ ...clean(), dynamic: true }, sha)).toBe(false);
  });
});

describe('divergencePct', () => {
  it('is signed, in percent of the mapped projection the CLI actually models — not the headline', () => {
    const row = {
      ...toCrossCheckRow(measurement(), parseCliReport(CLI_REPORT)),
      ourTokens: 500,
      ourMappedTokens: 100,
      cliTokens: 98,
    };
    expect(divergencePct(row)).toBeCloseTo(-2);
  });

  it('is null when there is nothing to divide by', () => {
    const row = { ...toCrossCheckRow(measurement(), parseCliReport(CLI_REPORT)), ourMappedTokens: 0 };
    expect(divergencePct(row)).toBeNull();
  });
});

describe('parseCrossCheck', () => {
  it('round-trips a run and fills defaults without inventing rows', () => {
    const run = parseCrossCheck(
      JSON.stringify({ cliVersion: 'v0.0.1', measuredAt: '2026-09-03', servers: { a: { ourTokens: 1 } } }),
    );
    expect(run).not.toBeNull();
    expect(run!.method).toBe(CROSS_CHECK_METHOD);
    expect(run!.cliArgs).toEqual([...CROSS_CHECK_CLI_ARGS]);
  });

  it('refuses text that is not a run', () => {
    expect(parseCrossCheck('nope')).toBeNull();
    expect(parseCrossCheck('{"measuredAt":"2026-09-03"}')).toBeNull();
  });
});

describe('cliTriple', () => {
  it('targets the container, not the host, in docker mode', () => {
    expect(cliTriple(true, 'darwin', 'arm64')).toBe('aarch64-unknown-linux-gnu');
    expect(cliTriple(true, 'linux', 'x64')).toBe('x86_64-unknown-linux-gnu');
  });

  it('targets the host in host mode, and refuses a platform with no asset', () => {
    expect(cliTriple(false, 'darwin', 'arm64')).toBe('aarch64-apple-darwin');
    expect(cliTriple(false, 'linux', 'x64')).toBe('x86_64-unknown-linux-gnu');
    expect(() => cliTriple(false, 'win32', 'x64')).toThrow('--docker');
  });
});

describe('the runner pieces, against a shim CLI', () => {
  let dir: string;
  const oldBin = process.env.MCP_TOKENS_BIN;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'xchk-shim-'));
    const shim = join(dir, 'mcp-tokens');
    writeFileSync(shim, `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(CLI_REPORT)});\n`);
    chmodSync(shim, 0o755);
    const slow = join(dir, 'mcp-tokens-slow');
    writeFileSync(slow, `#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n`);
    chmodSync(slow, 0o755);
  });

  afterAll(() => {
    if (oldBin === undefined) delete process.env.MCP_TOKENS_BIN;
    else process.env.MCP_TOKENS_BIN = oldBin;
    rmSync(dir, { recursive: true, force: true });
  });

  it('MCP_TOKENS_BIN short-circuits the download entirely', async () => {
    process.env.MCP_TOKENS_BIN = join(dir, 'mcp-tokens');
    await expect(ensureCliBinary('aarch64-apple-darwin')).resolves.toBe(join(dir, 'mcp-tokens'));
  });

  it('captures the report from a host-mode run', async () => {
    const out = await runCli(join(dir, 'mcp-tokens'), { name: 'stub', command: 'node -e ""' }, { docker: false, timeoutMs: 5_000 });
    expect(out.code).toBe(0);
    expect(out.timedOut).toBe(false);
    expect(parseCliReport(out.stdout).report?.total).toBe(120);
  });

  it('kills and marks a CLI that outlives its budget and its grace', async () => {
    const out = await runCli(
      join(dir, 'mcp-tokens-slow'),
      { name: 'stub', command: 'node -e ""' },
      { docker: false, timeoutMs: 300, graceMs: 0 },
    );
    expect(out.timedOut).toBe(true);
  });
});

describe('the leaderboard prints the column under the same silence rules', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'xchk-board-'));
    mkdirSync(join(root, 'results', 'fresh'), { recursive: true });
    mkdirSync(join(root, 'results', 'stale'), { recursive: true });
    const fresh = measureTools(TOOLS, { serverName: 'fresh', launchCommand: 'npx -y fresh', envVarNames: [] });
    const stale = measureTools(TOOLS.slice(0, 1), { serverName: 'stale', launchCommand: 'npx -y stale', envVarNames: [] });
    writeFileSync(join(root, 'results', 'fresh', 'measurement.json'), JSON.stringify(fresh, null, 2));
    writeFileSync(join(root, 'results', 'stale', 'measurement.json'), JSON.stringify(stale, null, 2));
    const rows: Record<string, CrossCheckRow> = {
      fresh: toCrossCheckRow(fresh, parseCliReport(CLI_REPORT)),
      // Filed under a capture that is no longer the one on disk.
      stale: { ourTokens: 50, ourMappedTokens: 50, cliTokens: 51, ourToolCount: 1, cliToolCount: 1, toolSetMatches: true, dynamic: false, capturedSha256: 'f'.repeat(64) },
    };
    writeFileSync(
      join(root, 'results', 'cross-check.json'),
      JSON.stringify({
        method: CROSS_CHECK_METHOD,
        cli: 'sd2k/mcp-tokens',
        cliVersion: CROSS_CHECK_CLI_VERSION,
        cliArgs: [...CROSS_CHECK_CLI_ARGS],
        measuredAt: '2026-09-03',
        isolation: 'test fixtures',
        servers: rows,
      }),
    );
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('shows the CLI number for a current row and silence for a stale one', () => {
    const entries: ServerEntry[] = [
      { name: 'fresh', command: 'npx -y fresh' },
      { name: 'stale', command: 'npx -y stale' },
    ];
    writeLeaderboard(entries, root);
    const board = readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8');
    expect(board).toContain(' mcp-tokens |');
    const freshLine = board.split('\n').find((l) => l.includes('| [fresh]'));
    const staleLine = board.split('\n').find((l) => l.includes('| [stale]'));
    // The CLI's number, with the counter disagreement vs our mapped projection beside it.
    expect(freshLine).toMatch(/ 120 \([+−]\d+\.\d%\) \|/);
    expect(staleLine).toContain(' — |');
    // The header states the range only over rows that compare like with like.
    expect(board).toContain('across the 1 row where both tools saw the same tool set');
    const csv = readFileSync(join(root, 'results', 'leaderboard.csv'), 'utf8');
    expect(csv.split('\n')[0]).toContain('crossCheckTokens,crossCheckCliVersion');
    expect(csv).toContain(`,120,${CROSS_CHECK_CLI_VERSION}`);
  });
});
