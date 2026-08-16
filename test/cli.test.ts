import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyMeasurement } from '../src/cli.js';
import { measureTools } from '../src/core/canonical.js';
import type { Measurement } from '../src/core/types.js';

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
