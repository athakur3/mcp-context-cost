import { describe, it, expect } from 'vitest';
import { buildDiff, evaluateIncreaseGate, parseBaselineReport } from '../src/audit/diff.js';
import { buildReport, formatReport, serverKey } from '../src/audit/audit.js';
import { measureTools, failedMeasurement } from '../src/core/canonical.js';
import { appendVector, latestChange, type ToolVectorFile } from '../src/core/regression.js';
import type { AuditReport } from '../src/audit/audit.js';

/**
 * Four ways a gate reported a verdict it had not established, found by a
 * full-codebase review on 2026-09-04 and fixed together. Each is the same
 * shape: the number the gate compared was not the whole number, and nothing
 * said so — a green check on a check that did not happen.
 */

const cfg = (source: string, total: number, servers: any[], skipped: any[] = []) => ({
  client: 'claude-code', source, totalTokens: total, toolCount: 1, serverCount: servers.length,
  contextShare: total / 200000, servers, skipped, heaviestTools: [], trimAdvice: null,
  deferral: { posture: 'unknown', sources: [] } as any,
});
const rep = (configs: any[]): AuditReport => ({
  methodologyVersion: '1.0', encoding: 'o200k_base', generatedAt: 'T',
  contextWindow: 200000, configs, emptyConfigs: [], problems: [],
} as AuditReport);
const srv = (name: string, tokens: number | null, status = 'measured') => ({
  name, status, tokens, toolCount: tokens === null ? null : 1, share: null, command: 'x', argv: ['x'],
});

describe('--max-increase: a server added and unmeasurable', () => {
  // The ordinary CI case: the PR adds a server, and CI has no credential for it.
  const before = rep([cfg('/cfg.json', 5000, [srv('a', 5000)])]);
  const after = rep([cfg('/cfg.json', 5000, [srv('a', 5000)], [srv('notion', null, 'startup-failure')])]);

  it('is not an exact comparison, because its cost is unknown rather than zero', () => {
    expect(buildDiff(before, after).configs[0].exact).toBe(false);
  });

  it('fails even the tightest allowance rather than reporting +0', () => {
    const gate = evaluateIncreaseGate(buildDiff(before, after), 0);
    expect(gate.pass).toBe(false);
    expect(gate.reasons.join(' ')).toContain('not established on both sides');
  });

  it('still passes when the added server measured', () => {
    const measured = rep([cfg('/cfg.json', 5100, [srv('a', 5000), srv('small', 100)])]);
    expect(evaluateIncreaseGate(buildDiff(before, measured), 500).pass).toBe(true);
  });

  it('leaves a removed-and-never-measured server exact — it was never in the total', () => {
    const wasSkipped = rep([cfg('/cfg.json', 5000, [srv('a', 5000)], [srv('ghost', null, 'auth-required')])]);
    const gone = rep([cfg('/cfg.json', 5000, [srv('a', 5000)])]);
    expect(buildDiff(wasSkipped, gone).configs[0].exact).toBe(true);
  });
});

describe('--max-increase: a baseline that cannot be read is never "no change"', () => {
  it('refuses a baseline config with no usable totalTokens', () => {
    const trimmed = JSON.stringify({
      methodologyVersion: '1.0', encoding: 'o200k_base', contextWindow: 200000, generatedAt: 'T',
      configs: [{ client: 'claude-code', source: '/cfg.json' }],
    });
    const parsed = parseBaselineReport(trimmed);
    // Previously accepted, yielding `after - undefined === NaN`; `typeof NaN`
    // is 'number', so the gate reported increase 0 and passed.
    expect(parsed.report).toBeNull();
    expect(parsed.problem).toContain('totalTokens');
  });

  it('still accepts a well-formed baseline', () => {
    const ok = JSON.stringify(rep([cfg('/cfg.json', 5000, [srv('a', 5000)])]));
    expect(parseBaselineReport(ok).report).not.toBeNull();
  });

  it('never reads a non-finite increase as zero', () => {
    const diff = { comparable: true, configs: [{ source: '/x', matchedBy: 'source', exact: true, delta: NaN }], droppedConfigs: [], worstIncrease: { source: '/x', delta: NaN } } as never;
    expect(evaluateIncreaseGate(diff, 0).increase).not.toBe(0);
  });
});

