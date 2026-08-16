/** Regenerate leaderboard + history + server pages from results/: npx tsx src/sweep/regen.ts */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { writeLeaderboard, percentiles, type ServerEntry } from './report.js';
import { appendHistory } from './history.js';
import { writeServerPages } from './server-pages.js';

const doc = parse(readFileSync('servers.yaml', 'utf8')) as { servers: ServerEntry[] };
writeLeaderboard(doc.servers);
// History first: the server pages read history.csv for their over-time table.
const h = appendHistory();
const p = writeServerPages(doc.servers);
console.log('leaderboard:', JSON.stringify(percentiles(doc.servers)));
console.log(`history: ${h.rows} rows (${h.added >= 0 ? '+' : ''}${h.added})`);
console.log(`server pages: ${p.pages}`);
