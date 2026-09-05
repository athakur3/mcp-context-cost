/**
 * Derive the tool-shape baseline from what is on disk and publish it beside
 * the other generated artifacts. Re-derivable by anyone from the same
 * measurement files; regenerated on every regen, so it moves with the data it
 * describes and never sits stale beside a fresh sweep.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { METHODOLOGY_VERSION } from '../core/canonical.js';
import { buildToolShapeBaseline, type ToolShapeBaseline } from '../core/tool-shape.js';
import { loadRows, type ServerEntry } from './report.js';
import type { ToolMeasurement } from '../core/types.js';

export function writeToolShapeBaseline(entries: ServerEntry[], root = process.cwd()): ToolShapeBaseline {
  const tools: ToolMeasurement[] = [];
  const dates: string[] = [];
  let serverCount = 0;
  for (const r of loadRows(entries, root)) {
    if (!r.m || (r.m.status !== 'measured' && r.m.status !== 'dynamic')) continue;
    if (r.m.tools.length === 0) continue;
    serverCount++;
    tools.push(...r.m.tools);
    const day = String(r.m.measuredAt ?? '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) dates.push(day);
  }
  // Dated by the newest measurement it summarises rather than by the clock, so
  // the file says how far its data reaches and a re-derivation over unchanged
  // measurements produces no diff. `buildToolShapeBaseline` still defaults to
  // today when nobody supplies one, for callers with no measurement dates.
  const generatedAt = dates.sort().pop();
  const baseline = buildToolShapeBaseline(tools, {
    serverCount,
    methodologyVersion: METHODOLOGY_VERSION,
    ...(generatedAt ? { generatedAt } : {}),
  });
  writeFileSync(join(root, 'results', 'tool-shape.json'), JSON.stringify(baseline, null, 2) + '\n');
  return baseline;
}
