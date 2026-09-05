/**
 * CLI cross-check runner — measure each server twice in one sitting, once with
 * our client and once with `sd2k/mcp-tokens`, and file the pair under the
 * capture our side took:
 *   npx tsx src/sweep/cross-check.ts [--docker] [--only a,b] [--concurrency 3]
 *                                    [--shards N [--shard-index K]]
 *                                    [--default-timeout 60]
 *
 * Writes results/cross-check.json and nothing else — the measurements on disk
 * keep their numbers, hashes and dates (the session-start discipline). Our
 * measurement is taken fresh through `measureServer` — same isolation, same
 * dummy env, same retries as a sweep — because the row is only worth publishing
 * while it compares like with like: the fresh capture's `canonicalSha256` is
 * what the row is filed under, and the CLI's tool names are checked against the
 * capture's, so a server that changed between the two launches records data but
 * prints silence.
 *
 * The CLI is a pinned release binary, fetched once into a host cache and
 * verified against the release's own SHA-256 before it is ever executed; in
 * docker mode it is bind-mounted read-only into the same image, limits and
 * package-cache volumes a sweep uses, so the server it launches runs under the
 * exact isolation every published measurement ran under.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { measureServer } from './run.js';
import { DockerHarnessFault, defaultImageFor, dockerize } from './docker.js';
import { splitCommand } from './client.js';
import { selectShard, shardIndexForDate } from './shard.js';
import type { ServerEntry } from './report.js';
import {
  CROSS_CHECK_CLI,
  CROSS_CHECK_CLI_ARGS,
  CROSS_CHECK_CLI_VERSION,
  CROSS_CHECK_METHOD,
  divergencePct,
  parseCliReport,
  parseCrossCheck,
  toCrossCheckRow,
  type CrossCheckRow,
  type CrossCheckRun,
} from '../core/cross-check.js';

export function loadCrossCheck(root = process.cwd()): CrossCheckRun | null {
  const p = join(root, 'results', 'cross-check.json');
  return existsSync(p) ? parseCrossCheck(readFileSync(p, 'utf8')) : null;
}

export function writeCrossCheck(run: CrossCheckRun, root = process.cwd()): void {
  // Key order sorted so a re-run of the same servers produces no diff noise.
  const servers: Record<string, CrossCheckRow> = {};
  for (const name of Object.keys(run.servers).sort()) servers[name] = run.servers[name];
  writeFileSync(join(root, 'results', 'cross-check.json'), JSON.stringify({ ...run, servers }, null, 2) + '\n');
}

/** Release-asset triple for where the CLI will actually run. */
export function cliTriple(docker: boolean, platform = process.platform, arch = process.arch): string {
  if (docker) {
    // The container is Linux whatever the host is; its architecture is the host's.
    return arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu';
  }
  const cpu = arch === 'arm64' ? 'aarch64' : 'x86_64';
  if (platform === 'darwin') return `${cpu}-apple-darwin`;
  if (platform === 'linux') return `${cpu}-unknown-linux-gnu`;
  throw new Error(`no ${CROSS_CHECK_CLI} release asset for ${platform}/${arch} — run with --docker`);
}

function sh(command: string, args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => (stderr = (stderr + chunk).slice(-4000)));
    child.on('error', (err) => resolvePromise({ code: null, stderr: String(err.message) }));
    child.on('exit', (code) => resolvePromise({ code, stderr }));
  });
}

/**
 * Fetch the pinned CLI release for `triple` into a host cache, verifying the
 * archive against the release's own `.sha256` before anything is extracted or
 * executed. `MCP_TOKENS_BIN` overrides the whole dance — that is how the tests
 * substitute a shim, and how an airgapped machine supplies its own copy.
 */
