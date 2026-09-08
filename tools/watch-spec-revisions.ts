/**
 * Has the Model Context Protocol published a revision this repository does not
 * know about?
 *
 *   npx tsx tools/watch-spec-revisions.ts [--json]
 *
 * The probe pins one revision (`PROTOCOL_VERSION`), and every published number
 * was taken over a session that sent it. When the specification moves, that pin
 * is a decision someone has to make deliberately — and until this existed, the
 * only thing standing between the pin and the specification was a person
 * remembering to look.
 *
 * This talks to a network API and so lives outside
 * `src/` and outside the published package: the library, the CLI and every
 * generated artifact stay offline. The rules it applies — what counts as a
 * revision, which names are deliberately not revisions, what makes a listing
 * unreadable — are in `src/core/protocol.ts`, offline and under test. This file
 * is the part that fetches.
 *
 * **Two sources, and they check each other.** The contents API says which
 * revision directories exist; the schema file states the specification's own
 * `LATEST_PROTOCOL_VERSION`. One endpoint returning a plausible-but-wrong
 * answer is the failure this watch is designed against, so when the two
 * disagree — or the listing comes back with no revision in it at all — the run
 * reports that it could not look, and says so in its first line. A watch that
 * is green when it is blind is worse than no watch.
 *
 * **It writes no file.** Nothing here is published; the output is the run.
 *
 * Exits 0 when the reading agrees, 1 when it does not and 1 when it could not
 * look, 2 for a caller mistake. A red scheduled run mails the maintainer, which
 * is the whole mechanism.
 */
import {
  IGNORED_SPEC_DIRS,
  KNOWN_SPEC_REVISIONS,
  PROTOCOL_VERSION,
  SPEC_REVISION_NAME,
  listingIsUnreadable,
  newerThanPinned,
  specSnapshotProblem,
  type SpecListingReading,
} from '../src/core/protocol.js';

const REPO = 'modelcontextprotocol/modelcontextprotocol';
const LISTING_URL = KNOWN_SPEC_REVISIONS.source;
const LATEST_URL = `https://raw.githubusercontent.com/${REPO}/main/schema/draft/schema.ts`;
/** Backoff after a failed request, per attempt; the length is the attempt budget. */
const BACKOFF_MS = [2_000, 8_000];
const REQUEST_TIMEOUT_MS = 30_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (line: string) => console.error(line);

const unknown = process.argv.slice(2).filter((a) => a !== '--json');
if (unknown.length > 0) {
  console.error(`unknown argument(s): ${unknown.join(' ')} — the only flag is --json`);
  process.exit(2);
}
const asJson = process.argv.includes('--json');

/**
 * The token is optional: the raw half needs no credential at
 * all and the listing half works unauthenticated at a lower limit, so refusing
 * would turn a missing token into a red run that says nothing about the
 * specification.
 */
const token = process.env.MCP_CTX_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;

async function request(url: string, accept: string): Promise<string> {
  let lastError = '';
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          accept,
          'user-agent': 'mcp-context-cost-spec-watch',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await res.text();
      if (res.ok) return text;
      lastError = `HTTP ${res.status} ${text.slice(0, 160).replace(/\s+/g, ' ')}`;
    } catch (e) {
      lastError = (e as Error).message;
    }
    const wait = BACKOFF_MS[attempt];
    if (wait === undefined) break;
    log(`  ${lastError} — retrying ${url} in ${wait / 1000}s`);
    await sleep(wait);
  }
  throw new Error(`${url}: ${lastError}`);
}

/** Every directory the listing publishes, sorted into what this watch makes of each. */
function partition(listing: unknown): SpecListingReading {
  if (!Array.isArray(listing)) throw new Error('the listing was not a JSON array');
  const names = listing
    .filter((e): e is { name: string; type: string } => !!e && typeof e === 'object')
    .filter((e) => e.type === 'dir')
    .map((e) => String(e.name));
  return {
    dated: names.filter((n) => SPEC_REVISION_NAME.test(n)).toSorted(),
    ignored: names.filter((n) => IGNORED_SPEC_DIRS.includes(n)),
    unrecognised: names
      .filter((n) => !SPEC_REVISION_NAME.test(n) && !IGNORED_SPEC_DIRS.includes(n))
      .toSorted(),
    latestSaid: null,
  };
}

/** The specification's own word for its latest revision, or null if unreadable. */
function latestFrom(source: string): string | null {
  return /^export const LATEST_PROTOCOL_VERSION = "([\d-]+)";/m.exec(source)?.[1] ?? null;
}

function couldNotLook(why: string): never {
  const first = `could not read the specification: ${why}`;
  if (asJson)
    console.log(
      JSON.stringify({ ok: false, couldNotLook: why, pinned: PROTOCOL_VERSION }, null, 2),
    );
  else {
    console.log(first);
    console.log(
      '\nNothing about the specification is claimed by this run. Re-run it; if it keeps failing,',
    );
    console.log(`look at ${LISTING_URL} and ${LATEST_URL} by hand.`);
  }
  process.exit(1);
}

let live: SpecListingReading;
try {
  live = partition(JSON.parse(await request(LISTING_URL, 'application/vnd.github+json')));
} catch (e) {
  couldNotLook((e as Error).message);
}

// The corroborating half. Its absence is not fatal — one source read is still a
// reading — but a disagreement is, and `listingIsUnreadable` decides that.
try {
  live.latestSaid = latestFrom(await request(LATEST_URL, 'text/plain'));
} catch (e) {
  log(
    `  the schema file could not be read (${(e as Error).message}); continuing on the listing alone`,
  );
}

const unreadable = listingIsUnreadable(live);
if (unreadable) couldNotLook(unreadable);

const problems = specSnapshotProblem(KNOWN_SPEC_REVISIONS, live);
const ahead = newerThanPinned(KNOWN_SPEC_REVISIONS);

if (asJson) {
  console.log(
    JSON.stringify(
      { ok: problems.length === 0, problems, pinned: PROTOCOL_VERSION, ahead, live },
      null,
      2,
    ),
  );
  process.exit(problems.length === 0 ? 0 : 1);
}

if (problems.length === 0) {
  console.log(
    `the specification publishes exactly what this repository names, as read on ${KNOWN_SPEC_REVISIONS.readOn}:`,
  );
  console.log(`  ${KNOWN_SPEC_REVISIONS.revisions.join(', ')}`);
  console.log(`  ignored, deliberately: ${live.ignored.join(', ') || '(none present)'}`);
  console.log(`  the schema file calls the latest: ${live.latestSaid ?? '(not read)'}`);
  console.log(
    ahead.length === 0
      ? `\nthis probe sends ${PROTOCOL_VERSION}, and nothing published is newer.`
      : `\nthis probe sends ${PROTOCOL_VERSION}; newer revisions exist: ${ahead.join(', ')}.`,
  );
  process.exit(0);
}

console.log('the specification and this repository disagree:');
for (const p of problems) console.log(`  - ${p}`);
console.log(`\nUpdate KNOWN_SPEC_REVISIONS in src/core/protocol.ts and move its readOn to today.`);
console.log(`Then read the new schema.ts before deciding whether PROTOCOL_VERSION moves: a new`);
console.log(`directory is not by itself a reason to change what this probe sends, and moving the`);
console.log(`pin re-opens whether numbers either side of it are comparable.`);
process.exit(1);
