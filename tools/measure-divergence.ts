/**
 * Measure the Claude divergence column and write results/divergence.json.
 *
 *   MCP_CTX_ANTHROPIC_KEY=... npx tsx tools/measure-divergence.ts
 *   ... tools/measure-divergence.ts --only slack,redis          # touch up two
 *   ... tools/measure-divergence.ts --shards 6 [--shard-index 2] # this week's slice
 *   ... tools/measure-divergence.ts 20                           # top 20 by tokens
 *
 * This is the one part of the pipeline that talks to a network API, so it lives
 * outside src/ (and outside the published package): the library, the CLI, and
 * every generated artifact stay offline and dependency-free.
 *
 * Run bare it writes THE run — every measured server, whole. Any selection
 * makes it a touch-up: it measures that subset and preserves every other row,
 * the same merge rule the cross-check runner uses, so a weekly slice fills its
 * own rows in without deleting the rest of the column.
 *
 * The selection flags are the sweep's, spelled the same way and refusing the
 * same combination, because the re-sweep workflow hands all three runners one
 * `SELECT` string: if they disagreed about what it selects, a cross-check row
 * and a Claude row could end up describing different captures.
 *
 * The key is read from MCP_CTX_ANTHROPIC_KEY, deliberately not ANTHROPIC_API_KEY:
 * that name is picked up by other Anthropic tooling in the same shell.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { parse } from 'yaml';
import { selectShard, shardIndexForDate } from '../src/sweep/shard.js';
import type { Measurement } from '../src/core/types.js';
import {
  DIVERGENCE_METHOD,
  mappedTokens,
  parseDivergence,
  toAnthropicTools,
  type DivergenceRow,
  type DivergenceRun,
} from '../src/core/divergence.js';

/** Pinned: Anthropic's tokenizer differs across model families, so a bare
 *  "Claude tokens" number without a model id is not reproducible. */
const MODEL = 'claude-opus-5';

/** The smallest legal request, so the baseline is almost entirely framing. */
const PROBE_MESSAGES = [{ role: 'user' as const, content: '.' }];
const PROBE_TOOL = {
  name: 'probe',
  description: 'x',
  input_schema: { type: 'object' as const, properties: {} },
};

const root = process.cwd();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Bare, this writes the whole run: every measured server, exactly — never a
 * preserved row the refresh no longer covers.
 *
 * It used to be the top 20, and the column was refreshed only by the Monday
 * self-badge job. Re-sweeps land on Wednesdays, so a re-measured row's Claude
 * cell went blank for five days each cycle: on 2026-09-05 the front page's own
 * "what it costs on Claude" table showed `—` for `github`, the heaviest server
 * in the set. Running it beside the sweep fixes the timing; covering every
 * measured server is what makes the rank a row happens to hold stop deciding
 * whether it has a Claude number at all.
 *
 * The earlier bug in the other direction is worth keeping in view: the bare
 * default was once 15 against a published run of 20, so ranks 16–20 were
 * carried forward and never refreshed — `blender`, rank 19, sat blank behind
 * its 2026-08-26 capture while the 15 rows above it refreshed twice. A bare
 * run replacing the whole file is what prevents that; a *selection* merges.
 */
const only = arg('only')?.split(',');
const shards = arg('shards') === undefined ? undefined : Number(arg('shards'));
const shardIndexArg = arg('shard-index') === undefined ? undefined : Number(arg('shard-index'));
/** Legacy positional: measure this many from the top, preserving the rest. */
const topNArg = process.argv[2] !== undefined && !process.argv[2].startsWith('--') ? Number(process.argv[2]) : undefined;

if (shards !== undefined && only) {
  // Same refusal as sweep-all and the cross-check runner, same reason: a slice
  // that belongs to no cycle must not be producible by accident.
  console.error('--shards and --only both select servers; pass one or the other');
  process.exit(2);
}
if (shardIndexArg !== undefined && shards === undefined) {
  console.error('--shard-index needs --shards');
  process.exit(2);
}
if (topNArg !== undefined && (Number.isNaN(topNArg) || topNArg <= 0)) {
  console.error(`expected a positive count, got '${process.argv[2]}'`);
  process.exit(2);
}
/** Any selection preserves the rows it did not measure; a bare run replaces them. */
const touchUp = only !== undefined || shards !== undefined || topNArg !== undefined;

