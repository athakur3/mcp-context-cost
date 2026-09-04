/**
 * `measure --baseline` — what *this change to your server* costs everyone who
 * installs it.
 *
 * `audit --baseline` is the consumer's half of this: what a config change adds
 * to every request they send. This is the author's half, and until it existed
 * the project asked server maintainers to publish a number it gave them no way
 * to defend. The movement report is the argument for it — nine of the servers
 * measured here ratcheted upward and not one of their maintainers had a check
 * that would have said so before release.
 *
 * The trap is the same one `audit`'s diff exists to avoid, in a sharper form: a
 * server that measured fine on `main` and fails to start on the branch makes
 * the number go *down*. Subtracting two totals would call that an improvement —
 * the flattering reading and the true one have the same shape — so a side that
 * did not produce a number never gets a delta, and a gate that cannot establish
 * the change fails rather than passing quietly. A green check on a gate that
 * never ran is the exact failure this project exists to catch.
 *
 * What this can do that the config diff cannot: both sides are single
 * measurements carrying per-tool counts, so an established change is attributed
 * exactly — which tools were added, which grew, and by how much.
 */
import { attribute, vectorEntryOf, type ToolAttribution } from './regression.js';
import type { Measurement } from './types.js';

export interface MeasuredSide {
  tokens: number;
  toolCount: number;
  canonicalSha256: string;
  measuredAt: string;
}

export interface ServerDiff {
  name: string;
  /** Null when the baseline did not carry a measured number. */
  before: MeasuredSide | null;
  /** Null when this run did not produce one. */
  after: MeasuredSide | null;
  /** Signed change, or null when the two sides are not both numbers. */
  delta: number | null;
  /** True only when both sides measured — the delta is then the exact change. */
  exact: boolean;
  /** Byte-identical captures: the server did not change at all. */
  identical: boolean;
  /** Why a delta could not be established, in a sentence a reader can act on. */
  problem?: string;
  /** Per-tool breakdown of an established change. */
  attribution: ToolAttribution | null;
}

const sideOf = (m: Measurement | null): MeasuredSide | null => {
  if (!m) return null;
  const v = vectorEntryOf(m);
  if (!v) return null;
  return {
    tokens: v.totalTokens,
    toolCount: v.tools.length,
    canonicalSha256: v.canonicalSha256,
    measuredAt: v.date,
  };
};

/**
 * Whether two measurements describe the same server, as far as what they
 * recorded can say.
 *
 * A baseline is a path the caller passes, and nothing about the path proves it
 * belongs to the server being measured — a monorepo with `baseline-a.json` and
 * `baseline-b.json` is one copy-paste away from diffing two unrelated servers
 * and reporting the difference as though it meant something. Both sides record
 * `serverName` (what the server called itself at `initialize`), so where both
 * carry one and they disagree, the comparison is refused.
 *
 * Only a disagreement counts. A measurement predating the field, or one whose
 * server reports no name, is unknown rather than mismatched, and unknown is not
 * evidence of anything — the same rule the isolation column follows.
 */
export function sameServer(baseline: Measurement, current: Measurement): boolean {
  const a = typeof baseline.serverName === 'string' ? baseline.serverName : '';
  const b = typeof current.serverName === 'string' ? current.serverName : '';
  if (!a || !b) return true;
  return a === b;
}

export function diffServer(name: string, baseline: Measurement | null, current: Measurement): ServerDiff {
  const before = sideOf(baseline);
  const after = sideOf(current);
  const base: ServerDiff = {
    name,
    before,
    after,
    delta: null,
    exact: false,
    identical: false,
    attribution: null,
  };

  if (!after) {
    return {
      ...base,
      problem: baseline
        ? `this run produced no number (${current.status}), so the change cannot be established — ` +
          `its cost is missing from the comparison, not removed from the server`
        : `this run produced no number (${current.status})`,
    };
  }
  if (!before) {
    return {
      ...base,
      problem: baseline
        ? `the baseline carries no measured number (${baseline.status}), so the increase overstates: ` +
          `it compares against a cost that was never established`
        : 'no baseline to compare against',
    };
  }

  // Checked only once both sides measured, so a mismatch is reported as what it
  // is rather than hidden behind an unmeasured side.
  if (!sameServer(baseline!, current)) {
    return {
      ...base,
      problem:
        `the baseline measured '${baseline!.serverName}' and this run measured ` +
        `'${current.serverName}' — a difference between two servers is not a change to either, ` +
        `so nothing is compared`,
    };
  }

  const identical = before.canonicalSha256 === after.canonicalSha256;
  const beforeVec = vectorEntryOf(baseline!)!;
  const afterVec = vectorEntryOf(current)!;
  const delta = after.tokens - before.tokens;
  return {
    ...base,
    delta,
    exact: true,
    identical,
    attribution: identical ? null : attribute(beforeVec, afterVec, delta),
  };
}

export interface ServerGate {
  pass: boolean;
  /** Present when the run fails a gate; the exact sentence to print. */
  failure?: string;
}

export interface GateLimits {
  /** Ceiling on this measurement's absolute cost. */
  budget?: number;
  /** Ceiling on the increase over the baseline. Fails when the change cannot be established. */
  maxIncrease?: number;
}

