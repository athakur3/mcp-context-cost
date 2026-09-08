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

  /** The `SELECT` expression both steps expand to choose their servers. */
  const select = /SELECT: >-\n([\s\S]*?)\n {4}steps:/.exec(resweep)![1];

  /**
   * The count the *schedule* runs with — the fallback in `SELECT`, reached when
   * no dispatch input is set. A dispatch may pin a different count, or name
   * servers outright, but the unattended properties below have to hold for what
   * runs on a Wednesday with nobody watching.
   */
  const scheduledShards = Number(
    /--shards \{0\}[\s\S]*?inputs\.shards \|\| '(\d+)'/.exec(select)![1],
  );

  it('measures a rotating slice rather than the whole set', () => {
    expect(invocation.length).toBe(1);
    expect(invocation[0]).toContain('${SELECT}');
    expect(select).toContain('--shards');
    expect(scheduledShards).toBeGreaterThan(1);
  });

  it('cannot be given a named set and a slice at once', () => {
    // sweep-all refuses `--only` with `--shards`, because the sharded set is a
    // complete partition and an intersection of the two belongs to no cycle
    // while still reading as a normal week in the log. The expression has to
    // pick one, not concatenate them.
    expect(select).toMatch(/inputs\.servers\s*&&\s*format\('--only \{0\}'/);
    expect(select).toContain('||');
  });

  it('expands the selection from the environment rather than inlining it', () => {
    // An env expansion is word-split but not re-parsed, so a dispatch value
    // cannot smuggle a command into the step. Inlining `${{ inputs.servers }}`
    // straight into `run:` would paste it into the script text instead.
    expect(invocation[0]).not.toContain('${{');
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
    const shards = scheduledShards;
    const doc = parse(readFileSync(join(import.meta.dirname, '..', 'servers.yaml'), 'utf8')) as {
      servers: { name: string; remote?: boolean }[];
    };
    const sweepable = doc.servers.filter((s) => !s.remote);
    const sizes = Array.from(
      { length: shards },
      (_, i) => selectShard(sweepable, shards, i).length,
    );
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
 * The cross-check column's staleness rule assumes each row is re-made in the
 * same sitting as the measurement it is filed under. That only holds if the
 * re-sweep cross-checks the exact slice it just measured, under the same
 * isolation — a property only observable on a real Wednesday.
 */
describe('the re-sweep cross-checks the slice it just measured', () => {
  const runLine = (needle: string) =>
    resweep
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('run:') && l.includes(needle));

  it('same slice, same isolation, same budget as the sweep above it', () => {
    const sweep = runLine('sweep:all');
    const cross = runLine('cross-check.ts');
    expect(cross).toBeDefined();
    expect(cross).toContain('--docker');
    // Both read the same env var rather than repeating the selection, so a
    // dispatch that pins a wider slice — or names servers outright — cannot
    // move one step onto it and leave the other cross-checking a set it never
    // measured.
    expect(sweep).toContain('${SELECT}');
    expect(cross).toContain('${SELECT}');
  });

  it('is best-effort — a CLI release outage must not block the sweep commit', () => {
    // A missed week reads as silence, not a stale number, so the step may fail.
    expect(resweep).toMatch(/Cross-check[^]*?continue-on-error: true[^]*?cross-check\.ts/);
  });
});

/**
 * The Claude column used to be refreshed only by the Monday self-badge job
 * while re-sweeps land on Wednesdays, so a re-measured row printed `—` for five
 * days each cycle — including `github`, the heaviest server in the set, on the
 * front page's own Claude table on 2026-09-05. Refreshing it here is what
 * closes that window, and these pin the two properties that make the row
 * trustworthy: the same slice, and no power to break the sweep.
 */
describe('the re-sweep refreshes the Claude column for the slice it just measured', () => {
  const runLine = (needle: string) =>
    resweep
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('run:') && l.includes(needle));

  it('selects with the same string the sweep and the cross-check use', () => {
    // A Claude row filed beside a capture from a different set would be a
    // number about one measurement printed against another.
    const divergence = runLine('measure-divergence.ts');
    expect(divergence).toBeDefined();
    expect(divergence).toContain('${SELECT}');
  });

  it('is best-effort — an API hiccup must not block the sweep commit', () => {
    expect(resweep).toMatch(/Claude column[^]*?continue-on-error: true[^]*?measure-divergence\.ts/);
  });

  it('runs before the commit step, which is what regenerates the pages', () => {
    // The leaderboard's Claude cells are written by regen, and regen runs
    // inside the commit step after the rebase. A refresh afterwards would land
    // in the tree with nothing left to render it.
    expect(resweep.indexOf('measure-divergence.ts')).toBeLessThan(
      resweep.indexOf('Commit refreshed measurements'),
    );
  });

  it('stages the run as a measurement, not as a derived file', () => {
    // The commit step clears unstaged aggregates with `git checkout -- .`
    // before rebasing. divergence.json is written by an API call, not derived
    // from results/, so leaving it to the regen commit would discard it.
    const staged = resweep.slice(0, resweep.indexOf('git checkout -q -- .'));
    expect(staged).toContain('git add results/divergence.json');
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
      expect(adds.some((l) => l.includes('README.md'))).toBe(true);

      // Ordering is the real property, and a staged commit can satisfy the
      // letter of "adds README.md" while breaking it: the README that gets
      // committed has to be the one regen patched from the data in the same
      // commit, so the last `git add` must come after regen has run.
      const regenAt = yaml.indexOf('regen.ts');
      expect(regenAt, 'the job regenerates before committing').toBeGreaterThan(-1);
      expect(yaml.lastIndexOf('git add')).toBeGreaterThan(regenAt);
      expect(addLines(yaml).at(-1)).toContain('README.md');
    });
  }
});

