import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DIVERGENCE_METHOD,
  claudeRatio,
  fieldSelectionShare,
  isCurrent,
  mappedTokens,
  parseDivergence,
  toAnthropicTools,
  type DivergenceRow,
  type DivergenceRun,
} from '../src/core/divergence.js';
import { countTokens } from '../src/core/canonical.js';
import { writeLeaderboard, type ServerEntry } from '../src/sweep/report.js';
import { renderServerPage } from '../src/sweep/server-pages.js';
import type { Measurement } from '../src/core/types.js';

/** A tools/list entry carrying the MCP-only fields Anthropic never receives. */
const rawTool = {
  name: 'search',
  title: 'Search The Knowledge Base',
  description: 'Search the knowledge base',
  inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  outputSchema: { type: 'object', properties: { hits: { type: 'array' } } },
  execution: { mode: 'sync' },
};

function row(over: Partial<DivergenceRow> = {}): DivergenceRow {
  return { o200kFull: 1000, o200kMapped: 400, claudeDelta: 700, toolCount: 2, capturedSha256: 'a'.repeat(64), ...over };
}

function run(over: Partial<DivergenceRun> = {}): DivergenceRun {
  return {
    method: DIVERGENCE_METHOD,
    model: 'claude-opus-5',
    measuredAt: '2026-08-17',
    baselineTokens: 7,
    probeDelta: 328,
    servers: { demo: row() },
    ...over,
  };
}

describe('toAnthropicTools', () => {
  it('keeps exactly the three fields an Anthropic tool definition carries', () => {
    const [t] = toAnthropicTools([rawTool]);
    expect(Object.keys(t).sort()).toEqual(['description', 'input_schema', 'name']);
    expect(t.name).toBe('search');
    expect(t.description).toBe('Search the knowledge base');
    expect(t.input_schema).toEqual(rawTool.inputSchema);
  });

  it('drops MCP-only metadata rather than renaming it', () => {
    const json = JSON.stringify(toAnthropicTools([rawTool]));
    for (const dropped of ['title', 'annotations', 'outputSchema', 'execution', 'readOnlyHint']) {
      expect(json).not.toContain(dropped);
    }
  });

  it('skips tools with no usable name instead of inventing one', () => {
    expect(toAnthropicTools([{ description: 'x' }, { name: '', description: 'y' }, rawTool])).toHaveLength(1);
  });

  it('defaults a missing description and schema to empty rather than omitting the key', () => {
    const [t] = toAnthropicTools([{ name: 'bare' }]);
    expect(t.description).toBe('');
    expect(t.input_schema).toEqual({ type: 'object', properties: {} });
  });

  it('preserves tool order — the comparison is against the same sequence', () => {
    const names = toAnthropicTools([{ name: 'b' }, { name: 'a' }, { name: 'c' }]).map((t) => t.name);
    expect(names).toEqual(['b', 'a', 'c']);
  });
});

describe('mappedTokens', () => {
  it('counts the projection with the same tokenizer as the headline', () => {
    expect(mappedTokens([rawTool])).toBe(countTokens(JSON.stringify(toAnthropicTools([rawTool]))));
  });

  it('is strictly smaller than the full capture when MCP-only fields are present', () => {
    expect(mappedTokens([rawTool])).toBeLessThan(countTokens(JSON.stringify([rawTool])));
  });
});

describe('derived ratios', () => {
  it('reports the MCP-only share of the headline', () => {
    expect(fieldSelectionShare(row({ o200kFull: 1000, o200kMapped: 250 }))).toBeCloseTo(0.75);
  });

  it('reports Claude tokens per headline token', () => {
    expect(claudeRatio(row({ o200kFull: 1000, claudeDelta: 1750 }))).toBeCloseTo(1.75);
  });

  it('returns null instead of dividing by zero', () => {
    expect(fieldSelectionShare(row({ o200kFull: 0 }))).toBeNull();
    expect(claudeRatio(row({ o200kFull: 0 }))).toBeNull();
  });
});

describe('isCurrent', () => {
  const sha = 'a'.repeat(64);

  it('accepts a row computed from the capture on disk', () => {
    expect(isCurrent(row(), sha)).toBe(true);
  });

  it('rejects a row whose capture has since been re-swept', () => {
    expect(isCurrent(row({ capturedSha256: 'b'.repeat(64) }), sha)).toBe(false);
  });

  it('rejects missing rows, errored rows, and captures with no hash', () => {
    expect(isCurrent(undefined, sha)).toBe(false);
    expect(isCurrent(row({ error: 'schema rejected' }), sha)).toBe(false);
    expect(isCurrent(row(), null)).toBe(false);
  });
});

