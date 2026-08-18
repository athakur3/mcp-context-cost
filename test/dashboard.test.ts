import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateDashboard, renderSparkline } from '../src/sweep/dashboard.js';
import type { Measurement } from '../src/core/types.js';

describe('renderSparkline', () => {
  it('renders nothing for zero or one point — there is no trend to draw', () => {
    expect(renderSparkline([])).toBe('');
    expect(renderSparkline([1000])).toBe('');
  });

  it('draws a level line for a flat series instead of faking a zero baseline', () => {
    const svg = renderSparkline([500, 500, 500]);
    const ys = [...svg.matchAll(/[\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));
    expect(new Set(ys).size).toBe(1); // every plotted point sits on the same y
  });

  it('caps the series at the last 12 points', () => {
    const long = Array.from({ length: 30 }, (_, i) => i * 10);
    const svg = renderSparkline(long);
    expect(svg.match(/[\d.]+,[\d.]+/g)?.length).toBe(12);
  });

  it('is a valid, self-contained inline svg', () => {
    const svg = renderSparkline([100, 300, 200]);
    expect(svg).toContain('<svg');
    expect(svg).toContain('polyline');
    expect(svg).toContain('circle');
  });
});

function measurement(over: Partial<Measurement> = {}): Measurement {
  return {
    methodologyVersion: '1.0',
    provider: 'tiktoken',
    encoding: 'o200k_base',
    status: 'measured',
    totalTokens: 1200,
    toolCount: 2,
    tools: [
      { name: 'search', tokens: 900, descriptionTokens: 100, inputSchemaTokens: 800 },
      { name: 'fetch', tokens: 300, descriptionTokens: 40, inputSchemaTokens: 260 },
    ],
    canonicalSha256: 'a'.repeat(64),
    rawToolsCapture: [],
    measuredAt: '2026-08-18T12:00:00.000Z',
    serverName: 'demo-server',
    ...over,
  };
}

describe('generateDashboard sparklines', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcc-dashboard-'));
    mkdirSync(join(root, 'results', 'demo'), { recursive: true });
    writeFileSync(join(root, 'servers.yaml'), 'servers:\n  - name: demo\n    command: npx -y demo-mcp\n    category: search\n');
    writeFileSync(join(root, 'results', 'demo', 'measurement.json'), JSON.stringify(measurement()));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('plots a trend line once more than one sweep date exists', () => {
    writeFileSync(
      join(root, 'results', 'history.csv'),
      'date,server,tokens,toolCount,status\n2026-08-16,demo,900,2,measured\n2026-08-18,demo,1200,2,measured\n',
    );
    const html = generateDashboard(root);
    expect(html).toContain('class="spark"');
    expect(html).toContain('900 → 1,200'); // tooltip carries the same trend in words
  });

  it('leaves the spark cell empty for a server with only one sweep on record', () => {
    const html = generateDashboard(root);
    expect(html).not.toContain('class="spark"');
    expect(html).toContain('spark-cell');
  });
});
