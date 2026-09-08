/**
 * Do the vendor's pages still say what this project's model of tool search is
 * built on?
 *
 *   npx tsx tools/watch-tool-search-docs.ts [--json]
 *
 * `src/audit/deferral.ts` decides whether a machine's Claude Code defers MCP
 * tool definitions, and every rule in it is a reading of someone else's
 * documentation. Four sentences carry the whole thing: that the disabling
 * variable is a boolean flag rather than a marker, that the variables which
 * instead read any non-empty value are an enumerated exception it is not in,
 * that an organisation can keep tool search on through managed settings, and
 * that the managed file has drop-ins beside it at a path which is not the
 * ProgramData one. Until this existed, the only thing between those sentences
 * and the report was somebody remembering to re-read them — and these pages
 * have already moved host once under this project.
 *
 * Like `watch-spec-revisions.ts`, this talks to a
 * network and so lives outside `src/` and outside the published package: the
 * library, the CLI and every generated artifact stay offline. The rule it
 * applies — which passages, what counts as drift, what counts as not having
 * looked — is `toolSearchDocProblems` in `src/audit/deferral.ts`, offline and
 * under test. This file is the part that fetches.
 *
 * **It checks sentences, not a page hash.** A hash of a documentation page goes
 * red every week for a typo, and a watch people learn to ignore is worse than
 * no watch.
 *
 * **It writes no file.** Nothing here is published; the output is the run.
 *
 * Exits 0 when the pages still say it, 1 when they do not and 1 when they could
 * not be read, 2 for a caller mistake. A red scheduled run mails the
 * maintainer, which is the whole mechanism.
 */
import {
  TOOL_SEARCH_DOC_CLAIMS,
  TOOL_SEARCH_DOC_READ_ON,
  toolSearchDocProblems,
} from '../src/audit/deferral.js';

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

async function request(url: string): Promise<string> {
  let lastError = '';
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          accept: 'text/plain, text/markdown',
          'user-agent': 'mcp-context-cost-doc-watch',
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
  throw new Error(lastError);
}

const urls = [...new Set(TOOL_SEARCH_DOC_CLAIMS.map((c) => c.url))];

/**
 * A page that could not be fetched is carried as `null` rather than dropped.
 * The rule reports it, which is the difference between a watch and a watch that
 * goes quietly green when the network is down.
 */
const pages = new Map<string, string | null>();
for (const url of urls) {
  try {
    pages.set(url, await request(url));
  } catch (e) {
    log(`  ${url}: ${(e as Error).message}`);
    pages.set(url, null);
  }
}

const problems = toolSearchDocProblems(pages);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        ok: problems.length === 0,
        readOn: TOOL_SEARCH_DOC_READ_ON,
        pages: urls.map((url) => ({ url, read: pages.get(url) !== null })),
        problems,
      },
      null,
      2,
    ),
  );
  process.exit(problems.length === 0 ? 0 : 1);
}

if (problems.length === 0) {
  console.log(
    `the ${TOOL_SEARCH_DOC_CLAIMS.length} passages the deferral model rests on still read as they did on ${TOOL_SEARCH_DOC_READ_ON}:`,
  );
  for (const url of urls) console.log(`  ${url}`);
  process.exit(0);
}

console.log('the deferral model rests on passages that no longer read as recorded:\n');
for (const p of problems) console.log(`  - ${p}`);
console.log(
  `\nRecorded on ${TOOL_SEARCH_DOC_READ_ON}. What has to change with them, if they moved:`,
);
console.log('  src/audit/deferral.ts — the rules and the dated source bullets in its header');
console.log(
  '  docs/METHODOLOGY.md   — the value table, and the paragraph naming what is not a quotation',
);
console.log('  README.md             — the settings table');
process.exit(1);
