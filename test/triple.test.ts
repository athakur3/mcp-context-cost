import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { PAGE_FILES, computePublishedStats, type PageFile } from '../src/sweep/published-stats.js';
import { stripNonProse } from '../src/sweep/page-prose.js';
import { isCurrent, mappedTokens } from '../src/core/divergence.js';
import type { ServerEntry } from '../src/sweep/report.js';
import type { Measurement } from '../src/core/types.js';

/**
 * A figure published without its two companions.
 *
 * A server has three true token counts and they do not agree: `github` is
 * 54,622 on the wire, 10,735 of which an Anthropic request carries, which
 * Claude counts at 18,728. Stating one and calling it the cost is how the front
 * page came to bill a 200K context window for 42,917 tokens of base64 `icons`
 * that no request sends, and how a published report attributed 81% of that
 * capture to a field the server does not ship. Both sentences were true-looking,
 * hand-written, and unreachable by every check here.
 *
 * So: a block of prose that names a server and states any one of its three
 * numbers states all three. `page-numbers.test.ts` is the same shape one level
 * along — it asks whether a count is maintained; this asks whether a figure is
 * accompanied.
 */
const repoRoot = join(import.meta.dirname, '..');
const fmt = (n: number) => n.toLocaleString('en-US');

interface Legs {
  wire: number;
  mapped: number;
  claude: number | null;
}

