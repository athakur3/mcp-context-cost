import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  SUGGEST_DESCRIPTION_PERCENTILE,
  buildToolShapeBaseline,
  parseToolShapeBaseline,
  percentileOf,
  quantileTable,
  suggestFor,
  type ToolShapeBaseline,
} from '../src/core/tool-shape.js';
import { measureTools, METHODOLOGY_VERSION } from '../src/core/canonical.js';
import { buildReport, formatReport, serverKey } from '../src/audit/audit.js';
import { loadRows, type ServerEntry } from '../src/sweep/report.js';
import type { ToolMeasurement } from '../src/core/types.js';

/**
 * `--suggest` gives advice with a number attached, so the failure modes worth
 * testing are the ones that would give advice the data does not support: a
 * percentile read off the wrong rank, a suggestion for a tool inside the
 * distribution, a baseline silently derived from measurements that never
 * carried component counts, or a committed baseline that drifted from the
 * measurements it claims to summarize.
 */

const tm = (name: string, tokens: number, desc: number, schema: number): ToolMeasurement => ({
  name,
  tokens,
  descriptionTokens: desc,
  inputSchemaTokens: schema,
});

/** 100 tools whose description weights are exactly 1..100 — every rank predictable. */
const population = Array.from({ length: 100 }, (_, i) => tm(`t${i + 1}`, (i + 1) * 3, i + 1, i + 1));
const baseline = buildToolShapeBaseline(population, { serverCount: 4, generatedAt: '2026-09-04', methodologyVersion: '1.0' });

describe('quantileTable and percentileOf', () => {
  it('is monotone with the population extremes at its ends', () => {
    const q = baseline.quantiles.descriptionTokens;
    expect(q).toHaveLength(101);
    expect(q[0]).toBe(1);
    expect(q[100]).toBe(100);
    for (let i = 1; i <= 100; i++) expect(q[i]).toBeGreaterThanOrEqual(q[i - 1]);
  });

  it('uses the same nearest-rank rule as the published percentiles', () => {
    // n=100, p=50 → ceil(0.5·100)−1 = rank 49 → value 50.
    expect(baseline.quantiles.descriptionTokens[50]).toBe(50);
    expect(baseline.quantiles.descriptionTokens[90]).toBe(90);
  });

  it('places a value at the highest percentile whose quantile it reaches', () => {
    const q = baseline.quantiles.descriptionTokens;
    expect(percentileOf(q, 0)).toBe(0); // below the whole population
    expect(percentileOf(q, 1)).toBe(1);
    expect(percentileOf(q, 50)).toBe(50);
    expect(percentileOf(q, 100)).toBe(100);
    expect(percentileOf(q, 5000)).toBe(100); // above the whole population
  });
});

describe('buildToolShapeBaseline', () => {
  it('counts only tools that carry all three component counts', () => {
    const incomplete = { name: 'old', tokens: 10 } as ToolMeasurement;
    const b = buildToolShapeBaseline([...population, incomplete], {
      serverCount: 5,
      generatedAt: '2026-09-04',
      methodologyVersion: '1.0',
    });
    expect(b.toolCount).toBe(100); // the pre-component measurement is not silently zeroed in
  });

  it('refuses to derive a distribution from fewer than two tools', () => {
    expect(() => buildToolShapeBaseline([population[0]], { serverCount: 1, methodologyVersion: '1.0' })).toThrow();
  });

  it('round-trips through its published JSON form', () => {
    const parsed = parseToolShapeBaseline(JSON.stringify(baseline));
    expect(parsed).toEqual(baseline);
  });

  it('rejects text that is not a baseline, including a truncated quantile table', () => {
    expect(parseToolShapeBaseline('nope')).toBeNull();
    expect(parseToolShapeBaseline('{"generatedAt":"2026-09-04","toolCount":5}')).toBeNull();
    const short = { ...baseline, quantiles: { ...baseline.quantiles, tokens: baseline.quantiles.tokens.slice(0, 50) } };
    expect(parseToolShapeBaseline(JSON.stringify(short))).toBeNull();
  });
});

