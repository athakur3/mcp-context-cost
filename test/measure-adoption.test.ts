import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TSX_CLI } from './tsx.js';
import {
  ADOPTION_METHOD,
  BADGE_SOURCE,
  parseAdoption,
  renderAdoptionPage,
  type AdoptionRun,
} from '../src/core/adoption.js';

const repoRoot = join(import.meta.dirname, '..');
const tool = join(repoRoot, 'tools', 'measure-adoption.ts');

/** The tool's environment with both token variables absent — offline means offline. */
const noTokens = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => k !== 'MCP_CTX_GITHUB_TOKEN' && k !== 'GITHUB_TOKEN'),
);

/** Run the tool from `cwd`; returns the exit status rather than throwing. */
function runTool(cwd: string, args: string[]): { status: number; stderr: string } {
  try {
    execFileSync(process.execPath, [TSX_CLI, tool, ...args], { cwd, encoding: 'utf8', env: noTokens, stdio: 'pipe' });
    return { status: 0, stderr: '' };
  } catch (e) {
    const err = e as { status: number; stderr: string };
    return { status: err.status, stderr: err.stderr };
  }
}

/** A reading dated well before any day this test can run on. */
function reading(): AdoptionRun {
  return {
    method: ADOPTION_METHOD,
    checkedAt: '2026-08-20',
    source: BADGE_SOURCE,
    queries: [{ name: 'q', q: '"x"', why: 'why', state: 'ok', hits: 0 }],
    candidates: 0,
    sightings: [],
    thirdPartyRepos: 0,
    unresolved: null,
    lastResolved: { checkedAt: '2026-08-20', thirdPartyRepos: 0 },
  };
}

/**
 * The page is held to be exactly what the reading renders (below), so a wording
 * change to `renderAdoptionPage` turns the suite red until the page is rebuilt.
 * Before this flag the only way to rebuild it was `npm run adoption`, which
 * talks to GitHub and stamps today's date on the reading — a date moved for a
 * wording change, on a page whose date is most of its meaning.
 */
describe('measure-adoption --render-only', () => {
  const dirs: string[] = [];
  const fresh = () => {
    const d = mkdtempSync(join(tmpdir(), 'mcp-context-cost-adoption-'));
    dirs.push(d);
    return d;
  };
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it('re-renders the page from the reading on disk, without a token and without touching checkedAt', () => {
    const dir = fresh();
    mkdirSync(join(dir, 'results'));
    mkdirSync(join(dir, 'docs'));
    const jsonPath = join(dir, 'results', 'badge-adoption.json');
    const before = JSON.stringify(reading(), null, 2) + '\n';
    writeFileSync(jsonPath, before);
    writeFileSync(join(dir, 'docs', 'adoption.md'), 'stale page\n');

    expect(runTool(dir, ['--render-only']).status).toBe(0);

    // The reading is the input, not an output: byte for byte what it was.
    expect(readFileSync(jsonPath, 'utf8')).toBe(before);
    expect(parseAdoption(readFileSync(jsonPath, 'utf8'))!.checkedAt).toBe('2026-08-20');

    const page = readFileSync(join(dir, 'docs', 'adoption.md'), 'utf8');
    expect(page).toBe(renderAdoptionPage(reading()));
    expect(page).toContain('as of 2026-08-20');
    expect(page).not.toContain(new Date().toISOString().slice(0, 10));
  });

  it('renders "nobody has looked" when there is no reading — that is the true page for that state', () => {
    const dir = fresh();
    expect(runTool(dir, ['--render-only']).status).toBe(0);
    expect(readFileSync(join(dir, 'docs', 'adoption.md'), 'utf8')).toBe(renderAdoptionPage(null));
  });

  it('refuses a reading it cannot parse rather than writing "nobody has looked" over a real page', () => {
    const dir = fresh();
    mkdirSync(join(dir, 'results'));
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'results', 'badge-adoption.json'), 'not a reading\n');
    writeFileSync(join(dir, 'docs', 'adoption.md'), 'the page as committed\n');
    const { status, stderr } = runTool(dir, ['--render-only']);
    expect(status).toBe(1);
    expect(stderr).toContain('does not parse');
    expect(readFileSync(join(dir, 'docs', 'adoption.md'), 'utf8')).toBe('the page as committed\n');
  });

  it('rejects an argument it does not know before it does anything', () => {
    const dir = fresh();
    const { status, stderr } = runTool(dir, ['--render-onyl']);
    expect(status).toBe(2);
    expect(stderr).toContain('--render-only');
    expect(existsSync(join(dir, 'docs'))).toBe(false);
  });
});

/**
 * docs/adoption.md says of itself that it is "rebuilt from
 * results/badge-adoption.json every time someone looks". This holds it to that.
 * It is also what gives the adoption workflow's `npm test` step something to
 * guard: a bot push starts no CI run, and no other test reads the committed
 * reading.
 */
describe('the committed reading', () => {
  it('is what the committed page renders — `npm run adoption -- --render-only` rebuilds it', () => {
    const run = parseAdoption(readFileSync(join(repoRoot, 'results', 'badge-adoption.json'), 'utf8'));
    expect(run).not.toBeNull();
    const page = readFileSync(join(repoRoot, 'docs', 'adoption.md'), 'utf8');
    expect(
      renderAdoptionPage(run),
      'docs/adoption.md is not what results/badge-adoption.json renders — run `npm run adoption -- --render-only` and commit the page',
    ).toBe(page);
  });
});