/**
 * The capability probe measures every server twice and publishes nothing, and
 * both halves of that are load-bearing.
 *
 * It exists to answer whether a server's tool list depends on what the client
 * declares at `initialize` — which means running each entry's launch command
 * twice, under a posture no published measurement used. A result from the
 * experimental half must never reach `results/`, or the leaderboard would
 * quietly start describing a client this project does not ship. The probe
 * passes `persist: false` on both captures, and the job holds no write token to
 * commit with even if it did.
 */
describe('the capability probe answers a question without publishing one', () => {
  const probe = readFileSync(join(wfDir, 'capability-probe.yml'), 'utf8');
  const scriptRaw = readFileSync(
    join(import.meta.dirname, '..', 'tools', 'capability-probe.ts'),
    'utf8',
  );
  /**
   * Comments stripped, because the first version of the assertion below passed
   * against the docblock's own description of the flag while the flag itself
   * had been deleted. A test that reads the prose is checking that someone
   * wrote a sentence, which is the failure this whole repository is about.
   */
  const script = scriptRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  it('captures with persist: false, which is the only reason it is safe to run', () => {
    expect(script).toContain('persist: false');
    // Both captures come from one call site, so one flag covers the pair.
    expect(script.match(/measureServer\(/g) ?? []).toHaveLength(1);
  });

  it('declares only capabilities the harness can answer truthfully', () => {
    // `sampling` would say this client can ask a model for a completion. It
    // cannot, and a probe that lies to the server it measures is worthless.
    const client = readFileSync(
      join(import.meta.dirname, '..', 'src', 'sweep', 'client.ts'),
      'utf8',
    );
    const posture = /export const DECLARING_POSTURE[\s\S]*?\n\};/.exec(client)![0];
    expect(posture).toContain('roots');
    expect(posture).toContain('elicitation');
    expect(posture).not.toContain('sampling');
    // Every declared capability has an answer beside it in the same object.
    for (const method of ['roots/list', 'elicitation/create']) expect(posture).toContain(method);
  });

  it('runs read-only and holds no token, in a job that launches strangers commands', () => {
    expect(probe).toMatch(/permissions:\n\s*contents: read/);
    expect(probe).not.toMatch(/github\.token|GITHUB_TOKEN|secrets\./);
    expect(probe).toMatch(/persist-credentials: false/);
    expect(probe).not.toContain('git push');
  });

  it('leaves its answer where a reader can fetch it, rather than committing it', () => {
    expect(probe).toContain('actions/upload-artifact');
    expect(probe).not.toContain('git commit');
  });
});

