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
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bandSnapshotProblem, wireToClientRatio } from '../src/audit/deferral.js';
import { parseDivergence } from '../src/core/divergence.js';

const root = process.cwd();
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

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
  const owned = git('ls-files', 'results', 'docs', 'README.md', 'badges').split('\n').filter(Boolean);
  const tmp = mkdtempSync(join(tmpdir(), 'mcc-readiness-'));
  try {
    for (const rel of ['servers.yaml', 'package.json', 'results', 'docs', 'badges', 'README.md']) {
      const from = join(root, rel);
      if (existsSync(from)) cpSync(from, join(tmp, rel), { recursive: true });
    }
    execFileSync('npx', ['tsx', join(root, 'src', 'sweep', 'regen.ts')], { cwd: tmp, stdio: 'pipe' });

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
          changed.slice(0, 12).map((f) => `  ${f}`).join('\n') +
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
  if (section.includes('\n- ')) return [];
  return [
    {
      kind: 'stale',
      what: 'the changelog says nothing about work that ships',
      detail:
        `${shipping.length} commit(s) since the last release touched src/, tools/ or servers.yaml ` +
        `and the Unreleased section has no entries:\n` +
        shipping.map(([h, s]) => `  ${h}  ${s}`).join('\n'),
    },
  ];
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

const DECLARES = /^\s*(?:export\s+const\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(\d[\d_.]*)\s*[,;]?\s*$/;
const DATA_SHAPED = /servers?|count|total|tokens|runSize|min|max|low|high|median|share|ratio/i;
/** A count of the current data. Deliberately not dates: a comment saying what was
 *  observed on 2026-08-19 is a dated reading, which is this repository's whole
 *  practice, and flagging those buries the one line that matters. */
const PROSE_COUNT = /\b\d[\d,]*\s+(servers?|tools?|tokens)\b/i;
/** How far above a number a comment still counts as being "beside" it. */
const BESIDE = 6;

/**
 * Numeric literals bound to data-shaped names — and prose *beside* one, which
 * is narrower than "any comment with a number in it" for a reason. Every drift
 * this has caught was a sentence sitting directly above the value it described
 * and disagreeing with it. A count mentioned anywhere else in a file is almost
 * always narrative, and reporting those trains the reader to skim.
 */
function numbersWrittenIntoSource(): Finding[] {
  const files = git('ls-files', 'src').split('\n').filter((f) => f.endsWith('.ts'));
  const hits: string[] = [];
  for (const f of files) {
    const lines = readFileSync(join(root, f), 'utf8').split('\n');
    const isComment = (l: string) => {
      const t = l.trimStart();
      return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
    };
    lines.forEach((line, i) => {
      if (isComment(line)) {
        if (!PROSE_COUNT.test(line)) return;
        // Only when a data-shaped number follows within a few lines.
        const near = lines.slice(i + 1, i + 1 + BESIDE);
        const beside = near.some((l) => {
          const m = DECLARES.exec(l);
          return m && DATA_SHAPED.test(m[1]!);
        });
        if (beside) hits.push(`${f}:${i + 1}  ${line.trim().slice(0, 96)}`);
        return;
      }
      const m = DECLARES.exec(line);
      if (m && DATA_SHAPED.test(m[1]!)) hits.push(`${f}:${i + 1}  ${line.trim().slice(0, 96)}`);
    });
  }
  if (hits.length === 0) return [];
  return [
    {
      kind: 'look',
      what: `${hits.length} number(s) written into source`,
      detail:
        'For each: what re-derives it, and what would notice if it stopped being true? A policy ' +
        'constant is fine. A count or a date copied from the data is the shape that has drifted ' +
        'three times — twice in a constant, once in a doc comment beside one.\n' +
        hits.map((h) => `  ${h}`).join('\n'),
    },
  ];
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
