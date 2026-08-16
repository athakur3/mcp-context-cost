/**
 * Batch sweep over servers.yaml:
 *   npx tsx src/sweep/sweep-all.ts [--docker] [--only name1,name2] [--concurrency 3]
 * Writes results/<name>/measurement.json + badges/<name>.json per server, then
 * regenerates the leaderboard.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { measureServer } from './run.js';
import { writeLeaderboard, type ServerEntry } from './report.js';
import { appendHistory } from './history.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const doc = parse(readFileSync('servers.yaml', 'utf8')) as { servers: ServerEntry[] };
const only = arg('only')?.split(',');
const docker = process.argv.includes('--docker');
const concurrency = Number(arg('concurrency') ?? 3);
const defaultTimeout = Number(arg('default-timeout') ?? 60);

const entries = doc.servers.filter((s) => {
  if (only && !only.includes(s.name)) return false;
  if (s.remote) return false; // remote servers handled separately (mcp-remote bridge)
  return true;
});

console.log(`sweeping ${entries.length} servers (docker=${docker}, concurrency=${concurrency})`);

const queue = [...entries];
const summary: Record<string, string> = {};

async function worker() {
  for (let e = queue.shift(); e; e = queue.shift()) {
    const started = Date.now();
    const m = await measureServer(e.name, e.command, {
      timeoutMs: (e.timeoutSeconds ?? defaultTimeout) * 1000,
      docker,
      dockerImage: e.dockerImage,
      dummyEnv: e.env ?? [],
    });
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    summary[e.name] =
      m.status === 'measured' || m.status === 'dynamic'
        ? `${m.totalTokens} tokens / ${m.toolCount} tools (${m.status}, ${secs}s)`
        : `${m.status} (${secs}s)`;
    console.log(`  ${e.name}: ${summary[e.name]}`);
  }
}

await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

// Serial, after every worker has finished: history.csv is a read-modify-write.
writeLeaderboard(doc.servers);
const h = appendHistory();
const measured = Object.values(summary).filter((s) => s.includes('tokens')).length;
console.log(`done: ${measured}/${entries.length} measured; leaderboard + history (${h.rows} rows) regenerated`);
