import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHECK_CLAIMS,
  PAGE_CLAIMS,
  PAGE_FILES,
  compileTemplate,
  type PageFile,
} from '../src/sweep/published-stats.js';

/**
 * The drift guard for counts nobody maintains.
 *
 * `published-stats.ts` keeps every number regen owns true on every sweep. It
 * says nothing about a number regen does *not* own — and two of those sat on
 * the front page for weeks: "82 curated candidates" against 106 in
 * `servers.yaml`, and "nine servers ratcheting upward against one that got
 * cheaper" ninety lines below the maintained "11 moved up against 6 that moved
 * down". Both were written by hand, were true the day they were written, and
 * drifted with the data while the maintained sentences beside them did not.
 *
 * So: every count these three pages state about the measured set is either
 * inside a claim regen maintains, or written down below as deliberately
 * static, with the reason it will not drift. Adding a third kind fails here.
 */
const repoRoot = join(import.meta.dirname, '..');

/**
 * Numbers in code are not claims about the data: fenced blocks and inline code
 * are transcripts, commands and JSON — illustrations of shape, shown as they
 * were run. Link targets and URLs are addresses. Blanked rather than removed so
 * every offset still lines up with the raw text the claims are matched against.
 */
const blank = (m: string) => m.replace(/[^\n]/g, ' ');
const stripNonProse = (text: string) =>
  text
    .replace(/^```[\s\S]*?^```/gm, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/\]\([^)]*\)/g, blank)
    .replace(/https?:\/\/\S+/g, blank);

/**
 * A count of something this project measures: a numeral or a spelled-out
 * small number, then up to three words, then one of the nouns the data is
 * counted in. Spelled-out numbers are in scope precisely because one of the
 * two drifted sentences said "nine servers" rather than "9".
 */
