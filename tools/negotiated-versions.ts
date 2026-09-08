/**
 * Which revision does each server actually say it will speak?
 *
 *   npx tsx tools/negotiated-versions.ts [--docker] [--only a,b] [--concurrency 2]
 *                                        [--default-timeout 240] [--json]
 *
 * Every session this harness opens sends `protocolVersion` at `initialize`, and
 * the server answers with the revision it will use. The 2025-06-18 schema
 * requires that answer and says of it: "This may not match the version that the
 * client requested. If the client cannot support this version, it MUST
 * disconnect." Until now nothing compared the two, so a server that answered
 * with something else was measured anyway and published as an ordinary number.
 *
 * Disconnecting instead — which is what the spec asks for — changes what gets
 * published, and nobody knows for how many servers, because the answer has
 * never been recorded. This measures that before the behaviour changes, in the
 * same spirit as `capability-probe.ts`: the evidence first, then the decision.
 *
 * **It writes nothing at all.** Every capture runs with `persist: false`, so no
 * record, badge, history row or page can move, and unlike the capability probe
 * this one does not even write a summary file — the output is the log, and the
 * number in it belongs in the commit message of the change it authorises.
 *
 * Exit 1 when any server named a revision other than the one asked for: that is
 * the run having something to report, not an error. Exit 2 for a caller
 * mistake, 0 when every server agreed.
 */
import { measureServer } from '../src/sweep/run.js';
import { PROTOCOL_VERSION } from '../src/core/protocol.js';
import type { ServerEntry } from '../src/sweep/report.js';
import { loadServersDoc } from '../src/sweep/servers-schema.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const docker = process.argv.includes('--docker');
const asJson = process.argv.includes('--json');
const only = arg('only')?.split(',');
const concurrency = Number(arg('concurrency') ?? 2);
const defaultTimeout = Number(arg('default-timeout') ?? 240);

const doc = loadServersDoc() as { servers: ServerEntry[] };
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
  status: string;
  /** What this harness asked for, read off the record rather than the constant. */
  requested: string | null;
  /** The server's own word. `null` when it never answered, or omitted a required field. */
  negotiated: string | null;
}

/**
 * Every option a real sweep passes. The capability probe learned this the
 * expensive way: a probe that launches servers differently from the sweep
 * reports its own gaps as findings about the servers.
 */
async function probe(entry: ServerEntry): Promise<Row> {
  const e = entry as ServerEntry & {
    timeoutSeconds?: number;
    dockerImage?: string;
    envValues?: Record<string, string>;
    needsGit?: boolean;
    aptPackages?: string[];
    notApplicable?: { reason: string; evidence: string };
  };
  const m = await measureServer(entry.name, entry.command, {
    docker,
    timeoutMs: (e.timeoutSeconds ?? defaultTimeout) * 1000,
    dockerImage: e.dockerImage,
    dummyEnv: entry.env ?? [],
    dummyEnvValues: e.envValues,
    needsGit: e.needsGit,
    aptPackages: e.aptPackages,
    notApplicable: e.notApplicable,
    persist: false, // the whole reason this is safe to run: nothing under results/ moves
  }).catch(() => null);
  return {
    name: entry.name,
    status: m?.status ?? 'probe-failed',
    requested: m?.requestedProtocolVersion ?? null,
    negotiated: m?.negotiatedProtocolVersion ?? null,
  };
}

/** Disagreement is only claimable when the server actually named something. */
const disagrees = (r: Row): boolean =>
  r.negotiated !== null && r.requested !== null && r.negotiated !== r.requested;

const rows: Row[] = [];
const queue = [...entries];

if (!asJson) {
  console.log(
    `asking ${entries.length} server(s) what revision they speak ` +
      `(docker=${docker}, concurrency=${concurrency}); this harness sends ${PROTOCOL_VERSION}; nothing is written`,
  );
}

await Promise.all(
  Array.from({ length: Math.max(1, concurrency) }, async () => {
    for (;;) {
      const entry = queue.shift();
      if (!entry) return;
      const row = await probe(entry);
      rows.push(row);
      if (!asJson) {
        const said = row.negotiated ?? (row.status === 'measured' ? 'named none' : '—');
        console.log(
          `  ${row.name}: ${said}${disagrees(row) ? '  <-- differs from what we asked' : ''} (${row.status})`,
        );
      }
    }
  }),
);

const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
const differing = sorted.filter(disagrees);
// A server that answered `initialize` and named no revision omitted a field the
// schema requires. Not a disagreement, and not nothing either.
const silent = sorted.filter(
  (r) => r.negotiated === null && (r.status === 'measured' || r.status === 'dynamic'),
);
const agreed = sorted.filter((r) => r.negotiated !== null && !disagrees(r));

if (asJson) {
  console.log(
    JSON.stringify(
      {
        asked: PROTOCOL_VERSION,
        selected: entries.length,
        probed: sorted.length,
        agreed: agreed.length,
        differing,
        silent,
        rows: sorted,
      },
      null,
      2,
    ),
  );
} else {
  console.log(
    `\n${agreed.length} of ${sorted.length} probed named ${PROTOCOL_VERSION}; ` +
      `${differing.length} named something else; ${silent.length} answered and named nothing; ` +
      `${sorted.length - agreed.length - differing.length - silent.length} never got that far.`,
  );
  for (const r of differing)
    console.log(`  differs: ${r.name} asked ${r.requested}, answered ${r.negotiated}`);
  for (const r of silent) console.log(`  named none: ${r.name} (${r.status})`);
}

process.exit(differing.length > 0 ? 1 : 0);
