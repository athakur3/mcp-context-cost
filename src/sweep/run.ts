/**
 * Single-server measurement runner:
 *   npm run sweep -- --name memory --command "npx -y @modelcontextprotocol/server-memory"
 * Writes results/<name>/measurement.json and badges/<name>.json.
 * Runs tools/list capture TWICE; differing tool sets -> status "dynamic".
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureTools } from './client.js';
import {
  DockerHarnessFault,
  defaultImageFor,
  dockerize,
  ensureImage,
  containerPlatform,
  isDockerRunFailure,
} from './docker.js';
import { measureTools, failedMeasurement, canonicalString } from '../core/canonical.js';
import { toBadge } from '../core/badge.js';
import type { Measurement } from '../core/types.js';

/**
 * Which kind of failure a dead server's own words describe.
 *
 * The distinction is the published one: `auth-required` says the server works
 * and this harness has no credentials for it, `startup-failure` says the server
 * did not come up. Only the text decides, so it matters that the text reaching
 * here is the part that explains the failure rather than whatever happened to
 * fall in the last few hundred bytes — see `evidenceTail` in client.ts, which
 * exists because a truncated message was being filed as a broken server.
 */
/**
 * Words that mean a server wanted a credential, bounded so they mean it.
 *
 * `\b` is the wrong boundary here. It counts `_` and digits as word
 * characters, so `\btoken\b` misses `tracker_token` — the exact phrasing
 * `yandex-tracker` uses to say its credential is missing. Letters are the
 * boundary instead, which keeps `tracker_token` and `oauth_enabled` while
 * rejecting the two records that made the unbounded version a bug:
 *
 * - `authority`, in "x509: certificate signed by unknown authority" — this
 *   harness's container not trusting a CA, published as `auth-required` for
 *   `slack`.
 * - `PublicKeyToken`, in a .NET assembly name — published as `auth-required`
 *   for `azure`.
 *
 * Both said "this server wants a credential" about a record that said nothing
 * of the kind. Alternatives that are already whole words nobody's stack trace
 * contains by accident (`credential`, `forbidden`, and the `authenticat` /
 * `authoriz` stems) stay unbounded so they still match their own plurals and
 * inflections; `401` takes `\b`, because there a digit *is* a boundary and
 * `1401` is not a status code.
 */
export const AUTH_EVIDENCE =
  /(?<![a-z])(?:o?auth|tokens?|api.?keys?)(?![a-z])|unauthori[sz]|authenticat|authori[sz]|credential|forbidden|\b401\b/i;

export function classifyFailure(msg: string): 'timeout' | 'auth-required' | 'startup-failure' {
  // Matched against this harness's own phrasing, not the bare word: these
  // messages carry the server's stderr, and a server that prints "connection
  // timeout" before dying did not time out — it exited, and saying otherwise
  // blames the clock for a breakage.
  if (/timeout after \d+ms waiting for/.test(msg)) return 'timeout';
  return AUTH_EVIDENCE.test(msg) ? 'auth-required' : 'startup-failure';
}

/**
 * The architecture the *measuring process* is running on, in Docker's
 * vocabulary (`darwin/arm64`, `linux/amd64`).
 *
 * Worth recording because a package can ship builds for some architectures and
 * not others, and then the *machine* decides the result. `local-mcp` sat
 * published as a startup failure on the strength of a run whose actual finding
 * was that the laptop was arm64 and the package ships no arm64 runtime — and
 * the record gave a reader no way to notice.
 *
 * Only correct for an uncontained run, where this process *is* the machine the
 * server ran on. It used to answer for containers too, by assuming the platform
 * half was `linux` and keeping the host's architecture — which is wrong the
 * moment `DOCKER_DEFAULT_PLATFORM` is set or the image has no manifest for the
 * host and is emulated. Containers are answered by `containerPlatform`, which
 * asks a container instead of inferring from the machine that starts one.
 */
export function measuringArch(): string {
  const arch = process.arch === 'x64' ? 'amd64' : process.arch;
  return `${process.platform}/${arch}`;
}

