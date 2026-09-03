import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DockerHarnessFault, ensureImage, isDockerRunFailure } from '../src/sweep/docker.js';
import { measureServer } from '../src/sweep/run.js';

/**
 * Docker failing is not the server failing, and it must be impossible to
 * publish the one as the other.
 *
 * The 2026-08-26 re-sweep did exactly that: the runner's pull of the base image
 * failed, `docker run` exited 125 without launching anything, and
 * `sequential-thinking` — 992 tokens the day before — was published as a
 * startup-failure. Both per-server retries re-ran through the same missing
 * image and read as confirmation, and the harness guard stayed quiet because it
 * watches populations, not rows. Everything here exercises that seam: docker's
 * own failures (exit 125 in docker's own stderr voice) throw
 * `DockerHarnessFault` instead of returning a measurement, and the image is
 * pulled — with retries — before a measurement ever depends on it.
 */

describe('isDockerRunFailure', () => {
  it('recognises docker failing to find its image', () => {
    expect(
      isDockerRunFailure("server exited (code 125); stderr tail: Unable to find image 'node:22-slim' locally"),
    ).toBe(true);
  });

  it('recognises the daemon refusing in its own voice', () => {
    expect(
      isDockerRunFailure('server exited (code 125); stderr tail: docker: Error response from daemon: pull rate limit'),
    ).toBe(true);
    expect(
      isDockerRunFailure('server exited (code 125); stderr tail: docker: Cannot connect to the Docker daemon'),
    ).toBe(true);
  });

  it('leaves a contained process that exits 125 to own its exit code', () => {
    // Docker reserves 125, but a contained process exiting 125 passes through
    // indistinguishably — without docker's stderr voice it stays the server's.
    expect(isDockerRunFailure('server exited (code 125); stderr tail: fatal: config parse error')).toBe(false);
  });

  it('never fires on other exit codes or timeouts, whatever the stderr says', () => {
    expect(isDockerRunFailure("server exited (code 1); stderr tail: Unable to find image 'x' locally")).toBe(false);
    expect(isDockerRunFailure('timeout after 60000ms waiting for initialize')).toBe(false);
  });
});

describe('ensureImage', () => {
  type Call = { args: string[] };
  /** A scripted docker: each entry answers the next invocation. */
  function scripted(script: Array<{ code: number | null; stderr?: string }>) {
    const calls: Call[] = [];
    const sleeps: number[] = [];
    return {
      calls,
      sleeps,
      opts: {
        run: async (args: string[]) => {
          calls.push({ args });
          const next = script.shift();
          if (!next) throw new Error('scripted docker ran out of answers');
          return { code: next.code, stderr: next.stderr ?? '' };
        },
        sleep: async (ms: number) => {
          sleeps.push(ms);
        },
        delaysMs: [5, 7],
      },
    };
  }

  it('does nothing when the image is already present', async () => {
    const d = scripted([{ code: 0 }]);
    await ensureImage('img', d.opts);
    expect(d.calls.map((c) => c.args[0])).toEqual(['image']);
  });

  it('pulls a missing image once when the pull works', async () => {
    const d = scripted([{ code: 1, stderr: 'No such image' }, { code: 0 }]);
    await ensureImage('img', d.opts);
    expect(d.calls.map((c) => c.args[0])).toEqual(['image', 'pull']);
    expect(d.sleeps).toEqual([]);
  });

  it('retries a failing pull on the configured delays before succeeding', async () => {
    const d = scripted([
      { code: 1, stderr: 'No such image' },
      { code: 1, stderr: 'registry hiccup' },
      { code: 1, stderr: 'registry hiccup' },
      { code: 0 },
    ]);
    await ensureImage('img', d.opts);
    expect(d.calls.map((c) => c.args[0])).toEqual(['image', 'pull', 'pull', 'pull']);
    expect(d.sleeps).toEqual([5, 7]);
  });

  it('gives up as a harness fault that names the image and keeps the registry error', async () => {
    const d = scripted([
      { code: 1, stderr: 'No such image' },
      { code: 1, stderr: 'x' },
      { code: 1, stderr: 'x' },
      { code: 1, stderr: 'toomanyrequests: pull rate limit reached' },
    ]);
    const err = await ensureImage('img', d.opts).catch((e) => e);
    expect(err).toBeInstanceOf(DockerHarnessFault);
    expect(String(err.message)).toContain('could not pull img after 3 attempts');
    expect(String(err.message)).toContain('pull rate limit reached');
  });

  it('fails fast when docker itself is not on the machine — retrying cannot install it', async () => {
    const d = scripted([{ code: null, stderr: 'spawn docker ENOENT' }]);
    const err = await ensureImage('img', d.opts).catch((e) => e);
    expect(err).toBeInstanceOf(DockerHarnessFault);
    expect(String(err.message)).toContain('not runnable');
    expect(d.calls).toHaveLength(1);
    expect(d.sleeps).toEqual([]);
  });
});

