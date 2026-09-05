/**
 * The read-only measurement a pull request gets before any job holding
 * `contents: write` ever runs its launch command:
 *   npx tsx src/sweep/pr-check.ts --base <base servers.yaml> [--head servers.yaml]
 *                                 [--docker] [--default-timeout 60] [--max-entries 4]
 *
 * Diffs the two documents BY NAME and measures only what changed: entries the
 * pull request added, and entries whose launch-affecting fields it changed
 * (`LAUNCH_FIELDS`). The second set is not optional. The roadmap first wrote
 * "measures only the entries the PR added", and that misses the point of the
 * check: a PR that rewrites an existing entry's `command` changes what the
 * Wednesday rotation (resweep.yml, `contents: write`) will spawn next, and
 * "added" never sees it. What is launched is what is measured.
 *
 * Nothing is written anywhere. `measureServer` runs with `persist: false`, the
 * form session-start.ts and cross-check.ts already use, and this file imports
 * none of history.js, report.js, regressions.js or regen.js — the number is
 * printed in the check log and the rotation publishes its own later, under its
 * own rules. The measured line here is not the published number and must not
 * be quoted as one: a fresh runner resolves `@latest` on its own day.
 *
 * Four refusals, all before a launch, all exit 2 so a reader can tell "nothing
 * ran" from "the entry failed". A head document that does not parse as YAML
 * prints the parser's message and stops — never its stack trace, which the
 * first draft of this script let through with exit 1, the code the policy
 * below reserves for an entry that launched and failed. A head that parses but
 * fails `validateServers` prints the problems (servers-schema.ts was written
 * for exactly this second caller). More than `--max-entries` entries is refused
 * because one entry can cost `budget × (1 + TIMEOUT_RETRY_FACTOR)` (run.ts
 * retries a timeout on the doubled budget) and the workflow's `timeout-minutes`
 * is derived from that product — and, because the schema bounds an entry's own
 * `timeoutSeconds` only below (servers-schema.ts:166-169), the sum of what the
 * selected entries would actually cost (`worstCaseSeconds`) is refused when it
 * exceeds the same budget, so no entry's `timeoutSeconds: 4000` can push the
 * runner past the job limit with its line unprinted. And an entry whose command
 * is already its own `docker run` (`isSelfContainerised`) is listed, not
 * launched: the harness would spawn it against the runner's own daemon with the
 * pull request's argv, so it waits for a maintainer to measure it via
 * resweep.yml's `servers` input after review. Listing is the `remote` treatment
 * sweep-all.ts gives endpoints, and it is exit 0 — published entries already
 * take this form (the premise record cites the `github`, `grafana` and
 * `terraform` entries), and a check that went red on a shape the file already
 * uses would be a check against the file.
 *
 * Exit policy, by the entry's outcome: `measured`, `auth-required` and a
 * declared `not-applicable` are findings the leaderboard publishes today, so
 * they pass. `startup-failure` and `timeout` mean the entry does not launch as
 * written — the lesson `agent-device` taught, measured only once its `mcp`
 * subcommand was named (CHANGELOG 0.12.0) — and `dynamic` means two captures
 * disagreed, so there is no one number to show. Those fail, with the evidence
 * tail printed so the reader sees what the server said. A `DockerHarnessFault`
 * is the runner's problem, not the entry's (the 2026-08-26 `sequential-thinking`
 * incident, docker.ts), and exits 1 saying so.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { isSelfContainerised, measureServer, TIMEOUT_RETRY_FACTOR } from './run.js';
import { DockerHarnessFault } from './docker.js';
import { formatProblems, validateServers, type SchemaProblem } from './servers-schema.js';
import type { ServerEntry } from './report.js';
import type { Measurement } from '../core/types.js';

/**
 * The fields that change what a sweep launches — the option object
 * sweep-all.ts hands to `measureServer`, plus the timeout it is given. A change
 * to `metric`, `metricSource`, `category`, `repo`, `package` or `deprecated`
 * changes a row's text, not its process, and is not re-measured here.
 */
export const LAUNCH_FIELDS = [
  'command',
  'dockerImage',
  'aptPackages',
  'needsGit',
  'env',
  'envValues',
  'timeoutSeconds',
  'notApplicable',
] as const satisfies readonly (keyof ServerEntry)[];

/**
 * How many entries one pull request may launch, at the default budget. The
 * worst case per entry is a timeout retried on `TIMEOUT_RETRY_FACTOR` times
 * its budget (run.ts:351-352), so at the workflow's `--default-timeout 240`
 * one entry can hold the runner for 240 × (1 + 2) = 720s, and this many of
 * them measured one at a time is what pr-check.yml's `timeout-minutes` is
 * sized to (`launchBudgetSeconds`).
 *
 * The count alone does not hold that bound. An entry's own `timeoutSeconds`
 * replaces the default (the rotation's rule, kept here), and the schema bounds
 * it only below — "a whole number of seconds greater than zero"
 * (servers-schema.ts:166-169) — so one added entry with `timeoutSeconds: 4000`
 * would cost 12000s under the same count and be killed by the job limit with
 * no line printed for it. The bound is held because the script also refuses,
 * before any launch, a selection whose `worstCaseSeconds` exceeds the budget
 * the count was sized to. A PR that trips either is asked to split or shorten,
 * rather than have the runner cut it off with the last entries unmeasured and
 * no line saying so.
 */
