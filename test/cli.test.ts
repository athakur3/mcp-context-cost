import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMeasurement } from '../src/cli.js';
import { measureTools } from '../src/core/canonical.js';
import type { Measurement } from '../src/core/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../spec/fixtures');
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
