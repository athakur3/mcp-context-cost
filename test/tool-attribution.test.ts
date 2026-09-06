import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { measureTool, measureTools } from '../src/core/canonical.js';
import type { Measurement } from '../src/core/types.js';

/**
 * `outputSchemaTokens` and `annotationsTokens` name two things that used to sit
 * inside a tool's `tokens` with nothing pointing at them. Output schemas are
 * about a sixth of every published token across the set, so on the servers that
 * ship one the breakdown could show a tool was expensive and not what made it so.
 *
 * The second block is the one that matters most. Every one of these numbers is
 * derived from bytes that are in the same file, so the file can be checked
 * against itself — and it must be, because they were written by a backfill
 * rather than by the sweep that took the capture. A stored number that its own
 * capture does not reproduce is worse than a missing one.
 */
describe('per-tool attribution', () => {
  it('counts the output schema and annotations separately from the tool total', () => {
    const t = measureTool({
      name: 'search',
      description: 'Search the index.',
      inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { hits: { type: 'array', items: { type: 'string' } } } },
      annotations: { readOnlyHint: true },
    });
    expect(t.outputSchemaTokens).toBeGreaterThan(0);
    expect(t.annotationsTokens).toBeGreaterThan(0);
    // Diagnostic, not a decomposition: the whole-object count includes framing
    // the parts do not, so the parts only have to fit inside it.
    expect(t.descriptionTokens + t.inputSchemaTokens + t.outputSchemaTokens + t.annotationsTokens).toBeLessThan(t.tokens);
  });

  it('records zero — not absent — for a tool that ships neither', () => {
    const t = measureTool({ name: 'ping', description: 'Ping.', inputSchema: { type: 'object' } });
    expect(t.outputSchemaTokens).toBe(0);
    expect(t.annotationsTokens).toBe(0);
  });

  it('leaves the published total and hash untouched', () => {
    const tools = [
      { name: 'a', description: 'A.', inputSchema: { type: 'object' }, outputSchema: { type: 'string' } },
      { name: 'b', description: 'B.', inputSchema: { type: 'object' } },
    ];
    const m = measureTools(tools, { serverName: 'demo' });
    // Both are counted over the canonical array, which the attribution does not
    // touch — this is why the backfill could run over published records at all.
    expect(m.totalTokens).toBe(measureTools(tools, { serverName: 'demo' }).totalTokens);
    expect(m.tools[0].outputSchemaTokens).toBeGreaterThan(0);
    expect(m.tools[1].outputSchemaTokens).toBe(0);
  });

  it('every published record reproduces its own per-tool breakdown from its own capture', () => {
    const resultsDir = join(process.cwd(), 'results');
    const dirs = readdirSync(resultsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    const checked: string[] = [];
    const problems: string[] = [];
    for (const name of dirs) {
      let m: Measurement;
      try {
        m = JSON.parse(readFileSync(join(resultsDir, name, 'measurement.json'), 'utf8')) as Measurement;
      } catch {
        continue;
      }
      if (!m.rawToolsCapture || m.tools.length === 0) continue;
      checked.push(name);
      if (m.rawToolsCapture.length !== m.tools.length) {
        problems.push(`${name}: ${m.tools.length} rows against a ${m.rawToolsCapture.length}-tool capture`);
        continue;
      }
      m.rawToolsCapture.forEach((raw, i) => {
        const d = measureTool(raw);
        const t = m.tools[i];
        if (
          t.name !== d.name ||
          t.tokens !== d.tokens ||
          t.descriptionTokens !== d.descriptionTokens ||
          t.inputSchemaTokens !== d.inputSchemaTokens ||
          t.outputSchemaTokens !== d.outputSchemaTokens ||
          t.annotationsTokens !== d.annotationsTokens
        ) {
          problems.push(`${name}/${t.name}: stored ${JSON.stringify(t)} against derived ${JSON.stringify(d)}`);
        }
      });
    }
    expect(problems).toEqual([]);
    // A guard that silently checked nothing would pass the same way.
    expect(checked.length).toBeGreaterThan(80);
  });
});
