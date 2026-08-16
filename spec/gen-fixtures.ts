/**
 * Regenerates the golden fixture expectations. Run deliberately (never in CI):
 *   npx tsx spec/gen-fixtures.ts
 * A diff in expected-*.json is a methodology change and must bump
 * METHODOLOGY_VERSION.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureTools, canonicalString } from '../src/core/canonical.js';
import { toBadge } from '../src/core/badge.js';
import { readmeSnippet } from '../src/core/snippet.js';

const here = dirname(fileURLToPath(import.meta.url));
const tools = JSON.parse(readFileSync(join(here, 'fixtures/tools-basic.json'), 'utf8'));

const m = measureTools(tools, {
  serverName: 'fixture-basic',
  serverVersion: '1.0.0',
  launchCommand: 'npx -y fixture-basic',
  measuredAt: '2026-08-16T00:00:00.000Z',
});
const badge = toBadge(m);
const snippet = readmeSnippet(
  'https://raw.githubusercontent.com/OWNER/mcp-context-cost/main/badges/fixture-basic.json',
  'https://OWNER.github.io/mcp-context-cost/methodology#m1',
);

writeFileSync(
  join(here, 'fixtures/expected-basic.json'),
  JSON.stringify(
    { canonicalLength: canonicalString(tools).length, measurement: m, badge, snippet },
    null,
    2,
  ) + '\n',
);
console.log('total:', m.totalTokens, 'sha:', m.canonicalSha256, 'badge:', badge.message, badge.color);
