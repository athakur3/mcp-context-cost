/** Regenerate leaderboard + dashboard from existing results/: npx tsx src/sweep/regen.ts */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { writeLeaderboard, percentiles, type ServerEntry } from './report.js';
import { appendHistory } from './history.js';

const doc = parse(readFileSync('servers.yaml', 'utf8')) as { servers: ServerEntry[] };
writeLeaderboard(doc.servers);
const h = appendHistory();
console.log('leaderboard:', JSON.stringify(percentiles(doc.servers)));
console.log(`history: ${h.rows} rows (${h.added >= 0 ? '+' : ''}${h.added})`);
