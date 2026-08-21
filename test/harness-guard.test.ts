import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isGood,
  snapshot,
  verdict,
  restore,
  MIN_REGRESSIONS,
  FAULT_RATIO,
  type Snapshot,
} from '../src/sweep/harness-guard.js';
import type { Measurement, MeasurementStatus } from '../src/core/types.js';
import { TSX_CLI } from './tsx.js';

function measurement(over: Partial<Measurement> = {}): Measurement {
  return {
    methodologyVersion: '1.0',
    provider: 'tiktoken',
    encoding: 'o200k_base',
    status: 'measured',
    totalTokens: 2378,
    toolCount: 9,
    tools: [],
    canonicalSha256: 'deadbeef',
    rawToolsCapture: [],
    measuredAt: '2026-08-19T12:03:51.569Z',
    serverName: 'memory',
    ...over,
  };
}

/** N servers that were all measuring fine before the sweep. */
function goodPrior(n: number): Snapshot[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `s${i}`,
    status: 'measured' as MeasurementStatus,
    measurementJson: JSON.stringify(measurement({ serverName: `s${i}` })),
    badgeJson: '{"schemaVersion":1}',
  }));
}

function statuses(entries: Record<string, MeasurementStatus>): Map<string, MeasurementStatus> {
  return new Map(Object.entries(entries));
}

/** All of `prior` swept, the first `failed` of them coming back broken. */
function outcome(prior: Snapshot[], failed: number): Map<string, MeasurementStatus> {
  const m = new Map<string, MeasurementStatus>();
  prior.forEach((s, i) => m.set(s.name, i < failed ? 'startup-failure' : 'measured'));
  return m;
}

describe('isGood', () => {
  it('counts measured and dynamic as a real number on record', () => {
    expect(isGood('measured')).toBe(true);
    expect(isGood('dynamic')).toBe(true);
  });

  it('counts every failure status as no number', () => {
    for (const s of ['startup-failure', 'timeout', 'auth-required', 'remote-auth-wall'] as const) {
      expect(isGood(s)).toBe(false);
    }
  });
});

describe('verdict', () => {
  it('calls a total wipeout a harness fault — the Docker-down case', () => {
    const prior = goodPrior(79);
    const v = verdict(prior, outcome(prior, 79));
    expect(v.fault).toBe(true);
    expect(v.regressed).toHaveLength(79);
    expect(v.comparable).toBe(79);
    expect(v.reason).toContain('100%');
  });

  it('lets a genuine upstream breakage wave through — single digits against a large set', () => {
    // The real event this threshold is calibrated against: a handful of PyPI
    // servers sharing one unbounded dependency, out of ~65 measuring fine.
    const prior = goodPrior(65);
    const v = verdict(prior, outcome(prior, 6));
    expect(v.fault).toBe(false);
    expect(v.regressed).toHaveLength(6);
    expect(v.reason).toContain('publishing normally');
  });

  it('does not fire below the absolute floor even at 100% — a narrow --only sweep', () => {
    const prior = goodPrior(MIN_REGRESSIONS - 1);
    const v = verdict(prior, outcome(prior, MIN_REGRESSIONS - 1));
    expect(v.fault).toBe(false);
    expect(v.regressed).toHaveLength(MIN_REGRESSIONS - 1);
  });

  it('does not fire at the absolute floor when the share is below the ratio', () => {
    // 5 regressions is enough in absolute terms, but out of 20 it is only 25%.
    const prior = goodPrior(20);
    const v = verdict(prior, outcome(prior, MIN_REGRESSIONS));
    expect(v.fault).toBe(false);
  });

  it('fires exactly at both thresholds together', () => {
    const prior = goodPrior(MIN_REGRESSIONS / FAULT_RATIO); // 10 comparable, 5 regressed = 50%
    const v = verdict(prior, outcome(prior, MIN_REGRESSIONS));
    expect(v.fault).toBe(true);
    expect(v.reason).toContain('50%');
  });

  it('ignores servers that were already failing — they cannot regress', () => {
    const prior: Snapshot[] = [
      ...goodPrior(2),
      ...Array.from({ length: 20 }, (_, i) => ({
        name: `broken${i}`,
        status: 'startup-failure' as MeasurementStatus,
        measurementJson: JSON.stringify(measurement({ status: 'startup-failure' })),
        badgeJson: '{"schemaVersion":1}',
      })),
    ];
    const current = new Map<string, MeasurementStatus>();
    for (const s of prior) current.set(s.name, 'startup-failure');
    const v = verdict(prior, current);
    // Only the 2 good ones were ever comparable, so the 20 still-broken servers
    // cannot pad the sweep into a fault.
    expect(v.comparable).toBe(2);
    expect(v.regressed).toHaveLength(2);
    expect(v.fault).toBe(false);
  });

  it('ignores servers that were not swept at all', () => {
    const prior = goodPrior(40);
    // A one-server --only run: 39 snapshots have no outcome in this sweep.
    const v = verdict(prior, statuses({ s0: 'startup-failure' }));
    expect(v.comparable).toBe(1);
    expect(v.regressed).toEqual(['s0']);
    expect(v.fault).toBe(false);
  });

  it('reports an unavailable reading, not a pass, when there is no baseline', () => {
    const v = verdict([], statuses({ s0: 'startup-failure' }));
    expect(v.fault).toBe(false);
    expect(v.comparable).toBe(0);
    expect(v.reason).toContain('not performed');
    expect(v.reason).not.toContain('publishing normally');
  });

  it('treats a dynamic-to-failure change as a regression', () => {
    const prior = goodPrior(10).map((s) => ({ ...s, status: 'dynamic' as MeasurementStatus }));
    const v = verdict(prior, outcome(prior, 10));
    expect(v.fault).toBe(true);
  });

  it('does not treat measured-to-dynamic as a regression — both are real numbers', () => {
    const prior = goodPrior(10);
    const current = new Map<string, MeasurementStatus>();
    for (const s of prior) current.set(s.name, 'dynamic');
    const v = verdict(prior, current);
    expect(v.regressed).toHaveLength(0);
    expect(v.fault).toBe(false);
  });

  it('counts a timeout wave as a fault too — the original outage was uniform timeouts', () => {
    const prior = goodPrior(79);
    const current = new Map<string, MeasurementStatus>();
    for (const s of prior) current.set(s.name, 'timeout');
    expect(verdict(prior, current).fault).toBe(true);
  });
});

