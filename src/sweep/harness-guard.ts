/**
 * A broken harness must not republish the whole set as failures.
 *
 * `measureServer` already adjudicates a *single* suspicious result — a
 * startup-failure gets re-attempted off a cold cache, a timeout on double the
 * budget (see run.ts). Neither retry can see the one failure mode that isn't
 * about any individual server: the machine doing the measuring is broken.
 * That is not hypothetical here — an orphaned Docker backend with a wedged
 * network stack once returned 0/79 uniform timeouts, and every one of those
 * results was a lie about a working server. The per-server retries make that
 * case *worse*, not better: each one re-runs through the same broken harness
 * and comes back failing again, which reads as confirmation.
 *
 * The signal a single measurement can't carry is population-level. A wave of
 * servers that were measuring fine yesterday and all fail at once is a
 * statement about the harness, not about the servers — upstream breakages
 * arrive a package at a time, not by the dozen. So: snapshot what was on
 * record before the sweep, count how many good measurements this sweep turned
 * into failures, and if that count is both large in absolute terms and a
 * majority of what it could have broken, refuse to publish, put the previous
 * results back, and exit non-zero.
 *
 * Restoring is what makes this safe to run unattended: `measureServer`
 * persists each result the moment it has one, so by the time a sweep-level
 * verdict is possible the damage is already on disk. Holding the prior bytes
 * in memory turns an irreversible overwrite into a reversible one.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Measurement, MeasurementStatus } from '../core/types.js';

/**
 * Below this many regressions the population signal doesn't exist yet, and a
 * deliberately narrow sweep (`--only redis,serena`, two servers known to be
 * shaky) must never be able to trip a fault by failing completely.
 */
export const MIN_REGRESSIONS = 5;

/**
 * Share of the previously-good servers in this sweep that must regress before
 * the harness is the likelier explanation. The largest genuine simultaneous
 * upstream breakage on record here is a handful of PyPI servers that shared
 * one unbounded dependency — single digits against ~65 measured, well under
 * 10%. A harness fault, by contrast, takes everything it touches: the Docker
 * outage above scored 100%. A majority sits far from the former and catches
 * every instance of the latter this project has actually seen.
 */
export const FAULT_RATIO = 0.5;

/** Statuses that represent a real number on record — the thing worth protecting. */
export function isGood(status: MeasurementStatus): boolean {
  return status === 'measured' || status === 'dynamic';
}

/** The bytes of one server's published artifacts, exactly as they were pre-sweep. */
export interface Snapshot {
  name: string;
  status: MeasurementStatus | null;
  /** Raw file contents, so a restore is byte-identical rather than re-serialized. */
  measurementJson: string | null;
  badgeJson: string | null;
}

/**
 * Read what is currently published for each server. Called before the sweep
 * starts; a server with nothing on record snapshots as `null` status, which no
 * verdict counts either way.
 */
export function snapshot(names: string[], root = process.cwd()): Snapshot[] {
  return names.map((name) => {
    const mPath = join(root, 'results', name, 'measurement.json');
    const bPath = join(root, 'badges', `${name}.json`);
    const measurementJson = existsSync(mPath) ? readFileSync(mPath, 'utf8') : null;
    const badgeJson = existsSync(bPath) ? readFileSync(bPath, 'utf8') : null;
    let status: MeasurementStatus | null = null;
    if (measurementJson) {
      try {
        status = (JSON.parse(measurementJson) as Measurement).status;
      } catch {
        // An unreadable prior record is not evidence of anything; treat it as
        // no record rather than as a good one that just broke.
        status = null;
      }
    }
    return { name, status, measurementJson, badgeJson };
  });
}

export interface Verdict {
  /** True when the sweep looks like a broken harness rather than broken servers. */
  fault: boolean;
  /** Servers that went from a real number to a failure in this sweep. */
  regressed: string[];
  /** How many servers had a real number on record and could therefore regress. */
  comparable: number;
  /** Human-readable reason, printed either way — a pass says why it passed. */
  reason: string;
}

/**
 * Compare pre-sweep snapshots against this sweep's outcomes.
 *
 * `current` maps server name to the status it just measured at. Servers absent
 * from it were not swept and are ignored.
 */
export function verdict(prior: Snapshot[], current: Map<string, MeasurementStatus>): Verdict {
  const comparableNames = prior
    .filter((s) => s.status !== null && isGood(s.status) && current.has(s.name))
    .map((s) => s.name);
  const regressed = comparableNames.filter((n) => !isGood(current.get(n)!));
  const comparable = comparableNames.length;

  if (comparable === 0) {
    return {
      fault: false,
      regressed,
      comparable,
      // Not a pass — an unavailable reading. Nothing on record measured well
      // before this sweep, so there is no baseline to judge it against.
      reason: 'no prior measurement to compare against — harness check not performed',
    };
  }
  const ratio = regressed.length / comparable;
  const pct = (ratio * 100).toFixed(0);
  if (regressed.length >= MIN_REGRESSIONS && ratio >= FAULT_RATIO) {
    return {
      fault: true,
      regressed,
      comparable,
      reason:
        `${regressed.length} of ${comparable} previously-measured servers (${pct}%) failed in ` +
        `this sweep — at or above the ${MIN_REGRESSIONS}-server, ` +
        `${(FAULT_RATIO * 100).toFixed(0)}% threshold that reads as a broken harness ` +
        `rather than broken servers`,
    };
  }
  return {
    fault: false,
    regressed,
    comparable,
    reason:
      `${regressed.length} of ${comparable} previously-measured servers (${pct}%) failed in ` +
      `this sweep — below the harness-fault threshold, publishing normally`,
  };
}

/**
 * Put the snapshotted artifacts back, byte for byte. Only servers named in
 * `names` are touched, and only where a prior file existed — a server whose
 * first-ever measurement failed has nothing to restore and keeps its new
 * (honest) failure record.
 */
export function restore(prior: Snapshot[], names: string[], root = process.cwd()): string[] {
  const wanted = new Set(names);
  const restored: string[] = [];
  for (const s of prior) {
    if (!wanted.has(s.name)) continue;
    if (s.measurementJson === null && s.badgeJson === null) continue;
    if (s.measurementJson !== null) {
      const dir = join(root, 'results', s.name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'measurement.json'), s.measurementJson);
    }
    if (s.badgeJson !== null) {
      mkdirSync(join(root, 'badges'), { recursive: true });
      writeFileSync(join(root, 'badges', `${s.name}.json`), s.badgeJson);
    }
    restored.push(s.name);
  }
  return restored;
}
