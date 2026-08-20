/**
 * Badge adoption — how many projects outside this one actually display the
 * badge, and on what day someone last looked.
 *
 * Every other number this project publishes is about MCP servers. This one is
 * about the project itself, and it exists because the alternative is a launch
 * that produces a number nobody can attribute. "Nobody is using the badge" and
 * "nobody has checked whether anybody is using the badge" are the same sentence
 * to a reader, and only one of them is a measurement. So the reading published
 * here is a dated observation with its own working shown: the exact queries
 * that were run, every file they turned up, and what each of those files was
 * judged to be. A zero from this instrument means *these queries ran on this
 * date and found none*, which is a fact. A missing reading says so in those
 * words and publishes no number at all.
 *
 * ## What counts as displaying the badge
 *
 * A file, in a repository owned by someone else, containing a shields.io
 * endpoint badge whose `url` points at this repository's `badges/` directory.
 * That is the badge this project publishes: the number is rendered by shields
 * from a measurement whose capture and hash anyone can re-derive.
 *
 * A badge whose JSON is self-hosted — an author runs the sweep and commits
 * their own `badges/<name>.json` — is invisible to that rule unless the file
 * also names this project somewhere, which the published snippet's link target
 * does. That is not an accident of the search: this project's own README says a
 * badge nobody can audit is decoration, and a badge carrying no reference back
 * to the measurement behind it is exactly that. The limit is published rather
 * than papered over; see `renderAdoptionPage`.
 *
 * ## Why the search is a net and not the judgement
 *
 * Code search matches text, and the same badge is written two ways: shields
 * percent-encodes the `url` parameter, so the published snippet carries
 * `raw.githubusercontent.com%2Fathakur3%2F…`, while a hand-written badge may
 * carry the plain path. Measured against GitHub code search on 2026-08-20, the
 * two forms do not find each other: a repository whose README carries only the
 * encoded form of a raw URL returns 0 for the plain form of that same path,
 * while the encoded literal returns matches. Neither query alone is the
 * question being asked.
 *
 * So the queries only nominate candidates. What a candidate *is* gets decided
 * by reading the file — `classifyFile` below, applied to content that has had
 * its percent-encoding undone, so one rule covers both spellings. Files that
 * name the project without displaying the badge are kept in the reading as
 * rejections, because a zero is worth much more next to the list of things that
 * were examined and turned down.
 */

/** Method identifier, versioned independently of the o200k methodology. */
export const ADOPTION_METHOD = 'badge-sightings/v1';

/** Where this project's badge JSON is published — the thing a badge points at. */
export interface BadgeSource {
  owner: string;
  repo: string;
  branch: string;
}

export const BADGE_SOURCE: BadgeSource = {
  owner: 'athakur3',
  repo: 'mcp-context-cost',
  branch: 'main',
};

/** A query as published: what was asked, and why it is part of the question. */
export interface QueryDef {
  name: string;
  q: string;
  why: string;
}

/** A query as answered. `hits` is null whenever `state` is not `ok`. */
export interface QueryResult extends QueryDef {
  state: 'ok' | 'failed';
  hits: number | null;
  /** Set when the query did not answer — a reading with one of these is refused. */
  error?: string;
  /** Set when more results existed than were collected. Also refuses the reading. */
  truncated?: boolean;
}

/** `badge`: displays it. `mention`: names the project without displaying it. */
export type SightingKind = 'badge' | 'mention';

