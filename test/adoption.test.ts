import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADOPTION_METHOD,
  BADGE_SOURCE,
  adoptionQueries,
  badgeRepos,
  carryResolved,
  classifyFile,
  decodeLoose,
  displaysBadge,
  endpointBadges,
  endpointUrls,
  isThirdParty,
  linksBackToProject,
  mergeSightings,
  namesProject,
  parseAdoption,
  renderAdoptionPage,
  resolveCount,
  applyRejudgements,
  judgingMethod,
  sightingsByMethod,
  type AdoptionRun,
  type QueryResult,
  type Sighting,
} from '../src/core/adoption.js';
import { readmeSnippet } from '../src/core/snippet.js';

const RAW =
  'https://raw.githubusercontent.com/athakur3/mcp-context-cost/main/badges/my-server.json';
const PAGE = 'https://athakur3.github.io/mcp-context-cost/servers/my-server.html';

function query(over: Partial<QueryResult> = {}): QueryResult {
  return { name: 'q', q: '"x"', why: 'why', state: 'ok', hits: 0, ...over };
}

function sighting(over: Partial<Sighting> = {}): Sighting {
  return {
    repo: 'someone/their-server',
    path: 'README.md',
    url: 'https://github.com/someone/their-server/blob/main/README.md',
    kind: 'badge',
    foundBy: 'badge-endpoint-encoded',
    firstSeenAt: '2026-08-20',
    lastSeenAt: '2026-08-20',
    ...over,
  };
}

function run(over: Partial<AdoptionRun> = {}): AdoptionRun {
  return {
    method: ADOPTION_METHOD,
    checkedAt: '2026-08-20',
    source: BADGE_SOURCE,
    queries: [query()],
    candidates: 0,
    sightings: [],
    thirdPartyRepos: 0,
    unresolved: null,
    lastResolved: { checkedAt: '2026-08-20', thirdPartyRepos: 0 },
    ...over,
  };
}

describe('adoptionQueries', () => {
  it('asks for both spellings of the badge URL, because neither finds the other', () => {
    const qs = adoptionQueries();
    const encoded = qs.find((q) => q.name === 'badge-endpoint-encoded');
    const plain = qs.find((q) => q.name === 'badge-endpoint-plain');
    expect(encoded?.q).toContain(
      'raw.githubusercontent.com%2Fathakur3%2Fmcp-context-cost%2Fmain%2Fbadges',
    );
    expect(encoded?.q).not.toContain('/badges');
    expect(plain?.q).toContain('raw.githubusercontent.com/athakur3/mcp-context-cost/main/badges');
    expect(plain?.q).not.toContain('%2F');
  });

  it('widens past the badge URL to anything naming the project', () => {
    const names = adoptionQueries().map((q) => q.name);
    expect(names).toContain('link-target');
    expect(names).toContain('project-name');
    for (const q of adoptionQueries()) expect(q.why.length).toBeGreaterThan(0);
  });
});