export const DEFAULT_MAX_ENTRIES = 4;

/** The launched entries among a selection: remote endpoints and self-containerised commands are listed, not spawned. */
export function launchedEntries(entries: ServerEntry[]): ServerEntry[] {
  return entries.filter((e) => !e.remote && !isSelfContainerised(e.command));
}

/**
 * The most seconds a selection can hold the runner: each launched entry's own
 * budget (`timeoutSeconds`, or the default) once, then `TIMEOUT_RETRY_FACTOR`
 * times more on the retry. Listed entries cost nothing and are not counted.
 */
export function worstCaseSeconds(entries: ServerEntry[], defaultTimeout: number): number {
  return launchedEntries(entries).reduce(
    (sum, e) => sum + (e.timeoutSeconds ?? defaultTimeout) * (1 + TIMEOUT_RETRY_FACTOR),
    0,
  );
}

/** What the job's `timeout-minutes` was sized to: `maxEntries` launches, each at the default budget and its retry. */
export function launchBudgetSeconds(maxEntries: number, defaultTimeout: number): number {
  return maxEntries * defaultTimeout * (1 + TIMEOUT_RETRY_FACTOR);
}

export interface ServersDiff {
  /** Head fails the shape check; nothing is diffed from a malformed document. */
  problems: SchemaProblem[];
  /** Names present in head and absent from base. */
  added: ServerEntry[];
  /** Names in both whose `LAUNCH_FIELDS` projection differs. */
  relaunched: ServerEntry[];
}

/** JSON with object keys sorted at every depth, so equal launches stringify equal. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The part of an entry that decides what gets spawned, as one comparable string. */
export function launchSignature(entry: ServerEntry): string {
  const projection: Record<string, unknown> = {};
  for (const field of LAUNCH_FIELDS) {
    if (entry[field] !== undefined) projection[field] = entry[field];
  }
  return stable(projection);
}

function entriesOf(doc: unknown): ServerEntry[] {
  if (typeof doc !== 'object' || doc === null) return [];
  const servers = (doc as { servers?: unknown }).servers;
  if (!Array.isArray(servers)) return [];
  return servers.filter(
    (e): e is ServerEntry => typeof e === 'object' && e !== null && typeof (e as ServerEntry).name === 'string',
  );
}

/**
 * What a pull request adds or relaunches, given the parsed base and head
 * documents. Head is shape-checked first and returns only problems when it has
 * any. Base is the committed branch, which `npm test` already holds valid; an
 * unreadable base is treated as empty, which makes every head entry "added"
 * and lets the entry cap refuse the run rather than measuring the whole file.
 */
export function entriesToMeasure(base: unknown, head: unknown): ServersDiff {
  const problems = validateServers(head);
  if (problems.length) return { problems, added: [], relaunched: [] };
  const before = new Map(entriesOf(base).map((e) => [e.name, e]));
  const added: ServerEntry[] = [];
  const relaunched: ServerEntry[] = [];
  for (const entry of entriesOf(head)) {
    const prior = before.get(entry.name);
    if (!prior) added.push(entry);
    else if (launchSignature(prior) !== launchSignature(entry)) relaunched.push(entry);
  }
  return { problems: [], added, relaunched };
}

/** The line printed for a launched entry — sweep-all's summary form, with the evidence behind a failure. */
export function summarise(name: string, m: Measurement, secs: number): string {
  const head =
    m.status === 'measured' || m.status === 'dynamic'
      ? `${name}: ${m.totalTokens} tokens / ${m.toolCount} tools (${m.status}, ${secs}s)`
      : `${name}: ${m.status} (${secs}s)`;
  const tail = m.notes ? `\n    ${m.notes.split('\n').join('\n    ')}` : '';
  return head + tail;
}

