import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  CHECK_CLAIMS,
  PAGE_CLAIMS,
  SAMPLE_SERVERS,
  applyClaim,
  compileTemplate,
  computePublishedStats,
  floorToTwoSignificant,
  heaviestDroppedField,
  verifyPublishedPages,
} from '../src/sweep/published-stats.js';
import { countTokens } from '../src/core/canonical.js';
import type { ServerEntry } from '../src/sweep/report.js';

/**
 * The published pages' numbers, read against the data they describe.
 *
 * README and docs/index.md state counts, the span, sample tables, the Claude
 * pair — numbers that change when a scheduled sweep lands, with no human in the
 * loop. Regen patches them from results/ (published-stats.ts); this suite is
 * the other half of that arrangement: the committed pages must already agree
 * with the committed data, so the check fires exactly when someone changes data
 * without running regen, or rewords a sentence regen maintains. The deferral
 * tables bought this property first (published-deferral.test.ts); the front
 * page's numbers had drifted the same way twice — repaired by hand 2026-08-20,
 * wrong again by 2026-09-03 — before getting the same treatment.
 */

const repoRoot = join(import.meta.dirname, '..');
const entries = (parse(readFileSync(join(repoRoot, 'servers.yaml'), 'utf8')) as { servers: ServerEntry[] }).servers;
const stats = computePublishedStats(entries, repoRoot);

describe('published pages agree with the data on disk', () => {
  it('regen would rewrite nothing and refuse nothing', () => {
    const v = verifyPublishedPages(entries, repoRoot);
    // A failure here names the claim: run `npx tsx src/sweep/regen.ts` for a
    // drifted number; a missing anchor means a maintained sentence was reworded
    // and the claim in published-stats.ts has to be reworded with it.
    expect(v.problems).toEqual([]);
    expect(v.updated).toEqual([]);
    expect(v.changedFiles).toEqual([]);
  });

  it('counts the same measured/candidate split as the leaderboard header', () => {
    const header = readFileSync(join(repoRoot, 'results', 'leaderboard.md'), 'utf8');
    const m = /Measured (\d+)\/(\d+) candidates/.exec(header);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(stats.measuredCount);
    expect(Number(m![2])).toBe(stats.candidateTotal);
  });

  for (const claim of CHECK_CLAIMS) {
    it(`'${claim.id}' — the words are on the page and the data still agrees`, () => {
      const page = readFileSync(join(repoRoot, claim.file), 'utf8');
      expect([...page.matchAll(compileTemplate(claim.words))]).toHaveLength(1);
      expect(claim.holds(stats)).toBeNull();
    });
  }

  it('states a Claude figure only where the leaderboard would print one', () => {
    // The README once carried github at 54,422 (from a divergence row computed
    // against bytes that no longer existed) three lines from 54,622 (from the
    // measurement) — the staleness gate guarded one number and not its
    // neighbour. The badge column now comes from the measurement, and the
    // Claude column is null exactly when the leaderboard prints `—`.
    const board = readFileSync(join(repoRoot, 'results', 'leaderboard.md'), 'utf8');
    for (const name of ['github', 'notion'] as const) {
      const row = board.split('\n').find((l) => l.includes(`| [${name}](`))!;
      const boardShowsClaude = row.split('|')[5]?.trim() !== '—';
      expect(stats.claude[name].claudeTokens === null, `${name}: README vs leaderboard`).toBe(!boardShowsClaude);
      // And the badge column is the measured number, never the run's copy of it.
      expect(stats.claude[name].badgeTokens).toBe(stats.sample[name]?.tokens ?? stats.claude[name].badgeTokens);
    }
  });

  it('derives its ranges only from rows that still describe the capture on disk', () => {
    expect(stats.claude.shareMin).toBeGreaterThanOrEqual(0);
    expect(stats.claude.shareMax).toBeLessThanOrEqual(1);
    expect(stats.claude.shareMin).toBeLessThanOrEqual(stats.claude.shareMax);
    // The exemplar METHODOLOGY names is derived, so it cannot name a stale row.
    expect(stats.claude.widest.mapped).toBeLessThanOrEqual(stats.claude.widest.full);
  });

  it('derives the numbers the pages state from the same rules the leaderboard uses', () => {
    expect(Object.keys(stats.sample).sort()).toEqual([...SAMPLE_SERVERS].sort());
    expect(stats.spanTimes).toBe(floorToTwoSignificant(stats.max.tokens / stats.min.tokens));
    expect(stats.max.tokens).toBeGreaterThan(stats.second.tokens);
    expect(stats.second.tokens).toBeGreaterThan(stats.min.tokens);
    expect(stats.claude.currentCount).toBeLessThanOrEqual(stats.claude.runSize);
    // The verify transcript quotes the same measurement the sample table shows.
    expect(stats.verify.tokens).toBe(stats.sample.github.tokens);
  });
});