describe('snapshot / restore round-trip', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'harness-guard-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function publish(name: string, m: Measurement, badge = '{"schemaVersion":1,"label":"x"}') {
    mkdirSync(join(root, 'results', name), { recursive: true });
    writeFileSync(join(root, 'results', name, 'measurement.json'), JSON.stringify(m, null, 2) + '\n');
    mkdirSync(join(root, 'badges'), { recursive: true });
    writeFileSync(join(root, 'badges', `${name}.json`), badge + '\n');
  }

  it('reads the published status off disk', () => {
    publish('memory', measurement());
    publish('git', measurement({ status: 'startup-failure', serverName: 'git' }));
    const snaps = snapshot(['memory', 'git'], root);
    expect(snaps.map((s) => s.status)).toEqual(['measured', 'startup-failure']);
  });

  it('snapshots a never-measured server as no record', () => {
    const [s] = snapshot(['brand-new'], root);
    expect(s.status).toBeNull();
    expect(s.measurementJson).toBeNull();
    expect(s.badgeJson).toBeNull();
  });

  it('treats an unparseable prior record as no record, not as a good one', () => {
    mkdirSync(join(root, 'results', 'corrupt'), { recursive: true });
    writeFileSync(join(root, 'results', 'corrupt', 'measurement.json'), '{ not json');
    const [s] = snapshot(['corrupt'], root);
    expect(s.status).toBeNull();
    // The bytes are still held, so a restore can put them back untouched.
    expect(s.measurementJson).toBe('{ not json');
  });

  it('restores the previous bytes exactly after a fault overwrote them', () => {
    publish('memory', measurement());
    const before = readFileSync(join(root, 'results', 'memory', 'measurement.json'), 'utf8');
    const beforeBadge = readFileSync(join(root, 'badges', 'memory.json'), 'utf8');
    const snaps = snapshot(['memory'], root);

    // The sweep overwrites both artifacts with a failure, as measureServer does.
    publish('memory', measurement({ status: 'startup-failure', totalTokens: null }), '{"message":"unknown"}');
    expect(readFileSync(join(root, 'results', 'memory', 'measurement.json'), 'utf8')).not.toBe(before);

    const restored = restore(snaps, ['memory'], root);
    expect(restored).toEqual(['memory']);
    expect(readFileSync(join(root, 'results', 'memory', 'measurement.json'), 'utf8')).toBe(before);
    expect(readFileSync(join(root, 'badges', 'memory.json'), 'utf8')).toBe(beforeBadge);
  });

  it('restores only the named servers, leaving other results alone', () => {
    publish('memory', measurement());
    publish('filesystem', measurement({ serverName: 'filesystem', totalTokens: 2823 }));
    const snaps = snapshot(['memory', 'filesystem'], root);

    publish('memory', measurement({ status: 'timeout' }));
    publish('filesystem', measurement({ serverName: 'filesystem', totalTokens: 9999 }));

    restore(snaps, ['memory'], root);
    const fs = JSON.parse(readFileSync(join(root, 'results', 'filesystem', 'measurement.json'), 'utf8'));
    expect(fs.totalTokens).toBe(9999); // untouched — not in the restore list
    const mem = JSON.parse(readFileSync(join(root, 'results', 'memory', 'measurement.json'), 'utf8'));
    expect(mem.status).toBe('measured');
  });

  it('leaves a first-ever failure in place — there is nothing to restore', () => {
    const snaps = snapshot(['brand-new'], root);
    publish('brand-new', measurement({ status: 'startup-failure' }));
    const restored = restore(snaps, ['brand-new'], root);
    expect(restored).toEqual([]);
    // The honest new failure record survives.
    const m = JSON.parse(readFileSync(join(root, 'results', 'brand-new', 'measurement.json'), 'utf8'));
    expect(m.status).toBe('startup-failure');
  });

  it('recreates a results directory the sweep never made', () => {
    publish('memory', measurement());
    const snaps = snapshot(['memory'], root);
    rmSync(join(root, 'results', 'memory'), { recursive: true });
    expect(existsSync(join(root, 'results', 'memory', 'measurement.json'))).toBe(false);
    restore(snaps, ['memory'], root);
    expect(existsSync(join(root, 'results', 'memory', 'measurement.json'))).toBe(true);
  });
});