/**
 * The guard the two publishing jobs run in place of the CI run a bot push never
 * starts — and the ordering that decides whether it can ever pass.
 *
 * `sweep-all` writes the leaderboard, history.csv and the tool vectors.
 * `regen.ts` writes the capture index, the tool-shape baseline, the server
 * pages, the dashboard and the numbers patched into README. So between a sweep
 * and regen the tree is *known* to be inconsistent, and the exact drift guards
 * fail by construction: a suite run there reports the ordering rather than the
 * data. It did exactly that — run 33997431756 on 2026-09-06, the first
 * re-sweep after the guard was added, failed three of them, skipped its commit
 * and threw away 34 fresh measurements. The guard is worth having only where
 * it reads the bytes the push publishes.
 */
describe('the publishing jobs check the tree they are about to push', () => {
  for (const [name, yaml] of [
    ['self-badge', workflow],
    ['resweep', resweep],
  ] as const) {
    it(`${name} runs the suite after regen and before the push`, () => {
      const at = (needle: string) => {
        const i = yaml.indexOf(needle);
        expect(i, `${name} runs ${needle}`).toBeGreaterThan(-1);
        return i;
      };
      expect(at('regen.ts'), `${name}: the suite reads a tree regen has not rebuilt`).toBeLessThan(
        at('npm test'),
      );
      expect(
        at('npm test'),
        `${name}: the suite cannot stop a push that happens first`,
      ).toBeLessThan(at('git push'));
    });
  }
});

/**
 * CHANGELOG's own preamble: cutting a version renames the `Unreleased` heading
 * to that version and dates it. 0.8.0 shipped with the rename skipped — npm
 * served bytes the changelog said were unreleased for thirteen days — so the
 * convention is enforced at the one seam that can refuse: the publish job.
 */
/**
 * The composite action drives the CLI through a shell script, so nothing in the
 * type system connects the two: a flag renamed in `measure` would leave the
 * action assembling a command line that no published version accepts, and the
 * action's own users would be the ones to find out. These assert the seam.
 */