/** Whether an outcome fails the check. */
export function failsCheck(status: Measurement['status']): boolean {
  return status === 'startup-failure' || status === 'timeout' || status === 'dynamic';
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Exact path match, for the reason src/sweep/run.ts states: any other file whose
// name merely ends the same way would otherwise run this block.
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const basePath = arg('base');
  if (!basePath) {
    console.error(
      'usage: npx tsx src/sweep/pr-check.ts --base <base servers.yaml> [--head servers.yaml] [--docker] ' +
        `[--default-timeout 60] [--max-entries ${DEFAULT_MAX_ENTRIES}]`,
    );
    process.exit(2);
  }
  const headPath = arg('head') ?? 'servers.yaml';
  const docker = process.argv.includes('--docker');
  const defaultTimeout = Number(arg('default-timeout') ?? 60);
  const maxEntries = Number(arg('max-entries') ?? DEFAULT_MAX_ENTRIES);

  // A parse error is a refusal, not a failed launch: exit 2 with the parser's
  // message, never its stack trace. Base is the committed branch and always
  // parses in practice, but the two are treated alike so no path exits 1
  // without an entry having been launched.
  const parseDoc = (path: string): unknown => {
    try {
      return parse(readFileSync(path, 'utf8')) as unknown;
    } catch (err) {
      console.error(`${path} does not parse as YAML: ${(err as Error).message.trim()}\nnothing was launched`);
      process.exit(2);
    }
  };
  const base = parseDoc(basePath);
  const head = parseDoc(headPath);

  const diff = entriesToMeasure(base, head);
  if (diff.problems.length) {
    console.error(`${headPath} is not shaped like a servers list; nothing was launched:`);
    console.error(formatProblems(diff.problems));
    process.exit(2);
  }

  const selected = [...diff.added, ...diff.relaunched];
  if (selected.length === 0) {
    console.log('servers.yaml adds or relaunches no entry; nothing to measure');
    process.exit(0);
  }
  if (selected.length > maxEntries) {
    console.error(
      `this pull request adds or relaunches ${selected.length} entries ` +
        `(${selected.map((e) => e.name).join(', ')}); the check launches at most ${maxEntries} — ` +
        `one entry can cost --default-timeout × (1 + ${TIMEOUT_RETRY_FACTOR}) seconds, and the ` +
        `job's timeout-minutes is sized to ${maxEntries} of those. Split the pull request. Nothing was launched.`,
    );
    process.exit(2);
  }
  const budget = launchBudgetSeconds(maxEntries, defaultTimeout);
  const worst = worstCaseSeconds(selected, defaultTimeout);
  if (worst > budget) {
    const named = launchedEntries(selected)
      .map((e) => `${e.name} (timeoutSeconds ${e.timeoutSeconds ?? `${defaultTimeout}, the default`})`)
      .join(', ');
    console.error(
      `the entries this pull request launches could hold the runner for ${worst}s — ${named}, each ` +
        `retried on ${TIMEOUT_RETRY_FACTOR}× its budget after a timeout — and the job's timeout-minutes ` +
        `is sized to ${budget}s (${maxEntries} entries at --default-timeout ${defaultTimeout}). ` +
        `Shorten timeoutSeconds or split the pull request. Nothing was launched.`,
    );
    process.exit(2);
  }

  console.log(
    `measuring ${diff.added.length} added and ${diff.relaunched.length} relaunched ` +
      `(docker=${docker}, default timeout ${defaultTimeout}s, one at a time)`,
  );

  // One at a time, deliberately: contention is what produced two false
  // timeouts in an earlier sweep (run.ts, `retriesWithLongerTimeout`), and a
  // check over a handful of entries has no throughput to buy with it.
  let failed = 0;
  for (const e of selected) {
    const kind = diff.added.includes(e) ? 'added' : 'relaunched';
    if (e.remote) {
      console.log(`  ${e.name} (${kind}): remote — listed, not measured; an endpoint never reaches initialize without credentials`);
      continue;
    }
    if (isSelfContainerised(e.command)) {
      console.log(
        `  ${e.name} (${kind}): listed, not launched here — its command is its own \`docker run\`, which ` +
          `the harness would spawn against this runner's daemon with the pull request's argv. ` +
          `A maintainer measures it via resweep.yml servers=${e.name} after review.`,
      );
      continue;
    }
    const started = Date.now();
    let m: Measurement;
    try {
      m = await measureServer(e.name, e.command, {
        timeoutMs: (e.timeoutSeconds ?? defaultTimeout) * 1000,
        docker,
        dockerImage: e.dockerImage,
        dummyEnv: e.env ?? [],
        dummyEnvValues: e.envValues,
        needsGit: e.needsGit,
        aptPackages: e.aptPackages,
        notApplicable: e.notApplicable,
        persist: false, // the check prints; the rotation publishes
      });
    } catch (err) {
      if (!(err instanceof DockerHarnessFault)) throw err;
      // A statement about the runner, not the entry — but nothing was measured,
      // and a green check with no number in it would be read as one.
      console.error(`HARNESS FAULT: ${err.message}`);
      process.exit(1);
    }
    const secs = Math.round((Date.now() - started) / 1000);
    console.log(`  ${summarise(`${e.name} (${kind})`, m, secs)}`);
    if (failsCheck(m.status)) failed++;
  }

  console.log(
    'Nothing was written: results/, badges/ and history.csv are published only by the rotation ' +
      '(.github/workflows/resweep.yml). If CI is red on this pull request, run `npx tsx src/sweep/regen.ts` ' +
      'and commit what it rewrote, and add a bullet under `## Unreleased` in CHANGELOG.md or start the ' +
      'commit subject with `chore:` — tools/release-readiness.ts fails a servers.yaml commit that does neither.',
  );
  if (failed) {
    console.error(`${failed} entr${failed === 1 ? 'y does' : 'ies do'} not launch as written; see the lines above`);
  }
  process.exit(failed ? 1 : 0);
}
