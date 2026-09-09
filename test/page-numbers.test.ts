import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGE_FILES, type PageFile } from '../src/sweep/published-stats.js';
import { maintainedSpans, stripNonProse } from '../src/sweep/page-prose.js';

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
 * A count of something this project measures: a numeral or a spelled-out
 * small number, then up to three words, then one of the nouns the data is
 * counted in. Spelled-out numbers are in scope precisely because one of the
 * two drifted sentences said "nine servers" rather than "9".
 */
const COUNT_CLAIM =
  /(?<![\w.,])(?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?![\w.,])(?:[ \t\n]+(?:[A-Za-z][\w'’-]*|\*\*|\*)){0,3}[ \t\n]+(?:servers?|candidates?|entries|rows?|tools?|tokens?|clients?|measurements?|sweeps?|movements?)\b/gi;

/**
 * Counts that are deliberately static, each with the reason it cannot drift.
 * A number belongs here only when the data cannot move it; anything the sweep
 * can change belongs in `PAGE_CLAIMS` instead.
 */
const STATIC_COUNTS: { file: PageFile; text: string; why: string }[] = [
  // --- grammar, not arithmetic: a small number used as a determiner ---
  {
    file: 'README.md',
    text: 'one client',
    why: 'a determiner in prose about how discovery works, not a count of clients',
  },
  {
    file: 'README.md',
    text: 'one server',
    why: 'a determiner: "what one server costs", not a count',
  },
  {
    file: 'README.md',
    text: 'one mistake this tool',
    why: 'prose, not a count of anything measured',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'one row',
    why: 'a determiner in the description of a single history row',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'One extra server',
    why: 'a determiner in the harness-guard rule',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'one server',
    why: 'a determiner: the rule is stated per server',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'one measurement',
    why: 'a determiner: the rule is stated per measurement',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'two configured entries',
    why: 'the worked example in the deferral model, whose numbers are invented for the example',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'two tools',
    why: 'the worked example, not the measured set',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'two measurements',
    why: 'a determiner: comparability is defined between two measurements',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'three fields an Anthropic tool',
    why: 'the Anthropic tool schema has three request fields — a fact about the API, not about this data',
  },

  // --- frozen or externally fixed ---
  {
    file: 'README.md',
    text: '10 clients',
    why: 'the number of client config formats `audit` discovers — moves when code moves, and the deferral table test already reads the page against the resolver',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'Three clients',
    why: 'the clients whose vendors are on record as deferring — `DEFERRAL_ON_RECORD` in `audit/deferral.ts`, whose membership `audit-clients.test.ts` pins; it moves when code moves, not when the sweep runs',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'four is a measurement',
    why: 'the four kinds of first-party record the rule admits, listed in the table above it — a property of the rule, not of the data',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: '128 tools',
    why: "VS Code's documented maximum of enabled tools per chat request, a fact about that client read 2026-09-09, not about this data",
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: '100 tools',
    why: "Windsurf's documented tool cap, a fact about that client read 2026-09-06, not about this data",
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: '197 tokens',
    why:
      'a dated reading from one capability-probe run in CI on 2026-09-06, stated with its date — ' +
      'it describes what that run saw, not the current data. ' +
      'Regen cannot maintain it because nothing in results/ holds it: the probe writes no published ' +
      'record by design. Retake it with tools/capability-probe.ts and re-date the sentence.',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: '197 tokens on one server',
    why: 'the same dated reading, matched a second time by the longer span',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: 'eleven of eighty-eight answering servers',
    why:
      'a dated reading, stated with its date: what the 2026-09-07 protocol-version census found, ' +
      'quoted from the docblock in core/types.ts that records the measure-through decision it ' +
      'evidences. History regen cannot maintain — no published record holds the census, and a ' +
      'future sweep changes the current corpus, not what that census saw. Retake and re-date ' +
      'both surfaces together if the census is ever rerun.',
  },
  {
    file: 'README.md',
    text: '1,200 tokens',
    why: 'an illustrative release-size figure in the badge pitch, not a measurement',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: '5 servers',
    why: 'the harness-guard floor, a constant in `harness-guard.ts`',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: '25 tokens',
    why: '`SIGNIFICANT_TOKENS`, a constant in `core/regression.ts`',
  },
  {
    file: 'docs/METHODOLOGY.md',
    text: '57 measured servers',
    why: 'the frozen band derivation: the size of the 2026-08-16 sweep the bands were cut against, which is history and must not move',
  },
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

/**
 * The page that replaced the withdrawn state-of report, held to nothing that
 * can rot.
 *
 * `docs/state-of-mcp-context-cost.md` was hand-written prose outside
 * `PAGE_FILES`, and it published a figure that was never true beside six more
 * that had drifted since the day they were read. Nothing above catches that,
 * because the guard above only walks `PAGE_FILES`, and nothing else did
 * either: regen never wrote the file, so `regenIsAFixedPoint` copied it into
 * its scratch tree and compared it against itself, green unconditionally.
 *
 * It was withdrawn on 2026-09-08. The address could not be, because it is
 * printed in the README of every release from 0.10.0 to 0.17.0 and those
 * tarballs are immutable, so the path now serves a withdrawal notice instead
 * of a 404. Putting a hand-written page back at the address that produced the
 * defect is only safe under one property: it states no number. That is what is
 * checked here, rather than trusted — a notice that acquires a measurement has
 * become the thing it replaced, and would be just as unreachable from the
 * guard above.
 */
describe('the withdrawn state-of report states nothing that can drift', () => {
  const TOMBSTONE = 'docs/state-of-mcp-context-cost.md';
  const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;

  /** The two events the notice is a record of. Both are history and cannot move. */
  const DATES_IT_MAY_STATE = ['2026-09-04', '2026-09-08'];

  const prose = stripNonProse(readFileSync(join(repoRoot, TOMBSTONE), 'utf8'));

  it('carries no digit outside the dates it records', () => {
    const withoutDates = prose.replace(ISO_DATE, (m) => ' '.repeat(m.length));
    const stray = [...withoutDates.matchAll(/\d[\d,.]*/g)].map((m) => m[0]);
    expect(
      stray,
      `${TOMBSTONE} states a number. It is hand-written prose at the address of a report ` +
        'withdrawn for publishing figures nothing could check; the only thing keeping it safe ' +
        'is that it has none. Send the reader to the leaderboard instead.',
    ).toEqual([]);
  });

  it('states those two dates and no others', () => {
    expect([...new Set(prose.match(ISO_DATE) ?? [])].toSorted()).toEqual(DATES_IT_MAY_STATE);
  });
});