/**
 * Both gates, evaluated against one diff. `--max-increase` fails on more than
 * the number: an increase that could not be established fails too, because a
 * gate whose answer is unknown has not passed.
 */
export function evaluateServerGate(diff: ServerDiff, limits: GateLimits): ServerGate {
  const n = (v: number) => v.toLocaleString('en-US');

  if (typeof limits.budget === 'number') {
    if (!diff.after) {
      return { pass: false, failure: `BUDGET FAIL: nothing was measured, so the budget could not be checked.` };
    }
    if (diff.after.tokens > limits.budget) {
      return {
        pass: false,
        failure:
          `BUDGET FAIL: ${n(diff.after.tokens)} tokens, over the ${n(limits.budget)} allowed — ` +
          `every install of this server pays this on every request.`,
      };
    }
  }

  if (typeof limits.maxIncrease === 'number') {
    if (!diff.exact || diff.delta === null) {
      // A short reason rather than the diff's full sentence: the diff has
      // already printed that above, and a gate line that repeats it in full
      // buries the verdict it exists to state.
      // Both sides measured and still not exact means exactly one thing today:
      // the baseline describes a different server. Kept as its own branch so a
      // future non-exact case cannot inherit this sentence by accident.
      const reason = !diff.after
        ? 'this run produced no number'
        : !diff.before
          ? 'the baseline carries no measured number'
          : 'the baseline describes a different server';
      return {
        pass: false,
        failure: `INCREASE FAIL: ${reason}, so the change could not be established and the gate has not passed.`,
      };
    }
    if (diff.delta > limits.maxIncrease) {
      return {
        pass: false,
        failure:
          `INCREASE FAIL: +${n(diff.delta)} tokens, over the ${n(limits.maxIncrease)} allowed — ` +
          `this change adds that to every request of every install.`,
      };
    }
  }

  return { pass: true };
}

/** The human-readable diff, printed whether or not a gate was asked for. */
export function formatServerDiff(diff: ServerDiff): string {
  const n = (v: number) => v.toLocaleString('en-US');
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${n(Math.abs(v))}`;
  const lines: string[] = [];

  if (!diff.exact) {
    lines.push(`  ${diff.name}: change not established — ${diff.problem}`);
    if (diff.after) lines.push(`    measured now: ${n(diff.after.tokens)} tokens across ${diff.after.toolCount} tools`);
    if (diff.before) lines.push(`    baseline:     ${n(diff.before.tokens)} tokens across ${diff.before.toolCount} tools`);
    return lines.join('\n');
  }

  const b = diff.before!;
  const a = diff.after!;
  if (diff.identical) {
    lines.push(`  ${diff.name}: unchanged — byte-identical to the baseline capture (${n(a.tokens)} tokens).`);
    return lines.join('\n');
  }

  lines.push(
    `  ${diff.name}: ${n(b.tokens)} → ${n(a.tokens)}  ${signed(diff.delta!)} tokens` +
      `  (${b.toolCount} → ${a.toolCount} tools)`,
  );
  const at = diff.attribution;
  if (at) {
    const top = <T>(xs: T[]) => xs.slice(0, 5);
    if (at.added.length) {
      lines.push(
        `    added:   ` +
          top(at.added)
            .map((t) => `${t.name} (${n(t.tokens)})`)
            .join(', ') +
          (at.added.length > 5 ? `, and ${at.added.length - 5} more` : ''),
      );
    }
    if (at.removed.length) {
      lines.push(
        `    removed: ` +
          top(at.removed)
            .map((t) => `${t.name} (${n(t.tokens)})`)
            .join(', ') +
          (at.removed.length > 5 ? `, and ${at.removed.length - 5} more` : ''),
      );
    }
    if (at.grew.length) {
      lines.push(
        `    grew:    ` +
          top(at.grew)
            .map((t) => `${t.name} ${n(t.from)} → ${n(t.to)} (${signed(t.delta)})`)
            .join(', ') +
          (at.grew.length > 5 ? `, and ${at.grew.length - 5} more` : ''),
      );
    }
    if (at.shrank.length) {
      lines.push(
        `    shrank:  ` +
          top(at.shrank)
            .map((t) => `${t.name} ${n(t.from)} → ${n(t.to)} (${signed(t.delta)})`)
            .join(', ') +
          (at.shrank.length > 5 ? `, and ${at.shrank.length - 5} more` : ''),
      );
    }
    if (at.unexplainedTokens !== 0) {
      lines.push(
        `    ${signed(at.unexplainedTokens)} unattributed — the total counts the canonical JSON of the whole ` +
          `array, whose framing bytes belong to no single tool.`,
      );
    }
  }
  return lines.join('\n');
}

/** Parse a baseline measurement.json. A malformed file is a usage error, not a pass. */
export function parseBaselineMeasurement(text: string): { measurement: Measurement | null; problem?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { measurement: null, problem: `not valid JSON: ${(e as Error).message}` };
  }
  const m = parsed as Partial<Measurement>;
  if (!m || typeof m.status !== 'string' || !('totalTokens' in m)) {
    return { measurement: null, problem: 'not a measurement.json (no status/totalTokens)' };
  }
  return { measurement: m as Measurement };
}
