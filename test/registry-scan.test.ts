import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { TSX_CLI } from './tsx.js';
import { validateEntry } from '../src/sweep/servers-schema.js';
import {
  NPM_BULK_LIMIT,
  REGISTRY_URL,
  assembleScan,
  candidatesFrom,
  draftCommand,
  draftEntry,
  draftName,
  metricKey,
  metricSourceFor,
  parseNpmBulk,
  parseNpmSingle,
  parsePypi,
  rankCandidates,
  registryNameOwner,
  repositoryOwner,
  splitForNpm,
  summaryLine,
  trackedPackages,
  walkLatest,
  type RegistryPage,
  type RegistryRecord,
  type ScanCandidate,
} from '../src/sweep/registry-scan.js';

/**
 * Every fixture here is a live response, verbatim, fetched on the date
 * `sources.json` states and from the URL it names. The rules under test were
 * written against these shapes, so a fixture written by hand would only prove
 * the code agrees with the person who wrote both.
 */
const repoRoot = join(import.meta.dirname, '..');
const fixtures = join(import.meta.dirname, 'fixtures', 'registry');
const json = <T>(file: string): T => JSON.parse(readFileSync(join(fixtures, file), 'utf8')) as T;

const page1 = json<RegistryPage>('page1.json');
const page2 = json<RegistryPage>('page2.json');
const records = json<Record<string, RegistryRecord>>('records.json');
const npmBulk = json<unknown>('npm-bulk.json');
const npmBulkScoped = json<unknown>('npm-bulk-scoped.json');
const npmBulk130 = json<{ error: string }>('npm-bulk-130.json');
const npmSingleScoped = json<{ downloads: number; package: string }>('npm-single-scoped.json');
const npmSingleUnscoped = json<{ downloads: number; package: string }>('npm-single-unscoped.json');
const npmSingleMissing = json<unknown>('npm-single-missing.json');
const pypiRecent = json<{ data: { last_week: number }; package: string }>('pypi-recent.json');
const pypi429 = readFileSync(join(fixtures, 'pypi-429.html'), 'utf8');

const serversYaml = parse(readFileSync(join(repoRoot, 'servers.yaml'), 'utf8')) as {
  servers: { name: string; package?: string; metricSource?: string }[];
};

/** The registry pages, played back: the cursor each page names leads to the next, and the last page names none. */
function playback(pages: RegistryPage[]) {
  const seen: (string | undefined)[] = [];
  const byCursor = new Map<string | undefined, RegistryPage>();
  let cursor: string | undefined;
  for (const p of pages) {
    byCursor.set(cursor, p);
    cursor = p.metadata?.nextCursor;
  }
  const fetchPage = async (c?: string) => {
    seen.push(c);
    const p = byCursor.get(c);
    if (!p) throw new Error(`no page at cursor ${c}`);
    return p;
  };
  return { fetchPage, seen };
}

/** page2 with its cursor removed, which is the shape the registry sends for the last page. */
const lastPage: RegistryPage = { servers: page2.servers, metadata: { count: page2.metadata?.count } };

describe('walkLatest', () => {
  it('follows metadata.nextCursor from the start and stops when a page carries none', async () => {
    const { fetchPage, seen } = playback([page1, lastPage]);
    const walk = await walkLatest(fetchPage);
    expect(seen).toEqual([undefined, page1.metadata!.nextCursor]);
    expect(walk.pages).toBe(2);
    expect(walk.records.length).toBe(page1.servers.length + lastPage.servers.length);
    expect(walk.truncated).toBe(false);
    expect(walk.lastCursor).toBeUndefined();
    expect(walk.startedAt).toBeUndefined();
  });

  it('marks the walk truncated when the page cap stops it while a cursor is still present', async () => {
    const { fetchPage } = playback([page1, lastPage]);
    const walk = await walkLatest(fetchPage, { maxPages: 1 });
    expect(walk.pages).toBe(1);
    expect(walk.records.length).toBe(page1.servers.length);
    expect(walk.truncated).toBe(true);
    // Where to resume: the cursor the cap stopped it from following.
    expect(walk.lastCursor).toBe(page1.metadata!.nextCursor);
  });

  it('does not call a walk truncated when the cap was never reached', async () => {
    const { fetchPage } = playback([page1, lastPage]);
    const walk = await walkLatest(fetchPage, { maxPages: 10 });
    expect(walk.pages).toBe(2);
    expect(walk.truncated).toBe(false);
  });

  it('treats a walk resumed from a cursor as partial, because it is', async () => {
    const { fetchPage, seen } = playback([page1, lastPage]);
    const resume = page1.metadata!.nextCursor!;
    const walk = await walkLatest(fetchPage, { cursor: resume });
    expect(seen).toEqual([resume]);
    expect(walk.pages).toBe(1);
    expect(walk.startedAt).toBe(resume);
    expect(walk.truncated).toBe(true);
  });

  it('refuses a cursor that does not advance rather than paging forever', async () => {
    // page1 handed back for its own cursor: the registry says "next" and names where we already are.
    const stuck = async () => page1;
    await expect(walkLatest(stuck)).rejects.toThrow(/cursor it was given/);
  });
});

