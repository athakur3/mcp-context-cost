import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  renderServerPage,
  renderServerIndex,
  writeServerPages,
  serverPageUrl,
} from '../src/sweep/server-pages.js';
import type { Measurement } from '../src/core/types.js';
import type { ServerEntry } from '../src/sweep/report.js';

function measurement(over: Partial<Measurement> = {}): Measurement {
  return {
    methodologyVersion: '1.0',
    provider: 'tiktoken',
    encoding: 'o200k_base',
    status: 'measured',
    totalTokens: 1000,
    toolCount: 2,
    tools: [
      { name: 'search', tokens: 700, descriptionTokens: 100, inputSchemaTokens: 560 },
      { name: 'fetch', tokens: 280, descriptionTokens: 40, inputSchemaTokens: 200 },
    ],
    canonicalSha256: 'a'.repeat(64),
    rawToolsCapture: [],
    measuredAt: '2026-08-16T12:08:31.393Z',
    serverName: 'demo-server',
    serverVersion: '1.2.0',
    launchCommand: 'npx -y demo-mcp',
    envVarNames: [],
    isolation: { docker: true, image: 'node:22-slim', network: 'bridge' },
    ...over,
  };
}

const entry: ServerEntry = { name: 'demo', command: 'npx -y demo-mcp', category: 'search' };

describe('renderServerPage', () => {
  it('leads with the number, band and tool count', () => {
    const md = renderServerPage(entry, measurement());
    expect(md).toContain('# demo — context cost');
    expect(md).toContain('**1,000 tokens** across 2 tools');
    expect(md).toContain('*light*');
  });

  it('records what makes the number checkable', () => {
    const md = renderServerPage(entry, measurement());
    expect(md).toContain('npx -y demo-mcp');
    expect(md).toContain('a'.repeat(64));
    expect(md).toContain('o200k_base');
    expect(md).toContain('docker · node:22-slim · network bridge');
    expect(md).toContain('npx -y mcp-context-cost verify results/demo/measurement.json');
    expect(md).toContain('/blob/main/results/demo/measurement.json');
  });

  it('breaks tokens down per tool, largest first, with shares', () => {
    const md = renderServerPage(entry, measurement());
    const rows = md.split('\n').filter((l) => l.startsWith('| search |') || l.startsWith('| fetch |'));
    expect(rows[0]).toContain('| search | 700 | 70.0% | 100 | 560 |');
    expect(rows[1]).toContain('| fetch | 280 | 28.0% | 40 | 200 |');
  });

  it('caps the inline table and accounts for the remainder', () => {
    const tools = Array.from({ length: 40 }, (_, i) => ({
      name: `tool${i}`,
      tokens: 100 - i,
      descriptionTokens: 10,
      inputSchemaTokens: 50,
    }));
    const md = renderServerPage(entry, measurement({ tools, toolCount: 40, totalTokens: 3220 }));
    expect(md).toContain('tool0');
    expect(md).not.toMatch(/\| tool39 \|/);
    // 40 tools, 30 shown: 10 omitted, tokens 70..61 = 655
    expect(md).toContain('10 smaller tools omitted (655 tokens combined)');
  });

  it('escapes markdown table syntax in third-party tool names', () => {
    const md = renderServerPage(
      entry,
      measurement({ tools: [{ name: 'a|b`c[d]', tokens: 10, descriptionTokens: 1, inputSchemaTokens: 2 }] }),
    );
    expect(md).toContain('a\\|b\\`c\\[d\\]');
    expect(md).not.toContain('| a|b');
  });

  it('flags a dynamic tool set instead of presenting it as a constant', () => {
    const md = renderServerPage(entry, measurement({ status: 'dynamic' }));
    expect(md).toContain('differed between two consecutive captures');
  });

  it('shows the series only once there is more than one date', () => {
    const one = [
      { date: '2026-08-16', server: 'demo', tokens: 1000, toolCount: 2, status: 'measured', isolation: 'docker', version: '' },
    ];
    expect(renderServerPage(entry, measurement(), one)).not.toContain('## Over time');

    const two = [
      ...one,
      // The newer row names its release and the older one does not, which is
      // the shape of the committed file while the rotation fills the column in.
      { date: '2026-08-23', server: 'demo', tokens: 1200, toolCount: 3, status: 'measured', isolation: 'docker', version: '1.29.1' },
    ];
    const md = renderServerPage(entry, measurement(), two);
    expect(md).toContain('## Over time');
    expect(md).toContain('| 2026-08-23 | 1,200 | 3 | 1.29.1 | docker | +200 |');
    expect(md).toContain('| 2026-08-16 | 1,000 | 2 | not recorded | docker | — |');
  });
});