describe('decodeLoose', () => {
  it('undoes percent-encoding so one rule covers both spellings', () => {
    expect(decodeLoose('a%2Fb%2Fc')).toBe('a/b/c');
  });

  it('leaves a malformed escape alone instead of throwing', () => {
    expect(decodeLoose('100%zz and a%2Fb')).toBe('100%zz and a/b');
    expect(decodeLoose('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('classifyFile', () => {
  it('reads the published snippet as a badge', () => {
    expect(classifyFile(readmeSnippet(RAW, PAGE))).toBe('badge');
  });

  it('reads a hand-written, unencoded badge as a badge too', () => {
    const md = `[![context cost](https://img.shields.io/endpoint?url=${RAW})](${PAGE})`;
    expect(classifyFile(md)).toBe('badge');
  });

  it("does not count somebody else's shields endpoint badge", () => {
    const md =
      '[![build](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fother%2Frepo%2Fmain%2Fbadges%2Fx.json)](https://example.com)';
    expect(classifyFile(md)).toBe(null);
  });

  it('separates naming the project from displaying its badge', () => {
    expect(
      classifyFile('Measured with https://github.com/athakur3/mcp-context-cost — no badge yet.'),
    ).toBe('mention');
    expect(classifyFile(`See ${PAGE} for the numbers.`)).toBe('mention');
    expect(classifyFile('Run `npx -y mcp-context-cost audit` before adding a server.')).toBe(
      'mention',
    );
  });

  it('separates naming the project from merely containing its name', () => {
    // Nothing in this sentence says which of the things called mcp-context-cost
    // it means, and the reading of 2026-09-05 listed 41 files like it as naming
    // this one. Not one did.
    expect(classifyFile('We measured this with mcp-context-cost.')).toBe('phrase');
  });

  it('returns null when the file no longer mentions the project at all', () => {
    expect(classifyFile('# Some other README\n\nNothing to do with it.')).toBe(null);
  });

  it('ignores case, because the search that found the file ignores it too', () => {
    // Observed on the first real run: a file discussing "MCP-context-cost". An
    // exact-case test would return null here, which reads as a file that stopped
    // carrying the name; the phrase is the phrase in any case.
    expect(classifyFile('the 55K-token MCP-context-cost concrete number')).toBe('phrase');
    expect(classifyFile('see GitHub.com/AThakur3/MCP-Context-Cost for the method')).toBe('mention');
    const md = `[![context cost](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FAThakur3%2FMCP-Context-Cost%2Fmain%2Fbadges%2Fx.json)](${PAGE})`;
    expect(classifyFile(md)).toBe('badge');
  });
});

describe('namesProject', () => {
  it('accepts the repository path, however the URL around it is spelled', () => {
    expect(namesProject('https://github.com/athakur3/mcp-context-cost')).toBe(true);
    expect(namesProject('git clone https://github.com/athakur3/mcp-context-cost.git')).toBe(true);
    expect(namesProject(RAW)).toBe(true);
    expect(namesProject('uses: athakur3/mcp-context-cost@v1')).toBe(true);
    expect(namesProject('github.com%2Fathakur3%2Fmcp-context-cost')).toBe(true);
  });

  it('accepts the pages site', () => {
    expect(namesProject(PAGE)).toBe(true);
    expect(namesProject('https://athakur3.github.io/mcp-context-cost/')).toBe(true);
  });

  it('accepts the npm package in the spellings a README uses', () => {
    expect(namesProject('npx -y mcp-context-cost audit --budget 20000')).toBe(true);
    expect(namesProject('npx mcp-context-cost@latest')).toBe(true);
    expect(namesProject('npm install -g mcp-context-cost')).toBe(true);
    expect(namesProject('pnpm add -D mcp-context-cost')).toBe(true);
    expect(namesProject('"devDependencies": { "mcp-context-cost": "^0.17.0" }')).toBe(true);
    expect(namesProject('https://www.npmjs.com/package/mcp-context-cost')).toBe(true);
  });

  it('stops where the name stops — a longer name is a different thing', () => {
    expect(namesProject('https://github.com/athakur3/mcp-context-cost-meter')).toBe(false);
    expect(namesProject('npx -y mcp-context-cost-meter')).toBe(false);
    expect(namesProject('https://www.npmjs.com/package/mcp-context-costs')).toBe(false);
    expect(namesProject('"mcp-context-cost": "a meter for what an MCP server costs"')).toBe(false);
  });

  it('rejects the bare name in prose, a URL slug, a directory and a name in a list', () => {
    expect(namesProject('mcp-context-cost is a good idea')).toBe(false);
    expect(namesProject('https://example.com/book/06-tool-context/mcp-context-cost')).toBe(false);
    expect(namesProject('see ./mcp-context-cost/README.md')).toBe(false);
    expect(namesProject('"storepilot-mcp", "mcp-context-cost", "capability-forge"')).toBe(false);
  });
});

describe('files found in the wild', () => {
  // The shapes the reading of 2026-09-05 listed as "names the project", read at
  // the commits the page links to. None of the 41 referred to this project.
  const fixtures = join(import.meta.dirname, 'fixtures', 'adoption');
  const fixture = (name: string) => readFileSync(join(fixtures, name), 'utf8');

  it("a file carrying the phrase only inside a link to somebody else's site is not naming the project", () => {
    // shuji-bonji/ai-agent-architecture, docs/glossary.md and seven more: every
    // occurrence is the slug of a chapter on an unrelated site.
    const text = fixture('phrase-in-foreign-url.md');
    expect(text.toLowerCase()).toContain('mcp-context-cost');
    expect(namesProject(text)).toBe(false);
    expect(classifyFile(text)).toBe('phrase');
  });

  it('a file naming directories called mcp-context-cost-meter is not naming the project', () => {
    // nikbearbrown/humanitarians-youtube, claude-for-computer-science/README.md
    // and the seven files under those directories.
    const text = fixture('phrase-in-directory-name.md');
    expect(text.toLowerCase()).toContain('mcp-context-cost');
    expect(namesProject(text)).toBe(false);
    expect(classifyFile(text)).toBe('phrase');
  });

  it("a file whose only occurrence of the name is a temp file's name is not naming the project", () => {
    // bbingz/engram, macos/EngramMCPTests/EngramMCPExecutableTests.swift at
    // d97d0257 — the record the reading of 2026-09-07 carried forward.
    const text = fixture('phrase-in-sqlite-filename.swift');
    expect(text.toLowerCase()).toContain('mcp-context-cost');
    expect(namesProject(text)).toBe(false);
    expect(classifyFile(text)).toBe('phrase');
  });

  it('a README that runs the npm package is naming the project', () => {
    const text = fixture('names-npm-package.md');
    expect(namesProject(text)).toBe(true);
    expect(classifyFile(text)).toBe('mention');
  });
});

describe('the badge forms this project actually publishes', () => {
  // Every snippet the project ships is addressed to an author measuring their
  // own server, so every one of them points shields at the author's own JSON.
  // A rule that only counted JSON served from here would publish a zero about a
  // spelling nobody was told to write.
  const OWN =
    'https://raw.githubusercontent.com/someone/their-server/main/badges/their-server.json';
  const METHODOLOGY = 'https://athakur3.github.io/mcp-context-cost/METHODOLOGY.html';

  it("counts README.md's snippet: the author's own badges/ JSON, linked back here", () => {
    expect(classifyFile(readmeSnippet(OWN, PAGE))).toBe('badge');
    expect(classifyFile(readmeSnippet(OWN, METHODOLOGY))).toBe('badge');
  });

  it("counts the dashboard's snippet written by hand, unencoded", () => {
    expect(
      classifyFile(`[![context cost](https://img.shields.io/endpoint?url=${OWN})](${METHODOLOGY})`),
    ).toBe('badge');
  });

  it('does not count an unrelated endpoint badge that merely links here', () => {
    // The self-hosted branch once accepted the link and looked at nothing else,
    // so any shields endpoint badge wrapped in a link to this project counted —
    // inflating the one number this project keeps about itself.
    const coverage = `[![coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fcodecov.example.com%2Fapi%2Fshield.json)](${METHODOLOGY})`;
    expect(classifyFile(coverage)).toBe('mention');
  });

  it("reads the badge's own label tolerantly, since the URL cannot decide it", () => {
    const gist = 'https://gist.githubusercontent.com/someone/abc123/raw/badge.json';
    expect(
      classifyFile(
        `[![Context-Cost](https://img.shields.io/endpoint?url=${gist})](${METHODOLOGY})`,
      ),
    ).toBe('badge');
  });

  it("counts the staged action's gist badge, which has no badges/ segment at all", () => {
    const gist = 'https://gist.githubusercontent.com/someone/abc123/raw/badge.json';
    expect(
      classifyFile(
        `[![context cost](https://img.shields.io/endpoint?url=${gist})](${METHODOLOGY})`,
      ),
    ).toBe('badge');
  });

  it('counts an HTML anchor wrapping the image, which READMEs also use', () => {
    const html = `<a href="${PAGE}"><img src="https://img.shields.io/endpoint?url=${encodeURIComponent(OWN)}" alt="context cost"></a>`;
    expect(classifyFile(html)).toBe('badge');
  });

  it('still counts a badge served from this repository, however it is linked', () => {
    expect(
      classifyFile(
        `![context cost](https://img.shields.io/endpoint?url=${encodeURIComponent(RAW)})`,
      ),
    ).toBe('badge');
  });

  it('leaves a self-hosted badge that links back to nothing outside the count', () => {
    // The one shape the page says it cannot see, stated there and true here.
    expect(
      classifyFile(
        `[![context cost](https://img.shields.io/endpoint?url=${OWN})](https://example.com)`,
      ),
    ).toBe(null);
    expect(classifyFile(`![context cost](https://img.shields.io/endpoint?url=${OWN})`)).toBe(null);
  });

  it('does not read an unrelated badge plus a mention elsewhere as a badge', () => {
    const md = [
      `[![build](https://img.shields.io/endpoint?url=${OWN})](https://ci.example.com)`,
      '',
      'Measured with mcp-context-cost, which you should read about at',
      PAGE,
    ].join('\n');
    expect(classifyFile(md)).toBe('mention');
  });
});

describe('endpointBadges', () => {
  it('pairs each image with its own link and no other', () => {
    const md = `[![a](https://img.shields.io/endpoint?url=one)](https://x.example) [![b](https://img.shields.io/endpoint?url=two)](https://y.example)`;
    expect(endpointBadges(md)).toEqual([
      { url: 'one', linkTarget: 'https://x.example', alt: 'a' },
      { url: 'two', linkTarget: 'https://y.example', alt: 'b' },
    ]);
  });

  it('reports no link rather than borrowing a later one', () => {
    const md = `![a](https://img.shields.io/endpoint?url=one)\n\nsee [the page](${PAGE})`;
    expect(endpointBadges(md)).toEqual([{ url: 'one', linkTarget: null, alt: 'a' }]);
  });
});

describe('linksBackToProject', () => {
  it('accepts the pages site, the repository and a raw file in it', () => {
    expect(linksBackToProject(PAGE)).toBe(true);
    expect(linksBackToProject('https://github.com/athakur3/mcp-context-cost')).toBe(true);
    expect(linksBackToProject('https://github.com/AThakur3/MCP-Context-Cost#readme')).toBe(true);
    expect(linksBackToProject(RAW)).toBe(true);
  });

  it('rejects somewhere else entirely', () => {
    expect(linksBackToProject('https://example.com')).toBe(false);
    expect(linksBackToProject('https://github.com/someone/mcp-context-costs-more')).toBe(false);
  });
});

describe('displaysBadge', () => {
  it('is the judgement classifyFile makes, on its own', () => {
    expect(displaysBadge(readmeSnippet(RAW, PAGE))).toBe(true);
    expect(displaysBadge('mcp-context-cost is great')).toBe(false);
  });
});

describe('endpointUrls', () => {
  it('stops at the markdown that closes the image, not at the end of the line', () => {
    const md = `[![context cost](https://img.shields.io/endpoint?url=${encodeURIComponent(RAW)})](${PAGE}) and more text`;
    expect(endpointUrls(md)).toEqual([RAW]);
  });
});

describe('isThirdParty', () => {
  it("excludes this project's own repositories, case-insensitively", () => {
    expect(isThirdParty('athakur3/mcp-context-cost')).toBe(false);
    expect(isThirdParty('ATHAKUR3/some-other-repo')).toBe(false);
    expect(isThirdParty('someone/mcp-context-cost')).toBe(true);
  });
});

describe('mergeSightings', () => {
  it('keeps the date a badge was first seen when it is seen again', () => {
    const previous = [sighting({ firstSeenAt: '2026-08-01', lastSeenAt: '2026-08-01' })];
    const merged = mergeSightings(previous, [sighting()], '2026-09-01');
    expect(merged).toHaveLength(1);
    expect(merged[0].firstSeenAt).toBe('2026-08-01');
    expect(merged[0].lastSeenAt).toBe('2026-09-01');
  });

  it('keeps a sighting that has disappeared, dated to when it was last seen', () => {
    const previous = [
      sighting({ repo: 'gone/away', firstSeenAt: '2026-08-01', lastSeenAt: '2026-08-01' }),
    ];
    const merged = mergeSightings(previous, [sighting()], '2026-09-01');
    expect(merged.map((s) => s.repo).sort()).toEqual(['gone/away', 'someone/their-server']);
    expect(merged.find((s) => s.repo === 'gone/away')?.lastSeenAt).toBe('2026-08-01');
  });

  it('counts only the badges seen on the day of the reading', () => {
    const merged = mergeSightings(
      [sighting({ repo: 'gone/away', firstSeenAt: '2026-08-01', lastSeenAt: '2026-08-01' })],
      [sighting()],
      '2026-09-01',
    );
    expect(badgeRepos(merged, '2026-09-01')).toEqual(['someone/their-server']);
  });

  it('counts a repository once however many of its files carry the badge', () => {
    const merged = mergeSightings(
      [],
      [sighting(), sighting({ path: 'docs/index.md' })],
      '2026-08-20',
    );
    expect(merged).toHaveLength(2);
    expect(badgeRepos(merged, '2026-08-20')).toEqual(['someone/their-server']);
  });
});

/**
 * The reading of 2026-09-07 (f86da0a) declared `badge-sightings/v2` and
 * published 43 rows, one of which had been judged under v1: bbingz/engram's
 * Swift test file, called "names the project, no badge" because v1's test for
 * naming the project was whether the file contained the string the search had
 * matched. GitHub code search did not return it that day, so it was carried
 * forward with the verdict it already had and nothing re-derived it — the page
 * named one method and described 42 of its 43 rows.
 *
 * The predicates were never the bug: `classifyFile` on that file's own bytes
 * returns `phrase` today (see "files found in the wild" above). What follows
 * pins the rule that replaced the carrying: a record is published under a
 * method's name only if that method judged it.
 */
describe('a verdict belongs to the method that made it', () => {
  const fixtures = join(import.meta.dirname, 'fixtures', 'adoption');

  /** The 2026-09-07 record, as it stood: a v1 verdict on a file v2 calls a phrase. */
  const carried = () =>
    sighting({
      repo: 'bbingz/engram',
      path: 'macos/EngramMCPTests/EngramMCPExecutableTests.swift',
      url: 'https://github.com/bbingz/engram/blob/d97d02575e1b6362b628c649a7e3337193942323/macos/EngramMCPTests/EngramMCPExecutableTests.swift',
      kind: 'mention',
      judgedBy: 'badge-sightings/v1',
      foundBy: 'project-name',
      firstSeenAt: '2026-08-20',
      lastSeenAt: '2026-09-03',
    });

  it('is a record the current method would judge differently — which is what makes it a fixture', () => {
    const evidence = readFileSync(join(fixtures, 'phrase-in-sqlite-filename.swift'), 'utf8');
    expect(carried().kind).toBe('mention');
    expect(classifyFile(evidence)).toBe('phrase');
  });

  it('does not present it under the v2 heading', () => {
    const reading = run({
      method: ADOPTION_METHOD,
      checkedAt: '2026-09-07',
      sightings: [carried()],
    });
    const page = renderAdoptionPage(reading);

    const found = page.slice(
      page.indexOf('## What was found'),
      page.indexOf('### Judged under an earlier rule'),
    );
    expect(found).not.toContain('bbingz/engram');
    expect(found).not.toContain('names the project, no badge');
    expect(found).toContain(`No file was judged under \`${ADOPTION_METHOD}\``);
  });

  it('prints it below, under the version that did judge it', () => {
    const page = renderAdoptionPage(run({ checkedAt: '2026-09-07', sightings: [carried()] }));
    const earlier = page.slice(page.indexOf('### Judged under an earlier rule'));
    expect(earlier).toContain('bbingz/engram');
    expect(earlier).toContain('| names the project, no badge | `badge-sightings/v1` |');
    expect(earlier).toContain('| judged under |');
  });

  it('holds a row this reading did judge in the table, so the split is the method and not the date', () => {
    const mine = sighting({ kind: 'mention', judgedBy: ADOPTION_METHOD, lastSeenAt: '2026-09-07' });
    const page = renderAdoptionPage(run({ checkedAt: '2026-09-07', sightings: [mine, carried()] }));
    const found = page.slice(
      page.indexOf('## What was found'),
      page.indexOf('### Judged under an earlier rule'),
    );
    expect(found).toContain('someone/their-server');
    expect(found).not.toContain('bbingz/engram');
    expect(page).not.toContain('No file was judged under');
  });

  it("takes an unstamped row as this reading's only when this reading saw it", () => {
    const reading = { method: ADOPTION_METHOD, checkedAt: '2026-09-07' };
    expect(judgingMethod(sighting({ lastSeenAt: '2026-09-07' }), reading)).toBe(ADOPTION_METHOD);
    expect(judgingMethod(sighting({ lastSeenAt: '2026-09-03' }), reading)).toBe(null);
    expect(
      judgingMethod(
        sighting({ lastSeenAt: '2026-09-03', judgedBy: 'badge-sightings/v1' }),
        reading,
      ),
    ).toBe('badge-sightings/v1');
  });

  it('holds out a carried-forward row that records no method at all, and says so', () => {
    // The committed reading's own shape: written before `judgedBy` existed.
    const { judgedBy: _drop, ...unstamped } = carried();
    const page = renderAdoptionPage(run({ checkedAt: '2026-09-07', sightings: [unstamped] }));
    const earlier = page.slice(page.indexOf('### Judged under an earlier rule'));
    expect(earlier).toContain('| names the project, no badge | not recorded |');
    expect(
      sightingsByMethod(run({ checkedAt: '2026-09-07', sightings: [unstamped] })).current,
    ).toEqual([]);
  });

  it('re-judging a carried-forward record replaces the verdict and the version, and not the dates', () => {
    const [after] = applyRejudgements(
      [carried()],
      [{ repo: 'bbingz/engram', path: carried().path, kind: 'phrase' }],
    );
    expect(after.kind).toBe('phrase');
    expect(after.judgedBy).toBe(ADOPTION_METHOD);
    // The search did not return it: it was re-read, not seen.
    expect(after.lastSeenAt).toBe('2026-09-03');
    expect(after.firstSeenAt).toBe('2026-08-20');
    expect(renderAdoptionPage(run({ checkedAt: '2026-09-07', sightings: [after] }))).not.toContain(
      '### Judged under an earlier rule',
    );
  });

  it('leaves a record alone when the re-read produced nothing, rather than deleting the evidence', () => {
    const gone = sighting({
      kind: 'badge',
      judgedBy: 'badge-sightings/v1',
      lastSeenAt: '2026-09-03',
    });
    const [after] = applyRejudgements([gone], [{ repo: gone.repo, path: gone.path, kind: null }]);
    expect(after).toEqual(gone);
  });

  it('stamps every sighting this run judged, so the next one need not infer it', () => {
    const merged = mergeSightings([carried()], [sighting()], '2026-09-07');
    expect(merged.find((x) => x.repo === 'someone/their-server')?.judgedBy).toBe(ADOPTION_METHOD);
    expect(merged.find((x) => x.repo === 'bbingz/engram')?.judgedBy).toBe('badge-sightings/v1');
  });
});

describe('resolveCount', () => {
  it('publishes a zero only when every query answered', () => {
    expect(resolveCount([query()], [], '2026-08-20')).toEqual({
      thirdPartyRepos: 0,
      unresolved: null,
    });
  });

  it('refuses a number when a query did not answer', () => {
    const r = resolveCount(
      [query(), query({ name: 'link-target', state: 'failed', hits: null, error: 'HTTP 403' })],
      [],
      '2026-08-20',
    );
    expect(r.thirdPartyRepos).toBe(null);
    expect(r.unresolved).toContain('link-target');
  });

  it('refuses a number when a query had more results than were collected', () => {
    const r = resolveCount(
      [query({ name: 'project-name', hits: 900, truncated: true })],
      [],
      '2026-08-20',
    );
    expect(r.thirdPartyRepos).toBe(null);
    expect(r.unresolved).toContain('more-results-than-collected');
  });

  it('refuses a number when a candidate could not be read', () => {
    const r = resolveCount([query()], [], '2026-08-20', 1);
    expect(r.thirdPartyRepos).toBe(null);
    expect(r.unresolved).toContain('candidate-could-not-be-read');
  });

  it('refuses a number when nothing was asked at all', () => {
    expect(resolveCount([], [], '2026-08-20')).toEqual({
      thirdPartyRepos: null,
      unresolved: 'no-query-was-run',
    });
  });

  it('counts the badges, not the mentions and not the phrase', () => {
    const sightings = [
      sighting(),
      sighting({ repo: 'talker/blog', path: 'post.md', kind: 'mention' }),
      sighting({ repo: 'someone/book', path: 'glossary.md', kind: 'phrase' }),
    ];
    expect(resolveCount([query()], sightings, '2026-08-20').thirdPartyRepos).toBe(1);
  });
});

describe('carryResolved', () => {
  it('carries this run when this run established a number', () => {
    const previous = run({ checkedAt: '2026-08-01', thirdPartyRepos: 3 });
    expect(carryResolved(previous, { checkedAt: '2026-09-01', thirdPartyRepos: 5 })).toEqual({
      checkedAt: '2026-09-01',
      thirdPartyRepos: 5,
    });
  });

  it('keeps the last completed reading when this run could not establish one', () => {
    const previous = run({ checkedAt: '2026-08-01', thirdPartyRepos: 3 });
    expect(carryResolved(previous, { checkedAt: '2026-09-01', thirdPartyRepos: null })).toEqual({
      checkedAt: '2026-08-01',
      thirdPartyRepos: 3,
    });
  });

  it('carries it across two failures in a row rather than losing it on the second', () => {
    const failedOnce = run({
      checkedAt: '2026-09-01',
      thirdPartyRepos: null,
      unresolved: 'query-did-not-answer: project-name',
      lastResolved: { checkedAt: '2026-08-01', thirdPartyRepos: 3 },
    });
    expect(carryResolved(failedOnce, { checkedAt: '2026-09-02', thirdPartyRepos: null })).toEqual({
      checkedAt: '2026-08-01',
      thirdPartyRepos: 3,
    });
  });

  it('is null when nothing has ever completed', () => {
    expect(carryResolved(null, { checkedAt: '2026-08-20', thirdPartyRepos: null })).toBe(null);
  });
});

describe('renderAdoptionPage', () => {
  it('says nobody has looked, and publishes no number, when there is no reading', () => {
    const page = renderAdoptionPage(null);
    expect(page).toContain('Nobody has looked yet');
    expect(page).not.toMatch(/\b0 project/);
    expect(page).toContain('npm run adoption');
  });

  it('says a zero was looked for, and on what day', () => {
    const page = renderAdoptionPage(
      run({
        candidates: 3,
        sightings: [sighting({ kind: 'mention' })],
        queries: [query({ hits: 3 })],
      }),
    );
    expect(page).toContain('Zero projects outside this repository display the badge');
    expect(page).toContain('2026-08-20');
    expect(page).toContain('That zero was looked for');
    expect(page).toContain('names the project, no badge');
  });

  it('lists a file that only matches the phrase under its own label, and says what each label requires', () => {
    const page = renderAdoptionPage(
      run({
        candidates: 2,
        sightings: [
          sighting({ kind: 'mention' }),
          sighting({ repo: 'someone/book', path: 'glossary.md', kind: 'phrase' }),
        ],
      }),
    );
    expect(page).toContain('| names the project, no badge |');
    expect(page).toContain('| matches the phrase only |');
    expect(page).toContain(
      '*Names the project* means the file refers to something that is the project',
    );
    expect(page).toContain('*Matches the phrase only*');
    expect(page).toContain('kept in this table rather than');
  });

  it('says, while the reading predates the rule, that a later one re-judges it — and only then', () => {
    const stale = renderAdoptionPage(
      run({
        method: 'badge-sightings/v1',
        sightings: [sighting({ kind: 'mention', judgedBy: 'badge-sightings/v1' })],
      }),
    );
    expect(stale).toContain('taken under method `badge-sightings/v1`; the rule now in force is');
    expect(stale).toContain(
      'the next reading re-judges every file it finds and every record it carries',
    );
    const current = renderAdoptionPage(run({ sightings: [sighting({ kind: 'mention' })] }));
    expect(current).not.toContain('taken under method');
  });

  it('publishes no number when the reading was refused, and says why', () => {
    const page = renderAdoptionPage(
      run({
        thirdPartyRepos: null,
        unresolved: 'query-did-not-answer: link-target',
        lastResolved: null,
      }),
    );
    expect(page).toContain('could not be established');
    expect(page).toContain('query-did-not-answer: link-target');
    expect(page).not.toContain('Zero projects');
    expect(page).toContain('No reading has ever completed');
  });

  it('a refused reading does not erase the last one that stood', () => {
    const page = renderAdoptionPage(
      run({
        checkedAt: '2026-09-01',
        thirdPartyRepos: null,
        unresolved: 'query-did-not-answer: project-name',
        lastResolved: { checkedAt: '2026-08-20', thirdPartyRepos: 3 },
      }),
    );
    expect(page).toContain('could not be established on 2026-09-01');
    expect(page).toContain('last reading that did complete found **3** on 2026-08-20');
  });

  it('names the repositories when there are some', () => {
    const page = renderAdoptionPage(
      run({ thirdPartyRepos: 1, sightings: [sighting()], candidates: 1 }),
    );
    expect(page).toContain('1 project(s) outside this repository display the badge');
    expect(page).toContain('https://github.com/someone/their-server');
  });

  it('publishes the queries it ran, so a reader can run them too', () => {
    const page = renderAdoptionPage(
      run({ queries: adoptionQueries().map((d) => ({ ...d, state: 'ok' as const, hits: 0 })) }),
    );
    for (const q of adoptionQueries())
      expect(page).toContain(q.q.replace(/[|`[\]<>]/g, (c) => `\\${c}`));
  });

  it('says what it cannot see', () => {
    const page = renderAdoptionPage(run());
    expect(page).toContain('What this cannot see');
    expect(page).toContain('private repositories');
  });

  it('never shortens a file link, however long the path', () => {
    const url =
      'https://github.com/someone/their-server/blob/' +
      'a'.repeat(40) +
      '/' +
      'd/'.repeat(60) +
      'file.md';
    const page = renderAdoptionPage(run({ thirdPartyRepos: 1, sightings: [sighting({ url })] }));
    expect(page).toContain(`(${url})`);
  });

  it('escapes markdown table syntax in third-party paths', () => {
    const page = renderAdoptionPage(
      run({ thirdPartyRepos: 1, sightings: [sighting({ path: 'a|b`c.md' })] }),
    );
    expect(page).toContain('a\\|b\\`c.md');
  });
});

describe('parseAdoption', () => {
  it('round-trips a run', () => {
    const r = run({ sightings: [sighting()], thirdPartyRepos: 1 });
    expect(parseAdoption(JSON.stringify(r))).toEqual(r);
  });

  it('yields null rather than throwing on anything malformed', () => {
    expect(parseAdoption('{')).toBe(null);
    expect(parseAdoption('{"checkedAt":"2026-08-20"}')).toBe(null);
    expect(parseAdoption('null')).toBe(null);
  });

  it('reads a refused count as refused, never as zero', () => {
    const parsed = parseAdoption(
      JSON.stringify(run({ thirdPartyRepos: null, unresolved: 'no-query-was-run' })),
    );
    expect(parsed?.thirdPartyRepos).toBe(null);
    expect(parsed?.unresolved).toBe('no-query-was-run');
  });
});