describe('candidatesFrom', () => {
  const none = new Set<string>();

  it('keeps only active records carrying an npm or pypi package with stdio transport', () => {
    expect(candidatesFrom([records['deprecated-latest']!], none)).toEqual([]);
    expect(candidatesFrom([records['remotes-only']!], none)).toEqual([]);
    expect(candidatesFrom([records['oci-only']!], none)).toEqual([]);

    const active = records['npm-active-runtime-hint']!;
    const out = candidatesFrom([active], none);
    expect(out.length).toBe(1);
    expect(out[0]!.pkg).toBe(active.server.packages![0]!.identifier);
    expect(out[0]!.registry).toBe('npm');
    expect(out[0]!.runtimeHint).toBe(active.server.packages![0]!.runtimeHint);
  });

  it('drops packages servers.yaml already tracks, including the " (PyPI)" spelling', () => {
    const rec = records['io-github-pypi']!;
    const id = rec.server.packages![0]!.identifier;
    const asPypi = trackedPackages({ servers: [{ package: `${id} (PyPI)` }] });
    expect(asPypi.has(metricKey('pypi', id))).toBe(true);
    expect(candidatesFrom([rec], asPypi)).toEqual([]);

    // The same string without the suffix names an npm package, which is a
    // different package: it must not un-track the PyPI one.
    const asNpm = trackedPackages({ servers: [{ package: id }] });
    expect(candidatesFrom([rec], asNpm).length).toBe(1);
  });

  it('builds the tracked set only from package spellings that name a package', () => {
    const tracked = trackedPackages(serversYaml);
    const spelled = serversYaml.servers.map((s) => s.package).filter((p): p is string => typeof p === 'string');
    const named = spelled.filter((p) => /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*( \(PyPI\))?$/i.test(p));
    const other = spelled.filter((p) => !named.includes(p));
    // The file really does carry the other spellings, or this proves nothing.
    expect(other.some((p) => p.includes('(docker)'))).toBe(true);
    expect(other.some((p) => p.startsWith('git+'))).toBe(true);
    expect(other.some((p) => p.startsWith('remote'))).toBe(true);
    expect(tracked.size).toBe(new Set(named).size);
    for (const key of tracked) expect(key).toMatch(/^(npm|pypi):/);
    for (const p of other) {
      expect(tracked.has(metricKey('npm', p))).toBe(false);
      expect(tracked.has(metricKey('pypi', p))).toBe(false);
    }
  });

  it('lists a package once when two registry names publish it', () => {
    const rec = records['npm-active-runtime-hint']!;
    const twin: RegistryRecord = { ...rec, server: { ...rec.server, name: 'io.github.someone-else/same-package' } };
    expect(candidatesFrom([rec, twin], none).length).toBe(1);
  });

  it('records the two owner strings the provenance judgment compares, and no verdict', () => {
    const agree = records['io-github-owners-agree']!;
    const [a] = candidatesFrom([agree], none);
    expect(a!.nameOwner).toBe(agree.server.name.slice('io.github.'.length).split('/')[0]);
    expect(a!.repoOwner).toBe(new URL(agree.server.repository!.url).pathname.split('/')[1]);
    expect(a!.nameOwner).toBe(a!.repoOwner);

    const differ = records['io-github-owners-differ']!;
    const [d] = candidatesFrom([differ], none);
    expect(d!.nameOwner).not.toBe(d!.repoOwner);
    expect(d!.nameOwner).not.toBeNull();
    expect(d!.repoOwner).not.toBeNull();

    // A reverse-DNS name has no io.github owner; a record without a repository has no repo owner.
    const [reverse] = candidatesFrom([records['npm-scoped']!], none);
    expect(reverse!.nameOwner).toBeNull();
    expect(reverse!.repoOwner).toBe(repositoryOwner(records['npm-scoped']!.server.repository!.url));
    const [noRepo] = candidatesFrom([records['npm-no-repository']!], none);
    expect(noRepo!.repoOwner).toBeNull();
    expect(noRepo!.repositoryUrl).toBeNull();

    for (const c of [a, d, reverse, noRepo]) {
      expect(Object.keys(c!).some((k) => /agree|verdict|provenance/i.test(k))).toBe(false);
    }
    expect(registryNameOwner('ac.inference.sh/mcp')).toBeNull();
  });
});

