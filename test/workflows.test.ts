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
  const scheduledShards = Number(/--shards \{0\}[\s\S]*?inputs\.shards \|\| '(\d+)'/.exec(select)![1]);

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
    expect(resweep.indexOf('measure-divergence.ts')).toBeLessThan(resweep.indexOf('Commit refreshed measurements'));
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
    for (const flag of ['--name', '--command', '--remote', '--baseline', '--max-increase', '--budget', '--timeout']) {
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
      const wired = Object.values(action.runs.steps[0].env).some((v) => v.includes(`inputs.${key}`) || v.includes(`inputs['${key}']`));
      expect(wired, `input ${key} reaches the step through env`).toBe(true);
    }
  });

  it('declares the outputs a caller needs after the gate has run', () => {
    expect(Object.keys(action.outputs).sort()).toEqual(['badge', 'measurement', 'status', 'tokens', 'tools']);
  });
});

/**
 * The release workflow exists so that cutting a version is one action rather
 * than a sequence held in someone's head. That only helps if the order is the
 * safe one — checks before commits, and the publish left where npm's trust
 * actually lives.
 */
describe('release workflow', () => {
  const release = readFileSync(join(import.meta.dirname, '..', '.github', 'workflows', 'release.yml'), 'utf8');
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

  it('has a dry run that stops before the first commit reaches main', () => {
    expect(at('Stop here on a dry run')).toBeLessThan(at('git push'));
    expect(release).toContain("if: inputs.dry_run");
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
 * src/sweep/client.ts), three committed entries already have that shape, and a
 * stranger's entry of the same shape would have read a write token every
 * Wednesday — after the read-only PR job had said it was fine. The phase-3
 * sentence "no job holding contents: write ever runs a launch command with the
 * token in reach" was true of the PR job and false of the schedule.
 *
 * So: every workflow that can push checks out with `persist-credentials: false`,
 * and the token reaches git on the push command line of the one step that
 * pushes. Asserted over the directory rather than a list, so the next workflow
 * that holds `contents: write` is held to it the day it is added.
 */
describe('every workflow that can push', () => {
  interface Step {
    name?: string;
    uses?: string;
    run?: string;
    env?: Record<string, string>;
    with?: Record<string, unknown>;
  }
  interface Workflow {
    permissions?: Record<string, string>;
    jobs: Record<string, { permissions?: Record<string, string>; env?: Record<string, string>; steps: Step[] }>;
  }
  const canPush = (wf: Workflow) =>
    wf.permissions?.contents === 'write' || Object.values(wf.jobs).some((j) => j.permissions?.contents === 'write');
  const writers = readdirSync(wfDir)
    .filter((f) => f.endsWith('.yml'))
    .map((f) => [f, parse(readFileSync(join(wfDir, f), 'utf8')) as Workflow] as const)
    .filter(([, wf]) => canPush(wf));

  const refersToToken = (v: unknown) => typeof v === 'string' && /github\.token|secrets\.GITHUB_TOKEN/.test(v);
  const holdsToken = (env?: Record<string, string>) => Object.values(env ?? {}).some(refersToToken);

  it('is not an empty set — the bots push, so the rule has something to hold', () => {
    expect(writers.length).toBeGreaterThan(0);
  });

  for (const [file, wf] of writers) {
    it(`${file} checks out without keeping the token`, () => {
      const checkouts = Object.values(wf.jobs)
        .flatMap((j) => j.steps)
        .filter((s) => s.uses?.startsWith('actions/checkout'));
      expect(checkouts.length).toBeGreaterThan(0);
      for (const s of checkouts) expect(s.with?.['persist-credentials'], `${file}: ${s.uses}`).toBe(false);
    });

    it(`${file} hands the token to the push, and never to a launch command`, () => {
      for (const job of Object.values(wf.jobs)) {
        for (const s of job.steps) {
          const run = s.run ?? '';
          // Inlining `${{ github.token }}` into a script would paste the secret
          // into the shell text; it goes through env or not at all.
          expect(run, s.name ?? s.uses).not.toMatch(/github\.token/);
          if (run.includes('npm run sweep')) {
            expect(holdsToken(s.env) || holdsToken(job.env), `${file}: launch step "${s.name}" can see the token`).toBe(false);
          }
          if (/git push/.test(run)) {
            // The documented form: token on the command line, never written to
            // the remote's URL, so the tree carries nothing after the push.
            expect(run).toMatch(/git push "https:\/\/x-access-token:\$\{GITHUB_TOKEN\}@github\.com\/\$\{GITHUB_REPOSITORY\}"/);
            expect(s.env?.GITHUB_TOKEN, `${file}: push step "${s.name}" has no token to push with`).toBe('${{ github.token }}');
          }
        }
      }
    });
  }
});

/**
 * The adoption reading is the one number the project keeps about itself, and
 * its date is most of its meaning. Every property here is only observable on
 * the first of a month, with nobody watching.
 */
describe('adoption workflow', () => {
  const adoption = readFileSync(join(wfDir, 'adoption.yml'), 'utf8');
  const runLines = (yaml: string) =>
    yaml
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('run:'));
  /** The five cron fields: minute, hour, day of month, month, day of week. */
  const cronFields = (yaml: string) => /cron: '([^']*)'/.exec(yaml)![1].trim().split(/\s+/);
  /** The document as Actions reads it — comments gone, which is the point for the checks below. */
  interface Step {
    name?: string;
    run?: string;
    env?: Record<string, string>;
    'continue-on-error'?: boolean;
  }
  const doc = parse(adoption) as { jobs: Record<string, { steps: Step[] }> };
  const steps = Object.values(doc.jobs).flatMap((j) => j.steps);
  const reading = steps.find((s) => s.run === 'npm run adoption');

  it('takes the reading with the Actions token and no repository secret', () => {
    // The tool already falls back from MCP_CTX_GITHUB_TOKEN to GITHUB_TOKEN;
    // wiring a secret in would be a second token to rotate for no reason.
    expect(runLines(adoption).filter((l) => l.includes('npm run adoption')).length).toBe(1);
    expect(reading?.env?.GITHUB_TOKEN).toBe('${{ github.token }}');
    expect(JSON.stringify(doc)).not.toContain('secrets.');
    expect(JSON.stringify(doc)).not.toContain('MCP_CTX_GITHUB_TOKEN');
  });

  it('never commits an unresolved reading', () => {
    // The tool writes both files and THEN exits 1 when the count could not be
    // established. A failing run step stops the job, so the commit step is
    // only reached on a resolved reading — provided the reading step is not
    // allowed to fail quietly and comes before the commit. The page date never
    // advances without a count.
    const tool = readFileSync(join(import.meta.dirname, '..', 'tools', 'measure-adoption.ts'), 'utf8');
    expect(tool).toContain('process.exit(run.unresolved ? 1 : 0)');
    expect(reading).toBeDefined();
    expect(reading!['continue-on-error']).toBeUndefined();
    expect(adoption.indexOf('npm run adoption')).toBeLessThan(adoption.indexOf('git commit'));
  });

  it('runs the suite before it commits, because a bot push starts no CI run', () => {
    const test = adoption.indexOf('npm test');
    expect(test).toBeGreaterThan(adoption.indexOf('npm run adoption'));
    expect(test).toBeLessThan(adoption.indexOf('git commit'));
  });

  it('commits only the reading and the page rendered from it', () => {
    // Regen does not produce docs/adoption.md and the README's sentence about
    // adoption carries no number, so nothing else in the tree moves with it.
    const adds = adoption
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('git add '));
    expect(adds.length).toBeGreaterThan(0);
    for (const l of adds) {
      expect(l.slice('git add '.length).split(/\s+/).sort()).toEqual(['docs/adoption.md', 'results/badge-adoption.json']);
    }
    expect(adoption).not.toContain('regen.ts');
  });

  it('rebases before pushing', () => {
    const rebase = adoption.indexOf('git pull --rebase origin main');
    expect(rebase).toBeGreaterThan(adoption.indexOf('git commit'));
    expect(rebase).toBeLessThan(adoption.indexOf('git push'));
  });

  it('is scheduled by day of month, in an hour neither weekly pusher uses', () => {
    // self-badge does not rebase, so a push racing it loses that week's badge;
    // resweep can run for hours. The neighbours' hours are read from their
    // ymls, the way dayOf does above, so moving one of them cannot leave this
    // passing while saying nothing.
    const [, hour, dayOfMonth, , dayOfWeek] = cronFields(adoption);
    expect(dayOfMonth).not.toBe('*');
    expect(dayOfWeek).toBe('*');
    for (const other of [workflow, resweep]) expect(hour).not.toBe(cronFields(other)[1]);
  });

  it('can be dispatched — that is how a reading is taken between slots', () => {
    expect(adoption).toMatch(/^\s*workflow_dispatch:/m);
  });

  it("has a budget of its own, because the tool's fetches carry none", () => {
    // Bare `fetch` with no AbortSignal: a hung response would otherwise hold a
    // write-token job for GitHub's default, which is hours. Smaller than the
    // sweep's, which pays for cold installs; this pays for a few dozen API calls.
    const budget = (yaml: string) => Number(/timeout-minutes: (\d+)/.exec(yaml)![1]);
    expect(/timeout-minutes: (\d+)/.test(adoption)).toBe(true);
    expect(budget(adoption)).toBeGreaterThan(0);
    expect(budget(adoption)).toBeLessThan(budget(resweep));
  });

  it('holds contents: write and a concurrency group, like every job that pushes', () => {
    expect(adoption).toMatch(/permissions:\n\s*contents: write/);
    expect(adoption).toMatch(/concurrency:\n\s*group: adoption/);
  });
});
