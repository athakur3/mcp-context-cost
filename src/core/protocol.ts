/**
 * The MCP revision this probe speaks, and the one place it is written down.
 *
 * Every record under `results/` was taken over a handshake that sent this
 * string. Moving it therefore re-opens the question of whether the numbers
 * either side of the move are comparable, which is why it is not a value to
 * keep current for its own sake: a newer revision published in the spec
 * repository is a reason to *read the new schema*, not by itself a reason to
 * change what we send.
 *
 * It lives in `core` because the sites that send it are in `sweep` and `audit`
 * both — the stdio probe's `initialize` params, and the remote probe's
 * JSON-RPC body and its `MCP-Protocol-Version` header, which have to agree with
 * each other and did so only by hand-typed coincidence. The stubs in `test/`
 * keep their own literals on purpose: a fixture that imported this constant
 * would agree with the probe by construction and could no longer catch it
 * drifting.
 *
 * Deliberately absent from `core/index.ts`, which names the library's exports
 * one by one rather than re-exporting whole modules — this is the harness
 * talking about itself, not part of the measurement anyone imports.
 */
export const PROTOCOL_VERSION = '2025-06-18';

/**
 * A decision about the pin above, so it is made once and read thereafter: the
 * newer revisions considered, the day, the reason the pin stays, and what
 * would reopen the question. The same discipline as `SpecRevisionReading`
 * below — a dated claim rather than an undated opinion.
 *
 * `tools/release-readiness.ts` prints this beside its released-pin notice, so
 * a release does not re-ask a question that has an answer on record. The
 * record covers only the revisions it names: one appearing that is not in
 * `considered` is a new question, and the notice says so by itself.
 */
export interface PinDecision {
  /** The revisions newer than the pin that were considered and declined. */
  considered: string[];
  /** The day the decision was taken. */
  on: string;
  /** Why the pin stays. */
  because: string;
  /** The condition under which this stops being an answer. */
  reopenWhen: string;
}

export const PIN_DECISION: PinDecision = {
  considered: ['2025-11-25', '2026-07-28'],
  on: '2026-09-08',
  because:
    '2026-07-28 removes the `initialize` handshake in favour of `server/discover` and moves the ' +
    'version into a per-request `_meta` field — following it is a change of methodology, not a ' +
    'version bump, and every published number was taken over the handshake the pin names. ' +
    '2025-11-25 changes none of the three methods this probe sends. The schema reading behind ' +
    "this is `PROTOCOL_MISMATCH_EVIDENCE`'s docblock in sweep/run.ts.",
  reopenWhen:
    'a measured server refuses the pinned handshake (it would surface as `protocol-mismatch` ' +
    'rows), or the specification publishes a revision this record does not name.',
};

/**
 * A reading of which MCP revisions the specification publishes, taken on a day
 * from a place — the same shape a name collision or a deprecation takes in
 * `sweep/report.ts`, and for the same reason: it is a claim about something
 * outside this repository, so it carries where it came from and when.
 */
export interface SpecRevisionReading {
  /** Every published revision, dated, sorted, without duplicates. */
  revisions: string[];
  /** Where it was read. */
  source: string;
  /** The day it was read. */
  readOn: string;
}

/**
 * The revisions the specification published, as read on the day below.
 *
 * Unlike `PUBLISHED_WIRE_TO_CLIENT_RATIO` in `audit/deferral.ts`, **this
 * snapshot is not allowed to lag.** That one may, because a bot widens the
 * divergence run on a schedule and cannot edit TypeScript, so demanding
 * agreement would turn main red for a commit that had done nothing but measure.
 * Nothing of the sort happens here: a revision appearing upstream *is* the
 * event this snapshot exists to notice, and a version of this rule that
 * tolerated being behind would be silent at exactly the moment it was needed.
 */
export const KNOWN_SPEC_REVISIONS: SpecRevisionReading = {
  revisions: ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25', '2026-07-28'],
  source: 'https://api.github.com/repos/modelcontextprotocol/modelcontextprotocol/contents/schema',
  readOn: '2026-09-08',
};

