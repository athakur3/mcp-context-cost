/**
 * The rules behind a registry scan, offline and under test. The part that
 * talks to the network is `tools/scan-registry.ts`; this module is what it
 * applies to whatever the network returned.
 *
 * The 2026-09-04 expansion of `servers.yaml` — the block opening "REGISTRY
 * LONG-TAIL EXPANSION (2026-09-04)" — was produced by a script that was never
 * committed. The comment above that block is the whole record of the method:
 * scan the official registry, rank the npm/PyPI stdio packages by weekly
 * downloads, check provenance by org and repo, append. A method that exists
 * only as a comment cannot be re-run, and a count it states ("14,283 distinct
 * active servers") cannot be reproduced. This is that scan, written down.
 *
 * Two things it deliberately is not.
 *
 * It is not a provenance rule. The comment says the entries were
 * "provenance-checked by org and repo", but no rule for that check is recorded
 * anywhere in the repository — the reasons for what was left out were written
 * in a scratchpad, not here. So a candidate carries the two strings that
 * judgment compared, `nameOwner` (the `<owner>` in an `io.github.<owner>/…`
 * registry name, null for the reverse-DNS names that make up a large share of
 * the registry) and `repoOwner` (the first path segment of `repository.url`),
 * and nothing else: no `ownersAgree`, no verdict. The comparison is a human
 * step, and the expansion commit that uses this output is where it is
 * recorded.
 *
 * It is not a source of entries, only of drafts. A registry package id does
 * not reveal how the server is launched: `agent-device` needs `mcp`,
 * `githits` needs `mcp start`, `emailmd` needs `mcp`, `hana-cli` ships a
 * separate `hana-cli-mcp` bin, and `@ankimcp/anki-mcp-server` serves HTTP
 * unless told `--stdio` (servers.yaml, the comments beside each). Most records
 * carry no `runtimeHint`, so most draft commands are the `npx -y <pkg>` /
 * `uvx <pkg>` guess, which is exactly the class those five belonged to.
 * `draftEntry` therefore marks a guessed command as guessed, and every draft is
 * probed by the harness before it becomes a row.
 *
 * What the registry actually does, verified live on 2026-09-05 and pinned in
 * `test/fixtures/registry/`: `GET /v0/servers?version=latest` returns one row
 * per name — the server does the dedupe, so none is done here — but among
 * those rows are `deprecated` ones, so the client still filters on
 * `_meta['io.modelcontextprotocol.registry/official'].status`. `limit` is
 * capped at 100 (500 is answered 422). `metadata.nextCursor` is a
 * `name:version` string and is absent on the last page.
 */
import type { ServerEntry } from './report.js';
import { formatProblems, validateEntry } from './servers-schema.js';

export const SCAN_METHOD = 'registry-scan/1';
export const REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0/servers';
/** The largest `limit` the registry accepts; a larger one is answered 422. */
export const REGISTRY_PAGE_LIMIT = 100;
/**
 * Names per npm bulk lookup. The live response to a 130-name request is
 * `{"error":"exceeded max bulk size of 128"}` (test/fixtures/registry/npm-bulk-130.json).
 */
export const NPM_BULK_LIMIT = 128;

/** The `_meta` key the registry files its own status under. */
export const OFFICIAL_META = 'io.modelcontextprotocol.registry/official';

export interface RegistryArgument {
  type?: string;
  name?: string;
  value?: string;
  valueHint?: string;
  isRequired?: boolean;
  description?: string;
}

export interface RegistryEnvironmentVariable {
  name: string;
  isRequired?: boolean;
  isSecret?: boolean;
  description?: string;
}

export interface RegistryPackage {
  registryType: string;
  identifier: string;
  version?: string;
  runtimeHint?: string;
  runtimeArguments?: RegistryArgument[];
  packageArguments?: RegistryArgument[];
  transport?: { type?: string };
  environmentVariables?: RegistryEnvironmentVariable[];
}

export interface RegistryRecord {
  server: {
    name: string;
    version: string;
    title?: string;
    description?: string;
    repository?: { url: string; source?: string; subfolder?: string };
    packages?: RegistryPackage[];
    remotes?: { type: string; url: string }[];
  };
  _meta?: {
    [OFFICIAL_META]?: { status?: string; isLatest?: boolean; publishedAt?: string; updatedAt?: string };
  };
}

export interface RegistryPage {
  servers: RegistryRecord[];
  metadata?: { nextCursor?: string; count?: number };
}

