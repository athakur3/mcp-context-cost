/** Regenerate leaderboard + history + server pages + dashboard from results/: npx tsx src/sweep/regen.ts */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { writeLeaderboard, percentiles, type ServerEntry } from './report.js';
import { appendHistory } from './history.js';
import { writeServerPages } from './server-pages.js';
import { writeDashboard } from './dashboard.js';
import { applyPublishedStats } from './published-stats.js';
import { writeToolShapeBaseline } from './tool-shape.js';
import { appendToolVectors, writeCaptureIndex, writeRegressions } from './regressions.js';

const doc = parse(readFileSync('servers.yaml', 'utf8')) as { servers: ServerEntry[] };
// History and tool vectors first: the server pages read history.csv for their
// over-time table, and the leaderboard's movement note is derived from the same
// series — generating it before the fold would describe the previous sweep.
const h = appendHistory();
const tv = appendToolVectors();
const ci = writeCaptureIndex(doc.servers);
const regressions = writeRegressions(doc.servers);
writeLeaderboard(doc.servers, process.cwd(), regressions.summary);
const p = writeServerPages(doc.servers);
// The dashboard reads the same results/ and history.csv as the pages do, so it
// belongs in the same refresh — see writeDashboard's note on why it wasn't.
const d = writeDashboard();
// The tool-shape baseline is a quantile table over every measured tool — the
// distribution `audit --suggest` reads percentile claims from. Derived from
// the same measurement files as the leaderboard, in the same refresh.
const ts = writeToolShapeBaseline(doc.servers);
// The front pages state numbers the sweep just changed; they are patched from
// the same results/ the leaderboard was. A missing anchor is a page regen can
// no longer maintain — refuse loudly rather than leave one number stale.
const stats = applyPublishedStats(doc.servers);
if (stats.problems.length > 0) {
  for (const p of stats.problems) console.error(`published stats: ${p}`);
  process.exit(1);
}
console.log('leaderboard:', JSON.stringify(percentiles(doc.servers)));
console.log(`history: ${h.rows} rows (${h.added >= 0 ? '+' : ''}${h.added})`);
console.log(`server pages: ${p.pages}`);
console.log(`dashboard: ${d.out} (${(d.bytes / 1024).toFixed(0)}KB)`);
console.log(`tool shape: ${ts.toolCount} tools across ${ts.serverCount} servers (median description ${ts.quantiles.descriptionTokens[50]})`);
console.log(
  `regressions: ${regressions.summary.changes.length} movement(s), ${regressions.summary.grew} heavier / ` +
    `${regressions.summary.shrank} cheaper, net ${regressions.summary.netTokens >= 0 ? '+' : ''}` +
    `${regressions.summary.netTokens} tokens; tool vectors ${tv.appended} appended across ${tv.servers} servers; ` +
    `capture index ${Object.keys(ci.captures).length} captures`,
);
console.log(
  `published stats: ${
    stats.changedFiles.length > 0
      ? `updated ${stats.updated.join(', ')} in ${stats.changedFiles.join(', ')}`
      : 'pages already agree with the data'
  }`,
);
