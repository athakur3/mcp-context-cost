/** Regenerate leaderboard + history + server pages + dashboard from results/: npx tsx src/sweep/regen.ts */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { writeLeaderboard, percentiles, type ServerEntry } from './report.js';
import { appendHistory } from './history.js';
import { writeServerPages } from './server-pages.js';
import { writeDashboard } from './dashboard.js';

const doc = parse(readFileSync('servers.yaml', 'utf8')) as { servers: ServerEntry[] };
writeLeaderboard(doc.servers);
// History first: the server pages read history.csv for their over-time table.
const h = appendHistory();
const p = writeServerPages(doc.servers);
// The dashboard reads the same results/ and history.csv as the pages do, so it
// belongs in the same refresh — see writeDashboard's note on why it wasn't.
const d = writeDashboard();
console.log('leaderboard:', JSON.stringify(percentiles(doc.servers)));
console.log(`history: ${h.rows} rows (${h.added >= 0 ? '+' : ''}${h.added})`);
console.log(`server pages: ${p.pages}`);
console.log(`dashboard: ${d.out} (${(d.bytes / 1024).toFixed(0)}KB)`);
