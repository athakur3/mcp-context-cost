import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { selectShard } from '../src/sweep/shard.js';
import { MIN_REGRESSIONS } from '../src/sweep/harness-guard.js';

/**
 * The weekly self-badge job republishes `results/memory/measurement.json` — a
 * row that sits in the same leaderboard as 68 others, all measured in Docker
 * isolation. Two numbers taken under different isolation are not comparable
 * (different Node, different resolution of an `@latest` tag, different ambient
 * environment), which is why `history.csv` records the isolation and the trend
 * line refuses to span a change in it.
 *
 * So a host measurement here is not a smaller version of the right thing: it
 * gives one published row a provenance none of its neighbours have, and — since
 * the weekly job and the full sweep would then alternate — leaves `memory` the
 * one server that can never draw a sparkline. This asserts the invocation, not
 * the outcome, because the outcome is only visible on a Monday.
 */
const wfDir = join(import.meta.dirname, '..', '.github', 'workflows');
const workflow = readFileSync(join(wfDir, 'self-badge.yml'), 'utf8');
const resweep = readFileSync(join(wfDir, 'resweep.yml'), 'utf8');

/** The `npm run sweep` command lines the workflow actually executes. */
function sweepInvocations(yaml: string): string[] {
  return yaml
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('run:') && l.includes('npm run sweep'));
}

describe('self-badge workflow', () => {
  it('measures in the same isolation as every other published row', () => {
    const runs = sweepInvocations(workflow);
    expect(runs.length).toBe(1);
    expect(runs[0]).toContain('--docker');
  });

  it('pins the measured package version', () => {
    // This job holds contents:write and pushes; an unpinned `@latest` here is a
    // third-party package with commit access to the repo's published data.
    expect(sweepInvocations(workflow)[0]).toMatch(/server-memory@\d/);
  });

  it('allows more than the default budget for a cold runner', () => {
    // No shared package cache survives between jobs, so the first capture pays
    // an image pull plus a full install — the 60s default would time out.
    const timeout = /--timeout (\d+)/.exec(sweepInvocations(workflow)[0]);
    expect(timeout).not.toBeNull();
    expect(Number(timeout![1])).toBeGreaterThan(60_000);
  });
});

/**
 * The rotating re-sweep is the only scheduled job that touches more than one
 * server, and it holds `contents: write`. Everything asserted here is a property
 * the job's safety rests on but that is only observable weeks apart on a real
 * Wednesday — exactly the kind of thing that rots without anyone noticing.
 */
describe('rotating re-sweep workflow', () => {
  const invocation = resweep
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('run:') && l.includes('npm run sweep:all'));

  it('measures a rotating slice rather than the whole set', () => {
    expect(invocation.length).toBe(1);
    expect(invocation[0]).toMatch(/--shards \d+/);
  });

  it('measures in the same isolation as every other published row', () => {
    // A sparkline refuses to span a change of isolation, so a host measurement
    // here would break the trend line of every server in the slice.
    expect(invocation[0]).toContain('--docker');
  });

  it('keeps every shard large enough for the harness guard to fire', () => {
    // The guard needs MIN_REGRESSIONS previously-good servers to fail together
    // before it will call a broken harness. Shard the set too finely and a
    // week's slice drops below that floor — the job would then publish a whole
    // slice of failures from a wedged runner without tripping anything.
    const shards = Number(/--shards (\d+)/.exec(invocation[0])![1]);
    const doc = parse(readFileSync(join(import.meta.dirname, '..', 'servers.yaml'), 'utf8')) as {
      servers: { name: string; remote?: boolean }[];
    };
    const sweepable = doc.servers.filter((s) => !s.remote);
    const sizes = Array.from({ length: shards }, (_, i) => selectShard(sweepable, shards, i).length);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_REGRESSIONS);
  });

  it('allows more than the default budget for a cold runner', () => {
    // Same reason as the self-badge job: no package-cache volume survives
    // between jobs, so every server in the slice pays a full cold install. At
    // the 60s default most of them would time out, and a slice of timeouts is
    // both a red job every week and a wave of regressions to adjudicate.
    const budget = /--default-timeout (\d+)/.exec(invocation[0]);
    expect(budget).not.toBeNull();
    expect(Number(budget![1])).toBeGreaterThan(60);
  });

  it('cannot run concurrently with itself', () => {
    // Two overlapping runs would measure the same servers twice and race to
    // push the same branch.
    expect(resweep).toMatch(/concurrency:\n\s*group: resweep/);
  });

  it('does not share a day with the other job that pushes', () => {
    const dayOf = (yaml: string) => /cron: '[^']*\s(\S+)'/.exec(yaml)![1];
    expect(dayOf(resweep)).not.toBe(dayOf(workflow));
  });

  it('rebases before pushing, because it can run long enough for main to move', () => {
    expect(resweep).toContain('git pull --rebase origin main');
  });
});

/**
 * Regen patches the numbers the front page states (published-stats.ts), so a
 * scheduled job that commits fresh data without committing README.md publishes
 * a leaderboard the README then contradicts — the drift the patching exists to
 * end. Asserted here because it is only observable on a real Monday/Wednesday.
 */
describe('every scheduled job that publishes data also publishes the front page', () => {
  const addLines = (yaml: string) =>
    yaml
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('git add '));

  for (const [name, yaml] of [
    ['self-badge', workflow],
    ['resweep', resweep],
  ] as const) {
    it(`${name} commits README.md beside the data regen just patched it from`, () => {
      const adds = addLines(yaml);
      expect(adds.length).toBeGreaterThan(0);
      for (const line of adds) expect(line).toContain('README.md');
    });
  }
});

/**
 * CHANGELOG's own preamble: cutting a version renames the `Unreleased` heading
 * to that version and dates it. 0.8.0 shipped with the rename skipped — npm
 * served bytes the changelog said were unreleased for thirteen days — so the
 * convention is enforced at the one seam that can refuse: the publish job.
 */
describe('publish workflow', () => {
  const publish = readFileSync(join(wfDir, 'publish.yml'), 'utf8');

  it('refuses a version the changelog has no section for', () => {
    expect(publish).toContain('CHANGELOG.md');
    // The check must run before `npm publish` does.
    expect(publish.indexOf('CHANGELOG.md')).toBeLessThan(publish.indexOf('npm publish'));
  });
});

describe('the suite CI runs', () => {
  it('spawns tools it already has, rather than whatever npx can fetch', () => {
    // `npx tsx` resolves from the child's cwd. Several tests spawn the CLI from a
    // temporary directory outside this repository, where the locked tsx is not on
    // the resolution path, so npx installs one from the registry into the shared
    // npx cache while the suite runs. Warm, that is invisible; cold, concurrent
    // spawns race on the same cache entry and the run fails for a reason that has
    // nothing to do with the product. A green check has to mean the code passed.
    const dir = import.meta.dirname;
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => /execFile\w*\(\s*\n?\s*'npx'/.test(readFileSync(join(dir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
