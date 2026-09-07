import { describe, it, expect } from 'vitest';
import {
  IGNORED_SPEC_DIRS,
  KNOWN_SPEC_REVISIONS,
  PROTOCOL_VERSION,
  SPEC_REVISION_NAME,
  listingIsUnreadable,
  newerThanPinned,
  specSnapshotProblem,
  type SpecListingReading,
} from '../src/core/protocol.js';
import { bandSnapshotProblem } from '../src/audit/deferral.js';

/** A listing that agrees with the snapshot, as one look found it on 2026-09-08. */
const agreeing: SpecListingReading = {
  dated: [...KNOWN_SPEC_REVISIONS.revisions],
  ignored: ['draft'],
  unrecognised: [],
  latestSaid: '2026-07-28',
};
const listing = (over: Partial<SpecListingReading>): SpecListingReading => ({ ...agreeing, ...over });

describe('the reading itself', () => {
  it('names the revision this probe sends', () => {
    expect(KNOWN_SPEC_REVISIONS.revisions).toContain(PROTOCOL_VERSION);
  });

  it('says where it was read and on what day', () => {
    expect(KNOWN_SPEC_REVISIONS.source).toMatch(/^https:\/\//);
    expect(KNOWN_SPEC_REVISIONS.readOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  /**
   * What makes `newerThanPinned`'s string comparison total rather than a guess:
   * every entry is a date in a format that sorts lexicographically, none
   * repeats, and the list is already in order.
   */
  it('is dated revisions, sorted, without duplicates', () => {
    const { revisions } = KNOWN_SPEC_REVISIONS;
    for (const r of revisions) expect(r, r).toMatch(SPEC_REVISION_NAME);
    expect(revisions).toEqual([...revisions].sort());
    expect(new Set(revisions).size).toBe(revisions.length);
  });
});

describe('newerThanPinned', () => {
  it('answers about the version it is given, not only the one compiled in', () => {
    // The caller that most needs this asks it of the version a past release
    // shipped, which is scraped out of that release's source and need not equal
    // trunk's — so the pin is a parameter, the way bandSnapshotProblem takes
    // both its operands.
    expect(newerThanPinned(KNOWN_SPEC_REVISIONS, '2024-11-05')).toEqual([
      '2025-03-26',
      '2025-06-18',
      '2025-11-25',
      '2026-07-28',
    ]);
    expect(newerThanPinned(KNOWN_SPEC_REVISIONS, '2026-07-28')).toEqual([]);
  });

  it('defaults to the revision this probe sends', () => {
    expect(newerThanPinned(KNOWN_SPEC_REVISIONS)).toEqual(newerThanPinned(KNOWN_SPEC_REVISIONS, PROTOCOL_VERSION));
  });
});

describe('specSnapshotProblem', () => {
  it('is silent when the listing agrees', () => {
    expect(specSnapshotProblem(KNOWN_SPEC_REVISIONS, agreeing)).toEqual([]);
  });

  /** The case the whole watch exists for, driven by the real one. */
  it('names a revision the specification published and the snapshot does not', () => {
    const behind = { ...KNOWN_SPEC_REVISIONS, revisions: KNOWN_SPEC_REVISIONS.revisions.filter((r) => r !== '2026-07-28') };
    const problems = specSnapshotProblem(behind, agreeing);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('2026-07-28');
    expect(problems[0]).toContain('nothing here noticed');
  });

  it('calls a snapshot naming an unpublished revision wrong, not old', () => {
    const problems = specSnapshotProblem(KNOWN_SPEC_REVISIONS, listing({ dated: ['2024-11-05'] }));
    expect(problems.join(' ')).toContain('wrong, not old');
  });

  /** Both clauses, not the first: a stale complaint must not hide a real move. */
  it('reports every problem it finds, not the first', () => {
    const problems = specSnapshotProblem(
      { ...KNOWN_SPEC_REVISIONS, revisions: ['2024-11-05', '2099-01-01'] },
      listing({ unrecognised: ['next'] }),
    );
    expect(problems).toHaveLength(3);
    expect(problems.join(' ')).toContain('2099-01-01');
    expect(problems.join(' ')).toContain('next');
  });

  it('reports a name it does not understand rather than dropping it', () => {
    const problems = specSnapshotProblem(KNOWN_SPEC_REVISIONS, listing({ unrecognised: ['2026-07-28-rc1'] }));
    expect(problems.join(' ')).toContain('2026-07-28-rc1');
  });

  /**
   * `draft` is excluded by a named list, not by failing the date pattern. The
   * difference matters: were it a side effect of the regex, this test would be
   * pinning collateral damage, and the next unfamiliar name would vanish the
   * same silent way. Put the same name in the bucket for things the watch does
   * not understand and it is reported.
   */
  it('ignores draft by decision, and would report it if it were not on the list', () => {
    expect(IGNORED_SPEC_DIRS).toContain('draft');
    expect(specSnapshotProblem(KNOWN_SPEC_REVISIONS, listing({ ignored: ['draft'] }))).toEqual([]);
    expect(specSnapshotProblem(KNOWN_SPEC_REVISIONS, listing({ ignored: [], unrecognised: ['draft'] }))).toHaveLength(1);
  });
});

describe('listingIsUnreadable', () => {
  it('passes a listing that can be compared', () => {
    expect(listingIsUnreadable(agreeing)).toBeNull();
  });

  /**
   * An empty listing is a failure to look. Reported as drift it would say every
   * pinned revision had been withdrawn, and the remedy printed beside it would
   * be to delete a constant that was correct.
   */
  it('refuses a listing with no dated revision in it', () => {
    expect(listingIsUnreadable(listing({ dated: [] }))).toContain('failure to look');
  });

  it('refuses two sources that disagree', () => {
    const why = listingIsUnreadable(listing({ latestSaid: '2027-01-01' }));
    expect(why).toContain('2027-01-01');
    expect(why).toContain('neither is evidence');
  });

  it('is content when the schema file was not read at all', () => {
    expect(listingIsUnreadable(listing({ latestSaid: null }))).toBeNull();
  });
});

/**
 * The one rule this must not inherit from the pattern it copies.
 *
 * `bandSnapshotProblem` (audit/deferral.ts) tolerates a snapshot that lags:
 * a bot widens the divergence run on a schedule and cannot edit TypeScript, so
 * demanding agreement would turn main red for a commit that had only measured a
 * server. Nothing of the kind happens to the specification — a revision
 * appearing upstream *is* the event — so the same shape of staleness that the
 * band forgives has to be a problem here. If someone ever unifies these two
 * rules, this is the test that should stop them.
 */
describe('a snapshot of the spec may not lag, unlike the band', () => {
  it('forgives a band measured over fewer servers than the run now holds', () => {
    expect(bandSnapshotProblem({ low: 0.19, high: 1.93, servers: 20 }, { low: 0.19, high: 1.93, servers: 86 })).toBeNull();
  });

  it('does not forgive a spec snapshot that has fallen behind the listing', () => {
    const behind = { ...KNOWN_SPEC_REVISIONS, revisions: KNOWN_SPEC_REVISIONS.revisions.slice(0, -1) };
    expect(specSnapshotProblem(behind, agreeing)).not.toEqual([]);
  });
});
