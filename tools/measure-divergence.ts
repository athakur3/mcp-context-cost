/**
 * Measure the Claude divergence column and write results/divergence.json.
 *
 *   MCP_CTX_ANTHROPIC_KEY=... npx tsx tools/measure-divergence.ts [count]
 *
 * This is the one part of the pipeline that talks to a network API, so it lives
 * outside src/ (and outside the published package): the library, the CLI, and
 * every generated artifact stay offline and dependency-free. Re-running it
 * updates only the servers it measured; rows for other servers are preserved.
 *
 * The key is read from MCP_CTX_ANTHROPIC_KEY, deliberately not ANTHROPIC_API_KEY:
 * that name is picked up by other Anthropic tooling in the same shell.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { parse } from 'yaml';
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
const topN = Number(process.argv[2] ?? 15);

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
candidates.sort((a, b) => (b.m.totalTokens as number) - (a.m.totalTokens as number));
const selected = candidates.slice(0, Math.max(0, topN));

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
const servers: Record<string, DivergenceRow> = { ...(previous?.servers ?? {}) };

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