const COUNT_CLAIM =
  /(?<![\w.,])(?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?![\w.,])(?:[ \t\n]+(?:[A-Za-z][\w'’-]*|\*\*|\*)){0,3}[ \t\n]+(?:servers?|candidates?|entries|rows?|tools?|tokens?|clients?|measurements?|sweeps?|movements?)\b/gi;

/** Half-open ranges of the page that regen owns, from the claims themselves. */
function maintainedSpans(file: PageFile, raw: string): [number, number][] {
  const spans: [number, number][] = [];
  const templates = [
    ...PAGE_CLAIMS.filter((c) => c.file === file).map((c) => c.template),
    ...CHECK_CLAIMS.filter((c) => c.file === file).map((c) => c.words),
  ];
  for (const template of templates) {
    for (const m of raw.matchAll(compileTemplate(template))) {
      spans.push([m.index, m.index + m[0].length]);
    }
  }
  return spans;
}

/**
 * Counts that are deliberately static, each with the reason it cannot drift.
 * A number belongs here only when the data cannot move it; anything the sweep
 * can change belongs in `PAGE_CLAIMS` instead.
 */
const STATIC_COUNTS: { file: PageFile; text: string; why: string }[] = [
  // --- grammar, not arithmetic: a small number used as a determiner ---
  { file: 'README.md', text: 'one client', why: 'a determiner in prose about how discovery works, not a count of clients' },
  { file: 'README.md', text: 'one server', why: 'a determiner: "what one server costs", not a count' },
  { file: 'README.md', text: 'one mistake this tool', why: 'prose, not a count of anything measured' },
  { file: 'docs/METHODOLOGY.md', text: 'one row', why: 'a determiner in the description of a single history row' },
  { file: 'docs/METHODOLOGY.md', text: 'One extra server', why: 'a determiner in the harness-guard rule' },
  { file: 'docs/METHODOLOGY.md', text: 'one server', why: 'a determiner: the rule is stated per server' },
  { file: 'docs/METHODOLOGY.md', text: 'one measurement', why: 'a determiner: the rule is stated per measurement' },
  { file: 'docs/METHODOLOGY.md', text: 'two configured entries', why: 'the worked example in the deferral model, whose numbers are invented for the example' },
  { file: 'docs/METHODOLOGY.md', text: 'two tools', why: 'the worked example, not the measured set' },
  { file: 'docs/METHODOLOGY.md', text: 'two measurements', why: 'a determiner: comparability is defined between two measurements' },
  { file: 'docs/METHODOLOGY.md', text: 'three fields an Anthropic tool', why: 'the Anthropic tool schema has three request fields — a fact about the API, not about this data' },

  // --- frozen or externally fixed ---
  { file: 'README.md', text: '10 clients', why: 'the number of client config formats `audit` discovers — moves when code moves, and the deferral table test already reads the page against the resolver' },
  { file: 'README.md', text: 'nine discovered clients', why: 'the same discovery set less Claude Code, in the audit walkthrough — a property of the code, not of the sweep' },
  { file: 'docs/METHODOLOGY.md', text: '100 tools', why: "Windsurf's documented tool cap, a fact about that client read 2026-09-06, not about this data" },
  {
    file: 'docs/METHODOLOGY.md',
    text: '197 tokens',
    why:
      'a dated reading from one capability-probe run in CI on 2026-09-06, stated with its date — ' +
      'it describes what that run saw, not the current data, the same way the adoption reading does. ' +
      'Regen cannot maintain it because nothing in results/ holds it: the probe writes no published ' +
      'record by design. Retake it with tools/capability-probe.ts and re-date the sentence.',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: '197 tokens on one server',
    why: 'the same dated reading, matched a second time by the longer span',
  },
  { file: 'README.md', text: '1,200 tokens', why: 'an illustrative release-size figure in the badge pitch, not a measurement' },
  { file: 'docs/METHODOLOGY.md', text: '5 servers', why: 'the harness-guard floor, a constant in `harness-guard.ts`' },
  { file: 'docs/METHODOLOGY.md', text: '25 tokens', why: '`SIGNIFICANT_TOKENS`, a constant in `core/regression.ts`' },
  { file: 'docs/METHODOLOGY.md', text: '57 measured servers', why: 'the frozen band derivation: the size of the 2026-08-16 sweep the bands were cut against, which is history and must not move' },
  { file: 'docs/METHODOLOGY.md', text: '2,676 tokens', why: 'part of the same frozen 2026-08-16 distribution' },
  { file: 'docs/METHODOLOGY.md', text: '328 tokens', why: 'part of the same frozen 2026-08-16 distribution' },

];

describe('every count on the front pages is maintained or deliberately static', () => {
  const pages = new Map<PageFile, string>(
    PAGE_FILES.map((f) => [f, readFileSync(join(repoRoot, f), 'utf8')]),
  );

  it('leaves no hand-written count of the measured set unaccounted for', () => {
    const unaccounted: string[] = [];
    for (const [file, raw] of pages) {
      const prose = stripNonProse(raw);
      const spans = maintainedSpans(file, raw);
      for (const hit of prose.matchAll(COUNT_CLAIM)) {
        const [start, end] = [hit.index, hit.index + hit[0].length];
        if (spans.some(([a, b]) => start >= a && end <= b)) continue;
        const text = hit[0].replace(/\s+/g, ' ').trim();
        if (STATIC_COUNTS.some((s) => s.file === file && s.text === text)) continue;
        unaccounted.push(`${file}: "${text}"`);
      }
    }
    expect(
      unaccounted,
      'a count of the measured set that regen does not maintain: add it to PAGE_CLAIMS, or to ' +
        'STATIC_COUNTS with the reason the data cannot move it',
    ).toEqual([]);
  });

  it('lists no static count that has since become maintained', () => {
    // A stale allow-list entry is the same defect one level up: it says "this
    // will not drift" about a sentence that no longer exists.
    const prose = new Map(
      [...pages].map(([f, raw]) => [f, stripNonProse(raw).replace(/\s+/g, ' ')] as const),
    );
    const stale = STATIC_COUNTS.filter((s) => !prose.get(s.file)!.includes(s.text));
    expect(stale.map((s) => `${s.file}: "${s.text}"`)).toEqual([]);
  });
});