/**
 * The `arch` to record for one isolation, or undefined when nothing observed it.
 *
 * Three cases, and the third is why this is not a fallback chain. An uncontained
 * run is observed by this process, which *is* the machine the server ran on. A
 * container this harness built is observed by asking a container. A command that
 * is *itself* a `docker run` names no image here at all — the harness never
 * chose it and cannot see inside it — so the field stays absent, which the
 * record already defines as unknown. Guessing the host's architecture there
 * would be a claim about a container this code did not launch.
 */
export async function observedArch(iso: Measurement['isolation']): Promise<string | undefined> {
  if (!iso?.docker) return measuringArch();
  if (!iso.image) return undefined;
  return (await containerPlatform(iso.image)) ?? undefined;
}

/**
 * The declared reason, when this failure is the one the entry warned about.
 *
 * Corroboration is the whole point: an entry may declare that this harness
 * cannot run it, but only the failure's own words can confirm that *this*
 * failure is that one. A macOS-only package that starts failing for some new
 * reason stops matching, and is published as the failure it actually is.
 */
export function notApplicableReason(
  declared: { reason: string; evidence: string } | undefined,
  msg: string,
): string | null {
  if (!declared?.evidence) return null;
  return msg.toLowerCase().includes(declared.evidence.toLowerCase()) ? declared.reason : null;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export interface MeasureOptions {
  timeoutMs?: number;
  env?: Record<string, string>;
  root?: string;
  docker?: boolean;
  dockerImage?: string;
  /** env var NAMES to provide as dummy values (docker mode). */
  dummyEnv?: string[];
  /** Override the literal `dummy` value for specific `dummyEnv` names — see docker.ts. */
  dummyEnvValues?: Record<string, string>;
  /** Install `git` in the container before launch (docker mode) — see docker.ts. */
  needsGit?: boolean;
  /** Declared harness limitation for this entry — see `notApplicable` in report.ts. */
  notApplicable?: { reason: string; evidence: string };
  /**
   * Exact argv, when the caller already has it (client configs store command and
   * args separately). Avoids re-splitting a joined string on spaces, which would
   * break any path containing one. Host path only — docker still wraps `command`.
   */
  argv?: string[];
  /**
   * Write results/<name>/measurement.json + badges/<name>.json (default true).
   * `audit` runs in the user's own directory and must not litter it.
   */
  persist?: boolean;
}

/**
 * Marks a startup-failure that was re-attempted from a cold package cache and
 * failed the same way. Its absence on a startup-failure means the retry never
 * ran (host mode, or a self-containerised command), not that it passed.
 */
export const RETRY_CONFIRMED_PREFIX = 'reproduced with the shared package cache bypassed; ';

/**
 * Whether a failed measurement gets a second attempt with the shared package
 * caches bypassed (see `DockerOptions.noSharedCache`).
 *
 * A poisoned cache entry and a genuinely broken server produce the same exit
 * code, so a `startup-failure` is not published until it reproduces from a cold
 * cache. Deliberately only `startup-failure`: a `timeout` is usually the slow
 * install a cold retry would only make slower (it has its own retry — see
 * `retriesWithLongerTimeout`), `auth-required` is a real answer about the
 * server, and a command that is already its own `docker run` has no cache mount
 * to bypass.
 */
export function retriesWithoutSharedCache(
  status: Measurement['status'],
  docker: boolean,
  command: string,
): boolean {
  return status === 'startup-failure' && docker && !command.trimStart().startsWith('docker ');
}

/**
 * Marks a `timeout` that was re-attempted on a larger budget and timed out
 * again. Its absence on a timeout means the retry never ran, not that it passed.
 */
export const TIMEOUT_CONFIRMED_PREFIX = 'reproduced on double the timeout budget; ';

/** A timed-out measurement is re-attempted on this multiple of its budget. */
export const TIMEOUT_RETRY_FACTOR = 2;

/**
 * Whether a timed-out measurement gets a second attempt on a larger budget.
 *
 * Sweeps and `audit` both run a worker pool, and a server that starts slowly
 * under that contention is indistinguishable from one that never starts: both
 * come back `timeout`. Two servers were published as failures for exactly this
 * reason (`puppeteer` and `kubernetes`, 2026-08-19) and measured normally when
 * re-run alone, so a timeout is not published until it survives a second, wider
 * budget. Unlike the cold-cache retry this is isolation-independent — contention
 * is not a property of the package cache, so host runs and commands that are
 * their own `docker run` are retried too.
 */
export function retriesWithLongerTimeout(status: Measurement['status']): boolean {
  return status === 'timeout';
}

export async function measureServer(
  name: string,
  command: string,
  opts: MeasureOptions = {},
): Promise<Measurement> {
  const persist = opts.persist !== false;
  // The name becomes a directory when persisting; that's the only reason it's
  // constrained, so in-memory callers may use whatever the config called it.
  if (persist && (!/^[a-z0-9][a-z0-9._-]*$/i.test(name) || name.includes('..'))) {
    throw new Error(`invalid server name '${name}' — letters/digits/dot/dash/underscore only`);
  }
  const root = opts.root ?? process.cwd();
  // True only when THIS code wraps the command in `docker run` — a command that
  // is already its own `docker run` owns its exit codes and its image.
  const dockerWrapped = opts.docker === true && !command.trimStart().startsWith('docker ');
  const hostSpec: string | { command: string; argv: string[] } =
    opts.argv && opts.argv.length ? { command: opts.argv[0], argv: opts.argv.slice(1) } : command;
  let isolation: Measurement['isolation'] = { docker: false };
  const containerNames: string[] = [];
  // A fresh container name per capture: some servers don't exit on stdin close
  // (background timers keep the event loop alive), so `close()`'s SIGKILL only
  // detaches the host-side `docker run` CLI — the container itself can outlive
  // it. Reusing one name across both tools/list captures then races `--rm`'s
  // async cleanup: the second `docker run --name X` collides with the first
  // container mid-removal. Distinct names sidestep the race entirely; the
  // `finally` below force-removes every name this call created either way.
  function buildSpec(noSharedCache = false): string | { command: string; argv: string[] } {
    if (opts.docker && command.trimStart().startsWith('docker ')) {
      // Command is already a container — wrapping it again would need docker-in-docker.
      isolation = { docker: true, note: 'command is itself a docker run (host-spawned container)' };
      return hostSpec;
    }
    if (!opts.docker) return hostSpec;
    const containerName = `mcp-ctx-${name}-${process.pid}-${Math.floor(Math.random() * 1e6)}-${containerNames.length}`;
    containerNames.push(containerName);
    const d = dockerize(command, {
      image: opts.dockerImage,
      dummyEnv: opts.dummyEnv,
      dummyEnvValues: opts.dummyEnvValues,
      containerName,
      needsGit: opts.needsGit,
      noSharedCache,
    });
    isolation = d.isolation;
    return { command: d.command, argv: d.argv };
  }
  async function attempt(noSharedCache: boolean, timeoutMsOverride?: number): Promise<Measurement> {
    // A cold install has to fetch everything again, so the retry gets its own
    // floor — otherwise the bypass would trade a cache-poisoned startup-failure
    // for a timeout and report just as wrongly.
    const attemptOpts =
      timeoutMsOverride !== undefined
        ? { ...opts, timeoutMs: timeoutMsOverride }
        : noSharedCache
          ? { ...opts, timeoutMs: Math.max(opts.timeoutMs ?? 60_000, 240_000) }
          : opts;
    let r: Measurement;
    try {
      const first = await captureTools(buildSpec(noSharedCache), attemptOpts);
      const second = await captureTools(buildSpec(noSharedCache), attemptOpts);
      r = measureTools(first.tools, {
        serverName: first.serverInfo?.name ?? name,
        serverVersion: first.serverInfo?.version,
        launchCommand: command,
        envVarNames: [...Object.keys(opts.env ?? {}), ...(opts.dummyEnv ?? [])],
        instructions: first.instructions,
      });
      if (canonicalString(first.tools) !== canonicalString(second.tools)) {
        r.status = 'dynamic';
        r.notes = 'tools/list differed between two runs; value is for the first capture';
      }
    } catch (err) {
      if (err instanceof DockerHarnessFault) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      // `docker run` failing as docker (exit 125, docker's own stderr) never
      // launched the server — classifying it would publish a fact about this
      // machine as a fact about the server, so it is thrown instead of returned.
      if (dockerWrapped && isDockerRunFailure(msg)) {
        throw new DockerHarnessFault(`docker could not run the container for ${name}: ${msg.slice(0, 400)}`);
      }
      const declared = notApplicableReason(opts.notApplicable, msg);
      r = failedMeasurement(declared ? 'not-applicable' : classifyFailure(msg), {
        serverName: name,
        launchCommand: command,
        // The declared reason leads, but the raw failure stays behind it: the
        // record has to remain checkable against the run that produced it.
        notes: (declared ? `${declared} — ${msg}` : msg).slice(0, 700),
      });
    }
    const iso = isolation ?? { docker: false };
    const arch = await observedArch(iso);
    r.isolation = { ...iso, ...(arch ? { arch } : {}) };
    r.timeoutMs = attemptOpts.timeoutMs ?? 60_000;
    return r;
  }

  // The base image is fetched before anything is measured: `--pull=missing`
  // pulls lazily, so a registry hiccup would otherwise land mid-measurement and
  // read as the server refusing to start. Throws DockerHarnessFault when the
  // machine cannot produce the image at all — before any record is written.
  if (dockerWrapped) await ensureImage(opts.dockerImage ?? defaultImageFor(command));

  let m: Measurement;
  try {
    m = await attempt(false);
    if (retriesWithoutSharedCache(m.status, opts.docker === true, command)) {
      const retry = await attempt(true);
      if (retry.status !== 'startup-failure') {
        m = retry;
      } else {
        // Keep the warm attempt — its stderr is the one worth reading — but say
        // that the failure survived a cold cache, so a reader can tell a real
        // breakage from a cache artifact without re-running the sweep.
        m.notes = `${RETRY_CONFIRMED_PREFIX}${m.notes ?? ''}`.slice(0, 700);
      }
    } else if (retriesWithLongerTimeout(m.status)) {
      const retry = await attempt(false, (opts.timeoutMs ?? 60_000) * TIMEOUT_RETRY_FACTOR);
      // The retry replaces the first attempt either way: it is the wider budget,
      // so its `timeoutMs` is the number a reader needs to judge the verdict.
      m = retry;
      if (retry.status === 'timeout') {
        m.notes = `${TIMEOUT_CONFIRMED_PREFIX}${m.notes ?? ''}`.slice(0, 700);
      }
    }
  } finally {
    if (containerNames.length) {
      // Killing the docker CLI on timeout/non-exit orphans the container — remove it.
      const { spawn } = await import('node:child_process');
      for (const n of containerNames) {
        spawn('docker', ['rm', '-f', n], { stdio: 'ignore' }).on('error', () => {});
      }
    }
  }

  if (!persist) return m;

  const resultDir = join(root, 'results', name);
  mkdirSync(resultDir, { recursive: true });
  writeFileSync(join(resultDir, 'measurement.json'), JSON.stringify(m, null, 2) + '\n');

  mkdirSync(join(root, 'badges'), { recursive: true });
  writeFileSync(join(root, 'badges', `${name}.json`), JSON.stringify(toBadge(m)) + '\n');
  return m;
}

// Exact path match, not endsWith('run.ts'): any other file whose name happens to
// end in "run.ts" (src/audit/run.ts, a scratch dryrun.ts) would otherwise run this
// block and exit 2 on missing --name.
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const name = arg('name');
  const command = arg('command');
  if (!name || !command) {
    console.error('usage: npm run sweep -- --name <slug> --command "<launch command>"');
    process.exit(2);
  }
  let m: Measurement;
  try {
    m = await measureServer(name, command, {
      timeoutMs: Number(arg('timeout') ?? 60_000),
      docker: process.argv.includes('--docker'),
      dockerImage: arg('docker-image'),
    });
  } catch (err) {
    if (err instanceof DockerHarnessFault) {
      // Nothing was measured and nothing was written — exiting non-zero here is
      // what keeps a scheduled job from reaching its commit step.
      console.error(`HARNESS FAULT: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
  // CLI path only — measureServer itself stays history-free so concurrent
  // sweep-all workers never race on the same file.
  const { appendHistory } = await import('./history.js');
  appendHistory();
  console.log(
    m.status === 'measured' || m.status === 'dynamic'
      ? `${name}: ${m.totalTokens} tokens across ${m.toolCount} tools (${m.status})`
      : `${name}: ${m.status} — ${m.notes ?? ''}`,
  );
  process.exit(m.status === 'measured' || m.status === 'dynamic' ? 0 : 1);
}
