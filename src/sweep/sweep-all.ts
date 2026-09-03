/**
 * Batch sweep over servers.yaml:
 *   npx tsx src/sweep/sweep-all.ts [--docker] [--only name1,name2] [--concurrency 3]
 *                                  [--shards N [--shard-index K]]
 * Writes results/<name>/measurement.json + badges/<name>.json per server, then
 * regenerates the leaderboard.
 *
 * `--shards N` measures only this week's rotating slice (see shard.ts), so a
 * scheduled job can keep every server's history growing without sweeping all of
 * servers.yaml in one runner. `--shard-index K` pins the slice instead of
 * deriving it from the date — for reproducing a given week, not for scheduled
 * use.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { measureServer } from './run.js';
import { DockerHarnessFault } from './docker.js';
import { writeLeaderboard, type ServerEntry } from './report.js';
import { appendHistory } from './history.js';
import { appendToolVectors, writeRegressions } from './regressions.js';
import { FAULT_RATIO, MIN_REGRESSIONS, snapshot, verdict, restore } from './harness-guard.js';
import { selectShard, shardIndexForDate } from './shard.js';
import type { MeasurementStatus } from '../core/types.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const doc = parse(readFileSync('servers.yaml', 'utf8')) as { servers: ServerEntry[] };
const only = arg('only')?.split(',');
const docker = process.argv.includes('--docker');
const concurrency = Number(arg('concurrency') ?? 3);
const defaultTimeout = Number(arg('default-timeout') ?? 60);

const shards = arg('shards') === undefined ? undefined : Number(arg('shards'));
const shardIndexArg = arg('shard-index') === undefined ? undefined : Number(arg('shard-index'));

if (shards !== undefined && only) {
  // Both narrow the set, but the sharded one is meant to be a *complete*
  // partition of servers.yaml. Silently intersecting them would produce a slice
  // that belongs to no cycle and still looks like a normal week's sweep in the log.
  console.error('--shards and --only both select servers; pass one or the other');
  process.exit(2);
}
if (shardIndexArg !== undefined && shards === undefined) {
  console.error('--shard-index needs --shards');
  process.exit(2);
}

const sweepable = doc.servers.filter((s) => {
  if (only && !only.includes(s.name)) return false;
  if (s.remote) return false; // remote servers handled separately (mcp-remote bridge)
  return true;
});

let entries = sweepable;
let shardLabel = '';
if (shards !== undefined) {
  const index = shardIndexArg ?? shardIndexForDate(new Date(), shards);
  entries = selectShard(sweepable, shards, index);
  shardLabel = `, shard ${index + 1}/${shards}`;
  console.log(
    `shard ${index + 1}/${shards} of ${sweepable.length} sweepable: ${entries.map((e) => e.name).join(', ')}`,
  );
}

console.log(
  `sweeping ${entries.length} servers (docker=${docker}, concurrency=${concurrency}${shardLabel})`,
);

// Taken before anything is measured: measureServer persists each result the
// moment it has one, so this is the only chance to hold on to what was
// published in case this sweep turns out to be measuring through a broken
// harness (see harness-guard.ts).
const prior = snapshot(entries.map((e) => e.name));

const queue = [...entries];
const summary: Record<string, string> = {};
const statuses = new Map<string, MeasurementStatus>();
// Servers docker itself failed to run — never a measurement (measureServer
// throws before persisting), so each one's previous record simply stands.
const dockerFaults = new Map<string, string>();

async function worker() {
  for (let e = queue.shift(); e; e = queue.shift()) {
    const started = Date.now();
    let m;
    try {
      m = await measureServer(e.name, e.command, {
        timeoutMs: (e.timeoutSeconds ?? defaultTimeout) * 1000,
        docker,
        dockerImage: e.dockerImage,
        dummyEnv: e.env ?? [],
        dummyEnvValues: e.envValues,
        needsGit: e.needsGit,
      });
    } catch (err) {
      if (!(err instanceof DockerHarnessFault)) throw err;
      dockerFaults.set(e.name, err.message);
      summary[e.name] = 'docker harness fault — not measured; previous record untouched';
      console.log(`  ${e.name}: ${summary[e.name]}`);
      continue;
    }
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    statuses.set(e.name, m.status);
    summary[e.name] =
      m.status === 'measured' || m.status === 'dynamic'
        ? `${m.totalTokens} tokens / ${m.toolCount} tools (${m.status}, ${secs}s)`
        : `${m.status} (${secs}s)`;
    console.log(`  ${e.name}: ${summary[e.name]}`);
  }
}

await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

// A docker fault on most of the slice is the harness-fault story with an
// earlier symptom — the guard below can't see it (nothing regressed on disk;
// the throws happened before anything was written), so it is judged here by
// the guard's own thresholds. Below them, the sweep publishes what it did
// measure and the faulted servers wait for the next cycle.
if (dockerFaults.size >= MIN_REGRESSIONS && dockerFaults.size / entries.length >= FAULT_RATIO) {
  console.error(
    `\nHARNESS FAULT — docker could not run for ${dockerFaults.size} of ${entries.length} servers; ` +
      `refusing to publish this sweep.\n` +
      [...dockerFaults].map(([n, msg]) => `  ${n}: ${msg}`).join('\n') +
      `\n  Nothing was overwritten — every previous record stands. ` +
      `Check the Docker daemon and registry path, then re-run.`,
  );
  process.exit(1);
}

// Before publishing anything: is this sweep a statement about the servers, or
// about the machine that measured them?
const v = verdict(prior, statuses);
console.log(`harness check: ${v.reason}`);
if (v.fault) {
  const restored = restore(prior, v.regressed);
  console.error(
    `\nHARNESS FAULT — refusing to publish this sweep.\n` +
      `  regressed: ${v.regressed.join(', ')}\n` +
      `  restored ${restored.length} previous measurement(s) and badge(s); ` +
      `leaderboard and history.csv are untouched.\n` +
      `  Check the measurement environment (Docker daemon, network, disk) and re-run.`,
  );
  process.exit(1);
}

// Serial, after every worker has finished: history.csv is a read-modify-write.
// Always the full set: the leaderboard is regenerated from what is on disk, so
// a shard sweep republishes every server's most recent measurement rather than
// dropping the servers this week did not touch.
// History and tool vectors before the leaderboard: its movement note is derived
// from the same series, so folding after it would describe the previous sweep.
const h = appendHistory();
appendToolVectors();
const regressions = writeRegressions(doc.servers);
writeLeaderboard(doc.servers, process.cwd(), regressions.summary);
const measured = Object.values(summary).filter((s) => s.includes('tokens')).length;
if (dockerFaults.size > 0) {
  console.warn(
    `\nDOCKER FAULT on ${[...dockerFaults.keys()].join(', ')} — not measured this sweep; ` +
      `previous records untouched. The next cycle re-attempts ${dockerFaults.size === 1 ? 'it' : 'them'}.`,
  );
}
console.log(`done: ${measured}/${entries.length} measured; leaderboard + history (${h.rows} rows) regenerated`);