const apiKey = process.env.MCP_CTX_ANTHROPIC_KEY;
if (!apiKey) {
  console.error('MCP_CTX_ANTHROPIC_KEY is not set — refusing to run.');
  process.exit(1);
}
const client = new Anthropic({ apiKey });

interface Candidate {
  name: string;
  m: Measurement;
}

const doc = parse(readFileSync(join(root, 'servers.yaml'), 'utf8')) as { servers: { name: string }[] };
const candidates: Candidate[] = [];
for (const entry of doc.servers) {
  const p = join(root, 'results', entry.name, 'measurement.json');
  if (!existsSync(p)) continue;
  let m: Measurement;
  try {
    m = JSON.parse(readFileSync(p, 'utf8')) as Measurement;
  } catch {
    continue;
  }
  if (m.status !== 'measured' && m.status !== 'dynamic') continue;
  if (typeof m.totalTokens !== 'number' || !Array.isArray(m.rawToolsCapture)) continue;
  candidates.push({ name: entry.name, m });
}
// Ranked by tokens whatever the selection, so the log reads heaviest-first and
// the legacy positional count still means "from the top".
candidates.sort((a, b) => (b.m.totalTokens as number) - (a.m.totalTokens as number));
let selected = candidates;
if (only) selected = selected.filter((c) => only.includes(c.name));
if (shards !== undefined) {
  // Sharded over the same list the sweep shards — servers.yaml order, not this
  // one — so the slice measured here is the slice measured there.
  const index = shardIndexArg ?? shardIndexForDate(new Date(), shards);
  const slice = new Set(
    selectShard(
      doc.servers.filter((e) => !(e as { remote?: boolean }).remote).map((e) => e.name),
      shards,
      index,
    ),
  );
  selected = selected.filter((c) => slice.has(c.name));
  console.log(`shard ${index + 1}/${shards}: ${selected.map((c) => c.name).join(', ') || '(none measured)'}`);
}
if (topNArg !== undefined) selected = selected.slice(0, topNArg);
if (selected.length === 0) {
  // Nothing to measure is not nothing to say: silently writing back the previous
  // run would look like a refresh that happened.
  console.log('no measured server matched the selection — divergence.json left as it is');
  process.exit(0);
}

const count = async (tools?: unknown[]): Promise<number> => {
  const r = await client.messages.countTokens({
    model: MODEL,
    messages: PROBE_MESSAGES,
    ...(tools ? { tools: tools as never } : {}),
  });
  return r.input_tokens;
};

const baselineTokens = await count();
const probeDelta = (await count([PROBE_TOOL])) - baselineTokens;
console.log(`baseline ${baselineTokens} tokens; probe delta ${probeDelta} (upper bound on fixed tool overhead)`);

const outPath = join(root, 'results', 'divergence.json');
const previous = existsSync(outPath) ? parseDivergence(readFileSync(outPath, 'utf8')) : null;
// A touch-up edits the previous run in place; a bare run replaces it whole.
const servers: Record<string, DivergenceRow> = touchUp ? { ...(previous?.servers ?? {}) } : {};

for (const { name, m } of selected) {
  const raw = m.rawToolsCapture as unknown[];
  const row: DivergenceRow = {
    o200kFull: m.totalTokens as number,
    o200kMapped: mappedTokens(raw),
    claudeDelta: 0,
    toolCount: m.toolCount ?? raw.length,
    capturedSha256: m.canonicalSha256 ?? '',
  };
  try {
    row.claudeDelta = (await count(toAnthropicTools(raw))) - baselineTokens;
    const dropped = ((1 - row.o200kMapped / row.o200kFull) * 100).toFixed(1);
    console.log(
      `${name}: o200k ${row.o200kFull} → mapped ${row.o200kMapped} (${dropped}% MCP-only) → claude ${row.claudeDelta}`,
    );
  } catch (e) {
    // One rejected schema must not lose the rest of the run.
    row.error = (e as Error).message.slice(0, 200);
    console.log(`${name}: ERROR ${row.error}`);
  }
  servers[name] = row;
}

const run: DivergenceRun = {
  method: DIVERGENCE_METHOD,
  model: MODEL,
  measuredAt: new Date().toISOString().slice(0, 10),
  baselineTokens,
  probeDelta,
  servers: Object.fromEntries(Object.entries(servers).sort(([a], [b]) => a.localeCompare(b))),
};
writeFileSync(outPath, JSON.stringify(run, null, 2) + '\n');
console.log(`wrote results/divergence.json (${Object.keys(run.servers).length} servers)`);
