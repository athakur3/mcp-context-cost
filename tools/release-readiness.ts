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
  const findings = [...regenIsAFixedPoint(), ...changelogCoversTheCommits(), ...numbersWrittenIntoSource()];

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
