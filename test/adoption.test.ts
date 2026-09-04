import { describe, it, expect } from 'vitest';
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
  parseAdoption,
  renderAdoptionPage,
  resolveCount,
  type AdoptionRun,
  type QueryResult,
  type Sighting,
} from '../src/core/adoption.js';
import { readmeSnippet } from '../src/core/snippet.js';

const RAW = 'https://raw.githubusercontent.com/athakur3/mcp-context-cost/main/badges/my-server.json';
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
    expect(encoded?.q).toContain('raw.githubusercontent.com%2Fathakur3%2Fmcp-context-cost%2Fmain%2Fbadges');
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

  it('does not count somebody else\'s shields endpoint badge', () => {
    const md =
      '[![build](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fother%2Frepo%2Fmain%2Fbadges%2Fx.json)](https://example.com)';
    expect(classifyFile(md)).toBe(null);
  });

  it('separates naming the project from displaying its badge', () => {
    expect(classifyFile('We measured this with mcp-context-cost.')).toBe('mention');
    expect(classifyFile(`See ${PAGE} for the numbers.`)).toBe('mention');
  });

  it('returns null when the file no longer mentions the project at all', () => {
    expect(classifyFile('# Some other README\n\nNothing to do with it.')).toBe(null);
  });

  it('ignores case, because the search that found the file ignores it too', () => {
    // Observed on the first real run: a file discussing "MCP-context-cost".
    expect(classifyFile('the 55K-token MCP-context-cost concrete number')).toBe('mention');
    const md = `[![context cost](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FAThakur3%2FMCP-Context-Cost%2Fmain%2Fbadges%2Fx.json)](${PAGE})`;
    expect(classifyFile(md)).toBe('badge');
  });
});

