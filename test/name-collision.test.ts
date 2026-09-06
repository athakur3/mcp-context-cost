import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { shortRepo, writeLeaderboard, type ServerEntry } from '../src/sweep/report.js';
import { renderServerPage } from '../src/sweep/server-pages.js';
import type { Measurement } from '../src/core/types.js';

/**
 * The leaderboard prints one thing about an entry: its name. `octocode` here is
 * the npm package `octocode-mcp` from `bgauryy/octocode`; `Muvon/octocode` is an
 * unrelated Rust project of the same name that has never been measured here.
 * Someone who works on the second one read the row as theirs and posted a
 * public correction about how their server had been filed — so this is a
 * demonstrated failure of the page, not a hypothetical one.
 *
 * A rename would be the other fix and a far larger one: `name` keys
 * `results/<name>/`, `badges/<name>.json`, the capture index and every history
 * row, so it is a published identifier rather than a label.
 */
const repoRoot = join(import.meta.dirname, '..');

const collision = {
  project: 'Other/demo',
  source: 'https://github.com/Other/demo',
  readOn: '2026-09-07',
};

const measurement = (over: Partial<Measurement> = {}): Measurement => ({
  methodologyVersion: '1.0',
  provider: 'tiktoken',
  encoding: 'o200k_base',
  status: 'measured',
  totalTokens: 374,
  toolCount: 1,
  tools: [{ name: 'search', tokens: 159, descriptionTokens: 30, inputSchemaTokens: 120 }],
  canonicalSha256: 'a'.repeat(64),
  rawToolsCapture: [],
  measuredAt: '2026-09-04T06:00:00.000Z',
  serverName: 'demo-server',
  ...over,
});

describe('shortRepo', () => {
  it('reduces a github URL to owner/repo, which is how people say it', () => {
    expect(shortRepo('https://github.com/bgauryy/octocode')).toBe('bgauryy/octocode');
    expect(shortRepo('https://github.com/Muvon/octocode.git')).toBe('Muvon/octocode');
  });

  it('leaves anything it does not recognise alone rather than mangling it', () => {
    expect(shortRepo('https://gitlab.com/x/y')).toBe('https://gitlab.com/x/y');
    expect(shortRepo('not a url')).toBe('not a url');
  });
});

describe('the leaderboard says which project a shared name refers to', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mcc-collision-'));
    mkdirSync(join(root, 'results', 'demo'), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const build = (entry: Partial<ServerEntry>) => {
    writeFileSync(join(root, 'results', 'demo', 'measurement.json'), JSON.stringify(measurement()));
    writeLeaderboard([{ name: 'demo', command: 'npx -y demo-mcp', ...entry }], root);
    return readFileSync(join(root, 'results', 'leaderboard.md'), 'utf8');
  };

  it('names what the row measures and what it is not', () => {
    const md = build({ package: 'demo-mcp', repo: 'https://github.com/Mine/demo', nameCollision: collision });
    expect(md).toContain('## Same name, different project');
    expect(md).toContain('`demo-mcp` — [Mine/demo](https://github.com/Mine/demo)');
    expect(md).toContain('[Other/demo](https://github.com/Other/demo), read 2026-09-07');
  });

  it('falls back to the launch command when an entry declares no package', () => {
    // Something has to identify the row. The command always exists.
    expect(build({ nameCollision: collision })).toContain('`npx -y demo-mcp`');
  });

  it('omits the section entirely when no entry declares a collision', () => {
    expect(build({ package: 'demo-mcp' })).not.toContain('Same name, different project');
  });
});

describe('the server page carries it too', () => {
  const entry: ServerEntry = { name: 'demo', command: 'npx -y demo-mcp', repo: 'https://github.com/Mine/demo' };

  it('names the other project for a reader who arrived from a badge', () => {
    const md = renderServerPage({ ...entry, nameCollision: collision }, measurement());
    expect(md).toContain('| not to be confused with | Other/demo');
    expect(md).toContain('read 2026-09-07');
    expect(md).toContain('not measured here');
  });

  it('adds no row when there is no collision to report', () => {
    expect(renderServerPage(entry, measurement())).not.toContain('not to be confused with');
  });
});

describe('the collision committed in servers.yaml', () => {
  const doc = parse(readFileSync(join(repoRoot, 'servers.yaml'), 'utf8')) as { servers: ServerEntry[] };
  const declared = doc.servers.filter((s) => s.nameCollision);

  it('names a project that is not the entry own, with its evidence and date', () => {
    expect(declared.map((s) => s.name)).toEqual(['octocode']);
    for (const s of declared) {
      const c = s.nameCollision!;
      expect(c.source).toMatch(/^https?:\/\//);
      expect(c.readOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // The whole claim is that these are different projects.
      expect(c.source).not.toBe(s.repo);
    }
  });

  it('is published on the leaderboard and on the page it describes', () => {
    // The declaration is worth nothing unless it reaches a reader; both
    // artifacts are committed, so the committed bytes are what to assert.
    const md = readFileSync(join(repoRoot, 'results', 'leaderboard.md'), 'utf8');
    expect(md).toContain('## Same name, different project');
    expect(md).toContain('[Muvon/octocode](https://github.com/Muvon/octocode)');
    const page = readFileSync(join(repoRoot, 'docs', 'servers', 'octocode.md'), 'utf8');
    expect(page).toContain('| not to be confused with | Muvon/octocode');
  });
});
