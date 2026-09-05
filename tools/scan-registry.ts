/**
 * Scan the official MCP registry for npm/PyPI stdio servers this set does not
 * yet track, rank them by weekly downloads, and draft entries for a person to
 * judge.
 *
 *   npm run scan-registry -- --out <path>                # the whole registry
 *   npm run scan-registry -- --out <path> --max-pages 2  # a smoke run, marked truncated
 *   npm run scan-registry -- --out <path> --cursor <name:version>  # resume; also marked truncated
 *
 * Every rule this applies lives in `src/sweep/registry-scan.ts`, offline and
 * under test; this file is the part that fetches, so it lives outside `src/`
 * and outside the published package like `measure-adoption.ts` and
 * `measure-divergence.ts`. Read that module's docblock for what the scan is
 * and is not: it emits the two owner strings a provenance judgment compares
 * and makes no judgment; it emits drafts, not entries.
 *
 * The output is NOT a measurement and goes nowhere a measurement goes. `--out`
 * is required and is refused under results/, badges/ or docs/: nothing under
 * those directories may come from a developer machine, and a scan file
 * committed there would sit beside records that only CI writes. Put it
 * outside the tree. What the expansion commit cites is the summary line this
 * prints on stdout — every number in it is in the JSON beside it — and the
 * JSON is the working file the operator reads drafts from.
 *
 * Progress goes to stderr so stdout carries only the line to quote.
 *
 * On the network: pages are retried with backoff and a failed page after
 * retries aborts the run with nothing written — a partial crawl that is not
 * marked truncated would be published as a count. A 429 is waited out, not
 * read as zero: pypistats answered 429 to the fixture request on 2026-09-05
 * and 200 to the same request, same headers, a minute later
 * (test/fixtures/registry/sources.json), so the rate limit is about pacing,
 * and the User-Agent sent here is courtesy, not what avoids it. Lookups are
 * paced with a fixed gap for the same reason. An unknown package reads as
 * "no figure" (npm bulk maps it to null; npm single and pypistats answer 404
 * — test/fixtures/registry/npm-single-missing.json and pypi-404.html), which
 * the ranking keeps out of the drafted set rather than ranking as 0.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { formatProblems, loadServersDoc, validateServers } from '../src/sweep/servers-schema.js';
import {
  REGISTRY_PAGE_LIMIT,
  REGISTRY_URL,
  assembleScan,
  candidatesFrom,
  metricKey,
  parseNpmBulk,
  parseNpmSingle,
  parsePypi,
  pypiName,
  rankCandidates,
  splitForNpm,
  summaryLine,
  trackedPackages,
  walkLatest,
  type RegistryPage,
} from '../src/sweep/registry-scan.js';

const NPM_API = 'https://api.npmjs.org/downloads/point/last-week';
const PYPISTATS_API = 'https://pypistats.org/api/packages';
/** Gap between consecutive lookups against one host. */
const NPM_GAP_MS = 250;
const PYPI_GAP_MS = 1500;
/** Waited on a 429 that carries no Retry-After. */
const RATE_LIMIT_WAIT_MS = 60_000;
/** Backoff after a failed request, per attempt; the length is the attempt budget. */
const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000, 60_000];
const REQUEST_TIMEOUT_MS = 60_000;
/** The published directories: nothing here may come from a developer machine. */
const PUBLISHED_DIRS = ['results', 'badges', 'docs'];

const root = process.cwd();
const headers = { accept: 'application/json', 'user-agent': 'mcp-context-cost-scan' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (line: string) => console.error(line);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const outArg = arg('out');
if (!outArg || outArg.startsWith('--')) {
  console.error('--out <path> is required — the scan writes one JSON file, and the operator names where.');
  console.error('Never under results/, badges/ or docs/: a scan is not a measurement. Put it outside the tree.');
  process.exit(2);
}
const out = resolve(root, outArg);
for (const dir of PUBLISHED_DIRS) {
  const rel = relative(join(root, dir), out);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    console.error(`refusing to write under ${dir}/ — nothing there comes from a developer machine`);
    process.exit(2);
  }
}

