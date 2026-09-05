import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { deprecationText, writeLeaderboard, type ServerEntry } from '../src/sweep/report.js';
import type { Measurement } from '../src/core/types.js';

/**
 * A deprecation is a fact about the package, and the set holds both kinds of
 * row it can sit on: `elasticsearch` measures cleanly at 374 tokens and is
 * deprecated, `gdrive` and `neon` fail and are deprecated. Published as a bare
 * failure — or worse, as a clean number with nothing beside it — the row says
 * "this server is broken" or "this server is fine", and neither is what the
 * registry says about the package.
 */
const repoRoot = join(import.meta.dirname, '..');

const measurement = (over: Partial<Measurement> = {}): Measurement => ({
  methodologyVersion: '1.0',
  provider: 'tiktoken',
  encoding: 'o200k_base',
  status: 'measured',
  totalTokens: 374,
  toolCount: 4,
  tools: [{ name: 'search', tokens: 159, descriptionTokens: 30, inputSchemaTokens: 120 }],
  canonicalSha256: 'a'.repeat(64),
  rawToolsCapture: [],
  measuredAt: '2026-09-04T06:00:00.000Z',
  serverName: 'demo-server',
  ...over,
});

describe('deprecationText', () => {
  it('says where upstream points, in upstream’s words', () => {
    const text = deprecationText({
      name: 'neon',
      command: 'npx -y x',
      deprecated: {
        replacement: 'the remote MCP server at mcp.neon.tech',
        version: '0.6.5',
        source: 'https://www.npmjs.com/package/@neondatabase/mcp-server-neon',
        readOn: '2026-09-05',
      },
    });
    expect(text).toContain('superseded by the remote MCP server at mcp.neon.tech');
    expect(text).toContain('https://www.npmjs.com/package/@neondatabase/mcp-server-neon');
    // Dated to a release and to a reading, because both can move without
    // anything in this repository changing.
    expect(text).toContain('0.6.5, read 2026-09-05');
  });

  it('names no replacement when the notice names none', () => {
    const text = deprecationText({
      name: 'gdrive',
      command: 'npx -y x',
      deprecated: { version: '2025.1.14', source: 'https://example.test/p', readOn: '2026-09-05' },
    });
    expect(text).toContain('deprecated by its publisher');
    expect(text).not.toContain('superseded');
  });

  it('is empty for an entry that is not deprecated', () => {
    expect(deprecationText({ name: 'demo', command: 'npx -y x' })).toBe('');
  });
});

describe('the leaderboard publishes the deprecation beside the row', () => {
  let root: string;
  const deprecated = {
    replacement: 'the remote MCP server at mcp.example.test',
    version: '0.6.5',
    source: 'https://www.npmjs.com/package/demo',
    readOn: '2026-09-05',
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcc-deprecated-'));
    mkdirSync(join(root, 'results', 'demo'), { recursive: true });
    mkdirSync(join(root, 'results', 'broken'), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const write = (name: string, m: Measurement) =>
    writeFileSync(join(root, 'results', name, 'measurement.json'), JSON.stringify(m));

  it('lists a measured row and a failed row alike', () => {
    write('demo', measurement());
    write('broken', measurement({ status: 'startup-failure', totalTokens: null, toolCount: null, notes: 'server exited (code 1)' }));
    const entries: ServerEntry[] = [
      { name: 'demo', command: 'npx -y demo', deprecated },
      { name: 'broken', command: 'npx -y broken', deprecated },
    ];
    writeLeaderboard(entries, root);
    const md = readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8');
    expect(md).toContain('## Deprecated upstream');
    expect(md).toContain('2 entries are no longer maintained');
    // A measured deprecated row is the case a "not measured" table would miss.
    expect(md).toMatch(/\| demo \| measured \| \[superseded by/);
    expect(md).toMatch(/\| broken \| startup-failure \| \[superseded by/);
    // …and the failure row leads with it, above the stderr that says how the
    // run ended rather than why the package is a dead end.
    expect(md).toMatch(/\| broken \| startup-failure \| \*\*\[superseded by .*\*\* server exited/);
  });

  it('omits the section entirely when nothing is deprecated', () => {
    write('demo', measurement());
    writeLeaderboard([{ name: 'demo', command: 'npx -y demo' }], root);
    expect(readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8')).not.toContain('Deprecated upstream');
  });
});

describe('the deprecations committed in servers.yaml', () => {
  const doc = parse(readFileSync(join(repoRoot, 'servers.yaml'), 'utf8')) as { servers: ServerEntry[] };
  const deprecated = doc.servers.filter((s) => s.deprecated);

  it('each carries the version, source and reading date its claim rests on', () => {
    expect(deprecated.map((s) => s.name).sort()).toEqual(['elasticsearch', 'gdrive', 'neon']);
    for (const s of deprecated) {
      const d = s.deprecated!;
      expect(d.version.trim(), `${s.name} version`).not.toBe('');
      expect(d.source, `${s.name} source`).toMatch(/^https?:\/\//);
      expect(d.readOn, `${s.name} readOn`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
