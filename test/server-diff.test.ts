import { describe, it, expect } from 'vitest';
import {
  diffServer,
  evaluateServerGate,
  formatServerDiff,
  parseBaselineMeasurement,
} from '../src/core/server-diff.js';
import { failedMeasurement, measureTools } from '../src/core/canonical.js';
import type { Measurement } from '../src/core/types.js';

/**
 * The author-side gate tells a maintainer their change costs every install
 * something. The failure mode it exists to prevent is the flattering one: a
 * server that stops starting on the branch makes the number go *down*, and a
 * gate that subtracts two totals would call that an improvement and pass.
 */

const server = (tools: { name: string; description: string; extra?: number }[]): Measurement =>
  measureTools(
    tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: { type: 'object', properties: Object.fromEntries(Array.from({ length: t.extra ?? 1 }, (_, i) => [`p${i}`, { type: 'string' }])) },
    })),
    { serverName: 'demo', launchCommand: 'node server.js', envVarNames: [] },
  );

const base = server([
  { name: 'search', description: 'Search the index.' },
  { name: 'get', description: 'Fetch one record by id.' },
]);
const grown = server([
  { name: 'search', description: 'Search the index. '.repeat(12) },
  { name: 'get', description: 'Fetch one record by id.' },
  { name: 'bulk_export', description: 'Export every record.' },
]);
const broken = failedMeasurement('startup-failure', { serverName: 'demo', notes: 'server exited (code 1)' });

describe('diffServer', () => {
  it('establishes an exact change and attributes it per tool', () => {
    const d = diffServer('demo', base, grown);
    expect(d.exact).toBe(true);
    expect(d.identical).toBe(false);
    expect(d.delta).toBe(grown.totalTokens! - base.totalTokens!);
    expect(d.attribution!.added.map((t) => t.name)).toEqual(['bulk_export']);
    expect(d.attribution!.grew.map((t) => t.name)).toEqual(['search']);
    expect(d.attribution!.removed).toEqual([]);
  });

  it('recognises a byte-identical capture as no change at all', () => {
    const d = diffServer('demo', base, base);
    expect(d.identical).toBe(true);
    expect(d.delta).toBe(0);
    expect(d.attribution).toBeNull();
    expect(formatServerDiff(d)).toContain('byte-identical');
  });

  it('gives no delta when this run produced no number, and says which direction the error runs', () => {
    const d = diffServer('demo', base, broken);
    expect(d.exact).toBe(false);
    expect(d.delta).toBeNull();
    expect(d.problem).toContain('missing from the comparison, not removed from the server');
    // The baseline's known side is still printed — a reader keeps what is known.
    expect(formatServerDiff(d)).toContain('baseline:');
  });

  it('gives no delta when the baseline never measured, because the increase would overstate', () => {
    const d = diffServer('demo', broken, grown);
    expect(d.exact).toBe(false);
    expect(d.problem).toContain('overstates');
    expect(formatServerDiff(d)).toContain('measured now:');
  });

  it('reports having no baseline as such rather than as a change', () => {
    const d = diffServer('demo', null, grown);
    expect(d.exact).toBe(false);
    expect(d.problem).toBe('no baseline to compare against');
  });
});

describe('evaluateServerGate', () => {
  const bigger = diffServer('demo', base, grown);
  const delta = bigger.delta!;

  it('passes a change inside the allowance and fails one over it', () => {
    expect(evaluateServerGate(bigger, { maxIncrease: delta }).pass).toBe(true);
    const fail = evaluateServerGate(bigger, { maxIncrease: delta - 1 });
    expect(fail.pass).toBe(false);
    expect(fail.failure).toContain('INCREASE FAIL');
    expect(fail.failure).toContain('every request of every install');
  });

  it('fails an increase that could not be established, rather than passing quietly', () => {
    // The whole point: a broken server on the branch must not read as a saving.
    const g = evaluateServerGate(diffServer('demo', base, broken), { maxIncrease: 100_000 });
    expect(g.pass).toBe(false);
    expect(g.failure).toContain('could not be established');
  });

  it('checks the budget against the absolute cost', () => {
    expect(evaluateServerGate(bigger, { budget: grown.totalTokens! }).pass).toBe(true);
    expect(evaluateServerGate(bigger, { budget: grown.totalTokens! - 1 }).pass).toBe(false);
  });

  it('fails a budget that could not be checked at all', () => {
    const g = evaluateServerGate(diffServer('demo', null, broken), { budget: 5000 });
    expect(g.pass).toBe(false);
    expect(g.failure).toContain('BUDGET FAIL');
  });

  it('passes when no gate was asked for, whatever the diff says', () => {
    expect(evaluateServerGate(diffServer('demo', base, broken), {}).pass).toBe(true);
  });
});

describe('parseBaselineMeasurement', () => {
  it('accepts a real measurement, including a failed one', () => {
    expect(parseBaselineMeasurement(JSON.stringify(base)).measurement).not.toBeNull();
    expect(parseBaselineMeasurement(JSON.stringify(broken)).measurement).not.toBeNull();
  });

  it('names the problem rather than returning something unusable', () => {
    expect(parseBaselineMeasurement('{').problem).toContain('not valid JSON');
    expect(parseBaselineMeasurement('{"hello":1}').problem).toContain('not a measurement.json');
  });
});