export interface WalkResult {
  records: RegistryRecord[];
  pages: number;
  /** True when the walk did not cover the whole registry: a page cap stopped it, or it started from a cursor. */
  truncated: boolean;
  /** The cursor the walk started from, when it did not start at the beginning. */
  startedAt?: string;
  /** Where a truncated walk would resume; absent when the last page was reached. */
  lastCursor?: string;
}

/**
 * Page through `version=latest` until the registry stops handing out a cursor.
 *
 * The fetch is a parameter so the walk itself is under test: the loop that
 * decides when to stop, and whether stopping early is *said*, is the part that
 * would otherwise live only in the script nothing imports. `measure-adoption.ts`
 * has the same MAX_PAGES rule and no test holds it.
 *
 * `truncated` is never silent. It is true whenever the records do not cover
 * the whole registry — the page cap fired while a next cursor was still
 * present, or the walk was resumed from a cursor and so never saw what came
 * before it. `lastCursor` is where to resume.
 */
export async function walkLatest(
  fetchPage: (cursor?: string) => Promise<RegistryPage>,
  opts: { maxPages?: number; cursor?: string } = {},
): Promise<WalkResult> {
  const records: RegistryRecord[] = [];
  const startedAt = opts.cursor;
  let cursor = opts.cursor;
  let pages = 0;
  for (;;) {
    if (opts.maxPages !== undefined && pages >= opts.maxPages) {
      return { records, pages, truncated: true, ...(startedAt ? { startedAt } : {}), ...(cursor ? { lastCursor: cursor } : {}) };
    }
    const page = await fetchPage(cursor);
    pages++;
    records.push(...(page.servers ?? []));
    const next = page.metadata?.nextCursor;
    if (!next) return { records, pages, truncated: startedAt !== undefined, ...(startedAt ? { startedAt } : {}) };
    // A cursor that does not advance would page forever; say so instead.
    if (next === cursor) throw new Error(`registry returned the cursor it was given (${next}); refusing to loop`);
    cursor = next;
  }
}

export function isActive(record: RegistryRecord): boolean {
  return record._meta?.[OFFICIAL_META]?.status === 'active';
}

export function distinctNames(records: RegistryRecord[]): number {
  return new Set(records.map((r) => r.server.name)).size;
}

/** The `<owner>` of an `io.github.<owner>/…` name; null for every other namespace. */
export function registryNameOwner(name: string): string | null {
  const m = /^io\.github\.([^/]+)\//.exec(name);
  return m ? m[1]! : null;
}