/**
 * The wiring, end to end, against a `docker` shim on PATH: measureServer must
 * ensure the image (inspect, then pull) before measuring, and a `docker run`
 * that fails as docker must throw — persisting nothing — rather than classify.
 * No real daemon is involved.
 */
describe('measureServer against a docker that fails as docker', () => {
  let shimDir: string;
  let root: string;
  let logPath: string;
  const oldPath = process.env.PATH;
  const oldLog = process.env.DOCKER_SHIM_LOG;

  beforeAll(() => {
    shimDir = mkdtempSync(join(tmpdir(), 'docker-shim-'));
    root = mkdtempSync(join(tmpdir(), 'docker-fault-root-'));
    logPath = join(shimDir, 'invocations.log');
    writeFileSync(
      join(shimDir, 'docker'),
      `#!/bin/sh
[ -n "$DOCKER_SHIM_LOG" ] && echo "$@" >> "$DOCKER_SHIM_LOG"
case "$1" in
  image) exit 1 ;;
  pull) exit 0 ;;
  run)
    echo "Unable to find image 'mcp-ctx-shim-img' locally" >&2
    echo "docker: Error response from daemon: registry hiccup" >&2
    exit 125 ;;
  rm) exit 0 ;;
  *) exit 2 ;;
esac
`,
    );
    chmodSync(join(shimDir, 'docker'), 0o755);
    process.env.PATH = `${shimDir}:${oldPath}`;
    process.env.DOCKER_SHIM_LOG = logPath;
  });

  afterAll(() => {
    process.env.PATH = oldPath;
    if (oldLog === undefined) delete process.env.DOCKER_SHIM_LOG;
    else process.env.DOCKER_SHIM_LOG = oldLog;
    rmSync(shimDir, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  });

  it('ensures the image first, throws on the 125, and publishes nothing', async () => {
    const err = await measureServer('shim-victim', 'npx -y some-server', {
      docker: true,
      dockerImage: 'mcp-ctx-shim-img',
      timeoutMs: 5_000,
      root,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(DockerHarnessFault);
    expect(String(err.message)).toContain('docker could not run the container for shim-victim');
    // The image was ensured before anything was measured…
    const log = readFileSync(logPath, 'utf8');
    expect(log).toContain('image inspect mcp-ctx-shim-img');
    expect(log).toContain('pull mcp-ctx-shim-img');
    // …and a throw is not a measurement: nothing was written for this server.
    expect(existsSync(join(root, 'results', 'shim-victim', 'measurement.json'))).toBe(false);
    expect(existsSync(join(root, 'badges', 'shim-victim.json'))).toBe(false);
  });

  it('shares one ensured pull across measurements of the same image', async () => {
    await measureServer('shim-victim-2', 'npx -y some-server', {
      docker: true,
      dockerImage: 'mcp-ctx-shim-img',
      timeoutMs: 5_000,
      root,
    }).catch(() => {});
    const pulls = readFileSync(logPath, 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('pull '));
    expect(pulls).toHaveLength(1);
  });

  it('leaves a host-mode server that exits 125 classified as its own startup-failure', async () => {
    const m = await measureServer(
      'host-125',
      `node -e "console.error('docker: not actually docker'); process.exit(125)"`,
      { timeoutMs: 5_000, persist: false },
    );
    expect(m.status).toBe('startup-failure');
    expect(m.notes).toContain('code 125');
  });
});
