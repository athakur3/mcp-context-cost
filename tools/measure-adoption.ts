/**
 * Look for the badge in the wild, and write down what was found.
 *
 *   MCP_CTX_GITHUB_TOKEN=... npx tsx tools/measure-adoption.ts
 *
 * Writes `results/badge-adoption.json` (the reading) and `docs/adoption.md`
 * (the page). Like `measure-divergence.ts`, this talks to a network API and so
 * lives outside `src/` and outside the published package: the library, the CLI
 * and every generated artifact stay offline. The rules it applies — which
 * queries make up the question, what counts as displaying the badge, when a
 * count may be published at all — are in `src/core/adoption.ts`, offline and
 * under test; this file is the part that fetches.
 *
 * Exits non-zero when the reading could not be established. A search that fell
 * over must not publish a zero, and it must not publish it quietly either. The
 * files are written first and the exit decided after, on purpose: a hand run
 * gets to read what failed, and the scheduled caller —
 * `.github/workflows/adoption.yml`, which is also how a reading is taken
 * without handling a token (`workflow_dispatch`) — stops at the failing step
 * and never reaches its commit. An unresolved reading is never published; the
 * page date does not advance without a count.
 *
 * The token is read from MCP_CTX_GITHUB_TOKEN, falling back to GITHUB_TOKEN so
 * it can run in CI. Code search needs an authenticated request; without one
 * this refuses to run rather than reporting an empty result.
 *
 *   npx tsx tools/measure-adoption.ts --render-only
 *
 * re-renders `docs/adoption.md` from the committed reading and touches nothing
 * else — no network, no token, `checkedAt` as it was. It exists because the
 * page is held to be exactly what the JSON renders (test/measure-adoption.test.ts),
 * so a wording change to `renderAdoptionPage` turns the suite red until the
 * page is rebuilt; before this flag the only way to rebuild it was a full run,
 * which also moves the date, and a date moved for a wording change is a date
 * where the date is not the point.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ADOPTION_METHOD,
  BADGE_SOURCE,
  adoptionQueries,
  classifyFile,
  isThirdParty,
  carryResolved,
  mergeSightings,
  parseAdoption,
  renderAdoptionPage,
  resolveCount,
  type AdoptionRun,
  type FreshSighting,
  type QueryResult,
  type Sighting,
} from '../src/core/adoption.js';

const API = 'https://api.github.com';
/** Authenticated code search allows 10 requests a minute; stay under it. */
const SEARCH_GAP_MS = 7000;
const PER_PAGE = 100;
/** Pages collected per query. Exceeding this marks the query truncated, never silently cut. */
const MAX_PAGES = 3;

const root = process.cwd();
const outPath = join(root, 'results', 'badge-adoption.json');
const pagePath = join(root, 'docs', 'adoption.md');

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== '--render-only');
if (unknown.length) {
  console.error(`unknown argument(s): ${unknown.join(' ')} — the only flag is --render-only`);
  process.exit(2);
}

if (args.includes('--render-only')) {
  // Offline by construction: the committed reading is the input, and the only
  // output is the page. A missing reading renders as "nobody has looked", which
  // is the true page for that state; a reading that is there but will not
  // parse is refused, because rendering it as "nobody has looked" would be a
  // false page written over a real one.
  let run: AdoptionRun | null = null;
  if (existsSync(outPath)) {
    run = parseAdoption(readFileSync(outPath, 'utf8'));
    if (!run) {
      console.error(`${outPath} does not parse as a reading — refusing to render over it.`);
      process.exit(1);
    }
  }
  mkdirSync(dirname(pagePath), { recursive: true });
  writeFileSync(pagePath, renderAdoptionPage(run));
  console.log(`wrote docs/adoption.md from ${run ? `the reading of ${run.checkedAt}` : 'no reading'} (no network, checkedAt untouched)`);
  process.exit(0);
}

const token = process.env.MCP_CTX_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
if (!token) {
  console.error('MCP_CTX_GITHUB_TOKEN (or GITHUB_TOKEN) is not set — refusing to run.');
  console.error('An unauthenticated code search returns nothing, which is not the same as finding nothing.');
  process.exit(1);
}