export interface Sighting {
  /** `owner/repo` of the third-party repository. */
  repo: string;
  path: string;
  url: string;
  kind: SightingKind;
  /** Which query nominated it — so a reader can re-run the one that found it. */
  foundBy: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AdoptionRun {
  method: string;
  /** UTC day the queries were run (YYYY-MM-DD). */
  checkedAt: string;
  source: BadgeSource;
  queries: QueryResult[];
  /** Distinct third-party files examined this run, whatever they turned out to be. */
  candidates: number;
  /** Every sighting ever recorded, including ones not seen this run. */
  sightings: Sighting[];
  /**
   * Third-party repositories displaying the badge on `checkedAt`, or null when
   * the queries did not establish it. Never 0 for want of looking.
   */
  thirdPartyRepos: number | null;
  /** Why no number is published. Null exactly when `thirdPartyRepos` is a number. */
  unresolved: string | null;
  /**
   * The most recent reading that did establish a number, carried across runs.
   * A search that falls over must not publish a count, but it also must not
   * erase the last one that stood: "unknown today, 3 on the 20th" is a reading,
   * and "unknown" alone throws away one that was already paid for.
   */
  lastResolved: { checkedAt: string; thirdPartyRepos: number } | null;
}

/**
 * The published query set. Both spellings of the badge URL are asked for
 * separately (see the header), plus the click-through the badge is supposed to
 * carry, plus the project's own name as the widest net — anything that names
 * the project becomes a candidate and is then judged by its contents.
 */
export function adoptionQueries(src: BadgeSource = BADGE_SOURCE): QueryDef[] {
  const raw = `raw.githubusercontent.com/${src.owner}/${src.repo}/${src.branch}/badges`;
  return [
    {
      name: 'badge-endpoint-encoded',
      q: `"${raw.replace(/\//g, '%2F')}"`,
      why: 'the form shields produces when the published snippet is used verbatim',
    },
    {
      name: 'badge-endpoint-plain',
      q: `"${raw}"`,
      why: 'a badge written without percent-encoding, which the encoded query cannot find',
    },
    {
      name: 'link-target',
      q: `"${src.owner}.github.io/${src.repo}"`,
      why: 'the measurement page a badge is required to link to, however the image is written',
    },
    {
      name: 'project-name',
      q: `"${src.repo}"`,
      why: 'the widest net: anything naming the project, judged by its contents rather than by the query',
    },
  ];
}

/**
 * Undo percent-encoding without throwing on the malformed sequences that turn
 * up in real files. Decoded per-escape rather than over the whole string, so
 * one bad `%zz` costs that escape and nothing around it.
 */
export function decodeLoose(text: string): string {
  return text.replace(/(?:%[0-9a-fA-F]{2})+/g, (seq) => {
    try {
      return decodeURIComponent(seq);
    } catch {
      return seq;
    }
  });
}

/**
 * Every shields endpoint `url` parameter in a file that points at this
 * project's badges, decoded. Matched without regard to case: GitHub owner and
 * repository names are case-insensitive, a badge written `MCP-Context-Cost`
 * renders exactly the same one, and code search found the file that way too.
 */
export function endpointUrls(text: string, src: BadgeSource = BADGE_SOURCE): string[] {
  const decoded = decodeLoose(text);
  const out: string[] = [];
  const re = /img\.shields\.io\/endpoint\?url=([^\s)"'<>\]]+)/gi;
  for (const m of decoded.matchAll(re)) out.push(m[1]);
  const needle = `${src.owner}/${src.repo}/`.toLowerCase();
  return out.filter((u) => {
    const lower = u.toLowerCase();
    return lower.includes(needle) && lower.includes('/badges/');
  });
}

/**
 * What a candidate file is. `null` when it turns out to be neither — a search
 * index can be older than the file it points at.
 *
 * Case is ignored here for the same reason it is ignored above, and the first
 * real run is why it is stated rather than assumed: a file discussing
 * "MCP-context-cost" was found by the search and would have been thrown out by
 * an exact-case test, which is a rejection that looks identical to a file that
 * genuinely stopped mentioning the project.
 */
export function classifyFile(text: string, src: BadgeSource = BADGE_SOURCE): SightingKind | null {
  if (endpointUrls(text, src).length > 0) return 'badge';
  const decoded = decodeLoose(text).toLowerCase();
  return decoded.includes(src.repo.toLowerCase()) ? 'mention' : null;
}

/** `owner/repo` → is that owner someone other than this project's? */
export function isThirdParty(repoFullName: string, src: BadgeSource = BADGE_SOURCE): boolean {
  const owner = repoFullName.split('/')[0] ?? '';
  return owner.toLowerCase() !== src.owner.toLowerCase();
}

/** A sighting as observed this run, before it is dated against the previous one. */
export type FreshSighting = Omit<Sighting, 'firstSeenAt' | 'lastSeenAt'>;

function sightingKey(s: { repo: string; path: string }): string {
  return JSON.stringify([s.repo, s.path]);
}

/**
 * Date this run's sightings against the last one. A file seen before keeps its
 * `firstSeenAt`; a file no longer found is kept with the date it was last seen
 * rather than deleted, so a badge that disappears is visible as a badge that
 * disappeared instead of as one that never existed.
 */
export function mergeSightings(previous: Sighting[], fresh: FreshSighting[], checkedAt: string): Sighting[] {
  const byKey = new Map<string, Sighting>();
  for (const s of previous) byKey.set(sightingKey(s), s);
  for (const f of fresh) {
    const key = sightingKey(f);
    const before = byKey.get(key);
    byKey.set(key, {
      ...f,
      firstSeenAt: before?.firstSeenAt ?? checkedAt,
      lastSeenAt: checkedAt,
    });
  }
  return [...byKey.values()].sort((a, b) => sightingKey(a).localeCompare(sightingKey(b)));
}

/** Repositories displaying the badge as of `checkedAt` — sorted, deduplicated. */
export function badgeRepos(sightings: Sighting[], checkedAt: string): string[] {
  const repos = new Set<string>();
  for (const s of sightings) {
    if (s.kind === 'badge' && s.lastSeenAt === checkedAt) repos.add(s.repo);
  }
  return [...repos].sort();
}

/**
 * Whether this run may publish a number, and if not, why not. A query that did
 * not answer, or one whose results were cut short, means the set of files that
 * carry the badge was never established — and a count taken from an incomplete
 * search is a zero that means "we did not finish", which is the exact confusion
 * this instrument exists to remove.
 */
export function resolveCount(
  queries: QueryResult[],
  sightings: Sighting[],
  checkedAt: string,
  unreadableCandidates = 0,
): Pick<AdoptionRun, 'thirdPartyRepos' | 'unresolved'> {
  if (queries.length === 0) return { thirdPartyRepos: null, unresolved: 'no-query-was-run' };
  const failed = queries.filter((q) => q.state !== 'ok');
  if (failed.length > 0) {
    return { thirdPartyRepos: null, unresolved: `query-did-not-answer: ${failed.map((q) => q.name).join(', ')}` };
  }
  const truncated = queries.filter((q) => q.truncated);
  if (truncated.length > 0) {
    return { thirdPartyRepos: null, unresolved: `more-results-than-collected: ${truncated.map((q) => q.name).join(', ')}` };
  }
  if (unreadableCandidates > 0) {
    return { thirdPartyRepos: null, unresolved: `candidate-could-not-be-read: ${unreadableCandidates}` };
  }
  return { thirdPartyRepos: badgeRepos(sightings, checkedAt).length, unresolved: null };
}

/**
 * The last completed reading to carry into this run's record: this one if it
 * completed, otherwise whatever the previous run was carrying.
 */
export function carryResolved(
  previous: AdoptionRun | null,
  current: Pick<AdoptionRun, 'checkedAt' | 'thirdPartyRepos'>,
): AdoptionRun['lastResolved'] {
  if (typeof current.thirdPartyRepos === 'number') {
    return { checkedAt: current.checkedAt, thirdPartyRepos: current.thirdPartyRepos };
  }
  if (!previous) return null;
  if (typeof previous.thirdPartyRepos === 'number') {
    return { checkedAt: previous.checkedAt, thirdPartyRepos: previous.thirdPartyRepos };
  }
  return previous.lastResolved ?? null;
}

/** Parse results/badge-adoption.json; anything malformed yields null, never throws. */
export function parseAdoption(text: string): AdoptionRun | null {
  let run: unknown;
  try {
    run = JSON.parse(text);
  } catch {
    return null;
  }
  const r = run as Partial<AdoptionRun>;
  if (!r || typeof r.checkedAt !== 'string' || !Array.isArray(r.sightings)) return null;
  if (!Array.isArray(r.queries) || !r.source) return null;
  return {
    method: typeof r.method === 'string' ? r.method : ADOPTION_METHOD,
    checkedAt: r.checkedAt,
    source: r.source,
    queries: r.queries,
    candidates: typeof r.candidates === 'number' ? r.candidates : 0,
    sightings: r.sightings,
    thirdPartyRepos: typeof r.thirdPartyRepos === 'number' ? r.thirdPartyRepos : null,
    unresolved: typeof r.unresolved === 'string' ? r.unresolved : null,
    lastResolved: r.lastResolved ?? null,
  };
}

function mdCell(s: unknown): string {
  return String(s ?? '')
    .replace(/[|`[\]<>]/g, (c) => `\\${c}`)
    .replace(/\r?\n/g, ' ')
    .slice(0, 160);
}

/**
 * A link destination, escaped but never shortened. `mdCell`'s 160-character
 * cap is right for text a table has to hold and wrong for a URL: a truncated
 * one is a broken link, and the whole point of listing a file is that a reader
 * can go and look at it.
 */
function mdUrl(s: unknown): string {
  return String(s ?? '')
    .replace(/\s/g, '%20')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/[|<>]/g, encodeURIComponent);
}

/**
 * The page a reader opens. `null` is the state that matters most: no run on
 * record renders as "nobody has looked", in those words, with no number — which
 * is the whole distinction this instrument exists to make readable.
 */
export function renderAdoptionPage(run: AdoptionRun | null, src: BadgeSource = BADGE_SOURCE): string {
  const out: string[] = [];
  out.push('# Who displays the badge');
  out.push('');
  out.push(
    '*Generated by `tools/measure-adoption.ts` (`npm run adoption`). Do not edit: this page is ' +
      'rebuilt from `results/badge-adoption.json` every time someone looks.*',
  );
  out.push('');

  if (!run) {
    out.push('**Nobody has looked yet.** No reading has been taken, so there is no number here —');
    out.push('not a zero, which would say something different and would not be true.');
    out.push('');
    out.push('Run `npm run adoption` to take one.');
    out.push('');
    return out.join('\n') + '\n';
  }

  const current = badgeRepos(run.sightings, run.checkedAt);
  if (run.unresolved) {
    out.push(`**The count could not be established on ${run.checkedAt}.** Reason: \`${run.unresolved}\`.`);
    out.push('');
    out.push('No number is published rather than a zero that might only mean the search stopped early.');
    out.push('');
    out.push(
      run.lastResolved
        ? `The last reading that did complete found **${run.lastResolved.thirdPartyRepos}** on ` +
            `${run.lastResolved.checkedAt}. That one still stands; this one adds nothing to it.`
        : 'No reading has ever completed, so nothing is known yet either way.',
    );
  } else if (run.thirdPartyRepos === 0) {
    out.push(`**Zero projects outside this repository display the badge**, as of ${run.checkedAt}.`);
    out.push('');
    out.push(
      `That zero was looked for: ${run.queries.length} queries ran and turned up ` +
        `${run.candidates} third-party file(s), listed below, none of which carries the badge.`,
    );
  } else {
    out.push(
      `**${run.thirdPartyRepos} project(s) outside this repository display the badge**, as of ${run.checkedAt}:`,
    );
    out.push('');
    for (const r of current) out.push(`- [${mdCell(r)}](https://github.com/${r})`);
  }
  out.push('');
  out.push('A reading is a dated observation, not a live counter. It is worth exactly as much as');
  out.push('its date, and re-running it is one command.');
  out.push('');

  out.push('## What was asked');
  out.push('');
  out.push('| query | what it is for | files found |');
  out.push('|---|---|---|');
  for (const q of run.queries) {
    const hits = q.state === 'ok' ? String(q.hits ?? 0) + (q.truncated ? ' (truncated)' : '') : `not answered — ${mdCell(q.error)}`;
    out.push(`| \`${mdCell(q.q)}\` | ${mdCell(q.why)} | ${hits} |`);
  }
  out.push('');
  out.push('Run against GitHub code search, which indexes default branches of public');
  out.push('repositories. Files in this project\'s own repositories are excluded before anything');
  out.push('is counted.');
  out.push('');

  out.push('## What was found');
  out.push('');
  if (run.sightings.length === 0) {
    out.push('No file outside this project named it at all.');
  } else {
    out.push('| repository | file | what it is | first seen | last seen |');
    out.push('|---|---|---|---|---|');
    for (const s of run.sightings) {
      const what = s.kind === 'badge' ? '**displays the badge**' : 'names the project, no badge';
      out.push(
        `| [${mdCell(s.repo)}](https://github.com/${s.repo}) | [${mdCell(s.path)}](${mdUrl(s.url)}) | ` +
          `${what} | ${s.firstSeenAt} | ${s.lastSeenAt} |`,
      );
    }
    out.push('');
    out.push('A row whose *last seen* is older than the date above was found by an earlier reading');
    out.push('and not by this one.');
  }
  out.push('');

  out.push('## What this cannot see');
  out.push('');
  out.push('- A badge whose JSON is self-hosted and which links back to nothing. Nothing in such a');
  out.push('  file names this project, so no query can nominate it — and a badge carrying no route');
  out.push('  to the measurement behind it is the kind this project calls decoration.');
  out.push('- Anything outside public GitHub: private repositories, other forges, documentation');
  out.push('  sites whose source is not on GitHub, and repositories the code search index has not');
  out.push('  reached.');
  out.push('- Whether anybody looked at a badge. This counts files that display one, which is a');
  out.push('  different question from reach.');
  out.push('');
  out.push(
    `Method \`${run.method}\`, against \`${src.owner}/${src.repo}\` on branch \`${src.branch}\`. ` +
      'The raw reading, including every query and every file examined, is in ' +
      '[`results/badge-adoption.json`](https://github.com/' +
      `${src.owner}/${src.repo}/blob/${src.branch}/results/badge-adoption.json).`,
  );
  out.push('');
  return out.join('\n');
}
