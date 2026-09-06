/**
 * Fill in the per-tool fields a record was written before, from the capture in
 * that same record.
 *
 *   npx tsx tools/backfill-tool-attribution.ts [--check]
 *
 * `outputSchemaTokens` and `annotationsTokens` name two things that were always
 * inside a tool's `tokens` and never had a field of their own. Output schemas
 * are about a sixth of every published token across the measured set, so on the
 * servers that ship one a reader could see that a tool was expensive without
 * being able to see what made it so.
 *
 * **This measures nothing.** It launches no server and reaches no network: it
 * re-tokenizes `rawToolsCapture`, which is already in the file and already
 * published, with the same encoder that produced every other number there. The
 * arithmetic is deterministic, so anyone can re-run this and get the same
 * result — which is the whole reason it is safe to run anywhere, unlike a
 * sweep. Nothing it writes can move `totalTokens` or `canonicalSha256`: both
 * are counted over the canonical array, and this adds no bytes to it.
 *
 * It refuses rather than repairs. A record whose stored `descriptionTokens` (or
 * name, or total) disagrees with its own capture is not a record missing two
 * fields — it is a record that no longer describes what it holds, and quietly
 * rewriting it would erase the evidence of that. Those are reported and skipped.
 *
 * Idempotent, so a second run reports zero changes. Kept rather than deleted
 * after its one use: the next derived per-tool field will want exactly this.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { measureTool } from '../src/core/canonical.js';
import type { Measurement, ToolMeasurement } from '../src/core/types.js';

const check = process.argv.includes('--check');
const resultsDir = join(process.cwd(), 'results');

let scanned = 0;
let changed = 0;
let already = 0;
let skipped = 0;
const problems: string[] = [];

for (const name of readdirSync(resultsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()) {
  const file = join(resultsDir, name, 'measurement.json');
  let m: Measurement;
  try {
    m = JSON.parse(readFileSync(file, 'utf8')) as Measurement;
  } catch {
    continue; // a directory without a measurement is not this script's business
  }
  scanned++;
  const capture = m.rawToolsCapture;
  if (!capture || m.tools.length === 0) continue; // a failed status has nothing to attribute

  if (capture.length !== m.tools.length) {
    problems.push(`${name}: ${m.tools.length} tool rows against a ${capture.length}-tool capture`);
    skipped++;
    continue;
  }

  const derived = capture.map(measureTool);
  // The fields that were already there have to agree before the new ones are
  // trusted: they came from the same function over the same bytes, so a
  // disagreement means the file and its capture have drifted apart.
  const drift = m.tools
    .map((t, i) => ({ t, d: derived[i] }))
    .filter(
      ({ t, d }) =>
        t.name !== d.name ||
        t.tokens !== d.tokens ||
        t.descriptionTokens !== d.descriptionTokens ||
        t.inputSchemaTokens !== d.inputSchemaTokens,
    );
  if (drift.length > 0) {
    problems.push(
      `${name}: ${drift.length} tool(s) disagree with the capture in the same file — ` +
        `first is ${drift[0].t.name} (stored ${drift[0].t.tokens} tokens, capture gives ${drift[0].d.tokens})`,
    );
    skipped++;
    continue;
  }

  const missing = m.tools.some((t) => t.outputSchemaTokens === undefined || t.annotationsTokens === undefined);
  if (!missing) {
    already++;
    continue;
  }

  const tools: ToolMeasurement[] = m.tools.map((t, i) => ({
    ...t,
    outputSchemaTokens: derived[i].outputSchemaTokens,
    annotationsTokens: derived[i].annotationsTokens,
  }));
  changed++;
  const out = tools.reduce((n, t) => n + (t.outputSchemaTokens ?? 0), 0);
  const ann = tools.reduce((n, t) => n + (t.annotationsTokens ?? 0), 0);
  console.log(`  ${name}: ${tools.length} tools — outputSchema ${out}, annotations ${ann}`);
  if (!check) writeFileSync(file, JSON.stringify({ ...m, tools }, null, 2) + '\n');
}

console.log(
  `\n${scanned} record(s) scanned: ${changed} ${check ? 'would be filled in' : 'filled in'}, ` +
    `${already} already had both fields, ${skipped} skipped.`,
);
for (const p of problems) console.error(`PROBLEM ${p}`);
if (problems.length > 0) process.exit(1);
