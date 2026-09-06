/**
 * Does a server's tool list depend on what the client says it can do?
 *
 *   npx tsx tools/capability-probe.ts [--docker] [--only a,b] [--concurrency 2]
 *                                     [--default-timeout 240] [--out <path>]
 *
 * Every published number in this repository was captured by a client that
 * declares `capabilities: {}` at `initialize` — it can do nothing, and says so.
 * That is not a neutral posture. The protocol lets a server shape its tool list
 * around what the client declares, and at least one server does: measured
 * 2026-09-06, the reference `everything` server exposed 13 tools to a client
 * declaring nothing and 15 to Claude Code, the extra two being `get-roots-list`
 * and `trigger-elicitation-request` — one per capability.
 *
 * So for any server that gates tools this way, the published number is a floor,
 * and nothing in the methodology says so. What nobody knows is how many servers
 * that is. Two, and it is a footnote. Thirty, and the leaderboard measures a
 * client nobody runs.
 *
 * This answers that and only that. It measures each server twice under
 * identical conditions, differing in one thing — the posture declared at
 * `initialize` — and reports the difference. It is deliberately not a fix:
 * changing what the sweep declares would move published numbers and hashes,
 * which is a methodology decision that wants this evidence first.
 *
 * **It writes nothing under `results/`.** Both captures run with
 * `persist: false`, so no published record, badge or history row can move. The
 * only output is the summary file, wherever `--out` points.
 *
 * The posture it compares against is `DECLARING_POSTURE`, which declares the two
 * capabilities this harness can answer *truthfully* — an empty root list and a
 * declined elicitation are ordinary states a real client can be in. `sampling`
 * is not declared, because this client cannot ask a model for a completion and
 * there is no honest minimal answer to pretend otherwise. A probe that lies to
 * the server it is measuring would produce exactly the kind of number this
 * project exists to refuse.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { measureServer } from '../src/sweep/run.js';
import { DECLARING_POSTURE, MINIMAL_POSTURE, type ClientPosture } from '../src/sweep/client.js';
import type { ServerEntry } from '../src/sweep/report.js';
import type { Measurement } from '../src/core/types.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const docker = process.argv.includes('--docker');
const only = arg('only')?.split(',');
const concurrency = Number(arg('concurrency') ?? 2);
const defaultTimeout = Number(arg('default-timeout') ?? 240);
const outPath = arg('out') ?? 'capability-probe.json';

const doc = parse(readFileSync('servers.yaml', 'utf8')) as { servers: ServerEntry[] };
const entries = doc.servers.filter((e) => {
  if ((e as { remote?: boolean }).remote) return false; // a remote is not launched here
  if (only) return only.includes(e.name);
  return true;
});

if (entries.length === 0) {
  console.error('no entries selected');
  process.exit(2);
}

interface Row {
  name: string;
  /** Status of each capture, so a server that simply failed is not read as "no difference". */
  minimalStatus: string;
  declaringStatus: string;
  minimalTools: number | null;
  declaringTools: number | null;
  minimalTokens: number | null;
  declaringTokens: number | null;
  /** Tool names the declaring client saw and the minimal one did not. */
  gained: string[];
  /** Names only the minimal client saw — not expected, and worth seeing if it happens. */
  lost: string[];
}

const names = (m: Measurement | null): Set<string> =>
  new Set(((m?.tools ?? []) as { name?: string }[]).map((t) => String(t.name ?? '')));

