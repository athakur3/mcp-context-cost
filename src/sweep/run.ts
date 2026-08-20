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
import { dockerize } from './docker.js';
import { measureTools, failedMeasurement, canonicalString } from '../core/canonical.js';
import { toBadge } from '../core/badge.js';
import type { Measurement } from '../core/types.js';

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
      const msg = err instanceof Error ? err.message : String(err);
      const status = msg.includes('timeout')
        ? 'timeout'
        : /auth|unauthorized|401|forbidden|credential|api.?key|token/i.test(msg)
          ? 'auth-required'
          : 'startup-failure';
      r = failedMeasurement(status, { serverName: name, launchCommand: command, notes: msg.slice(0, 700) });
    }
    r.isolation = isolation;
    r.timeoutMs = attemptOpts.timeoutMs ?? 60_000;
    return r;
  }

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
  const m = await measureServer(name, command, {
    timeoutMs: Number(arg('timeout') ?? 60_000),
    docker: process.argv.includes('--docker'),
    dockerImage: arg('docker-image'),
  });
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