/** The first path segment of a repository URL — the GitHub org or user — verbatim, or null. */
export function repositoryOwner(url: string | undefined): string | null {
  if (!url) return null;
  const m = /^https?:\/\/[^/]+\/([^/?#]+)\/[^/?#]+/.exec(url);
  return m ? m[1]! : null;
}

export type PackageRegistry = 'npm' | 'pypi';

export interface ScanCandidate {
  registryName: string;
  version: string;
  description?: string;
  registry: PackageRegistry;
  pkg: string;
  packageVersion?: string;
  runtimeHint?: string;
  runtimeArguments?: RegistryArgument[];
  packageArguments?: RegistryArgument[];
  environmentVariables: RegistryEnvironmentVariable[];
  repositoryUrl: string | null;
  /** The two strings the provenance judgment compares. Emitted, not compared. */
  nameOwner: string | null;
  repoOwner: string | null;
}

export function metricKey(registry: PackageRegistry, pkg: string): string {
  return `${registry}:${pkg}`;
}

/** The `package:` spellings that name a package, as opposed to a docker image, a git URL or a remote. */
const PACKAGE_ID = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;
const PYPI_SUFFIX = / \(PyPI\)$/;

/**
 * Registry-qualified keys for every package `servers.yaml` already names.
 *
 * `package:` is free text in the file. Beside plain npm names and the
 * `<name> (PyPI)` spelling it holds `ghcr.io/… (docker)`, `git+https://…`,
 * `remote via mcp-remote bridge (no auth)` and `remote (Streamable HTTP,
 * OAuth)`; none of those is a package this scan could find, so none is added.
 * The keys are qualified by registry because one string can name two
 * packages — `basic-memory` on PyPI is not `basic-memory` on npm — and the
 * PyPI suffix is the only thing that tells them apart.
 */
export function trackedPackages(doc: unknown): Set<string> {
  const tracked = new Set<string>();
  const servers = (doc as { servers?: unknown[] } | null)?.servers;
  if (!Array.isArray(servers)) return tracked;
  for (const raw of servers) {
    const pkg = (raw as { package?: unknown } | null)?.package;
    if (typeof pkg !== 'string') continue;
    const isPypi = PYPI_SUFFIX.test(pkg);
    const id = pkg.replace(PYPI_SUFFIX, '').trim();
    if (!PACKAGE_ID.test(id)) continue;
    tracked.add(metricKey(isPypi ? 'pypi' : 'npm', id));
  }
  return tracked;
}

export function alreadyTracked(registry: PackageRegistry, pkg: string, tracked: Set<string>): boolean {
  return tracked.has(metricKey(registry, pkg));
}

function isCandidatePackage(p: RegistryPackage): p is RegistryPackage & { registryType: PackageRegistry } {
  return (p.registryType === 'npm' || p.registryType === 'pypi') && p.transport?.type === 'stdio';
}

/**
 * One candidate per untracked npm/PyPI stdio package on an active record.
 *
 * A package listed by two registry names is one package; the first record to
 * name it wins and the second is dropped, so the download lookup is made once
 * and the draft is drafted once. Records with only `remotes`, or only `oci`
 * packages, contribute nothing: this harness measures what `npx`/`uvx` can
 * start, and a remote endpoint or a container image is a different entry
 * shape a human writes by hand.
 */
export function candidatesFrom(records: RegistryRecord[], tracked: Set<string>): ScanCandidate[] {
  const seen = new Set<string>();
  const out: ScanCandidate[] = [];
  for (const r of records) {
    if (!isActive(r)) continue;
    const s = r.server;
    for (const p of s.packages ?? []) {
      if (!isCandidatePackage(p)) continue;
      if (typeof p.identifier !== 'string' || p.identifier === '') continue;
      const key = metricKey(p.registryType, p.identifier);
      if (alreadyTracked(p.registryType, p.identifier, tracked) || seen.has(key)) continue;
      seen.add(key);
      out.push({
        registryName: s.name,
        version: s.version,
        ...(s.description ? { description: s.description } : {}),
        registry: p.registryType,
        pkg: p.identifier,
        ...(p.version ? { packageVersion: p.version } : {}),
        ...(p.runtimeHint ? { runtimeHint: p.runtimeHint } : {}),
        ...(p.runtimeArguments?.length ? { runtimeArguments: p.runtimeArguments } : {}),
        ...(p.packageArguments?.length ? { packageArguments: p.packageArguments } : {}),
        environmentVariables: p.environmentVariables ?? [],
        repositoryUrl: s.repository?.url ?? null,
        nameOwner: registryNameOwner(s.name),
        repoOwner: repositoryOwner(s.repository?.url),
      });
    }
  }
  return out;
}

/**
 * Which names go to which npm endpoint. The bulk endpoint refuses a scoped
 * name outright — `{"error":"scoped packages are not currently supported in
 * bulk lookups"}`, recorded live — so scoped names each get a single lookup,
 * and unscoped names are chunked at the bulk ceiling.
 */
export function splitForNpm(names: string[]): { bulk: string[][]; single: string[] } {
  const single = names.filter((n) => n.startsWith('@'));
  const unscoped = names.filter((n) => !n.startsWith('@'));
  const bulk: string[][] = [];
  for (let i = 0; i < unscoped.length; i += NPM_BULK_LIMIT) bulk.push(unscoped.slice(i, i + NPM_BULK_LIMIT));
  return { bulk, single };
}

function downloads(v: unknown): number | null {
  const d = (v as { downloads?: unknown } | null)?.downloads;
  return typeof d === 'number' && Number.isFinite(d) ? d : null;
}

/**
 * The bulk shape is a map keyed by package name; an unknown name maps to
 * `null` (live: `"no-such-package-…":null` beside two real rows). Null is
 * "no figure", never zero — a zero would rank the package, a null keeps it
 * out of the drafted set with a reason.
 */
export function parseNpmBulk(body: unknown): Map<string, number | null> {
  const out = new Map<string, number | null>();
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return out;
  if ('error' in body) throw new Error(`npm bulk lookup: ${String((body as { error: unknown }).error)}`);
  for (const [name, v] of Object.entries(body)) out.set(name, downloads(v));
  return out;
}

/** The single shape is flat `{downloads, start, end, package}`; a 404 body is `{error}` and reads as no figure. */
export function parseNpmSingle(body: unknown): number | null {
  return downloads(body);
}

/** pypistats `recent`: `{data:{last_day,last_month,last_week},package,type}`. Anything else is no figure. */
export function parsePypi(body: unknown): number | null {
  const week = (body as { data?: { last_week?: unknown } } | null)?.data?.last_week;
  return typeof week === 'number' && Number.isFinite(week) ? week : null;
}

/**
 * The name pypistats keys a package by: PEP 503 normalised, so runs of `.`,
 * `_` and `-` become one `-`. `servers.yaml` already cites it that way — the
 * `aws-documentation` row's package is `awslabs.aws-documentation-mcp-server`
 * and its source is `pypistats.org/packages/awslabs-aws-documentation-mcp-server`
 * — and the test that compares every row against `metricSourceFor` is what
 * found the difference.
 */
export function pypiName(pkg: string): string {
  return pkg.toLowerCase().replace(/[-_.]+/g, '-');
}

/**
 * The citation forms `servers.yaml` uses, base form only. Some rows carry a
 * suffix after the form (`npm weekly; uses ~/.kube/config`, `npm weekly,
 * 2026-08-09..15`); those are the human's note and are not generated here.
 * PyPI cites the HTML page, not the API URL the figure was read from, because
 * that is what every PyPI row in the file cites.
 */
export function metricSourceFor(registry: PackageRegistry, pkg: string): string {
  return registry === 'npm'
    ? `https://api.npmjs.org/downloads/point/last-week/${pkg} (npm weekly)`
    : `https://pypistats.org/packages/${pypiName(pkg)} (PyPI weekly)`;
}

export type Draft = { entry: ServerEntry; commandGuessed: boolean; optionalEnv: string[] } | { refused: string };

interface RenderedArgument {
  text: string;
  placeholder: boolean;
}

function renderArgument(a: RegistryArgument): RenderedArgument {
  if (a.type === 'named' && a.name) {
    if (a.value !== undefined) return { text: `${a.name} ${a.value}`, placeholder: false };
    return { text: `${a.name} <${a.valueHint ?? 'value'}>`, placeholder: true };
  }
  if (a.value !== undefined) return { text: a.value, placeholder: false };
  return { text: `<${a.valueHint ?? a.name ?? 'value'}>`, placeholder: true };
}

/**
 * The launch line, and whether it is a guess.
 *
 * With a `runtimeHint` and `runtimeArguments` the record says how it is run
 * (`npx -y keyblind` then `start`, live) and the draft repeats it. With a hint
 * alone the draft is the conventional line for that runtime. With neither —
 * most records — it is `npx -y <pkg>` / `uvx <pkg>`, and `guessed` is true so
 * the operator can see which drafts are the class that needed a subcommand.
 * A required argument the registry only describes (`<project_root>`) is left
 * as a placeholder, which also marks the command guessed: it cannot run as
 * written.
 */
export function draftCommand(c: ScanCandidate): { command: string; guessed: boolean } {
  const runtime = (c.runtimeArguments ?? []).map(renderArgument);
  const pkgArgs = (c.packageArguments ?? []).map(renderArgument);
  let guessed = [...runtime, ...pkgArgs].some((a) => a.placeholder);
  let parts: string[];
  const conventional = c.registry === 'npm' ? ['npx', '-y', c.pkg] : ['uvx', c.pkg];
  if (c.runtimeHint && runtime.length) {
    parts = [c.runtimeHint, ...runtime.map((a) => a.text)];
    if (!parts.includes(c.pkg)) parts.push(c.pkg);
  } else if (c.runtimeHint === 'npx' && c.registry === 'npm') {
    parts = conventional;
  } else if (c.runtimeHint === 'uvx' && c.registry === 'pypi') {
    parts = conventional;
  } else {
    parts = conventional;
    guessed = true;
  }
  return { command: [...parts, ...pkgArgs.map((a) => a.text)].join(' '), guessed };
}

/**
 * A slug for `name`, from the package's own basename. It becomes
 * `results/<name>/` and the rest, so it has to satisfy the schema's NAME rule;
 * the schema, not a copy of its regex, is what checks it below. The operator
 * renames on collision — the scan does not read the file's names, only its
 * packages.
 */
export function draftName(pkg: string): string {
  const base = pkg.startsWith('@') ? pkg.slice(pkg.indexOf('/') + 1) : pkg;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '');
}

/**
 * A draft entry in the shape `servers.yaml` takes, or a refusal that says why.
 *
 * Total over its input by design. Drawn from live records, drafts fail the
 * schema for ordinary reasons — about half the records on a page carry no
 * `repository.url`, a package nobody downloads has no figure, and an env
 * name like `2Captcha_API_KEY` (live) is not a variable name a shell accepts.
 * Each of those is a fact worth printing beside the candidate, not a crash
 * and not a row with a field quietly missing; so the refusal carries the
 * reason, and the ranked output lists refused candidates alongside drafted
 * ones.
 *
 * `env` lists the variables the record marks required; the others are carried
 * beside the draft as `optionalEnv`, because docker mode injects a placeholder
 * for every listed name and a placeholder port or URL is the class of failure
 * `envValues` exists to undo (servers.yaml, the `hevy` and `keboola` comments).
 */
export function draftEntry(c: ScanCandidate, metric: number | null): Draft {
  if (metric === null) return { refused: 'no weekly-download figure — the endpoint returned no number for this package' };
  if (!c.repositoryUrl) return { refused: 'no repository.url on the registry record' };
  const { command, guessed } = draftCommand(c);
  const required = c.environmentVariables.filter((e) => e.isRequired === true).map((e) => e.name);
  const optionalEnv = c.environmentVariables.filter((e) => e.isRequired !== true).map((e) => e.name);
  const entry: ServerEntry = {
    name: draftName(c.pkg),
    command,
    package: c.registry === 'pypi' ? `${c.pkg} (PyPI)` : c.pkg,
    env: required,
    metric,
    metricSource: metricSourceFor(c.registry, c.pkg),
    category: 'community',
    repo: c.repositoryUrl,
  };
  const problems = validateEntry(entry, 0);
  if (problems.length) return { refused: formatProblems(problems) };
  return { entry, commandGuessed: guessed, optionalEnv };
}

export interface RankedCandidate extends ScanCandidate {
  metric: number | null;
  metricSource: string;
  draft: Draft;
}

/**
 * Rank by weekly downloads, unmetered last, and draft each one. `metrics` is
 * keyed by `metricKey`; a candidate the lookup never reached reads as null.
 */
export function rankCandidates(candidates: ScanCandidate[], metrics: Map<string, number | null>): RankedCandidate[] {
  const ranked = candidates.map((c) => {
    const metric = metrics.get(metricKey(c.registry, c.pkg)) ?? null;
    return { ...c, metric, metricSource: metricSourceFor(c.registry, c.pkg), draft: draftEntry(c, metric) };
  });
  ranked.sort((a, b) => {
    if (a.metric === null && b.metric === null) return a.pkg.localeCompare(b.pkg);
    if (a.metric === null) return 1;
    if (b.metric === null) return -1;
    return b.metric - a.metric || a.pkg.localeCompare(b.pkg);
  });
  return ranked;
}

export interface ScanOutput {
  method: string;
  scannedAt: string;
  registry: string;
  pages: number;
  truncated: boolean;
  startedAt?: string;
  lastCursor?: string;
  records: number;
  distinctLatest: number;
  active: number;
  candidates: number;
  drafted: number;
  refused: number;
  elapsedSeconds: number;
  provenance: string;
  ranked: RankedCandidate[];
}

export const PROVENANCE_NOTE =
  'nameOwner and repoOwner are the two strings the provenance judgment compares; the judgment is made by a person and recorded in the expansion commit, not here.';

export function assembleScan(
  walk: WalkResult,
  ranked: RankedCandidate[],
  meta: { scannedAt: string; elapsedSeconds: number },
): ScanOutput {
  return {
    method: SCAN_METHOD,
    scannedAt: meta.scannedAt,
    registry: REGISTRY_URL,
    pages: walk.pages,
    truncated: walk.truncated,
    ...(walk.startedAt ? { startedAt: walk.startedAt } : {}),
    ...(walk.lastCursor ? { lastCursor: walk.lastCursor } : {}),
    records: walk.records.length,
    distinctLatest: distinctNames(walk.records),
    active: walk.records.filter(isActive).length,
    candidates: ranked.length,
    drafted: ranked.filter((r) => 'entry' in r.draft).length,
    refused: ranked.filter((r) => 'refused' in r.draft).length,
    elapsedSeconds: meta.elapsedSeconds,
    provenance: PROVENANCE_NOTE,
    ranked,
  };
}

/** The one line an expansion commit quotes. Every number in it is in the JSON beside it. */
export function summaryLine(scan: ScanOutput): string {
  const cover = scan.truncated ? ` (TRUNCATED${scan.lastCursor ? `, resume at ${scan.lastCursor}` : ''})` : '';
  return (
    `registry scan ${scan.scannedAt.slice(0, 10)}: ${scan.pages} page(s)${cover}, ` +
    `${scan.distinctLatest} distinct latest name(s), ${scan.active} active, ` +
    `${scan.candidates} npm/pypi stdio package(s) not yet tracked, ` +
    `${scan.drafted} drafted, ${scan.refused} refused, ${scan.elapsedSeconds}s`
  );
}