describe('parseDivergence', () => {
  it('round-trips a written run', () => {
    expect(parseDivergence(JSON.stringify(run()))).toEqual(run());
  });

  it('returns null for malformed or incomplete input instead of throwing', () => {
    expect(parseDivergence('not json')).toBeNull();
    expect(parseDivergence('{"model":"m"}')).toBeNull();
    expect(parseDivergence('{"model":"m","measuredAt":"2026-08-17"}')).toBeNull();
    expect(parseDivergence('null')).toBeNull();
  });

  it('fills a missing method with the current one so old files stay readable', () => {
    const parsed = parseDivergence('{"model":"m","measuredAt":"2026-08-17","servers":{}}');
    expect(parsed?.method).toBe(DIVERGENCE_METHOD);
    expect(parsed?.probeDelta).toBe(0);
  });
});

describe('publishing the column', () => {
  let root: string;
  const entry: ServerEntry = { name: 'demo', command: 'npx -y demo-mcp' };
  const m: Measurement = {
    methodologyVersion: '1.0',
    provider: 'tiktoken',
    encoding: 'o200k_base',
    status: 'measured',
    totalTokens: 1000,
    toolCount: 2,
    tools: [{ name: 'search', tokens: 700, descriptionTokens: 100, inputSchemaTokens: 560 }],
    canonicalSha256: 'a'.repeat(64),
    rawToolsCapture: [],
    measuredAt: '2026-08-16T12:08:31.393Z',
    serverName: 'demo-server',
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'divergence-'));
    mkdirSync(join(root, 'results', 'demo'), { recursive: true });
    writeFileSync(join(root, 'results', 'demo', 'measurement.json'), JSON.stringify(m));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('omits the claude column entirely when no divergence run exists', () => {
    writeLeaderboard([entry], root);
    const md = readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8');
    expect(md).toContain('| # | server | tokens | tools |');
    expect(md).not.toContain('claude');
    const csv = readFileSync(join(root, 'results', 'leaderboard.csv'), 'utf8');
    expect(csv.split('\n')[0]).toContain('claudeTokens,claudeModel');
    expect(csv.split('\n')[1]).toMatch(/,,$/);
  });

  it('publishes the claude number and pins the model once a run exists', () => {
    writeFileSync(join(root, 'results', 'divergence.json'), JSON.stringify(run()));
    writeLeaderboard([entry], root);
    const md = readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8');
    expect(md).toContain('| # | server | tokens | claude | tools |');
    expect(md).toContain('| 1 | [demo](../docs/servers/demo.md) | 1,000 | 700 | 2 |');
    expect(md).toContain('claude-opus-5');
    const csv = readFileSync(join(root, 'results', 'leaderboard.csv'), 'utf8');
    expect(csv.split('\n')[1]).toContain(',700,claude-opus-5');
  });

  it('shows a dash, not a stale number, when the capture was re-swept', () => {
    const stale = run({ servers: { demo: row({ capturedSha256: 'b'.repeat(64) }) } });
    writeFileSync(join(root, 'results', 'divergence.json'), JSON.stringify(stale));
    writeLeaderboard([entry], root);
    const md = readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8');
    expect(md).toContain('| 1 | [demo](../docs/servers/demo.md) | 1,000 | — | 2 |');
    const csv = readFileSync(join(root, 'results', 'leaderboard.csv'), 'utf8');
    expect(csv.split('\n')[1]).toMatch(/,,$/);
  });

  it('breaks the decomposition out on the server page', () => {
    const md = renderServerPage(entry, m, [], run());
    expect(md).toContain('## What this costs on Claude');
    expect(md).toContain('claude-opus-5');
    expect(md).toContain('60.0% of the capture is MCP-only metadata');
    expect(md).toContain('0.70× the badge number');
    expect(md).toContain('at most 328 tokens');
  });

  it('leaves the section off the page when the row is stale or absent', () => {
    expect(renderServerPage(entry, m, [], null)).not.toContain('What this costs on Claude');
    const stale = run({ servers: { demo: row({ capturedSha256: 'b'.repeat(64) }) } });
    expect(renderServerPage(entry, m, [], stale)).not.toContain('What this costs on Claude');
  });
});