/**
 * Directory names under `schema/` that are deliberately not revisions.
 *
 * An explicit list rather than a side effect of the date pattern. `draft` moves
 * constantly and names nothing a server can claim to speak, so a watch that
 * treated it as a revision would cry wolf every time the specification's
 * authors saved a file — and a watch people learn to ignore is worse than no
 * watch. Being explicit is also what lets an unfamiliar name be *reported*
 * rather than silently dropped: anything neither dated nor listed here is
 * something this rule does not understand, which is worth saying out loud.
 */
export const IGNORED_SPEC_DIRS = ['draft'];

/** A directory name that is a revision this project could pin. */
export const SPEC_REVISION_NAME = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What one look at the specification repository found.
 *
 * `latestSaid` is a second, independent answer to a related question: the
 * schema file states its own `LATEST_PROTOCOL_VERSION`, which is the
 * specification's word rather than an inference from directory names. It is
 * here to corroborate, not to decide — during a development window the file can
 * name a revision no directory publishes yet.
 */
export interface SpecListingReading {
  dated: string[];
  ignored: string[];
  unrecognised: string[];
  latestSaid: string | null;
}

/**
 * Why this listing cannot be compared against anything, or `null` if it can.
 *
 * Separate from `specSnapshotProblem` because the two answer different
 * questions, and confusing them is the specific failure this watch is designed
 * against. "I could not see" must never be reported as "nothing has changed",
 * and it must never be reported as drift either: a listing that came back empty
 * because the repository was restructured would otherwise be read as every
 * pinned revision having been withdrawn, and the printed remedy would be to
 * delete a constant that was correct.
 */
export function listingIsUnreadable(live: SpecListingReading): string | null {
  if (live.dated.length === 0) {
    return 'the listing published no dated revision at all, which is a failure to look rather than a reading';
  }
  if (live.latestSaid !== null && !live.dated.includes(live.latestSaid)) {
    return (
      `the schema file calls ${live.latestSaid} the latest revision and the directory listing does not ` +
      'publish it — the two sources disagree, so neither is evidence'
    );
  }
  return null;
}

/**
 * Revisions the reading names that are newer than the one being asked about.
 *
 * The pin is a parameter, defaulted, and not simply `PROTOCOL_VERSION`: the
 * caller that most needs this asks it of the version a *past release* shipped,
 * which is a string scraped out of that release's source and need not equal
 * trunk's. `bandSnapshotProblem` takes both its operands for the same reason.
 *
 * This answers ordering — how far behind is the version in question — and not
 * membership. Whether the specification published something this project does
 * not name is `specSnapshotProblem`'s question, and using this one for it would
 * miss a revision published *below* the pin. Takes the reading rather than a
 * bare array so that only a list already held to the shape rules can reach a
 * comparison that assumes dates.
 */
export function newerThanPinned(
  reading: SpecRevisionReading,
  pin: string = PROTOCOL_VERSION,
): string[] {
  return reading.revisions.filter((r) => r > pin);
}

/**
 * Everything wrong between what this project believes the specification
 * publishes and what one look found. Empty means they agree.
 *
 * Returns every problem rather than the first. `bandSnapshotProblem` returns
 * one and stops, which suits a single-sentence caller; here the clauses are
 * independent, and stopping at the first would let a stale-snapshot complaint
 * hide the new revision that is the whole reason for looking.
 */
export function specSnapshotProblem(
  snapshot: SpecRevisionReading,
  live: SpecListingReading,
): string[] {
  const problems: string[] = [];
  const unnamed = live.dated.filter((r) => !snapshot.revisions.includes(r));
  if (unnamed.length > 0) {
    problems.push(
      `the specification publishes ${unnamed.join(', ')}, which this snapshot does not name — ` +
        'the spec moved and nothing here noticed',
    );
  }
  const withdrawn = snapshot.revisions.filter((r) => !live.dated.includes(r));
  if (withdrawn.length > 0) {
    problems.push(
      `this snapshot names ${withdrawn.join(', ')} and the listing does not publish it — ` +
        'the snapshot is wrong, not old',
    );
  }
  if (live.unrecognised.length > 0) {
    problems.push(
      `the listing publishes ${live.unrecognised.join(', ')}, which this watch does not know how to read — ` +
        `neither a dated revision nor one of the names it ignores (${IGNORED_SPEC_DIRS.join(', ')})`,
    );
  }
  return problems;
}