const maxPagesArg = arg('max-pages');
const maxPages = maxPagesArg === undefined ? undefined : Number(maxPagesArg);
if (maxPages !== undefined && (!Number.isInteger(maxPages) || maxPages <= 0)) {
  console.error(`--max-pages expects a positive whole number, got '${maxPagesArg}'`);
  process.exit(2);
}
const limitArg = arg('limit');
const limit = limitArg === undefined ? REGISTRY_PAGE_LIMIT : Number(limitArg);
if (!Number.isInteger(limit) || limit <= 0 || limit > REGISTRY_PAGE_LIMIT) {
  console.error(`--limit expects a whole number from 1 to ${REGISTRY_PAGE_LIMIT} (the registry's cap), got '${limitArg}'`);
  process.exit(2);
}
const startCursor = arg('cursor');

const doc = loadServersDoc(root);
const problems = validateServers(doc);
if (problems.length) {
  console.error('servers.yaml does not validate; refusing to scan against a set whose packages cannot be read:');
  console.error(formatProblems(problems));
  process.exit(1);
}
const tracked = trackedPackages(doc);

interface Response {
  status: number;
  text: string;
}

/**
 * One request with retry. A network failure or a 5xx backs off and tries
 * again; a 429 waits for Retry-After or the fixed wait. A 4xx other than 429
 * is returned as-is for the caller to read (404 means "no figure").
 */
async function request(url: string): Promise<Response> {
  let lastError = '';
  for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      const text = await res.text();
      if (res.status === 429) {
        const after = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(after) && after > 0 ? after * 1000 : RATE_LIMIT_WAIT_MS;
        log(`  429 from ${new URL(url).host}; waiting ${Math.round(wait / 1000)}s`);
        await sleep(wait);
        lastError = 'HTTP 429';
        continue;
      }
      if (res.status >= 500) {
        lastError = `HTTP ${res.status} ${text.slice(0, 120)}`;
      } else {
        return { status: res.status, text };
      }
    } catch (e) {
      lastError = (e as Error).message;
    }
    const wait = BACKOFF_MS[attempt]!;
    log(`  ${lastError} — retrying ${url} in ${wait / 1000}s`);
    await sleep(wait);
  }
  throw new Error(`${url}: gave up after ${BACKOFF_MS.length} attempts (${lastError})`);
}

/**
 * A lookup that gives up is a fact about that lookup, not about the run. The
 * first real scan crawled for seven minutes, then died on one package's 429
 * after six attempts and wrote nothing, because the file is written last.
 * Now a failed lookup comes back as a reason the candidate is refused with,
 * and the run reaches its write.
 */
async function tryRequest(url: string): Promise<Response | { failed: string }> {
  try {
    return await request(url);
  } catch (e) {
    return { failed: (e as Error).message };
  }
}

async function fetchPage(cursor?: string): Promise<RegistryPage> {
  const url = new URL(REGISTRY_URL);
  url.searchParams.set('version', 'latest');
  url.searchParams.set('limit', String(limit));
  if (cursor) url.searchParams.set('cursor', cursor);
  const res = await request(url.toString());
  if (res.status !== 200) throw new Error(`${url}: HTTP ${res.status} ${res.text.slice(0, 120)}`);
  const page = JSON.parse(res.text) as RegistryPage;
  log(`page ${page.servers?.length ?? 0} row(s)${page.metadata?.nextCursor ? ` → ${page.metadata.nextCursor}` : ' (last)'}`);
  return page;
}

const startedAtMs = Date.now();
const scannedAt = new Date().toISOString();

const walk = await walkLatest(fetchPage, { ...(maxPages !== undefined ? { maxPages } : {}), ...(startCursor ? { cursor: startCursor } : {}) });
log(`${walk.pages} page(s), ${walk.records.length} record(s)${walk.truncated ? ' — TRUNCATED' : ''}`);