const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  'user-agent': 'mcp-context-cost-adoption',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SearchItem {
  repository: { full_name: string };
  path: string;
  html_url: string;
}

async function searchPage(q: string, page: number): Promise<{ total: number; items: SearchItem[] }> {
  const url = `${API}/search/code?q=${encodeURIComponent(q)}&per_page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  const body = (await res.json()) as { total_count: number; items: SearchItem[] };
  return { total: body.total_count, items: body.items ?? [] };
}

/** File contents via the API, so the same token and the same view of the repo apply. */
async function fetchFile(repo: string, path: string): Promise<string> {
  const url = `${API}/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { content?: string; encoding?: string };
  if (body.encoding !== 'base64' || typeof body.content !== 'string') throw new Error('no base64 content');
  return Buffer.from(body.content, 'base64').toString('utf8');
}

const checkedAt = new Date().toISOString().slice(0, 10);
const queries: QueryResult[] = [];
const candidates = new Map<string, { repo: string; path: string; url: string; foundBy: string }>();

for (const def of adoptionQueries()) {
  let collected = 0;
  let total = 0;
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { total: t, items } = await searchPage(def.q, page);
      total = t;
      for (const item of items) {
        const repo = item.repository.full_name;
        if (!isThirdParty(repo)) continue;
        const key = `${repo}/${item.path}`;
        if (!candidates.has(key)) candidates.set(key, { repo, path: item.path, url: item.html_url, foundBy: def.name });
      }
      collected += items.length;
      if (collected >= total || items.length === 0) break;
      await sleep(SEARCH_GAP_MS);
    }
    const truncated = collected < total;
    queries.push({ ...def, state: 'ok', hits: total, ...(truncated ? { truncated } : {}) });
    console.log(`${def.name}: ${total} file(s)${truncated ? ` — only ${collected} collected` : ''}`);
  } catch (e) {
    queries.push({ ...def, state: 'failed', hits: null, error: (e as Error).message.slice(0, 200) });
    console.log(`${def.name}: FAILED ${(e as Error).message.slice(0, 200)}`);
  }
  await sleep(SEARCH_GAP_MS);
}

const fresh: FreshSighting[] = [];
let unreadable = 0;
for (const c of candidates.values()) {
  let text: string;
  try {
    text = await fetchFile(c.repo, c.path);
  } catch (e) {
    unreadable++;
    console.log(`${c.repo}/${c.path}: could not read — ${(e as Error).message.slice(0, 120)}`);
    continue;
  }
  const kind = classifyFile(text);
  if (!kind) {
    console.log(`${c.repo}/${c.path}: no longer names the project — index is ahead of the file`);
    continue;
  }
  fresh.push({ repo: c.repo, path: c.path, url: c.url, kind, foundBy: c.foundBy });
  console.log(`${c.repo}/${c.path}: ${kind}`);
}

const previous = existsSync(outPath) ? parseAdoption(readFileSync(outPath, 'utf8')) : null;
const sightings: Sighting[] = mergeSightings(previous?.sightings ?? [], fresh, checkedAt);

const counted = resolveCount(queries, sightings, checkedAt, unreadable);
const run: AdoptionRun = {
  method: ADOPTION_METHOD,
  checkedAt,
  source: BADGE_SOURCE,
  queries,
  candidates: candidates.size,
  sightings,
  ...counted,
  lastResolved: carryResolved(previous, { checkedAt, thirdPartyRepos: counted.thirdPartyRepos }),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(run, null, 2) + '\n');
mkdirSync(dirname(pagePath), { recursive: true });
writeFileSync(pagePath, renderAdoptionPage(run));

console.log(
  run.unresolved
    ? `wrote results/badge-adoption.json — NO COUNT PUBLISHED (${run.unresolved})`
    : `wrote results/badge-adoption.json — ${run.thirdPartyRepos} third-party repo(s) display the badge`,
);
console.log('wrote docs/adoption.md');
process.exit(run.unresolved ? 1 : 0);