async function probe(entry: ServerEntry): Promise<Row> {
  const run = async (posture: ClientPosture) =>
    measureServer(entry.name, entry.command, {
      docker,
      timeoutMs: ((entry as { timeoutSeconds?: number }).timeoutSeconds ?? defaultTimeout) * 1000,
      dummyEnv: entry.env ?? [],
      persist: false, // the whole reason this is safe to run: nothing under results/ moves
      posture,
    }).catch(() => null);

  // Same order every time, and the minimal capture first, so a server that
  // warms a cache on its first launch warms it for the published posture rather
  // than for the experimental one.
  const a = await run(MINIMAL_POSTURE);
  const b = await run(DECLARING_POSTURE);
  const an = names(a);
  const bn = names(b);
  return {
    name: entry.name,
    minimalStatus: a?.status ?? 'error',
    declaringStatus: b?.status ?? 'error',
    minimalTools: a?.toolCount ?? null,
    declaringTools: b?.toolCount ?? null,
    minimalTokens: a?.totalTokens ?? null,
    declaringTokens: b?.totalTokens ?? null,
    gained: [...bn].filter((n) => !an.has(n)).sort(),
    lost: [...an].filter((n) => !bn.has(n)).sort(),
  };
}

const rows: Row[] = [];
const queue = [...entries];

/**
 * The summary, rewritten after every row rather than once at the end.
 *
 * This job measures every entry twice, so it is the longest-running thing in
 * the repository and the likeliest to meet the runner's cap. A file written
 * only on the last line means a run that times out at 99 servers reports
 * nothing, and the artifact step's `if: always()` would upload an absent file.
 * Partial coverage answers "how many servers gate their tools" perfectly well
 * as long as it says how far it got, which `selected` against `probed` does.
 */
function writeSummary(): void {
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const cmp = sorted.filter(
    (r) => ['measured', 'dynamic'].includes(r.minimalStatus) && ['measured', 'dynamic'].includes(r.declaringStatus),
  );
  const mv = cmp.filter((r) => r.gained.length > 0 || r.lost.length > 0);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        method: 'capability-probe/v1',
        declared: DECLARING_POSTURE.capabilities,
        docker,
        selected: entries.length,
        probed: sorted.length,
        comparable: cmp.length,
        moved: mv.length,
        movedNames: mv.map((r) => r.name),
        extraTokens: mv.reduce((n, r) => n + ((r.declaringTokens ?? 0) - (r.minimalTokens ?? 0)), 0),
        rows: sorted,
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(
  `probing ${entries.length} server(s), each twice (docker=${docker}, concurrency=${concurrency}); nothing under results/ is written`,
);

await Promise.all(
  Array.from({ length: Math.max(1, concurrency) }, async () => {
    for (;;) {
      const entry = queue.shift();
      if (!entry) return;
      const row = await probe(entry);
      rows.push(row);
      writeSummary(); // so a run that meets the cap still reports what it reached
      const moved = row.gained.length > 0 || row.lost.length > 0;
      const verdict = moved
        ? `MOVED +${row.gained.length}/-${row.lost.length}: ${[...row.gained, ...row.lost.map((n) => `-${n}`)].join(', ')}`
        : row.minimalStatus === 'measured' || row.minimalStatus === 'dynamic'
          ? 'same'
          : `not comparable (${row.minimalStatus}/${row.declaringStatus})`;
      console.log(
        `  ${row.name}: ${row.minimalTools ?? '—'} -> ${row.declaringTools ?? '—'} tools, ` +
          `${row.minimalTokens ?? '—'} -> ${row.declaringTokens ?? '—'} tokens — ${verdict}`,
      );
    }
  }),
);

writeSummary();
const summary = JSON.parse(readFileSync(outPath, 'utf8')) as {
  probed: number;
  comparable: number;
  moved: number;
  movedNames: string[];
  extraTokens: number;
};

console.log(
  `\n${summary.moved} of ${summary.comparable} comparable server(s) change their tool list when the client ` +
    `declares ${Object.keys(DECLARING_POSTURE.capabilities).join(' and ')}` +
    (summary.moved > 0 ? `: ${summary.movedNames.join(', ')}` : ''),
);
if (summary.moved > 0) {
  console.log(`those servers publish ${summary.extraTokens} fewer tokens than a declaring client would load.`);
}
console.log(`${summary.probed - summary.comparable} not comparable (a capture failed on one side or both).`);
console.log(`written: ${outPath}`);