export async function ensureCliBinary(triple: string): Promise<string> {
  const override = process.env.MCP_TOKENS_BIN;
  if (override) return override;

  const cacheDir = join(homedir(), '.cache', 'mcp-context-cost', 'mcp-tokens', `${CROSS_CHECK_CLI_VERSION}-${triple}`);
  const binPath = join(cacheDir, 'mcp-tokens');
  if (existsSync(binPath)) return binPath;

  const asset = `mcp-tokens-${triple}.tar.xz`;
  const base = `https://github.com/${CROSS_CHECK_CLI}/releases/download/${CROSS_CHECK_CLI_VERSION}`;
  const fetchBytes = async (url: string): Promise<Buffer> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };

  const archive = await fetchBytes(`${base}/${asset}`);
  const sumFile = (await fetchBytes(`${base}/${asset}.sha256`)).toString('utf8');
  const expected = sumFile.trim().split(/\s+/)[0]?.toLowerCase();
  const actual = createHash('sha256').update(archive).digest('hex');
  if (!expected || expected !== actual) {
    throw new Error(`${asset}: SHA-256 mismatch — expected ${expected ?? '(unparseable)'}, got ${actual}; refusing to run it`);
  }

  const work = join(tmpdir(), `mcp-tokens-${process.pid}-${Math.floor(Math.random() * 1e6)}`);
  mkdirSync(work, { recursive: true });
  try {
    const archivePath = join(work, asset);
    writeFileSync(archivePath, archive);
    const tar = await sh('tar', ['-xJf', archivePath, '-C', work]);
    if (tar.code !== 0) throw new Error(`tar failed extracting ${asset}: ${tar.stderr.slice(-200)}`);
    const found = findFile(work, 'mcp-tokens');
    if (!found) throw new Error(`${asset} did not contain an mcp-tokens binary`);
    mkdirSync(cacheDir, { recursive: true });
    chmodSync(found, 0o755);
    renameSync(found, binPath);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return binPath;
}

function findFile(dir: string, name: string): string | null {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findFile(p, name);
      if (hit) return hit;
    } else if (entry.name === name) {
      return p;
    }
  }
  return null;
}