describe('download lookups', () => {
  it('sends scoped npm names to the single endpoint and chunks unscoped names at the bulk limit', () => {
    // The limit is the number npm states when it is exceeded, not one written here.
    const stated = Number(/max bulk size of (\d+)/.exec(npmBulk130.error)![1]);
    expect(NPM_BULK_LIMIT).toBe(stated);

    const unscoped = Array.from({ length: stated + 2 }, (_, i) => `pkg-${i}`);
    const scoped = ['@ankimcp/anki-mcp-server', '@adeu/mcp-server'];
    const { bulk, single } = splitForNpm([...scoped, ...unscoped]);
    expect(bulk.map((c) => c.length)).toEqual([stated, 2]);
    expect(single).toEqual(scoped);
    expect(bulk.flat().some((n) => n.startsWith('@'))).toBe(false);
  });

  it('parses the bulk map and reads an unknown name as no figure, never as zero', () => {
    const m = parseNpmBulk(npmBulk);
    const body = npmBulk as Record<string, { downloads: number } | null>;
    for (const [name, row] of Object.entries(body)) {
      expect(m.has(name)).toBe(true);
      expect(m.get(name)).toBe(row === null ? null : row.downloads);
    }
    expect([...m.values()].some((v) => v === null)).toBe(true);
    expect([...m.values()]).not.toContain(0);
  });

  it('refuses the bulk error shape rather than reading it as an empty map', () => {
    expect(() => parseNpmBulk(npmBulkScoped)).toThrow(/scoped packages/);
  });

  it('parses the single flat shape, scoped or not, and reads a 404 body as no figure', () => {
    expect(parseNpmSingle(npmSingleScoped)).toBe(npmSingleScoped.downloads);
    expect(parseNpmSingle(npmSingleUnscoped)).toBe(npmSingleUnscoped.downloads);
    expect(parseNpmSingle(npmSingleMissing)).toBeNull();
  });

  it('reads last_week from pypistats and nothing from the 429 body', () => {
    expect(parsePypi(pypiRecent)).toBe(pypiRecent.data.last_week);
    // The 429 is HTML, not JSON: the tool waits and retries on the status, and
    // even if the body reached the parser it would be no figure, not zero.
    expect(() => JSON.parse(pypi429)).toThrow();
    expect(parsePypi(pypi429)).toBeNull();
    expect(parsePypi({ data: {} })).toBeNull();
  });
});