describe('the published composite action', () => {
  const action = parse(readFileSync(join(import.meta.dirname, '..', 'action.yml'), 'utf8')) as {
    inputs: Record<string, { required?: boolean; default?: string }>;
    outputs: Record<string, { value: string }>;
    runs: { using: string; steps: { run: string; env: Record<string, string> }[] };
  };
  const script = action.runs.steps[0].run;

  it('passes every flag the gate needs, spelled as the CLI spells it', () => {
    for (const flag of [
      '--name',
      '--command',
      '--remote',
      '--baseline',
      '--max-increase',
      '--budget',
      '--timeout',
    ]) {
      expect(script, flag).toContain(flag);
    }
  });

  it('sends the CLI exit code on to the job, so a failed gate fails the build', () => {
    // The whole point of the action: a gate that cannot fail the build is a
    // green check on a check that never ran.
    expect(script).toMatch(/exit "\$\{status\}"/);
  });

  it('never interpolates an input into the shell', () => {
    // Inputs are untrusted text; `${{ }}` inside a run block would execute it.
    expect(script).not.toMatch(/\$\{\{/);
    for (const key of Object.keys(action.inputs)) {
      const wired = Object.values(action.runs.steps[0].env).some(
        (v) => v.includes(`inputs.${key}`) || v.includes(`inputs['${key}']`),
      );
      expect(wired, `input ${key} reaches the step through env`).toBe(true);
    }
  });

  it('declares the outputs a caller needs after the gate has run', () => {
    expect(Object.keys(action.outputs).toSorted()).toEqual([
      'badge',
      'measurement',
      'status',
      'tokens',
      'tools',
    ]);
  });
});

/**
 * The release workflow exists so that cutting a version is one action rather
 * than a sequence held in someone's head. That only helps if the order is the
 * safe one — checks before commits, and the publish left where npm's trust
 * actually lives.
 */
describe('release workflow', () => {
  const release = readFileSync(
    join(import.meta.dirname, '..', '.github', 'workflows', 'release.yml'),
    'utf8',
  );
  const at = (needle: string) => release.indexOf(needle);

  it('runs the readiness gate before it writes anything', () => {
    // A gate that runs after the cut is a report, not a gate.
    expect(at('release-readiness.ts')).toBeGreaterThan(-1);
    expect(at('release-readiness.ts')).toBeLessThan(at('cut-changelog.ts'));
    expect(at('release-readiness.ts')).toBeLessThan(at('git commit'));
  });

  it('runs the suite before it writes anything', () => {
    expect(at('npm test')).toBeLessThan(at('cut-changelog.ts'));
  });

  it('does not publish — it asks the workflow npm actually trusts', () => {
    // publish.yml holds the OIDC trust, bound to that workflow in this
    // repository and pinned to a configuration a release verifiably shipped
    // through. Reimplementing it here would risk the one path that cannot be
    // tested without publishing.
    expect(release).not.toMatch(/npm publish/);
    expect(release).toContain('gh workflow run publish.yml');
    expect(release).toContain('gh run watch');
  });

  it('proves the tarball from npm rather than trusting the upload', () => {
    expect(release).toMatch(/mcp-context-cost@\$VERSION" verify --remote/);
  });

  it('fetches the tarball from outside the checkout, or it proves nothing', () => {
    // The repository's own package.json claims this package's name, so npx run
    // from the checkout resolves the local bin rather than the published one.
    // In 0.13.1 that surfaced as `command not found` — loud, but the quiet
    // version of the same mistake is a check that passes against the working
    // tree and says nothing about what npm is serving.
    const verify = release.indexOf('verify --remote');
    const cd = release.lastIndexOf('cd "$(mktemp -d)"', verify);
    expect(cd, 'the npm verification must run from an empty directory').toBeGreaterThan(-1);
    expect(release.slice(cd, verify)).not.toContain('\n      - name:');
  });

  /**
   * 0.17.0 published cleanly and then failed this step with `ETARGET`. The step
   * waited on `npm view "<pkg>@$VERSION"`, which passed on its first attempt,
   * and then ran `npx`, which could not resolve the same version seconds later.
   * They read different documents: the registry serves a full packument to
   * `Accept: application/json` and an abbreviated one to
   * `application/vnd.npm.install-v1+json`, from one URL under
   * `Vary: accept-encoding, accept` — separately cached, each with its own ETag
   * and its own `max-age`. Waiting on either says nothing about the other, so
   * the only wait worth having is around the command itself.
   */
  it('retries the command that resolves the tarball, not a proxy for it', () => {
    // The npx invocation must sit INSIDE the retry loop. An earlier version of
    // this test only asked that a `for … $(seq` appear somewhere between the
    // temp-dir cd and the first `verify --remote`, which the bug it was written
    // for walks straight through: put any probe in the loop, leave npx after
    // `done`, and it passes. Banning the string `npm view` did not save it
    // either — `npm info`, `npm show` and `npm v` are documented aliases for
    // the same command, and `curl` is not even an alias. Position is the
    // property; spelling is not.
    const verify = release.indexOf('verify --remote');
    const cd = release.lastIndexOf('cd "$(mktemp -d)"', verify);
    expect(cd, 'the retried command must run from an empty directory').toBeGreaterThan(-1);
    const loop = release.indexOf('$(seq ', cd);
    const doAt = release.indexOf('; do', loop);
    const doneAt = release.indexOf('\n          done', doAt);
    expect(doAt, 'expected a bounded retry after the temp-dir cd').toBeGreaterThan(-1);
    expect(doneAt).toBeGreaterThan(doAt);
    expect(verify, 'the verify must be retried, not run once after the loop').toBeGreaterThan(doAt);
    expect(verify, 'the verify must be retried, not run once after the loop').toBeLessThan(doneAt);
  });

  /**
   * The loop this replaced had no guard after it: ten failed probes fell
   * through with status 0 straight into the command they were meant to be
   * waiting for. Verified against the old shape, where a wait that never
   * succeeds still exits 0 and the step continues. Every bounded wait in this
   * file has to say so out loud instead.
   */
  it('never falls through a bounded wait as though it had succeeded', () => {
    const loops = release.split(/for \w+ in \$\(seq /).slice(1);
    expect(loops.length, 'expected the waits this rule is about').toBeGreaterThan(1);
    for (const rest of loops) {
      const after = rest.slice(rest.indexOf('done') + 'done'.length);
      // The guard must be the next thing that RUNS, not merely something within
      // N characters of `done`. The first version of this looked at a 500-char
      // window and went red when the comment above the guard grew — length is
      // not the property, order is.
      const nextCommand =
        after
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l !== '' && !l.startsWith('#')) ?? '';
      expect(
        nextCommand,
        'a wait that can exhaust must fail loudly, before anything else runs',
      ).toMatch(/exit 1/);
    }
  });

  it('says a failure here is not a rollback', () => {
    // This step runs after the publish. Someone reading a red run must not go
    // looking for a release that was undone; nothing here can undo one.
    expect(release).toMatch(/RUNS AFTER THE PUBLISH/);
  });

  it('has a dry run that stops before the first commit reaches main', () => {
    expect(at('Stop here on a dry run')).toBeLessThan(at('git push'));
    expect(release).toContain('if: inputs.dry_run');
  });

  it('cannot race another release', () => {
    expect(release).toMatch(/concurrency:[^]*?group: release/);
  });
});

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

/**
 * The write token and the launch command must never be in the same process.
 *
 * actions/checkout stores the job's token in .git/config by default, where it
 * sits for every later step. In resweep.yml that included the sweep step, which
 * executes the launch command of every servers.yaml entry in the slice. The
 * dockerized ones cannot see the workspace, but a `docker `-prefixed command is
 * spawned on the host with the workspace as its cwd (src/sweep/run.ts,
 * src/sweep/client.ts), the github, grafana and terraform entries in
 * servers.yaml already have that shape, and a stranger's entry of the same
 * shape would have read a write token every Wednesday — after the read-only PR
 * job had said it was fine. The phase-3 sentence "no job holding contents:
 * write ever runs a launch command with the token in reach" was true of the PR
 * job and false of the schedule.
 *
 * So: every workflow that can push checks out with `persist-credentials: false`,
 * and in every workflow that launches a server the token reaches git on the
 * push command line of the one step that pushes — no other step, no job env.
 * (release.yml holds `GH_TOKEN` job-wide for the gh CLI; it launches nothing,
 * so the second half does not bind it, and its checkout comment says so.)
 * Asserted over the directory rather than a list, so the next workflow that
 * holds `contents: write` is held to it the day it is added.
 */
describe('every workflow that can push', () => {
  interface Step {
    name?: string;
    uses?: string;
    run?: string;
    env?: Record<string, string>;
    with?: Record<string, unknown>;
  }
  /** `permissions:` is a map, or the `read-all` / `write-all` shorthand. */
  type Permissions = string | Record<string, string>;
  interface Workflow {
    permissions?: Permissions;
    jobs: Record<
      string,
      { permissions?: Permissions; env?: Record<string, string>; steps: Step[] }
    >;
  }
  /**
   * Whether a job's token can push. A missing `permissions:` block is not
   * read-only: it is the repository default, which GitHub can set to
   * read-and-write, so a workflow with no block is treated as able to push and
   * has to say `contents: read` to leave this rule. That is the choice made for
   * ci.yml — declaring read there, rather than adding `persist-credentials:
   * false` to a job that pushes nothing — because a token that cannot push
   * needs no keeping out of .git/config. Before this, `canPush` looked only for
   * an explicit `contents: write`, and ci.yml, with no block and credentials
   * kept, was invisible to a rule that claims to cover the directory.
   */
  const grants = (p?: Permissions) =>
    p === undefined ? true : typeof p === 'string' ? p === 'write-all' : p.contents === 'write';
  const canPush = (wf: Workflow) =>
    Object.values(wf.jobs).some((j) => grants(j.permissions ?? wf.permissions));
  const workflows = readdirSync(wfDir)
    .filter((f) => f.endsWith('.yml'))
    .map((f) => [f, parse(readFileSync(join(wfDir, f), 'utf8')) as Workflow] as const);
  const writers = workflows.filter(([, wf]) => canPush(wf));

  const refersToToken = (v: unknown) =>
    typeof v === 'string' && /github\.token|secrets\.GITHUB_TOKEN/.test(v);
  const holdsToken = (env?: Record<string, unknown>) =>
    Object.values(env ?? {}).some(refersToToken);

  /**
   * A step that launches servers.yaml entries: the sweep, the full sweep, and
   * the cross-check, which launches the slice again through mcp-tokens
   * (src/sweep/cross-check.ts:168-197 spawns the entry command — on the host
   * when it is `docker `-prefixed). The first attempt at this rule matched only
   * `npm run sweep`, so a token added to the cross-check step's env would have
   * passed.
   */
  const LAUNCH_STEP = /npm run sweep\b|npm run sweep:all|src\/sweep\/cross-check\.ts/;

  it('is not an empty set — the bots push, so the rule has something to hold', () => {
    expect(writers.length).toBeGreaterThan(0);
  });

  it('is a rule with something outside it — a read-only workflow says so rather than defaulting to it', () => {
    // If every workflow were a writer, `contents: read` would never have been
    // asserted anywhere and the default-is-write reading of `canPush` would be
    // untested. ci.yml and publish.yml declare read.
    expect(workflows.length).toBeGreaterThan(writers.length);
    // And every workflow declares, at the top or on each job: one without a
    // block is a writer by the reading above, so it would be held to the
    // checkout rule for a push it never makes — the fix is to declare, not to
    // exempt.
    for (const [file, wf] of workflows) {
      const declared =
        wf.permissions !== undefined ||
        Object.values(wf.jobs).every((j) => j.permissions !== undefined);
      expect(declared, `${file} declares what its token may do`).toBe(true);
    }
  });

  for (const [file, wf] of writers) {
    it(`${file} checks out without keeping the token`, () => {
      const checkouts = Object.values(wf.jobs)
        .flatMap((j) => j.steps)
        .filter((s) => s.uses?.startsWith('actions/checkout'));
      expect(checkouts.length).toBeGreaterThan(0);
      for (const s of checkouts)
        expect(s.with?.['persist-credentials'], `${file}: ${s.uses}`).toBe(false);
    });

    it(`${file} hands the token to the push, and never to a launch command`, () => {
      const jobs = Object.values(wf.jobs);
      // In a workflow that launches anything, the push step is the only place
      // the token may appear: not the launch step alone, because a token in
      // the job env or in a neighbouring step's env is one edit away from the
      // launch step's process, and that edit would not fail a narrower check.
      const launches = jobs.some((j) => j.steps.some((s) => LAUNCH_STEP.test(s.run ?? '')));
      for (const job of jobs) {
        if (launches)
          expect(
            holdsToken(job.env),
            `${file}: the job env holds the token in a workflow that launches servers`,
          ).toBe(false);
        for (const s of job.steps) {
          const run = s.run ?? '';
          const label = s.name ?? s.uses ?? run;
          // Inlining `${{ github.token }}` into a script would paste the secret
          // into the shell text; it goes through env or not at all.
          expect(run, label).not.toMatch(/github\.token/);
          if (/git push/.test(run)) {
            // The documented form: token on the command line, never written to
            // the remote's URL, so the tree carries nothing after the push.
            expect(run).toMatch(
              /git push "https:\/\/x-access-token:\$\{GITHUB_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}"/,
            );
            expect(
              s.env?.GITHUB_TOKEN,
              `${file}: push step "${label}" has no token to push with`,
            ).toBe('${{ github.token }}');
          } else if (launches) {
            expect(
              holdsToken(s.env) || holdsToken(s.with),
              `${file}: step "${label}" can see the token in a workflow that launches servers`,
            ).toBe(false);
          }
        }
      }
    });
  }

  it('the launch-step predicate matches every launching step the two measuring jobs run', () => {
    // The predicate is a constant, so this is what keeps it honest: every
    // launch command the two ymls actually execute — found by a looser net
    // than the predicate itself casts — is one it matches. Both jobs launch,
    // so both have to contribute a line.
    for (const [name, yaml] of [
      ['self-badge', workflow],
      ['resweep', resweep],
    ] as const) {
      const launching = yaml
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('run:') && /npm run sweep|cross-check\.ts/.test(l));
      expect(launching.length, `${name} launches servers`).toBeGreaterThan(0);
      for (const l of launching) expect(l, l).toMatch(LAUNCH_STEP);
    }
  });
});

/**
 * The spec watch reads two public URLs and publishes nothing.
 *
 * Deliberately NOT modelled on the capability-probe block above, which asserts
 * the blanket absence of any token: this job carries one on purpose, because
 * the contents API allows 60 requests an hour per IP to an unauthenticated
 * caller and Actions runners share addresses. So the assertions here are
 * positive — what the token may do, where it is allowed to appear — rather than
 * that it is absent.
 */
describe('spec revision watch', () => {
  const specWatch = readFileSync(join(wfDir, 'spec-watch.yml'), 'utf8');
  interface Step {
    uses?: string;
    with?: Record<string, unknown>;
    run?: string;
    env?: Record<string, string>;
  }
  const doc = parse(specWatch) as {
    on: Record<string, unknown>;
    permissions?: Record<string, string>;
    jobs: Record<string, { 'timeout-minutes'?: number; steps: Step[] }>;
  };
  const steps = Object.values(doc.jobs).flatMap((j) => j.steps);

  it('holds a token that can only read, and pushes nothing', () => {
    expect(doc.permissions).toEqual({ contents: 'read' });
    expect(specWatch).not.toContain('git push');
    for (const s of steps.filter((x) => x.uses?.startsWith('actions/checkout'))) {
      expect(s.with?.['persist-credentials']).toBe(false);
    }
  });

  it('passes the token through the environment and never through a command line', () => {
    const watching = steps.find((s) => s.run?.includes('tools/watch-spec-revisions.ts'));
    expect(watching?.env?.GITHUB_TOKEN).toBe('${{ github.token }}');
    for (const s of steps) expect(s.run ?? '').not.toMatch(/github\.token/);
    expect(JSON.stringify(doc)).not.toContain('secrets.');
  });

  /**
   * Derived from both crons rather than restated: the watch is only worth
   * having if a revision landing upstream is visible before the job that
   * publishes measurements taken against the old pin.
   */
  it('runs before the sweep it protects', () => {
    const slot = (yaml: string) => {
      const [min, hour, , , day] = /cron: '([^']*)'/.exec(yaml)![1].trim().split(/\s+/);
      return Number(day) * 24 * 60 + Number(hour) * 60 + Number(min);
    };
    expect(slot(specWatch)).toBeLessThan(slot(resweep));
  });

  it('cannot hold a runner all day for two HTTP requests', () => {
    for (const j of Object.values(doc.jobs)) {
      expect(j['timeout-minutes']).toBeDefined();
      expect(j['timeout-minutes']!).toBeLessThanOrEqual(15);
    }
  });

  it('is scheduled and dispatchable, and does not run on push or pull request', () => {
    expect(Object.keys(doc.on).toSorted()).toEqual(['schedule', 'workflow_dispatch']);
  });
});