interface CliOutcome {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Run the CLI against one server, host or containerized. In docker mode the
 * binary is bind-mounted read-only and the CLI launches the server inside the
 * container — same image, limits, dummy env and shared package caches as the
 * measurement that just ran, so the npx install it pays is already warm.
 */
export function runCli(
  binPath: string,
  entry: ServerEntry,
  opts: { docker: boolean; timeoutMs: number; graceMs?: number },
): Promise<CliOutcome> {
  // The CLI's own deadline gets the entry's budget — its default is 30s, which
  // published as a failure for a server (postgres-mcp) that legitimately takes
  // longer to start and measures fine on the same budget our client gets. Its
  // --timeout is in seconds, for server startup.
  const cliArgs = [...CROSS_CHECK_CLI_ARGS, '--timeout', String(Math.ceil(opts.timeoutMs / 1000))];
  let command = binPath;
  let argv: string[] = [...cliArgs, '--', ...splitCommand(entry.command)];
  let containerName: string | null = null;
  if (opts.docker) {
    containerName = `mcp-ctx-xchk-${entry.name}-${process.pid}-${Math.floor(Math.random() * 1e6)}`;
    // The slim images carry no OpenSSL shared library and the CLI's linux-gnu
    // build links libssl.so.3 — installed inside the container before launch,
    // the same shape as dockerize's needsGit: it prefixes the containerized
    // invocation only and is never part of any recorded command.
    const sslPrefix =
      'ldconfig -p 2>/dev/null | grep -q libssl.so.3 || ' +
      '(apt-get update -qq && apt-get install -y -qq --no-install-recommends libssl3 >/dev/null 2>&1); ';
    const d = dockerize(`${sslPrefix}/opt/mcp-tokens ${cliArgs.join(' ')} -- ${entry.command}`, {
      // Explicit, from the SERVER's command: dockerize's image sniffing reads
      // the front of the command line, which here is the ssl prefix and the
      // CLI, not the `uvx …` it is about to launch — left implicit, every
      // Python server's CLI run would land in the node image, uvx-less.
      image: entry.dockerImage ?? defaultImageFor(entry.command),
      dummyEnv: entry.env ?? [],
      dummyEnvValues: entry.envValues,
      needsGit: entry.needsGit,
      aptPackages: entry.aptPackages,
      containerName,
      binds: [`${binPath}:/opt/mcp-tokens:ro`],
    });
    command = d.command;
    argv = d.argv;
  }
  return new Promise((resolvePromise) => {
    const child = spawn(command, argv, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => (stderr = (stderr + chunk).slice(-4000)));
    // Grace beyond the CLI's own deadline: startup is what its timeout covers,
    // and the counting that follows deserves to finish rather than be killed
    // at the exact same instant.
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
      if (containerName) spawn('docker', ['rm', '-f', containerName], { stdio: 'ignore' }).on('error', () => {});
    }, opts.timeoutMs + (opts.graceMs ?? 30_000));
    child.on('error', (err) => {
      clearTimeout(timer);
      resolvePromise({ code: null, stdout, stderr: String(err.message), timedOut });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolvePromise({ code, stdout, stderr, timedOut });
    });
  });
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Exact path match, for the reason src/sweep/run.ts states: any other file whose
// name merely ends the same way would otherwise run this block.
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const doc = parse(readFileSync('servers.yaml', 'utf8')) as { servers: ServerEntry[] };
  const only = arg('only')?.split(',');
  const docker = process.argv.includes('--docker');
  const concurrency = Number(arg('concurrency') ?? 3);
  const defaultTimeout = Number(arg('default-timeout') ?? 60);
  const shards = arg('shards') === undefined ? undefined : Number(arg('shards'));
  const shardIndexArg = arg('shard-index') === undefined ? undefined : Number(arg('shard-index'));

  if (shards !== undefined && only) {
    // Same refusal as sweep-all, same reason: a slice that belongs to no cycle
    // must not be producible by accident.
    console.error('--shards and --only both select servers; pass one or the other');
    process.exit(2);
  }
  if (shardIndexArg !== undefined && shards === undefined) {
    console.error('--shard-index needs --shards');
    process.exit(2);
  }

  let entries = doc.servers.filter((s) => {
    if (only && !only.includes(s.name)) return false;
    return !s.remote; // a remote server never reaches tools/list without credentials
  });
  if (shards !== undefined) {
    const index = shardIndexArg ?? shardIndexForDate(new Date(), shards);
    entries = selectShard(entries, shards, index);
    console.log(`shard ${index + 1}/${shards}: ${entries.map((e) => e.name).join(', ')}`);
  }

  // A row can only ever print by matching the hash of a published measurement,
  // so a server with no good number on record has no comparison to make — the
  // launches would be spent on a row that cannot become printable until a
  // sweep publishes a capture for it. Skipped after shard selection, so the
  // slice stays the sweep's slice.
  const skipped: string[] = [];
  entries = entries.filter((e) => {
    const p = join(process.cwd(), 'results', e.name, 'measurement.json');
    if (!existsSync(p)) {
      skipped.push(e.name);
      return false;
    }
    try {
      const status = (JSON.parse(readFileSync(p, 'utf8')) as { status?: string }).status;
      if (status === 'measured' || status === 'dynamic') return true;
    } catch {
      // An unreadable record is not a good number on record.
    }
    skipped.push(e.name);
    return false;
  });
  if (skipped.length > 0) {
    console.log(`skipping ${skipped.length} with no published number to compare against: ${skipped.join(', ')}`);
  }

  const triple = cliTriple(docker);
  const binPath = await ensureCliBinary(triple);
  // A command that is already its own `docker run` cannot have the CLI
  // containerized around it — that would be docker from inside docker — so for
  // those entries the CLI runs host-side and the server still runs in its own
  // container, the same shape measureServer records for these commands.
  let hostBinPromise: Promise<string> | null = null;
  const hostBin = () => (hostBinPromise ??= ensureCliBinary(cliTriple(false)));
  console.log(
    `cross-checking ${entries.length} servers against ${CROSS_CHECK_CLI} ${CROSS_CHECK_CLI_VERSION} ` +
      `(${triple}, docker=${docker}, concurrency=${concurrency})`,
  );

  // Merged, not replaced: a run over `--only` or one shard must not delete the
  // rows it did not visit. A row it did visit is overwritten, errors included.
  const prior = loadCrossCheck();
  const servers: Record<string, CrossCheckRow> = { ...(prior?.servers ?? {}) };

  const queue = [...entries];
  async function worker() {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const timeoutMs = (e.timeoutSeconds ?? defaultTimeout) * 1000;
      let m;
      try {
        m = await measureServer(e.name, e.command, {
          timeoutMs,
          docker,
          dockerImage: e.dockerImage,
          dummyEnv: e.env ?? [],
          dummyEnvValues: e.envValues,
          needsGit: e.needsGit,
          aptPackages: e.aptPackages,
          notApplicable: e.notApplicable,
          persist: false, // the measurements on disk are not this run's to rewrite
        });
      } catch (err) {
        if (!(err instanceof DockerHarnessFault)) throw err;
        // A machine fault is not a fact about the server: leave its prior row alone.
        console.log(`  ${e.name}: docker harness fault — skipped, prior row untouched`);
        continue;
      }
      if (m.status !== 'measured' && m.status !== 'dynamic') {
        servers[e.name] = toCrossCheckRow(m, {});
        console.log(`  ${e.name}: our measurement ${m.status} — recorded, nothing to compare`);
        continue;
      }
      const selfDocker = e.command.trimStart().startsWith('docker ');
      const out = await runCli(docker && selfDocker ? await hostBin() : binPath, e, {
        docker: docker && !selfDocker,
        timeoutMs,
      });
      const cli = out.timedOut
        ? { problem: `timeout after ${timeoutMs}ms` }
        : out.code !== 0
          ? { problem: `exited ${out.code}: ${out.stderr.slice(-200)}` }
          : parseCliReport(out.stdout);
      const row = toCrossCheckRow(m, cli);
      servers[e.name] = row;
      const pct = divergencePct(row);
      console.log(
        `  ${e.name}: ours ${row.ourTokens} (mapped ${row.ourMappedTokens}), cli ${row.cliTokens}` +
          (row.error
            ? ` — ${row.error}`
            : !row.toolSetMatches
              ? ` — tool sets differ (${row.ourToolCount} vs ${row.cliToolCount} tools), not comparable`
              : row.dynamic
                ? ` (${pct !== null && pct >= 0 ? '+' : ''}${pct?.toFixed(1)}% vs mapped) — dynamic listing, recorded but never printed`
                : ` (${pct !== null && pct >= 0 ? '+' : ''}${pct?.toFixed(1)}% vs mapped)`),
      );
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

  writeCrossCheck({
    method: CROSS_CHECK_METHOD,
    cli: CROSS_CHECK_CLI,
    cliVersion: CROSS_CHECK_CLI_VERSION,
    cliArgs: [...CROSS_CHECK_CLI_ARGS],
    measuredAt: new Date().toISOString().slice(0, 10),
    isolation:
      (docker ? 'docker (same images, limits and package caches as a sweep)' : 'host process (no container)') +
      (process.env.MCP_TOKENS_BIN ? '; binary supplied via MCP_TOKENS_BIN' : ''),
    servers,
  });
  const rows = Object.values(servers);
  const clean = rows.filter((r) => !r.error && r.toolSetMatches && !r.dynamic);
  console.log(
    `done: ${clean.length}/${rows.length} rows comparable; results/cross-check.json written`,
  );
}