describe('metricSourceFor', () => {
  it('emits the base citation forms servers.yaml uses, byte for byte', () => {
    // Base forms only: rows carrying a note after the form ("npm weekly; uses
    // ~/.kube/config") are the human's addition and are not generated.
    let compared = 0;
    for (const s of serversYaml.servers) {
      if (typeof s.package !== 'string' || typeof s.metricSource !== 'string') continue;
      const isPypi = / \(PyPI\)$/.test(s.package);
      const id = s.package.replace(/ \(PyPI\)$/, '');
      if (!/^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(id)) continue;
      if (!/ \((npm|PyPI) weekly\)$/.test(s.metricSource)) continue;
      expect(s.metricSource, s.name).toBe(metricSourceFor(isPypi ? 'pypi' : 'npm', id));
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });
});

describe('draftEntry', () => {
  const none = new Set<string>();
  const candidate = (key: string): ScanCandidate => candidatesFrom([records[key]!], none)[0]!;
  const argValues = (args: { value?: string }[] | undefined) => (args ?? []).map((a) => a.value);

  it('produces a draft the schema validator accepts from a record that says how it is run', () => {
    const rec = records['io-github-runtime-arguments']!;
    const pkg = rec.server.packages![0]!;
    const d = draftEntry(candidate('io-github-runtime-arguments'), 12);
    if (!('entry' in d)) throw new Error(d.refused);
    expect(validateEntry(d.entry, 0)).toEqual([]);
    expect(d.entry.command).toBe(
      [pkg.runtimeHint, ...argValues(pkg.runtimeArguments), ...argValues(pkg.packageArguments)].join(' '),
    );
    expect(d.commandGuessed).toBe(false);
    expect(d.entry.package).toBe(pkg.identifier);
    expect(d.entry.repo).toBe(rec.server.repository!.url);
    expect(d.entry.metric).toBe(12);
    expect(d.entry.metricSource).toBe(metricSourceFor('npm', pkg.identifier));
    expect(d.entry.category).toBe('community');
  });

  it('marks the command guessed when the record carries no runtimeHint, and lists only required env', () => {
    const rec = records['io-github-owners-agree']!;
    const pkg = rec.server.packages![0]!;
    expect(pkg.runtimeHint).toBeUndefined();
    const d = draftEntry(candidate('io-github-owners-agree'), 3);
    if (!('entry' in d)) throw new Error(d.refused);
    expect(validateEntry(d.entry, 0)).toEqual([]);
    expect(d.entry.command).toBe(`npx -y ${pkg.identifier}`);
    expect(d.commandGuessed).toBe(true);
    const vars = pkg.environmentVariables!;
    expect(d.entry.env).toEqual(vars.filter((v) => v.isRequired === true).map((v) => v.name));
    expect(d.optionalEnv).toEqual(vars.filter((v) => v.isRequired !== true).map((v) => v.name));
    expect(d.optionalEnv.length).toBeGreaterThan(0);
  });

  it('leaves a described-only argument as a placeholder and marks the command guessed', () => {
    const rec = records['io-github-package-arguments']!;
    const pkg = rec.server.packages![0]!;
    const described = pkg.packageArguments!.find((a) => a.value === undefined)!;
    const { command, guessed } = draftCommand(candidate('io-github-package-arguments'));
    expect(command).toContain(`<${described.valueHint}>`);
    expect(command.startsWith(`npx -y ${pkg.identifier}`)).toBe(true);
    expect(guessed).toBe(true);
  });

  it('drafts a PyPI package with the (PyPI) spelling and the pypistats page as its source', () => {
    const rec = records['io-github-pypi']!;
    const id = rec.server.packages![0]!.identifier;
    const d = draftEntry(candidate('io-github-pypi'), 7);
    if (!('entry' in d)) throw new Error(d.refused);
    expect(validateEntry(d.entry, 0)).toEqual([]);
    expect(d.entry.package).toBe(`${id} (PyPI)`);
    expect(d.entry.command).toBe(`uvx ${id}`);
    expect(d.entry.metricSource).toBe(`https://pypistats.org/packages/${id} (PyPI weekly)`);
  });

  it('refuses, with the reason, a candidate with no figure, no repository, or an env name the schema rejects', () => {
    const unmetered = draftEntry(candidate('io-github-runtime-arguments'), null);
    expect(unmetered).toMatchObject({ refused: expect.stringMatching(/no weekly-download figure/) });

    const noRepo = draftEntry(candidate('npm-no-repository'), 5);
    expect(noRepo).toMatchObject({ refused: expect.stringMatching(/repository\.url/) });

    const rec = records['io-github-bad-env-name']!;
    const bad = rec.server.packages![0]!.environmentVariables!.find((v) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.name))!;
    expect(bad.isRequired).toBe(true);
    const badEnv = draftEntry(candidate('io-github-bad-env-name'), 5);
    expect(badEnv).toMatchObject({ refused: expect.stringContaining(bad.name) });
  });

  it('derives the slug from the package basename, so a scoped name still validates', () => {
    const rec = records['npm-scoped']!;
    const id = rec.server.packages![0]!.identifier;
    expect(id.startsWith('@')).toBe(true);
    expect(draftName(id)).toBe(id.slice(id.indexOf('/') + 1));
    const d = draftEntry(candidate('npm-scoped'), 1);
    if (!('entry' in d)) throw new Error(d.refused);
    expect(validateEntry(d.entry, 0)).toEqual([]);
    expect(d.entry.name).not.toContain('/');
  });
});