/** Every measured server's three numbers, read from results/ rather than from a page. */
const triples = (() => {
  const div = JSON.parse(readFileSync(join(repoRoot, 'results', 'divergence.json'), 'utf8')) as {
    servers: Record<string, { claudeDelta: number; capturedSha256: string; error?: string }>;
  };
  const out = new Map<string, Legs>();
  for (const d of readdirSync(join(repoRoot, 'results'), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const p = join(repoRoot, 'results', d.name, 'measurement.json');
    if (!existsSync(p)) continue;
    const m = JSON.parse(readFileSync(p, 'utf8')) as Measurement;
    if (m.status !== 'measured' && m.status !== 'dynamic') continue;
    if (typeof m.totalTokens !== 'number') continue;
    const row = div.servers[d.name];
    out.set(d.name, {
      wire: m.totalTokens,
      mapped: mappedTokens(m.rawToolsCapture ?? []),
      claude: isCurrent(row as never, m.canonicalSha256 ?? null) ? row.claudeDelta : null,
    });
  }
  return out;
})();

/**
 * Figures the pages state alone, each with the reason. A residual belongs here
 * only when the missing companions would say nothing — not when they are
 * inconvenient to fit.
 */
const WIRE_ALONE: { file: PageFile; anchor: string; server: string; why: string }[] = [];

/** A server is named when the name stands as its own word — `git` is not `github`. */
const namesServer = (block: string, name: string) =>
  new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(block);

describe('a published figure travels with its two companions', () => {
  it('states all three numbers in any block that states one', () => {
    const unaccompanied: string[] = [];
    for (const file of PAGE_FILES) {
      const raw = readFileSync(join(repoRoot, file), 'utf8');
      const rawLines = raw.split('\n');
      // Same length and same line breaks, so the two views split identically:
      // names are looked for in the raw text (a server is still named when it
      // is in backticks) and numbers only in the prose (a figure inside a
      // verify transcript is an illustration, not a claim).
      const proseLines = stripNonProse(raw).split('\n');
      const blank = (l: string) => /^\s*$/.test(l);
      for (let i = 0; i < rawLines.length; ) {
        if (blank(rawLines[i])) {
          i++;
          continue;
        }
        let j = i;
        while (j < rawLines.length && !blank(rawLines[j])) j++;
        const rawBlock = rawLines.slice(i, j).join('\n');
        const proseBlock = proseLines.slice(i, j).join('\n');
        for (const [name, t] of triples) {
          if (!namesServer(rawBlock, name)) continue;
          // Nothing is dropped, so the first two numbers are the same number
          // and one figure is the whole story: `postgres` is 32 and 32, and the
          // headline may say "postgres at 32 tokens" without dragging 348 along.
          if (t.mapped >= t.wire) continue;
          const legs: Record<string, string> = {
            wire: fmt(t.wire),
            mapped: fmt(t.mapped),
            claude: t.claude === null ? '—' : fmt(t.claude),
          };
          const absent = Object.entries(legs)
            .filter(([, v]) => !proseBlock.includes(v))
            .map(([k]) => k);
          if (absent.length === 0 || absent.length === 3) continue;
          if (WIRE_ALONE.some((e) => e.file === file && e.server === name && rawBlock.includes(e.anchor))) continue;
          unaccompanied.push(`${file}: ${name} is missing its ${absent.join(' and ')} figure`);
        }
        i = j;
      }
    }
    expect(
      unaccompanied,
      'a page states one of a server\'s three numbers without the others: state all three, or add it ' +
        'to WIRE_ALONE with the reason the companions would say nothing',
    ).toEqual([]);
  });

  it('lists no exemption whose sentence has since been rewritten', () => {
    const stale = WIRE_ALONE.filter((e) => !readFileSync(join(repoRoot, e.file), 'utf8').includes(e.anchor));
    expect(stale.map((e) => `${e.file}: "${e.anchor}"`)).toEqual([]);
  });
});

/**
 * The generated surfaces, which `PAGE_FILES` does not cover. Regen writes these
 * from the same data, so the rule above cannot reach them — but they are where
 * most readers arrive, and the badge links straight into one of them.
 */
describe('the generated surfaces carry the triple and rank on the wire', () => {
  const read = (...p: string[]) => readFileSync(join(repoRoot, ...p), 'utf8');
  const entries = (parse(read('servers.yaml')) as { servers: ServerEntry[] }).servers;
  const stats = computePublishedStats(entries, repoRoot);
  const board = read('results', 'leaderboard.md');
  const index = read('docs', 'servers', 'index.md');
  const dash = read('docs', 'dashboard.html');

  /** A markdown table's cell index for a named column, from its own header. */
  const colOf = (table: string, header: string, name: string) =>
    table
      .split('\n')
      .find((l) => l.startsWith(header))!
      .split('|')
      .findIndex((c) => c.trim() === name);

  const rowsOf = (table: string) => table.split('\n').filter((l) => /^\| \d+ \|/.test(l));
  const num = (cell: string) => Number(cell.trim().replace(/,/g, ''));

  it('prints an em-dash for the one server whose Claude count errored, and no substitute', () => {
    const gitlab = triples.get('gitlab')!;
    expect(gitlab.claude, 'fixture assumption: gitlab has no Claude figure').toBeNull();

    // The server page says why in words rather than dropping a dash into prose.
    const page = read('docs', 'servers', 'gitlab.md');
    expect(page).toContain('An Anthropic request carries 336 of those tokens as tool definitions.');
    expect(page).toContain('What Claude makes of them is not published for this server');

    // The two tables print the dash. Not a zero, and not the neighbouring figure
    // repeated — gitlab's row carries a literal 0 that a shape check would pass.
    const claudeCol = colOf(index, '| # | server |', 'Claude');
    const row = rowsOf(index).find((l) => l.includes('[gitlab]'))!;
    expect(row.split('|')[claudeCol].trim()).toBe('—');
    expect(row.split('|')[colOf(index, '| # | server |', 'mapped')].trim()).toBe('336');
  });

  it('agrees with the leaderboard about which Claude figures exist', () => {
    const claudeCol = colOf(board, '| # | server |', 'claude');
    for (const row of rowsOf(board)) {
      const name = /\| \[([^\]]+)\]/.exec(row)![1];
      const t = triples.get(name);
      if (!t) continue;
      expect(row.split('|')[claudeCol].trim() === '—', `${name}: leaderboard vs triple`).toBe(t.claude === null);
    }
  });

  it('shows the companions on the dashboard tile and a mapped column in its table', () => {
    const top = triples.get(stats.max.name)!;
    expect(dash).toContain(`<span class="l">priciest on the wire (${stats.max.name})</span>`);
    expect(dash).toContain(
      `<span class="t">${fmt(top.mapped)} carried · ${top.claude === null ? '—' : fmt(top.claude)} on Claude</span>`,
    );
    expect(dash).toContain('<th>wire (o200k)</th><th>mapped</th><th>claude req</th>');
  });

  /**
   * Publishing three numbers must not quietly reorder anything. Every surface
   * ranks on the wire, and this asserts it of the rendered artifacts rather
   * than of the sort keys — a renderer can sort correctly and print rows in
   * another order, and the sort key being right is not the claim the pages make.
   */
  it('leaves every ranked surface non-increasing by the wire figure', () => {
    const seriesOf = (rows: string[], col: number) => rows.map((r) => num(r.split('|')[col]));
    const surfaces: [string, number[]][] = [
      ['docs/servers/index.md', seriesOf(rowsOf(index), colOf(index, '| # | server |', 'wire'))],
      ['results/leaderboard.md', seriesOf(rowsOf(board), colOf(board, '| # | server |', 'tokens'))],
      [
        'docs/dashboard.html',
        [...dash.matchAll(/<tr><td>\d+<\/td><td>[^<]*<\/td><td class="num">([\d,]+)<\/td>/g)].map((m) =>
          num(m[1]),
        ),
      ],
    ];
    for (const [name, series] of surfaces) {
      expect(series.length, `${name}: no ranked rows found — the parser has gone stale`).toBeGreaterThan(10);
      const outOfOrder = series.map((n, i) => (i > 0 && n > series[i - 1] ? `${series[i - 1]} then ${n}` : '')).filter(Boolean);
      expect(outOfOrder, `${name} is not ranked on the wire`).toEqual([]);
    }
  });
});