describe('--budget: a total missing a server is not a total', () => {
  const stdio = (name: string) => ({ name, transport: 'stdio' as const, command: 'node', argv: ['node', `${name}.js`] });
  const ok = stdio('ok');
  const broken = stdio('heavy-but-broken');
  const configs = [{ client: 'claude-desktop', source: '/cfg.json', servers: [ok, broken] }] as Parameters<typeof buildReport>[0];
  const measured = new Map([
    [serverKey(ok), measureTools([{ name: 't', description: 'A tool.', inputSchema: { type: 'object' } }], { serverName: 'ok', launchCommand: 'node ok.js', envVarNames: [] })],
    [serverKey(broken), failedMeasurement('startup-failure', { serverName: 'heavy-but-broken', notes: 'server exited (code 1)' })],
  ]);

  it('fails under the line when a server produced no number, naming which', () => {
    const r = buildReport(configs, measured, { generatedAt: 'T', budget: 100_000 });
    expect(r.budget!.over).toBe(true);
    expect(r.budget!.unestablished).toHaveLength(1);
    const text = formatReport(r);
    expect(text).toContain('could not be checked against the whole stack');
    expect(text).toContain('heavy-but-broken');
  });

  it('passes when every server in the config measured', () => {
    const onlyOk = [{ client: 'claude-desktop', source: '/cfg.json', servers: [ok] }] as Parameters<typeof buildReport>[0];
    const r = buildReport(onlyOk, measured, { generatedAt: 'T', budget: 100_000 });
    expect(r.budget!.over).toBe(false);
    expect(r.budget!.unestablished).toBeUndefined();
    expect(formatReport(r)).toContain('budget ok');
  });
});

describe('attribution joins the capture in force, not the date', () => {
  const vec = (date: string, sha: string, total: number, tools: { name: string; tokens: number }[]) => ({
    date, canonicalSha256: sha, totalTokens: total, tools,
  });
  const row = (date: string, tokens: number, toolCount: number) => ({ date, tokens, toolCount, status: 'measured' });

  it('explains a change measured across an unchanged sweep', () => {
    // The ordinary rhythm: measured weekly, unchanged once, then it moves.
    // Vectors dedupe by capture and keep the FIRST date; `from` is the LAST row
    // of the previous plateau, so the two dates do not coincide.
    let v: ToolVectorFile = { method: 'cost-regression/v1', server: 's', entries: [] };
    v = appendVector(v, vec('2026-08-19', 'a'.repeat(64), 1000, [{ name: 't', tokens: 1000 }]));
    v = appendVector(v, vec('2026-08-26', 'a'.repeat(64), 1000, [{ name: 't', tokens: 1000 }])); // deduped
    v = appendVector(v, vec('2026-09-02', 'b'.repeat(64), 1400, [{ name: 't', tokens: 1000 }, { name: 'new', tokens: 400 }]));

    const c = latestChange('s', [row('2026-08-19', 1000, 1), row('2026-08-26', 1000, 1), row('2026-09-02', 1400, 2)], v)!;
    expect(c.fromDate).toBe('2026-08-26');
    expect(c.attribution).not.toBeNull();
    expect(c.attribution!.added.map((t) => t.name)).toEqual(['new']);
  });

  it('refuses when a vector does not agree with the row it would explain', () => {
    // A same-day re-sweep appends a second capture for one history row; a join
    // that picked the wrong one would publish the mismatch as framing bytes.
    let v: ToolVectorFile = { method: 'cost-regression/v1', server: 's', entries: [] };
    v = appendVector(v, vec('2026-08-26', 'a'.repeat(64), 900, [{ name: 't', tokens: 900 }]));
    v = appendVector(v, vec('2026-09-03', 'b'.repeat(64), 1000, [{ name: 't', tokens: 1000 }]));
    v = appendVector(v, vec('2026-09-03', 'c'.repeat(64), 1400, [{ name: 't', tokens: 1400 }]));

    const c = latestChange('s', [row('2026-08-26', 900, 1), row('2026-09-03', 1400, 1)], v)!;
    expect(c.deltaTokens).toBe(500);
    // The newest vector on 09-03 totals 1400 and agrees; the 08-26 side agrees too.
    expect(c.attribution).not.toBeNull();
    expect(c.attribution!.unexplainedTokens).toBe(0);
  });

  it('still refuses when the vectors genuinely do not cover the change', () => {
    let v: ToolVectorFile = { method: 'cost-regression/v1', server: 's', entries: [] };
    v = appendVector(v, vec('2026-09-02', 'b'.repeat(64), 1400, [{ name: 't', tokens: 1400 }]));
    const c = latestChange('s', [row('2026-08-19', 1000, 1), row('2026-09-02', 1400, 1)], v)!;
    expect(c.attribution).toBeNull(); // only the newer side is on record
  });
});