describe('the patch engine', () => {
  const claim = { file: 'README.md', id: 'unit', template: 'cost spans **{n}×**, from `{w}` at {n} tokens' } as const;

  it('matches a sentence across the line wraps prose actually has', () => {
    const wrapped = 'cost spans **1,700×**,\nfrom `postgres` at 32 tokens';
    expect([...wrapped.matchAll(compileTemplate(claim.template))]).toHaveLength(1);
  });

  it('escapes markdown punctuation so a table row anchors literally', () => {
    const row = compileTemplate('| filesystem (reference) | {n} | {n} |');
    expect([...'| filesystem (reference) | 2,823 | 14 |'.matchAll(row)]).toHaveLength(1);
    expect([...'| filesystem Xreference) | 2,823 | 14 |'.matchAll(row)]).toHaveLength(0);
  });

  it('reads a decimal as one slot', () => {
    const m = [...'between 0.7% and **89.9%**'.matchAll(compileTemplate('between {f}% and **{f}%**'))];
    expect(m).toHaveLength(1);
    expect(m[0].slice(1)).toEqual(['0.7', '89.9']);
  });

  it('splices only the slots, leaving words and wrapping untouched', () => {
    const stale = 'lead-in\ncost spans **1,500×**,\nfrom `mysql` at 40 tokens\ntrail-out';
    const applied = applyClaim(stale, claim, ['1,700', 'postgres', '32']);
    expect(applied.changed).toBe(true);
    expect(applied.problem).toBeNull();
    expect(applied.text).toBe('lead-in\ncost spans **1,700×**,\nfrom `postgres` at 32 tokens\ntrail-out');
  });

  it('reports agreement as no change at all', () => {
    const current = 'cost spans **1,700×**, from `postgres` at 32 tokens';
    const applied = applyClaim(current, claim, ['1,700', 'postgres', '32']);
    expect(applied.changed).toBe(false);
    expect(applied.problem).toBeNull();
    expect(applied.text).toBe(current);
  });

  it('refuses a page that dropped the sentence, naming the claim', () => {
    const applied = applyClaim('a page about something else entirely', claim, ['1,700', 'postgres', '32']);
    expect(applied.changed).toBe(false);
    expect(applied.problem).toContain("'unit' not found");
  });

  it('refuses an ambiguous anchor rather than patching the wrong one', () => {
    const twice = 'cost spans **9×**, from `a` at 1 tokens … cost spans **9×**, from `a` at 1 tokens';
    const applied = applyClaim(twice, claim, ['1,700', 'postgres', '32']);
    expect(applied.changed).toBe(false);
    expect(applied.problem).toContain('matches 2 places');
  });

  it('never overstates a span: floors, to two significant digits', () => {
    expect(floorToTwoSignificant(1700.6875)).toBe(1700);
    expect(floorToTwoSignificant(1799)).toBe(1700);
    expect(floorToTwoSignificant(1800)).toBe(1800);
    expect(floorToTwoSignificant(999)).toBe(990);
    expect(floorToTwoSignificant(99.9)).toBe(99);
    expect(floorToTwoSignificant(7)).toBe(7);
  });

  /**
   * The sentence this feeds was hand-written and said most of github's capture
   * was `annotations`/`outputSchema` metadata. github ships no `outputSchema`
   * and 1.7% of annotations; the 78% being dropped was `icons`. A plausible
   * claim nobody could have noticed going stale, so it is derived now.
   */
  describe('heaviestDroppedField', () => {
    it('names the heaviest field an Anthropic request cannot carry, and its share', () => {
      const capture = [
        { name: 'a', description: 'd', inputSchema: { type: 'object' }, icons: { big: 'x'.repeat(400) } },
        { name: 'b', description: 'd', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
      ];
      const total = countTokens(JSON.stringify(capture));
      const got = heaviestDroppedField(capture, total);
      expect(got.dropField).toBe('icons');
      expect(got.dropSharePct).toBeGreaterThan(50);
    });

    it('never counts the three fields the request does carry', () => {
      const capture = [{ name: 'a', description: 'x'.repeat(2000), inputSchema: { type: 'object' }, icons: { s: 'y' } }];
      // The description dwarfs everything, and it is not dropped — so it must
      // not be the answer.
      expect(heaviestDroppedField(capture, countTokens(JSON.stringify(capture))).dropField).toBe('icons');
    });

    it('says none rather than guessing when a capture drops nothing', () => {
      const capture = [{ name: 'a', description: 'd', inputSchema: { type: 'object' } }];
      expect(heaviestDroppedField(capture, 50)).toEqual({ dropField: 'none', dropSharePct: 0 });
      expect(heaviestDroppedField(null, 50).dropField).toBe('none');
    });

    it('breaks a tie on the field name, so the sentence does not flip between regenerations', () => {
      const capture = [{ name: 'a', zzz: 'same', aaa: 'same' }];
      expect(heaviestDroppedField(capture, 100).dropField).toBe('aaa');
    });
  });

  it('every claim template has as many slots as its values function returns', () => {
    for (const c of PAGE_CLAIMS) {
      const slots = [...c.template.matchAll(/\{[ndwfq]\}/g)].length;
      expect(c.values(stats), `claim '${c.id}'`).toHaveLength(slots);
    }
  });
});
