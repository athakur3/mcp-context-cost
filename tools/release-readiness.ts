/**
 * Is the tree in a state a release could be cut from?
 *
 * Two guards already stand at publish time — the version asked for must match
 * `package.json`, and the changelog must have a section for it — and neither
 * has ever failed. Everything that has actually gone wrong got past them,
 * because it was not a broken build but a true-looking sentence: a page
 * quoting a number the data had moved past, a baseline README stated from
 * memory, a whole phase of work missing from the changelog.
 *
 * So this asks the questions those guards do not, and it runs on every push
 * rather than at release time. A release should never be a cleanup job; if
 * nothing is allowed to go stale between releases, cutting one is just a
 * version number.
 *
 * Two kinds of finding, deliberately:
 *
 * - **Stale** fails the build. These are decidable — regen either changes a
 *   file or it does not — so a red build here is a fact, not an opinion, and
 *   nobody has to argue with it.
 * - **Worth a look** never fails. These are heuristics over source, and a
 *   check that cries wolf is a check people learn to skip. They print, and a
 *   human decides.
 *
 *   npx tsx tools/release-readiness.ts [--json]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bandSnapshotProblem, wireToClientRatio } from '../src/audit/deferral.js';
import { parseDivergence } from '../src/core/divergence.js';
import { KNOWN_SPEC_REVISIONS, PIN_DECISION, newerThanPinned } from '../src/core/protocol.js';

const root = process.cwd();
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

interface Finding {
  kind: 'stale' | 'look';
  what: string;
  detail: string;
}

/**
 * Everything under `results/`, `docs/` and the front pages is derived from the
 * measurement records. If regenerating changes any of it, what is committed is
 * not what the data says — which is the exact condition under which a reader
 * gets a number nobody stands behind.
 */