describe('sweep-all wiring (subprocess)', () => {
  const repoRoot = process.cwd();
  const sweepAll = join(repoRoot, 'src', 'sweep', 'sweep-all.ts');
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sweep-guard-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /**
   * A sweep root with `n` servers, each launched by a command that exits
   * immediately — the shape a broken harness produces, without needing to
   * actually break Docker. `priorGood` of them already have a real number
   * published, which is what the guard is protecting.
   */
  function scaffold(n: number, priorGood: number) {
    const names = Array.from({ length: n }, (_, i) => `stub${i}`);
    writeFileSync(
      join(root, 'servers.yaml'),
      'servers:\n' +
        names
          .map((nm) => `  - name: ${nm}\n    command: node -e "process.exit(1)"\n    timeoutSeconds: 10\n`)
          .join(''),
    );
    for (let i = 0; i < priorGood; i++) {
      const name = names[i];
      mkdirSync(join(root, 'results', name), { recursive: true });
      writeFileSync(
        join(root, 'results', name, 'measurement.json'),
        JSON.stringify(measurement({ serverName: name, totalTokens: 1000 + i }), null, 2) + '\n',
      );
      mkdirSync(join(root, 'badges'), { recursive: true });
      writeFileSync(join(root, 'badges', `${name}.json`), '{"schemaVersion":1,"label":"context"}\n');
    }
    return names;
  }

  function runSweep(): { code: number; out: string } {
    try {
      const out = execFileSync(process.execPath, [TSX_CLI, sweepAll], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { code: 0, out };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  }

  it('refuses to publish, restores results, and exits non-zero when every server fails', () => {
    const names = scaffold(6, 6);
    const { code, out } = runSweep();

    expect(code).toBe(1);
    expect(out).toContain('HARNESS FAULT');
    // Nothing was published: the leaderboard and history are the artifacts a CI
    // job would commit, and neither exists.
    expect(existsSync(join(root, 'results', 'leaderboard.md'))).toBe(false);
    expect(existsSync(join(root, 'results', 'history.csv'))).toBe(false);
    // Every prior measurement is back to its real number, not the failure the
    // sweep just wrote over it.
    for (let i = 0; i < names.length; i++) {
      const m = JSON.parse(readFileSync(join(root, 'results', names[i], 'measurement.json'), 'utf8'));
      expect(m.status).toBe('measured');
      expect(m.totalTokens).toBe(1000 + i);
    }
  }, 120_000);

  it('publishes normally when the same failures have no good baseline to contradict', () => {
    // Same broken commands, but nothing was ever measured — so this sweep is
    // the honest first record, not a regression, and must go through.
    scaffold(6, 0);
    const { code, out } = runSweep();

    expect(code).toBe(0);
    expect(out).toContain('harness check');
    expect(out).toContain('not performed');
    expect(existsSync(join(root, 'results', 'leaderboard.md'))).toBe(true);
  }, 120_000);
});
