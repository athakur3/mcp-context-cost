/**
 * Instructions capture — the half of the session-start load that `tools/list`
 * does not carry:
 *   npx tsx src/sweep/session-start.ts [--docker] [--only a,b] [--concurrency 3]
 *
 * Writes results/session-start.json. Deliberately writes nothing else: the
 * measurements on disk keep their numbers, their hashes and their dates, and a
 * capture taken today never gets filed under a sweep taken on another day.
 *
 * This is a backfill, and it is meant to shrink. Every sweep from now on records
 * `serverInstructions` inside the measurement itself, which takes precedence
 * over anything here (see core/session-start.ts), so a server drops out of
 * needing this file the first time it is re-measured.
 *
 * A server is launched the same way a sweep launches it, through `measureServer`
 * — same isolation, same dummy env, same retries. That costs a full tools/list
 * to obtain a string from `initialize`, which is the price of the row being
 * comparable to the published measurement rather than merely adjacent to it:
 * the fresh capture's `canonicalSha256` is what the row is filed under, so a
 * server whose tools have drifted since publication is marked stale instead of
 * having today's instructions attached to yesterday's tools.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { measureServer } from './run.js';
import { DockerHarnessFault } from './docker.js';
import type { ServerEntry } from './report.js';
import {
  SESSION_START_METHOD,
  parseSessionStart,
  toSessionStartRow,
  type SessionStartRow,
  type SessionStartRun,
} from '../core/session-start.js';

export function loadSessionStart(root = process.cwd()): SessionStartRun | null {
  const p = join(root, 'results', 'session-start.json');
  return existsSync(p) ? parseSessionStart(readFileSync(p, 'utf8')) : null;
}

export function writeSessionStart(run: SessionStartRun, root = process.cwd()): void {
  // Key order sorted so a re-run of the same servers produces no diff noise.
  const servers: Record<string, SessionStartRow> = {};
  for (const name of Object.keys(run.servers).sort()) servers[name] = run.servers[name];
  writeFileSync(
    join(root, 'results', 'session-start.json'),
    JSON.stringify({ ...run, servers }, null, 2) + '\n',
  );
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

  const entries = doc.servers.filter((s) => {
    if (only && !only.includes(s.name)) return false;
    return !s.remote; // a remote server never reaches initialize without credentials
  });

  console.log(`capturing instructions for ${entries.length} servers (docker=${docker}, concurrency=${concurrency})`);

  // Merged, not replaced: a run over `--only` must not delete the rows it did
  // not visit. A row it did visit is overwritten, errors included.
  const prior = loadSessionStart();
  const servers: Record<string, SessionStartRow> = { ...(prior?.servers ?? {}) };

  const queue = [...entries];
  async function worker() {
    for (let e = queue.shift(); e; e = queue.shift()) {
      let m;
      try {
        m = await measureServer(e.name, e.command, {
          timeoutMs: (e.timeoutSeconds ?? defaultTimeout) * 1000,
          docker,
          dockerImage: e.dockerImage,
          dummyEnv: e.env ?? [],
          dummyEnvValues: e.envValues,
          needsGit: e.needsGit,
          persist: false, // the measurements on disk are not this run's to rewrite
        });
      } catch (err) {
        // One thrown error used to reject Promise.all and end the process
        // before anything was written, discarding every capture the run had
        // already completed — and skipping the `finally` that force-removes
        // containers, orphaning the in-flight ones. A machine fault on one
        // server is recorded against that server; the rest of the run stands.
        if (!(err instanceof DockerHarnessFault)) throw err;
        servers[e.name] = {
          instructions: '',
          instructionsTokens: 0,
          instructionsSha256: '',
          capturedSha256: null,
          error: `docker harness fault: ${err.message.slice(0, 200)}`,
        };
        console.log(`  ${e.name}: docker harness fault — recorded, run continues`);
        continue;
      }
      if (m.status !== 'measured' && m.status !== 'dynamic') {
        servers[e.name] = {
          instructions: '',
          instructionsTokens: 0,
          instructionsSha256: '',
          capturedSha256: null,
          error: `${m.status}: ${(m.notes ?? '').slice(0, 200)}`,
        };
        console.log(`  ${e.name}: ${m.status}`);
        continue;
      }
      const row = toSessionStartRow(m.serverInstructions ?? null, {
        capturedSha256: m.canonicalSha256,
        serverVersion: m.serverVersion,
      });
      servers[e.name] = row;
      console.log(`  ${e.name}: ${row.instructionsTokens} instruction tokens`);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

  writeSessionStart({
    method: SESSION_START_METHOD,
    measuredAt: new Date().toISOString().slice(0, 10),
    isolation: docker ? 'docker (same images and limits as a sweep)' : 'host process (no container)',
    servers,
  });
  const ok = Object.values(servers).filter((r) => !r.error).length;
  console.log(`done: ${ok}/${Object.keys(servers).length} rows carry instructions; results/session-start.json written`);
}