function regenIsAFixedPoint(): Finding[] {
  // Runs regen against a throwaway copy of the tree and compares, rather than
  // regenerating in place and putting things back. Two earlier attempts show
  // why the indirection is worth it: the first skipped the check whenever the
  // tree was dirty and still printed "ready" — the worst answer available to a
  // question it had not asked, and dirty is the normal state when someone runs
  // this locally. The second regenerated in place and restored with `git
  // checkout`, which silently discarded the caller's own uncommitted edits.
  //
  // A check that reports on your work should not be able to damage it. This one
  // cannot touch the working tree at all.
  const owned = git('ls-files', 'results', 'docs', 'README.md', 'badges')
    .split('\n')
    .filter(Boolean);
  const tmp = mkdtempSync(join(tmpdir(), 'mcc-readiness-'));
  try {
    for (const rel of ['servers.yaml', 'package.json', 'results', 'docs', 'badges', 'README.md']) {
      const from = join(root, rel);
      if (existsSync(from)) cpSync(from, join(tmp, rel), { recursive: true });
    }
    execFileSync('npx', ['tsx', join(root, 'src', 'sweep', 'regen.ts')], {
      cwd: tmp,
      stdio: 'pipe',
    });

    const hash = (base: string, f: string) => {
      const p = join(base, f);
      return existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : 'absent';
    };
    const changed = owned.filter((f) => hash(root, f) !== hash(tmp, f));
    if (changed.length === 0) return [];
    return [
      {
        kind: 'stale',
        what: 'a published artifact does not match the data it is derived from',
        detail:
          `regen would rewrite ${changed.length} file(s):\n` +
          changed
            .slice(0, 12)
            .map((f) => `  ${f}`)
            .join('\n') +
          (changed.length > 12 ? `\n  … and ${changed.length - 12} more` : '') +
          '\nRun `npx tsx src/sweep/regen.ts` and commit the result. If it rewrote something you ' +
          'did not expect, that is the finding — read it before committing it.',
      },
    ];
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * A release ships bytes. If commits since the last version bump touched `src/`
 * or `servers.yaml` and the changelog has nothing to say about them, the
 * section records what its author was thinking about rather than what a reader
 * will install — which is how one release nearly went out describing a single
 * phase while carrying two.
 *
 * **It checks presence, not coverage, and the difference matters.** Asking only
 * "is there an entry" passes a section that describes half the release: ten
 * shipping commits sat under six entries on 2026-09-08, with Prettier, eight
 * compiler flags, oxlint, a third tsconfig and a review pass all unmentioned,
 * and this returned clean. Nothing here can tell which commit an entry is
 * about — entries do not cite commits, and matching on the files they name
 * passes as soon as any other entry happens to mention the same file. So the
 * empty section stays a hard failure, and a section with fewer entries than
 * shipping commits prints the commits instead, for the one reader who can
 * actually check: whoever is cutting.
 */
function changelogCoversTheCommits(): Finding[] {
  const since = git('log', '--format=%H', '--grep=^Version .* -> .*', '-1');
  if (!since) return [];
  const commits = git('log', '--format=%h\t%s', `${since}..HEAD`)
    .split('\n')
    .filter((l) => l.includes('\t'))
    .map((l) => l.split('\t', 2) as [string, string])
    .filter(([, s]) => !s.startsWith('chore:'));
  const shipping = commits.filter(([h]) => {
    const files = git('diff', '--name-only', `${h}^`, h, '--', 'src/', 'servers.yaml', 'tools/');
    return files.length > 0;
  });
  if (shipping.length === 0) return [];

  const text = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  const start = text.indexOf('## Unreleased');
  const next = text.indexOf('\n## ', start + 1);
  const section = start < 0 ? '' : text.slice(start, next > 0 ? next : undefined);
  const entries = (section.match(/\n- /g) ?? []).length;
  const listed = shipping.map(([h, s]) => `  ${h}  ${s}`).join('\n');

  if (entries === 0) {
    return [
      {
        kind: 'stale',
        what: 'the changelog says nothing about work that ships',
        detail:
          `${shipping.length} commit(s) since the last release touched src/, tools/ or servers.yaml ` +
          `and the Unreleased section has no entries:\n${listed}`,
      },
    ];
  }
  if (entries < shipping.length) {
    return [
      {
        kind: 'look',
        what: `${shipping.length} shipping commit(s) under ${entries} changelog entr(y/ies)`,
        detail:
          `One entry can cover several commits, so this is not a failure. It is the list to read ` +
          `before cutting, because nothing here can tell which of them an entry is about:\n${listed}`,
      },
    ];
  }
  return [];
}

/**
 * The three numbers of `PUBLISHED_WIRE_TO_CLIENT_RATIO` as one revision of
 * `deferral.ts` states them, or null if the constant is not in that shape.
 *
 * A regex over source, which is the trade this check accepts: the alternative
 * is building a past revision to import it, and a shape change here reads as
 * "could not be read" rather than as a pass.
 */
function bandLiteral(source: string): { low: number; high: number; servers: number } | null {
  const body = /PUBLISHED_WIRE_TO_CLIENT_RATIO[^=]*=\s*\{([\s\S]*?)\n\};/.exec(source)?.[1];
  if (body === undefined) return null;
  // Anchored at the start of a line, so the prose inside the literal — which
  // quotes older readings of these very numbers — cannot answer for them.
  const field = (name: string): number | null => {
    const m = new RegExp(`^\\s*${name}:\\s*([\\d.]+),`, 'm').exec(body);
    return m ? Number(m[1]) : null;
  };
  const [low, high, servers] = [field('low'), field('high'), field('servers')];
  if (low === null || high === null || servers === null) return null;
  return { low, high, servers };
}

/**
 * The band an installed package states offline, against the data on trunk.
 *
 * `results/divergence.json` does not ship, so with no live run to read, the
 * installed `audit` converts wire tokens to client tokens through the constant
 * compiled into it — and that constant is a snapshot of a run that keeps
 * moving. The suite holds the constant *on trunk* to the run committed beside
 * it, which is the same rule one step earlier; nothing was watching the one
 * users actually have. It can only be moved by cutting a release, so this is a
 * release-readiness question by construction.
 *
 * The released bytes are read at the last version-bump commit — the tree that
 * version was cut from. A release cut from a later tree would carry a *newer*
 * constant than this reads, so the error is toward reporting drift that has
 * already been fixed, never toward missing drift that is live.
 */
function theReleasedBandStillDescribesTheData(): Finding[] {
  const since = git('log', '--format=%H', '--grep=^Version .* -> .*', '-1');
  if (!since) return [];
  const divergence = join(root, 'results', 'divergence.json');
  if (!existsSync(divergence)) return [];
  const run = parseDivergence(readFileSync(divergence, 'utf8'));
  // A run that does not parse is a broken artifact, and the suite says so with
  // a better message than this could. Silence here rather than a second voice.
  if (!run) return [];

  let releasedSource: string;
  try {
    releasedSource = execFileSync('git', ['show', `${since}:src/audit/deferral.ts`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      // Same reason as the protocol check below: the catch turns this into a
      // stated finding, so the child's own stderr would only ever double it.
      stdio: 'pipe',
    });
  } catch {
    // A shallow clone, or a release from before the file existed. Nothing to
    // compare against is not the same as agreement, so it says which it is.
    return [
      {
        kind: 'look',
        what: 'the band the last release published could not be read',
        detail: `\`git show ${since.slice(0, 7)}:src/audit/deferral.ts\` failed — a shallow clone cannot answer this.`,
      },
    ];
  }
  const released = bandLiteral(releasedSource);
  if (!released) {
    return [
      {
        kind: 'look',
        what: 'the band the last release published could not be read',
        detail:
          `PUBLISHED_WIRE_TO_CLIENT_RATIO was not in the expected shape at ${since.slice(0, 7)}. ` +
          'If the constant was renamed or restructured, this check has to move with it.',
      },
    ];
  }
  const problem = bandSnapshotProblem(released, wireToClientRatio(run));
  if (!problem) return [];
  return [
    {
      kind: 'stale',
      what: 'the band the last release published no longer describes the data',
      detail:
        `The installed package converts wire tokens to client tokens through the band compiled ` +
        `into it, and ${problem}.\nThat band decides an above/below verdict against a client ` +
        `threshold, so an install is answering threshold questions from a number the data has ` +
        `moved past. Update PUBLISHED_WIRE_TO_CLIENT_RATIO in src/audit/deferral.ts from the ` +
        `current run and cut a release; nothing else can reach an installed copy.`,
    },
  ];
}

const DECLARES =
  /^\s*(?:export\s+const\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(\d[\d_.]*)\s*[,;]?\s*$/;
const DATA_SHAPED = /servers?|count|total|tokens|runSize|min|max|low|high|median|share|ratio/i;
/** The first line of a const declaration — what a data-shaped literal inside an
 *  object is attributed to, so the three fields of one snapshot are one key. */
const CONST_LINE = /^\s*(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)/;

/** A threshold somebody chose. Nothing re-derives it; changing it is a decision. */
const POLICY: Record<string, string> = {
  'src/audit/deferral.ts:TOOL_SEARCH_AUTO_SHARE':
    "the vendor's documented auto threshold; watch-tool-search-docs.ts holds the sentence",
  'src/core/regression.ts:SIGNIFICANT_PCT': 'emphasis, not inclusion — the docblock gives the pair',
  'src/core/regression.ts:SIGNIFICANT_TOKENS': 'same pair',
  'src/core/regression.ts:MAX_VECTOR_ENTRIES':
    'retention depth; dropping the oldest is reported, never implied',
  'src/sweep/harness-guard.ts:MIN_REGRESSIONS':
    'population floor below which the signal does not exist',
  'src/sweep/harness-guard.ts:FAULT_RATIO':
    'measured against the largest genuine simultaneous breakage on record',
  'src/sweep/pr-check.ts:DEFAULT_MAX_ENTRIES':
    'sized to the runner budget, held by worstCaseSeconds',
};

/** A copy of data that lives elsewhere, and the guard that holds it honest. */
const GUARDED: Record<string, string> = {
  'src/audit/deferral.ts:PUBLISHED_WIRE_TO_CLIENT_RATIO':
    'bandSnapshotProblem, against results/divergence.json',
  'src/core/protocol.ts:KNOWN_SPEC_REVISIONS': 'specSnapshotProblem, against the schema listing',
};

/**
 * Which MCP revision does the released package still speak?
 *
 * `PROTOCOL_VERSION` decides what every session an installed copy opens sends,
 * and the specification has moved twice since the one this project pins. Being
 * behind is not by itself a defect — a revision is a decision, and 2026-07-28
 * removed the handshake entirely, so following it is a change of methodology
 * rather than a version bump. That is exactly why this is `look` and never
 * `stale`: this tool runs on every push and every pull request, and a check
 * that reddened the build over a judgement is one people learn to route around.
 *
 * Read from **two** paths, newest first. The constant moved into
 * `src/core/protocol.ts` after the last release; before that it lived in
 * `src/sweep/client.ts`, unexported. A check that knew only the new home would
 * take its could-not-read branch on every run until the next release, which is
 * the cry-wolf failure one step removed.
 */
function theProtocolRevisionTheLastReleaseSpeaksIsStillCurrent(): Finding[] {
  const since = git('log', '--format=%H', '--grep=^Version .* -> .*', '-1');
  if (!since) return [];

  // Anchored at the start of a line for bandLiteral's reason: a docblock beside
  // a constant may quote the value, and a comment must not answer for the
  // field. One pattern for both spellings — the old home did not export it.
  const literal = /^(?:export )?const PROTOCOL_VERSION = '([\d-]+)';/m;
  const homes = ['src/core/protocol.ts', 'src/sweep/client.ts'];
  let readAny = false;
  let released: string | undefined;
  for (const path of homes) {
    let source: string;
    try {
      // `stdio: 'pipe'` is load-bearing, not tidiness: without it `execFileSync`
      // sends the child's stderr straight to ours, so the *expected* miss on the
      // first home printed a raw `fatal: path ... exists on disk, but not in ...`
      // above every run of this tool. The constant moved into src/core after the
      // last release, so that miss happens every time, and a healthy `ready` run
      // opened with a git fatal. The failure is handled here; it is not news.
      source = execFileSync('git', ['show', `${since}:${path}`], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        stdio: 'pipe',
      });
    } catch {
      continue; // absent at that ref, or a shallow clone — the next line tells them apart
    }
    readAny = true;
    const found = literal.exec(source)?.[1];
    if (found) {
      released = found;
      break;
    }
  }

  // Three outcomes, and each says only what it established. The first version
  // of the band's equivalent narrated "a shallow clone cannot answer this" for
  // every failure, including a file that simply had not been written yet.
  if (!readAny) {
    return [
      {
        kind: 'look',
        what: 'the revision the last release speaks could not be read',
        detail: `Neither ${homes.join(' nor ')} could be read at ${since.slice(0, 7)} — a shallow clone cannot answer this.`,
      },
    ];
  }
  if (!released) {
    return [
      {
        kind: 'look',
        what: 'the revision the last release speaks could not be read',
        detail:
          `PROTOCOL_VERSION was not in the expected shape at ${since.slice(0, 7)}. ` +
          'If the constant was renamed or restructured, this check has to move with it.',
      },
    ];
  }

  const newer = newerThanPinned(KNOWN_SPEC_REVISIONS, released);
  if (newer.length === 0) return [];

  // The decision on record answers only the revisions it names. Everything
  // newer that it covers reads as decided; anything it does not name is a new
  // question, and saying so here is what reopens it.
  const undecided = newer.filter((r) => !PIN_DECISION.considered.includes(r));
  if (undecided.length === 0) {
    return [
      {
        kind: 'look',
        what: `the released package speaks ${released}, behind ${newer.length} revision(s) — decided ${PIN_DECISION.on}: the pin stays`,
        detail:
          `Considered ${PIN_DECISION.considered.join(', ')} and declined, because ${PIN_DECISION.because}\n` +
          `Reopens when ${PIN_DECISION.reopenWhen} PIN_DECISION in src/core/protocol.ts is the record.`,
      },
    ];
  }
  return [
    {
      kind: 'look',
      what: `the released package speaks ${released}, and the specification has published ${undecided.length} revision(s) the pin decision does not cover`,
      detail:
        `Newer, as read on ${KNOWN_SPEC_REVISIONS.readOn}: ${newer.join(', ')} — of which ` +
        `${undecided.join(', ')} postdate the decision PIN_DECISION records (${PIN_DECISION.on}). ` +
        'This is a judgement, not a defect — moving the pin re-opens whether numbers either side ' +
        'of it are comparable. Read the new schema, then extend or revise PIN_DECISION in ' +
        'src/core/protocol.ts so the question is answered once. `tools/watch-spec-revisions.ts` ' +
        'is what notices a revision appearing; this is what notices the released bytes falling behind one.',
    },
  ];
}

/**
 * Which published numbers were taken over a revision the server chose rather
 * than the one this harness asked for?
 *
 * The handshake lets a server answer with a different version, and 11 of the 88
 * that answered do — all of them older, `2024-11-05` mostly (run 34161745581,
 * 2026-09-07). Those measurements are sound: this probe sends `initialize`,
 * `notifications/initialized` and a paginated `tools/list`, and all three are
 * the same in those revisions as in the one it asks for. Nothing needs fixing,
 * which is exactly why this is `look` and could never be `stale` — a build that
 * went red over it would be red for a fact rather than a fault.
 *
 * It is worth surfacing anyway. A server that starts answering with a revision
 * this probe genuinely cannot drive would show up here first, as a change in
 * this list rather than as a number quietly meaning something different from
 * its neighbours.
 */
function measuredOverARevisionTheServerChose(): Finding[] {
  const dir = join(root, 'results');
  if (!existsSync(dir)) return [];
  const differing: string[] = [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'measurement.json');
    if (!existsSync(file)) continue;
    let m: { requestedProtocolVersion?: unknown; negotiatedProtocolVersion?: unknown };
    try {
      m = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      continue; // a record that does not parse is the suite's complaint, not this one's
    }
    const asked = m.requestedProtocolVersion;
    const answered = m.negotiatedProtocolVersion;
    // Both halves, or the comparison is against something absent. A record
    // predating these fields says nothing about its handshake either way.
    if (typeof asked === 'string' && typeof answered === 'string' && asked !== answered) {
      differing.push(`${name}: asked ${asked}, the server chose ${answered}`);
    }
  }
  if (differing.length === 0) return [];
  return [
    {
      kind: 'look',
      what: `${differing.length} published record(s) were measured over a revision the server chose`,
      detail:
        `${differing.toSorted().join('\n  ')}\n` +
        'Sound as they stand: every method this probe uses is unchanged across these revisions. ' +
        'Worth a look only if the list changes shape — a revision this probe cannot drive would ' +
        'appear here before it appeared as a number meaning something its neighbours do not.',
    },
  ];
}

/**
 * Every data-shaped numeric literal in `src` declares its own kind — `POLICY`
 * or `GUARDED`, in the maps above — and this fails on one that declares
 * neither. The scanner cannot tell a chosen threshold from a copied datum
 * (they are the same characters), so the declaration is the datum: classifying
 * a new number is one line here, and the alternative is another entry in a
 * notice nobody reads. The maps are held to the same rule
 * `KNOWN_SPEC_REVISIONS` is held to — a key that names nothing real fails too.
 *
 * The prose-adjacency branch this once had (a comment mentioning a count,
 * sitting within a few lines of a data-shaped value) is gone on purpose. Its
 * two last hits were docblocks *explaining why the number beside them is
 * safe* — one of them literally the correction for the drift the branch
 * existed to catch. A text heuristic cannot separate an explanation from a
 * stale copy; `GUARDED` naming its guard is what carries that weight now.
 */
function numbersWrittenIntoSource(): Finding[] {
  const files = git('ls-files', 'src')
    .split('\n')
    .filter((f) => f.endsWith('.ts'));
  const classified = new Set([...Object.keys(POLICY), ...Object.keys(GUARDED)]);
  const sources = new Map<string, string[]>();
  const isComment = (l: string) => {
    const t = l.trimStart();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };

  const unclassified: string[] = [];
  for (const f of files) {
    const lines = readFileSync(join(root, f), 'utf8').split('\n');
    sources.set(f, lines);
    lines.forEach((line, i) => {
      if (isComment(line)) return;
      const m = DECLARES.exec(line);
      if (!m || !DATA_SHAPED.test(m[1]!)) return;
      // A field inside an object literal answers to the const that owns it, so
      // the nearest declaration at or above the line is the key.
      let owner = m[1]!;
      for (let j = i; j >= 0; j--) {
        const c = CONST_LINE.exec(lines[j]!);
        if (c) {
          owner = c[1]!;
          break;
        }
      }
      const key = `${f}:${owner}`;
      if (!classified.has(key)) {
        unclassified.push(`${f}:${i + 1}  ${line.trim().slice(0, 96)}  → key ${key}`);
      }
    });
  }

  const missing: string[] = [];
  for (const key of classified) {
    const sep = key.lastIndexOf(':');
    const file = key.slice(0, sep);
    const name = key.slice(sep + 1);
    const lines =
      sources.get(file) ??
      (existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8').split('\n') : []);
    const declares = new RegExp(`^\\s*(?:export\\s+)?const\\s+${name}\\b`);
    if (!lines.some((l) => declares.test(l))) missing.push(key);
  }

  const findings: Finding[] = [];
  if (unclassified.length) {
    findings.push({
      kind: 'stale',
      what: `${unclassified.length} data-shaped number(s) in src with no declared kind`,
      detail:
        'Every data-shaped constant is POLICY (a threshold somebody chose; nothing re-derives it) ' +
        'or GUARDED (a copy of data, named beside the guard that holds it honest), declared in ' +
        'the two maps in this file. These declare neither — classify each, or restructure it:\n' +
        unclassified.map((h) => `  ${h}`).join('\n'),
    });
  }
  if (missing.length) {
    findings.push({
      kind: 'stale',
      what: `the classification maps name ${missing.length} declaration(s) that do not exist`,
      detail:
        'POLICY and GUARDED must name real things — the same rule KNOWN_SPEC_REVISIONS is held ' +
        'to. Remove or rename:\n' +
        missing.map((k) => `  ${k}`).join('\n'),
    });
  }
  return findings;
}

function main(): number {
  if (!existsSync(join(root, 'servers.yaml'))) {
    console.error('run this from the repository root');
    return 2;
  }
  const findings = [
    ...regenIsAFixedPoint(),
    ...changelogCoversTheCommits(),
    ...theReleasedBandStillDescribesTheData(),
    ...theProtocolRevisionTheLastReleaseSpeaksIsStillCurrent(),
    ...measuredOverARevisionTheServerChose(),
    ...numbersWrittenIntoSource(),
  ];

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(findings, null, 2));
    return findings.some((f) => f.kind === 'stale') ? 1 : 0;
  }

  const stale = findings.filter((f) => f.kind === 'stale');
  const look = findings.filter((f) => f.kind === 'look');

  for (const f of look) {
    console.log(`\nWORTH A LOOK — ${f.what}\n${f.detail}`);
  }
  for (const f of stale) {
    console.log(`\nSTALE — ${f.what}\n${f.detail}`);
  }
  if (stale.length === 0) {
    console.log('\nready: every published artifact matches the data it is derived from.');
    return 0;
  }
  console.log(`\n${stale.length} thing(s) a reader would find wrong. Fix them before releasing.`);
  return 1;
}

process.exit(main());