describe('renderServerIndex', () => {
  it('ranks measured servers and links their pages', () => {
    const md = renderServerIndex([
      { entry: { name: 'small', command: 'x' }, m: measurement({ totalTokens: 10, toolCount: 1 }) },
      { entry: { name: 'big', command: 'x' }, m: measurement({ totalTokens: 90_000, toolCount: 3 }) },
    ]);
    const ranked = md.split('\n').filter((l) => /^\| \d+ \|/.test(l));
    expect(ranked[0]).toContain('[big](big.html)');
    expect(ranked[0]).toContain('90,000');
    expect(ranked[1]).toContain('[small](small.html)');
    expect(md).toContain('2 of 2');
  });

  it('lists unmeasured candidates with their status and no link', () => {
    const md = renderServerIndex([
      { entry: { name: 'ok', command: 'x' }, m: measurement() },
      { entry: { name: 'broken', command: 'x' }, m: measurement({ status: 'startup-failure', totalTokens: null }) },
      { entry: { name: 'walled', command: 'x', remote: true }, m: null },
      { entry: { name: 'fresh', command: 'x' }, m: null },
    ]);
    expect(md).toContain('| broken | startup-failure |');
    expect(md).toContain('| walled | remote-auth-wall |');
    expect(md).toContain('| fresh | not-yet-run |');
    expect(md).not.toContain('[broken](');
    expect(md).toContain('1 of 4');
  });
});

describe('writeServerPages', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcc-pages-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function seed(name: string, m: Measurement | 'corrupt') {
    mkdirSync(join(root, 'results', name), { recursive: true });
    writeFileSync(
      join(root, 'results', name, 'measurement.json'),
      m === 'corrupt' ? '{ not json' : JSON.stringify(m),
    );
  }

  it('writes one page per measured server plus an index', () => {
    seed('demo', measurement());
    seed('nope', measurement({ status: 'timeout', totalTokens: null, toolCount: null, tools: [] }));
    const out = writeServerPages(
      [entry, { name: 'nope', command: 'x' }, { name: 'missing', command: 'x' }],
      root,
    );
    expect(out.pages).toBe(1);
    expect(existsSync(join(root, 'docs', 'servers', 'demo.md'))).toBe(true);
    expect(existsSync(join(root, 'docs', 'servers', 'nope.md'))).toBe(false);
    expect(readFileSync(join(root, 'docs', 'servers', 'index.md'), 'utf8')).toContain('[demo](demo.html)');
  });

  it('folds that server’s history rows into its page', () => {
    seed('demo', measurement());
    mkdirSync(join(root, 'results'), { recursive: true });
    writeFileSync(
      join(root, 'results', 'history.csv'),
      'date,server,tokens,toolCount,status\n' +
        '2026-08-23,demo,1200,3,measured\n' +
        '2026-08-16,demo,1000,2,measured\n' +
        '2026-08-16,other,50,1,measured\n',
    );
    writeServerPages([entry], root);
    const md = readFileSync(join(root, 'docs', 'servers', 'demo.md'), 'utf8');
    expect(md).toContain('## Over time');
    expect(md.indexOf('2026-08-16')).toBeLessThan(md.indexOf('2026-08-23')); // oldest first
    expect(md).not.toContain('| 50 |');
  });

  it('marks the over-time row that crosses an isolation change as not comparable', () => {
    seed('demo', measurement());
    mkdirSync(join(root, 'results'), { recursive: true });
    writeFileSync(
      join(root, 'results', 'history.csv'),
      'date,server,tokens,toolCount,status,isolation\n' +
        '2026-08-16,demo,900,2,measured,host\n' +
        '2026-08-18,demo,1200,3,measured,docker\n' +
        '2026-08-19,demo,1210,3,measured,docker\n',
    );
    writeServerPages([entry], root);
    const md = readFileSync(join(root, 'docs', 'servers', 'demo.md'), 'utf8');
    expect(md).toContain('| measured in |');
    expect(md).toContain('| host |');
    expect(md).toContain('not comparable'); // the +300 across the boundary is never stated
    expect(md).not.toContain('+300');
    expect(md).toContain('+10'); // the within-docker change still is
    expect(md).toContain('the published trend starts at 2026-08-18');
  });

  it('says so when a series predates the isolation column instead of implying it is docker', () => {
    seed('demo', measurement());
    mkdirSync(join(root, 'results'), { recursive: true });
    writeFileSync(
      join(root, 'results', 'history.csv'),
      'date,server,tokens,toolCount,status\n' +
        '2026-08-16,demo,1000,2,measured\n' +
        '2026-08-18,demo,1200,3,measured\n',
    );
    writeServerPages([entry], root);
    const md = readFileSync(join(root, 'docs', 'servers', 'demo.md'), 'utf8');
    expect(md).toContain('| not recorded |');
    expect(md).toContain('predate the `isolation` column');
    expect(md).toContain('+200'); // unknown is not evidence of a difference, so the delta stands
  });

  it('is deterministic — regenerating without a new sweep changes nothing', () => {
    seed('demo', measurement());
    writeServerPages([entry], root);
    const first = readFileSync(join(root, 'docs', 'servers', 'demo.md'), 'utf8');
    writeServerPages([entry], root);
    expect(readFileSync(join(root, 'docs', 'servers', 'demo.md'), 'utf8')).toBe(first);
  });

  it('skips a half-written measurement instead of aborting the run', () => {
    seed('demo', measurement());
    seed('half', 'corrupt');
    const out = writeServerPages([entry, { name: 'half', command: 'x' }], root);
    expect(out.pages).toBe(1);
    expect(readFileSync(join(root, 'docs', 'servers', 'index.md'), 'utf8')).toContain('| half | not-yet-run |');
  });
});

describe('serverPageUrl', () => {
  it('is the published Pages URL for the server', () => {
    expect(serverPageUrl('demo')).toBe('https://athakur3.github.io/mcp-context-cost/servers/demo.html');
  });
});