describe('the negotiated-version probe answers a question without publishing one', () => {
  const probe = readFileSync(join(wfDir, 'negotiated-versions.yml'), 'utf8');
  const scriptRaw = readFileSync(
    join(import.meta.dirname, '..', 'tools', 'negotiated-versions.ts'),
    'utf8',
  );
  // Comments stripped, for the reason the capability-probe block above gives:
  // a test that reads the prose is checking that someone wrote a sentence.
  const script = scriptRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  it('captures with persist: false, which is the only reason it is safe to run', () => {
    expect(script).toContain('persist: false');
    expect(script.match(/measureServer\(/g) ?? []).toHaveLength(1);
  });

  it('writes no file at all, not even a summary', () => {
    expect(script).not.toContain('writeFileSync');
  });

  it('runs read-only and holds no token, in a job that launches strangers commands', () => {
    expect(probe).toMatch(/permissions:\n\s*contents: read/);
    expect(probe).not.toMatch(/github\.token|GITHUB_TOKEN|secrets\./);
    expect(probe).toContain('persist-credentials: false');
    expect(probe).not.toContain('git push');
  });

  it('is dispatch-only, so nothing here runs on a schedule', () => {
    const doc = parse(probe) as { on: Record<string, unknown> };
    expect(Object.keys(doc.on)).toEqual(['workflow_dispatch']);
  });
});