describe('rankCandidates and the summary line', () => {
  const none = new Set<string>();
  const all = candidatesFrom(
    ['io-github-runtime-arguments', 'io-github-owners-agree', 'io-github-pypi', 'npm-no-repository'].map((k) => records[k]!),
    none,
  );

  it('ranks by weekly downloads with unmetered candidates last', () => {
    const metrics = new Map<string, number | null>([
      [metricKey(all[0]!.registry, all[0]!.pkg), 10],
      [metricKey(all[1]!.registry, all[1]!.pkg), 500],
      [metricKey(all[2]!.registry, all[2]!.pkg), null],
      // all[3] never looked up
    ]);
    const ranked = rankCandidates(all, metrics);
    expect(ranked.map((r) => r.metric)).toEqual([500, 10, null, null]);
    expect(ranked[0]!.pkg).toBe(all[1]!.pkg);
    expect(ranked.filter((r) => 'entry' in r.draft).length).toBe(2);
    expect(ranked.filter((r) => 'refused' in r.draft).length).toBe(2);
  });

  it('states every count in the JSON and says when the walk was truncated', async () => {
    const { fetchPage } = playback([page1, lastPage]);
    const walk = await walkLatest(fetchPage, { maxPages: 1 });
    const ranked = rankCandidates(all, new Map());
    const scan = assembleScan(walk, ranked, { scannedAt: '2026-09-05T00:00:00.000Z', elapsedSeconds: 3 });
    expect(scan.records).toBe(page1.servers.length);
    expect(scan.distinctLatest).toBe(new Set(page1.servers.map((r) => r.server.name)).size);
    expect(scan.active).toBe(page1.servers.filter((r) => r._meta!['io.modelcontextprotocol.registry/official']!.status === 'active').length);
    expect(scan.candidates).toBe(all.length);
    expect(scan.drafted + scan.refused).toBe(scan.candidates);
    expect(scan.provenance).toMatch(/judgment/);

    const line = summaryLine(scan);
    expect(line).toContain('TRUNCATED');
    expect(line).toContain(walk.lastCursor!);
    for (const n of [scan.pages, scan.distinctLatest, scan.active, scan.candidates, scan.drafted, scan.refused]) {
      expect(line).toContain(String(n));
    }
    expect(line).toContain('2026-09-05');

    const whole = assembleScan({ ...walk, truncated: false, lastCursor: undefined }, ranked, { scannedAt: scan.scannedAt, elapsedSeconds: 3 });
    expect(summaryLine(whole)).not.toContain('TRUNCATED');
  });
});

/**
 * The script is the part nothing imports, so what it may write is asserted on
 * its text — the way workflows.test.ts anchors on the `run:` lines a job
 * executes — and what it refuses is asserted by running it, which costs
 * nothing because the refusals come before any network call.
 */
describe('tools/scan-registry.ts', () => {
  const script = join(repoRoot, 'tools', 'scan-registry.ts');
  const source = readFileSync(script, 'utf8');

  it('writes exactly one file, at the path --out names', () => {
    expect(source).toMatch(/const outArg = arg\('out'\)/);
    expect(source).toMatch(/const out = resolve\(root, outArg\)/);
    const writes = source.match(/writeFileSync\(/g) ?? [];
    expect(writes.length).toBe(1);
    expect(source).toMatch(/writeFileSync\(out,/);
    expect(source).not.toMatch(/appendFileSync|createWriteStream|\bwriteFile\(|copyFileSync|renameSync/);
  });

  const run = (args: string[]) => {
    try {
      execFileSync(process.execPath, [TSX_CLI, script, ...args], { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' });
      return { status: 0, stderr: '' };
    } catch (e) {
      const err = e as { status: number; stderr: string };
      return { status: err.status, stderr: err.stderr };
    }
  };

  it('refuses to run without --out', () => {
    const r = run([]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--out');
  });

  it('refuses an --out under results/, badges/ or docs/', () => {
    for (const dir of ['results', 'badges', 'docs']) {
      const r = run(['--out', `${dir}/scan.json`]);
      expect(r.status, dir).toBe(2);
      expect(r.stderr).toContain(`${dir}/`);
    }
  });

  it('is what the npm script runs', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['scan-registry']).toBe('tsx tools/scan-registry.ts');
  });
});

describe('the live registry', () => {
  it('still serves one page in the shape the fixtures record', async (ctx) => {
    // One page, never the crawl. Offline is a skip, not a failure: this proves
    // the fixtures are not stale, and nothing about the code when there is no
    // network to prove it against.
    const fetchPage = async (cursor?: string): Promise<RegistryPage> => {
      const url = new URL(REGISTRY_URL);
      url.searchParams.set('version', 'latest');
      url.searchParams.set('limit', '5');
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url, { headers: { 'user-agent': 'mcp-context-cost-scan-test' }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as RegistryPage;
    };
    let walk;
    try {
      walk = await walkLatest(fetchPage, { maxPages: 1 });
    } catch (e) {
      ctx.skip(`registry unreachable: ${(e as Error).message}`);
      return;
    }
    expect(walk.pages).toBe(1);
    expect(walk.truncated).toBe(true);
    expect(walk.lastCursor).toMatch(/:/);
    expect(walk.records.length).toBeGreaterThan(0);
    for (const r of walk.records) {
      expect(typeof r.server.name).toBe('string');
      expect(typeof r._meta?.['io.modelcontextprotocol.registry/official']?.status).toBe('string');
    }
  });
});