describe('the badge forms this project actually publishes', () => {
  // Every snippet the project ships is addressed to an author measuring their
  // own server, so every one of them points shields at the author's own JSON.
  // A rule that only counted JSON served from here would publish a zero about a
  // spelling nobody was told to write.
  const OWN = 'https://raw.githubusercontent.com/someone/their-server/main/badges/their-server.json';
  const METHODOLOGY = 'https://athakur3.github.io/mcp-context-cost/METHODOLOGY.html';

  it('counts README.md\'s snippet: the author\'s own badges/ JSON, linked back here', () => {
    expect(classifyFile(readmeSnippet(OWN, PAGE))).toBe('badge');
    expect(classifyFile(readmeSnippet(OWN, METHODOLOGY))).toBe('badge');
  });

  it('counts the dashboard\'s snippet written by hand, unencoded', () => {
    expect(classifyFile(`[![context cost](https://img.shields.io/endpoint?url=${OWN})](${METHODOLOGY})`)).toBe(
      'badge',
    );
  });

  it('does not count an unrelated endpoint badge that merely links here', () => {
    // The self-hosted branch once accepted the link and looked at nothing else,
    // so any shields endpoint badge wrapped in a link to this project counted —
    // inflating the one number this project keeps about itself.
    const coverage = `[![coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fcodecov.example.com%2Fapi%2Fshield.json)](${METHODOLOGY})`;
    expect(classifyFile(coverage)).toBe('mention');
  });

  it('reads the badge\'s own label tolerantly, since the URL cannot decide it', () => {
    const gist = 'https://gist.githubusercontent.com/someone/abc123/raw/badge.json';
    expect(classifyFile(`[![Context-Cost](https://img.shields.io/endpoint?url=${gist})](${METHODOLOGY})`)).toBe('badge');
  });

  it('counts the staged action\'s gist badge, which has no badges/ segment at all', () => {
    const gist = 'https://gist.githubusercontent.com/someone/abc123/raw/badge.json';
    expect(classifyFile(`[![context cost](https://img.shields.io/endpoint?url=${gist})](${METHODOLOGY})`)).toBe(
      'badge',
    );
  });

  it('counts an HTML anchor wrapping the image, which READMEs also use', () => {
    const html = `<a href="${PAGE}"><img src="https://img.shields.io/endpoint?url=${encodeURIComponent(OWN)}" alt="context cost"></a>`;
    expect(classifyFile(html)).toBe('badge');
  });

  it('still counts a badge served from this repository, however it is linked', () => {
    expect(classifyFile(`![context cost](https://img.shields.io/endpoint?url=${encodeURIComponent(RAW)})`)).toBe(
      'badge',
    );
  });

  it('leaves a self-hosted badge that links back to nothing outside the count', () => {
    // The one shape the page says it cannot see, stated there and true here.
    expect(classifyFile(`[![context cost](https://img.shields.io/endpoint?url=${OWN})](https://example.com)`)).toBe(
      null,
    );
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
  it('excludes this project\'s own repositories, case-insensitively', () => {
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
    const previous = [sighting({ repo: 'gone/away', firstSeenAt: '2026-08-01', lastSeenAt: '2026-08-01' })];
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
    const merged = mergeSightings([], [sighting(), sighting({ path: 'docs/index.md' })], '2026-08-20');
    expect(merged).toHaveLength(2);
    expect(badgeRepos(merged, '2026-08-20')).toEqual(['someone/their-server']);
  });
});

describe('resolveCount', () => {
  it('publishes a zero only when every query answered', () => {
    expect(resolveCount([query()], [], '2026-08-20')).toEqual({ thirdPartyRepos: 0, unresolved: null });
  });

  it('refuses a number when a query did not answer', () => {
    const r = resolveCount([query(), query({ name: 'link-target', state: 'failed', hits: null, error: 'HTTP 403' })], [], '2026-08-20');
    expect(r.thirdPartyRepos).toBe(null);
    expect(r.unresolved).toContain('link-target');
  });

  it('refuses a number when a query had more results than were collected', () => {
    const r = resolveCount([query({ name: 'project-name', hits: 900, truncated: true })], [], '2026-08-20');
    expect(r.thirdPartyRepos).toBe(null);
    expect(r.unresolved).toContain('more-results-than-collected');
  });

  it('refuses a number when a candidate could not be read', () => {
    const r = resolveCount([query()], [], '2026-08-20', 1);
    expect(r.thirdPartyRepos).toBe(null);
    expect(r.unresolved).toContain('candidate-could-not-be-read');
  });

  it('refuses a number when nothing was asked at all', () => {
    expect(resolveCount([], [], '2026-08-20')).toEqual({ thirdPartyRepos: null, unresolved: 'no-query-was-run' });
  });

  it('counts the badges and not the mentions', () => {
    const sightings = [sighting(), sighting({ repo: 'talker/blog', path: 'post.md', kind: 'mention' })];
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
      run({ candidates: 3, sightings: [sighting({ kind: 'mention' })], queries: [query({ hits: 3 })] }),
    );
    expect(page).toContain('Zero projects outside this repository display the badge');
    expect(page).toContain('2026-08-20');
    expect(page).toContain('That zero was looked for');
    expect(page).toContain('names the project, no badge');
  });

  it('publishes no number when the reading was refused, and says why', () => {
    const page = renderAdoptionPage(
      run({ thirdPartyRepos: null, unresolved: 'query-did-not-answer: link-target', lastResolved: null }),
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
    const page = renderAdoptionPage(run({ thirdPartyRepos: 1, sightings: [sighting()], candidates: 1 }));
    expect(page).toContain('1 project(s) outside this repository display the badge');
    expect(page).toContain('https://github.com/someone/their-server');
  });

  it('publishes the queries it ran, so a reader can run them too', () => {
    const page = renderAdoptionPage(run({ queries: adoptionQueries().map((d) => ({ ...d, state: 'ok' as const, hits: 0 })) }));
    for (const q of adoptionQueries()) expect(page).toContain(q.q.replace(/[|`[\]<>]/g, (c) => `\\${c}`));
  });

  it('says what it cannot see', () => {
    const page = renderAdoptionPage(run());
    expect(page).toContain('What this cannot see');
    expect(page).toContain('private repositories');
  });

  it('never shortens a file link, however long the path', () => {
    const url = 'https://github.com/someone/their-server/blob/' + 'a'.repeat(40) + '/' + 'd/'.repeat(60) + 'file.md';
    const page = renderAdoptionPage(run({ thirdPartyRepos: 1, sightings: [sighting({ url })] }));
    expect(page).toContain(`(${url})`);
  });

  it('escapes markdown table syntax in third-party paths', () => {
    const page = renderAdoptionPage(run({ thirdPartyRepos: 1, sightings: [sighting({ path: 'a|b`c.md' })] }));
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
    const parsed = parseAdoption(JSON.stringify(run({ thirdPartyRepos: null, unresolved: 'no-query-was-run' })));
    expect(parsed?.thirdPartyRepos).toBe(null);
    expect(parsed?.unresolved).toBe('no-query-was-run');
  });
});