const candidates = candidatesFrom(walk.records, tracked);
const metrics = new Map<string, number | null>();
/** Why a figure is missing, per metric key, where this run knows. */
const reasons = new Map<string, string>();
const unmetered = (registry: 'npm' | 'pypi', pkg: string, why: string) => {
  metrics.set(metricKey(registry, pkg), null);
  reasons.set(metricKey(registry, pkg), why);
};

const { bulk, single } = splitForNpm(candidates.filter((c) => c.registry === 'npm').map((c) => c.pkg));
const pypi = candidates.filter((c) => c.registry === 'pypi').map((c) => c.pkg);
log(`${candidates.length} candidate(s): ${bulk.length} npm bulk chunk(s), ${single.length} npm single(s), ${pypi.length} pypi lookup(s)`);

for (const chunk of bulk) {
  const res = await tryRequest(`${NPM_API}/${chunk.join(',')}`);
  if ('failed' in res || res.status !== 200) {
    const why = 'failed' in res ? res.failed : `HTTP ${res.status} ${res.text.slice(0, 120)}`;
    log(`  npm bulk lookup for ${chunk.length} name(s) failed: ${why}`);
    for (const name of chunk) unmetered('npm', name, `api.npmjs.org bulk lookup failed: ${why}`);
  } else {
    for (const [name, n] of parseNpmBulk(JSON.parse(res.text))) metrics.set(metricKey('npm', name), n);
  }
  await sleep(NPM_GAP_MS);
}
for (const name of single) {
  const res = await tryRequest(`${NPM_API}/${name}`);
  if ('failed' in res) unmetered('npm', name, `api.npmjs.org lookup failed: ${res.failed}`);
  else metrics.set(metricKey('npm', name), res.status === 200 ? parseNpmSingle(JSON.parse(res.text)) : null);
  await sleep(NPM_GAP_MS);
}
// pypistats answers a sustained 429 to a whole run once it has decided to: the
// first scan saw six attempts over six minutes on one package all refused. When
// that happens the host has stopped talking to us, and asking a few hundred more
// times is not measuring anything — the rest of the pass is marked unmetered with
// that reason, and the run still writes.
let pypiBlocked: string | null = null;
for (const [i, name] of pypi.entries()) {
  if (pypiBlocked) {
    unmetered('pypi', name, pypiBlocked);
    continue;
  }
  const res = await tryRequest(`${PYPISTATS_API}/${encodeURIComponent(pypiName(name))}/recent`);
  if ('failed' in res) {
    if (/HTTP 429/.test(res.failed)) {
      pypiBlocked = `pypistats.org rate-limited this run (${res.failed.replace(/^https?:\S+: /, '')})`;
      log(`  ${pypiBlocked}; the remaining ${pypi.length - i} pypi candidate(s) are unmetered`);
    }
    unmetered('pypi', name, pypiBlocked ?? `pypistats.org lookup failed: ${res.failed}`);
    continue;
  }
  let figure: number | null = null;
  if (res.status === 200) {
    try {
      figure = parsePypi(JSON.parse(res.text));
    } catch {
      figure = null;
    }
  }
  metrics.set(metricKey('pypi', name), figure);
  if ((i + 1) % 100 === 0) log(`  pypi ${i + 1}/${pypi.length}`);
  await sleep(PYPI_GAP_MS);
}

const ranked = rankCandidates(candidates, metrics, reasons);
const scan = assembleScan(walk, ranked, {
  scannedAt,
  elapsedSeconds: Math.round((Date.now() - startedAtMs) / 1000),
  ...(reasons.size > 0
    ? { unmetered: { count: reasons.size, why: pypiBlocked ?? 'one or more download lookups failed; each refusal names its reason' } }
    : {}),
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(scan, null, 2) + '\n');
log(`wrote ${out}`);
console.log(summaryLine(scan));