describe('suggestFor — advice only where the data can point', () => {
  it('fires at the threshold percentile with the exact numbers a reader can re-check', () => {
    const s = suggestFor('srv', tm('heavy', 400, 95, 40), baseline);
    expect(s).not.toBeNull();
    expect(s!.descriptionPercentile).toBeGreaterThanOrEqual(SUGGEST_DESCRIPTION_PERCENTILE);
    expect(s!.medianDescriptionTokens).toBe(50);
    expect(s!.approxRecoverableTokens).toBe(95 - 50);
  });

  it('stays silent below the threshold', () => {
    expect(suggestFor('srv', tm('normal', 100, 60, 40), baseline)).toBeNull();
  });

  it('stays silent for a measurement that predates component counts', () => {
    expect(suggestFor('srv', { name: 'old', tokens: 10 } as ToolMeasurement, baseline)).toBeNull();
  });

  it('stays silent when trimming toward the median would recover nothing', () => {
    // A degenerate population where the median IS the maximum.
    const flat = buildToolShapeBaseline(
      Array.from({ length: 10 }, (_, i) => tm(`f${i}`, 30, 20, 10)),
      { serverCount: 1, generatedAt: '2026-09-04', methodologyVersion: '1.0' },
    );
    expect(suggestFor('srv', tm('same', 30, 20, 10), flat)).toBeNull();
  });
});

describe('the audit report carries suggestions under the same honesty rules', () => {
  const stdio = (name: string) => ({
    name,
    transport: 'stdio' as const,
    command: 'node',
    argv: ['node', `${name}.js`],
  });
  const cfg = (servers: ReturnType<typeof stdio>[]) =>
    [{ client: 'claude-desktop', source: '/cfg.json', servers }] as Parameters<typeof buildReport>[0];

  const verbose = measureTools(
    [
      {
        name: 'wordy',
        description: 'An extremely long description. '.repeat(40),
        inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      },
      { name: 'terse', description: 'Short.', inputSchema: { type: 'object', properties: {} } },
    ],
    { serverName: 'verbose', launchCommand: 'node verbose.js', envVarNames: [] },
  );

  it('attaches out-of-distribution tools, heaviest recovery first, and prints the percentile it fired at', () => {
    const a = stdio('verbose');
    const r = buildReport(cfg([a]), new Map([[serverKey(a), verbose]]), {
      generatedAt: 'T',
      toolShape: baseline,
    });
    const sg = r.configs[0].suggestions!;
    expect(sg.checkedTools).toBe(2);
    expect(sg.outOfDistribution.map((s) => s.tool)).toEqual(['wordy']);
    expect(r.toolShape).toEqual({ generatedAt: '2026-09-04', toolCount: 100, serverCount: 4 });
    const text = formatReport(r);
    expect(text).toContain('suggest — descriptions at or above the 90th percentile');
    expect(text).toContain('verbose · wordy');
    expect(text).toContain('rewriting the description toward the measured median (50)');
    expect(text).toContain('1 of 2 tools sit inside the distribution');
  });

  it('says in words when nothing is measurably unusual, instead of inventing advice', () => {
    const quiet = measureTools([{ name: 'ok', description: 'Fine.', inputSchema: { type: 'object' } }], {
      serverName: 'quiet',
      launchCommand: 'node quiet.js',
      envVarNames: [],
    });
    const a = stdio('quiet');
    const r = buildReport(cfg([a]), new Map([[serverKey(a), quiet]]), { generatedAt: 'T', toolShape: baseline });
    expect(r.configs[0].suggestions!.outOfDistribution).toHaveLength(0);
    expect(formatReport(r)).toContain('sits inside the measured distribution — nothing the data can point at');
  });

  it('attaches nothing at all when --suggest did not run', () => {
    const a = stdio('verbose');
    const r = buildReport(cfg([a]), new Map([[serverKey(a), verbose]]), { generatedAt: 'T' });
    expect(r.configs[0].suggestions).toBeUndefined();
    expect(r.toolShape).toBeUndefined();
    expect(formatReport(r)).not.toContain('suggest');
  });
});

describe('the committed baseline is the one the measurements derive', () => {
  it('re-derives byte-equal from results/, at its own recorded date', () => {
    const repoRoot = join(import.meta.dirname, '..');
    const committed = parseToolShapeBaseline(readFileSync(join(repoRoot, 'results', 'tool-shape.json'), 'utf8'));
    expect(committed).not.toBeNull();
    const doc = parse(readFileSync(join(repoRoot, 'servers.yaml'), 'utf8')) as { servers: ServerEntry[] };
    const tools: ToolMeasurement[] = [];
    let serverCount = 0;
    for (const r of loadRows(doc.servers, repoRoot)) {
      if (!r.m || (r.m.status !== 'measured' && r.m.status !== 'dynamic') || r.m.tools.length === 0) continue;
      serverCount++;
      tools.push(...r.m.tools);
    }
    const rederived = buildToolShapeBaseline(tools, {
      serverCount,
      generatedAt: committed!.generatedAt,
      methodologyVersion: METHODOLOGY_VERSION,
    });
    expect(rederived).toEqual(committed);
  });
});
