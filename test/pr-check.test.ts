import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import {
  DEFAULT_MAX_ENTRIES,
  LAUNCH_FIELDS,
  entriesToMeasure,
  failsCheck,
  launchBudgetSeconds,
  launchSignature,
  worstCaseSeconds,
} from '../src/sweep/pr-check.js';
import { isSelfContainerised, TIMEOUT_RETRY_FACTOR } from '../src/sweep/run.js';
import type { ServerEntry } from '../src/sweep/report.js';
import { TSX_CLI } from './tsx.js';

const repoRoot = join(import.meta.dirname, '..');
const prCheck = join(repoRoot, 'src', 'sweep', 'pr-check.ts');
const sweepRun = join(repoRoot, 'src', 'sweep', 'run.ts');
const wfDir = join(repoRoot, '.github', 'workflows');

/** A complete, valid entry — the shape servers-schema.test.ts mutates. */
function entry(name: string, over: Partial<ServerEntry> = {}): ServerEntry {
  return {
    name,
    command: `npx -y ${name}`,
    package: name,
    env: [],
    metric: 1,
    metricSource: 'https://example.invalid',
    category: 'community',
    repo: `https://github.com/example/${name}`,
    ...over,
  };
}

const doc = (servers: ServerEntry[]) => ({ servers });

/**
 * The diff is the whole check: an entry it misses is an entry the write-token
 * rotation launches first, and an entry it over-selects burns the runner budget
 * on a metric edit. Every launch-affecting field is walked from the exported
 * list rather than named here, so a field added to `LAUNCH_FIELDS` is covered
 * the day it is added — `timeoutSeconds` is the one whose misspelling motivated
 * the schema module, and it was the one the first draft of these tests skipped.
 */
describe('entriesToMeasure', () => {
  const base = doc([entry('a'), entry('b')]);

  it('finds an entry by name that the base document does not have', () => {
    const d = entriesToMeasure(base, doc([entry('a'), entry('b'), entry('c')]));
    expect(d.problems).toEqual([]);
    expect(d.added.map((e) => e.name)).toEqual(['c']);
    expect(d.relaunched).toEqual([]);
  });

  const changed: Record<(typeof LAUNCH_FIELDS)[number], Partial<ServerEntry>> = {
    command: { command: 'npx -y a mcp' },
    dockerImage: { dockerImage: 'ghcr.io/astral-sh/uv:python3.12-bookworm-slim' },
    aptPackages: { aptPackages: ['libsecret-1-0'] },
    needsGit: { needsGit: true },
    env: { env: ['A_TOKEN'] },
    envValues: { env: ['A_TOKEN'], envValues: { A_TOKEN: 'bolt://localhost:7687' } },
    timeoutSeconds: { timeoutSeconds: 420 },
    notApplicable: { notApplicable: { reason: 'needs a display', evidence: 'cannot open display' } },
  };

  for (const field of LAUNCH_FIELDS) {
    it(`finds an existing entry whose ${field} changed`, () => {
      const d = entriesToMeasure(base, doc([entry('a', changed[field]), entry('b')]));
      expect(d.problems).toEqual([]);
      expect(d.added).toEqual([]);
      expect(d.relaunched.map((e) => e.name)).toEqual(['a']);
    });
  }

  it('leaves alone a metric change, a repo change and a reorder — none of them launches differently', () => {
    const head = doc([entry('b', { metric: 999, repo: 'https://github.com/moved/b' }), entry('a')]);
    const d = entriesToMeasure(base, head);
    expect(d.added).toEqual([]);
    expect(d.relaunched).toEqual([]);
  });

  it('compares launches by content, not by key order', () => {
    const one = entry('a', { env: ['X', 'Y'], envValues: { X: '1', Y: '2' } });
    const two = entry('a', { env: ['X', 'Y'], envValues: { Y: '2', X: '1' } });
    expect(launchSignature(one)).toBe(launchSignature(two));
  });

  it('treats a renamed entry as added, never as a relaunch of the old name', () => {
    const d = entriesToMeasure(base, doc([{ ...entry('a'), name: 'a-renamed' }, entry('b')]));
    expect(d.added.map((e) => e.name)).toEqual(['a-renamed']);
    expect(d.relaunched).toEqual([]);
  });

  it('refuses to diff a malformed head document, and names the field', () => {
    const bad = { ...entry('c'), timeoutSecond: 240 } as unknown as ServerEntry;
    const d = entriesToMeasure(base, doc([entry('a'), entry('b'), bad]));
    expect(d.problems.map((p) => `${p.entry}.${p.field}`)).toEqual(['c.timeoutSecond']);
    expect(d.added).toEqual([]);
    expect(d.relaunched).toEqual([]);
  });

  it('treats an unreadable base as empty, so the entry cap refuses rather than the whole file measuring', () => {
    const d = entriesToMeasure(null, base);
    expect(d.added.map((e) => e.name)).toEqual(['a', 'b']);
  });
});

/**
 * The entry cap sizes the job's timeout-minutes to `DEFAULT_MAX_ENTRIES`
 * launches at the default budget, but an entry's own `timeoutSeconds` replaces
 * the default and the schema bounds it only below (servers-schema.ts:166-169).
 * The first draft of the check counted entries and nothing else, so one added
 * entry with a four-digit timeoutSeconds would have been killed by the job
 * limit with no line printed. The threshold here is derived from the same two
 * constants the script uses; no number of seconds is written down.
 */
describe('worstCaseSeconds', () => {
  const defaultTimeout = 10;
  const budget = launchBudgetSeconds(DEFAULT_MAX_ENTRIES, defaultTimeout);

  it('sizes the budget to the entry cap, the default budget and its retry', () => {
    expect(budget).toBe(DEFAULT_MAX_ENTRIES * defaultTimeout * (1 + TIMEOUT_RETRY_FACTOR));
  });

  it('is within budget for the cap\'s worth of entries at the default, and over it one second later', () => {
    const atDefault = Array.from({ length: DEFAULT_MAX_ENTRIES }, (_, i) => entry(`s${i}`));
    expect(worstCaseSeconds(atDefault, defaultTimeout)).toBe(budget);
    const oneOver = [entry('slow', { timeoutSeconds: DEFAULT_MAX_ENTRIES * defaultTimeout + 1 })];
    expect(worstCaseSeconds(oneOver, defaultTimeout)).toBeGreaterThan(budget);
  });

  it('charges an entry its own timeoutSeconds, and its retry, when it has one', () => {
    expect(worstCaseSeconds([entry('own', { timeoutSeconds: 7 })], defaultTimeout)).toBe(7 * (1 + TIMEOUT_RETRY_FACTOR));
  });

  it('counts neither a remote endpoint nor a self-containerised command — neither is launched', () => {
    const listed = [
      entry('endpoint', { remote: true, command: 'https://mcp.example.invalid/sse', timeoutSeconds: 9999 }),
      entry('containerised', { command: 'docker run --rm -i ghcr.io/example/x', timeoutSeconds: 9999 }),
    ];
    expect(worstCaseSeconds(listed, defaultTimeout)).toBe(0);
    expect(worstCaseSeconds([...listed, entry('launched')], defaultTimeout)).toBe(
      worstCaseSeconds([entry('launched')], defaultTimeout),
    );
  });
});

describe('failsCheck', () => {
  it('fails the outcomes that mean the entry does not launch as written, or has no one number', () => {
    for (const s of ['startup-failure', 'timeout', 'dynamic'] as const) expect(failsCheck(s)).toBe(true);
  });

  it('passes the outcomes the leaderboard publishes as findings', () => {
    for (const s of ['measured', 'auth-required', 'not-applicable'] as const) expect(failsCheck(s)).toBe(false);
  });
});

/**
 * Four copies of `startsWith('docker ')` were one ambiguity away from two paths
 * disagreeing about the same entry. The predicate is exported once and the
 * grep below is what keeps a fifth copy from appearing.
 */
describe('isSelfContainerised', () => {
  it('recognises a command that is its own docker run, whitespace included', () => {
    expect(isSelfContainerised('docker run --rm -i ghcr.io/x/y')).toBe(true);
    expect(isSelfContainerised('  docker run x')).toBe(true);
  });

  it('does not mistake a package whose name starts with docker', () => {
    expect(isSelfContainerised('npx -y docker-mcp')).toBe(false);
    expect(isSelfContainerised('dockerize-me serve')).toBe(false);
    expect(isSelfContainerised('docker')).toBe(false);
  });

  it('is the only place src/ asks the question', () => {
    const srcDir = join(repoRoot, 'src');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, d.name);
        if (d.isDirectory()) walk(p);
        else if (d.name.endsWith('.ts') && readFileSync(p, 'utf8').includes("startsWith('docker ')")) hits.push(p);
      }
    };
    walk(srcDir);
    expect(hits).toEqual([sweepRun]);
    expect(readFileSync(sweepRun, 'utf8').match(/startsWith\('docker '\)/g)).toHaveLength(1);
  });
});

/**
 * A stdio MCP server that answers initialize and tools/list with one tool, and
 * records that it was launched by touching `launched` beside itself. The marker
 * is what makes "refused before any launch" a testable claim: the host-mode
 * script spawns `node`, not `docker`, so a docker shim would stay silent whether
 * or not the early exit exists.
 */
const STUB = `
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
writeFileSync(fileURLToPath(new URL('launched', import.meta.url)), '1', { flag: 'a' });
let buf = '';
const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n');
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.method === 'initialize')
      reply(msg.id, { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'stub', version: '1.0.0' } });
    else if (msg.method === 'tools/list')
      reply(msg.id, { tools: [{ name: 'echo', description: 'Echo a string back.', inputSchema: { type: 'object', properties: { s: { type: 'string' } } } }] });
  }
});
process.stdin.on('end', () => process.exit(0));
`;

/**
 * A `docker` on PATH that logs every invocation beside itself and fails a `run`
 * the way docker fails as docker (the docker-fault.test.ts script). Logging to
 * a path derived from `$0` rather than an env var, because the harness hands a
 * spawned server only PATH and HOME — an env-addressed log would miss exactly
 * the host-spawned `docker run` these tests exist to catch.
 */
const DOCKER_SHIM = `#!/bin/sh
echo "$@" >> "$(dirname "$0")/invocations.log"
case "$1" in
  image) exit 1 ;;
  pull) exit 0 ;;
  run)
    echo "Unable to find image 'mcp-ctx-shim-img' locally" >&2
    echo "docker: Error response from daemon: registry hiccup" >&2
    exit 125 ;;
  rm) exit 0 ;;
  *) exit 2 ;;
esac
`;

describe('pr-check (subprocess)', () => {
  let root: string;
  let stub: string;
  let shimDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pr-check-'));
    stub = join(root, 'stub.mjs');
    writeFileSync(stub, STUB);
    shimDir = join(root, 'shim');
    mkdirSync(shimDir);
    writeFileSync(join(shimDir, 'docker'), DOCKER_SHIM);
    chmodSync(join(shimDir, 'docker'), 0o755);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const launched = () => existsSync(join(root, 'launched'));
  const dockerCalls = () => {
    const log = join(shimDir, 'invocations.log');
    return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  };
  const wroteNothing = () => {
    expect(existsSync(join(root, 'results'))).toBe(false);
    expect(existsSync(join(root, 'badges'))).toBe(false);
  };

  function docs(base: ServerEntry[], head: ServerEntry[]): [string, string] {
    const b = join(root, 'base.yaml');
    const h = join(root, 'head.yaml');
    writeFileSync(b, stringify(doc(base)));
    writeFileSync(h, stringify(doc(head)));
    return [b, h];
  }

  function run(script: string, args: string[]): { code: number; out: string } {
    const env = { ...process.env, PATH: `${shimDir}:${process.env.PATH}` };
    try {
      const out = execFileSync(process.execPath, [TSX_CLI, script, ...args], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      });
      return { code: 0, out };
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  }

  const stubEntry = (name: string, over: Partial<ServerEntry> = {}) =>
    entry(name, { command: `node ${stub}`, timeoutSeconds: 10, ...over });

  it('prints the measured tokens for an added entry and a relaunched one, and writes nothing', () => {
    const [b, h] = docs(
      [stubEntry('old', { command: 'node -e "process.exit(1)"' })],
      [stubEntry('old'), stubEntry('fresh')],
    );
    const { code, out } = run(prCheck, ['--base', b, '--head', h]);
    expect(out).toMatch(/fresh \(added\): \d+ tokens \/ 1 tools \(measured, \d+s\)/);
    expect(out).toMatch(/old \(relaunched\): \d+ tokens \/ 1 tools \(measured, \d+s\)/);
    expect(out).toContain('Nothing was written');
    expect(out).toContain('regen.ts');
    expect(out).toContain('## Unreleased');
    expect(code).toBe(0);
    expect(launched()).toBe(true);
    wroteNothing();
    expect(existsSync(join(root, 'results', 'history.csv'))).toBe(false);
  }, 60_000);

  it('says so and exits 0 when the pull request adds or relaunches nothing', () => {
    const [b, h] = docs([stubEntry('same')], [stubEntry('same', { metric: 5 })]);
    const { code, out } = run(prCheck, ['--base', b, '--head', h]);
    expect(code).toBe(0);
    expect(out).toContain('nothing to measure');
    expect(out).not.toContain(' tokens / ');
    expect(launched()).toBe(false);
  }, 60_000);

  it('caps how many entries one pull request may launch, and refuses before the first launch', () => {
    const many = Array.from({ length: DEFAULT_MAX_ENTRIES + 1 }, (_, i) => stubEntry(`s${i}`));
    const [b, h] = docs([], many);
    const { code, out } = run(prCheck, ['--base', b, '--head', h]);
    expect(code).toBe(2);
    expect(out).toContain(`at most ${DEFAULT_MAX_ENTRIES}`);
    expect(out).toContain('Nothing was launched');
    expect(out).not.toContain(' tokens / ');
    expect(launched()).toBe(false);
    wroteNothing();
  }, 60_000);

  it('refuses, before any launch, one entry whose own timeoutSeconds exceeds what the cap was sized to', () => {
    // Host mode, so the stub's marker is the proof: had the script launched,
    // `launched` would exist beside it whatever the docker shim saw.
    const defaultTimeout = 10;
    const tooLong = DEFAULT_MAX_ENTRIES * defaultTimeout + 1;
    const [b, h] = docs([], [stubEntry('slow', { timeoutSeconds: tooLong })]);
    const { code, out } = run(prCheck, ['--base', b, '--head', h, '--default-timeout', String(defaultTimeout)]);
    expect(code).toBe(2);
    expect(out).toContain(`slow (timeoutSeconds ${tooLong})`);
    expect(out).toContain('Nothing was launched');
    expect(out).not.toContain(' tokens / ');
    expect(launched()).toBe(false);
    wroteNothing();
  }, 60_000);

  it('refuses a head document that does not parse, with the parser\'s message and no stack trace', () => {
    // An unquoted `a: b` inside a plain-scalar command is the YAML mistake a
    // hand-edited entry makes; the first draft let the parser's exception out
    // as a stack trace with exit 1, the code reserved for a launched entry.
    const b = join(root, 'base.yaml');
    const h = join(root, 'head.yaml');
    writeFileSync(b, stringify(doc([])));
    writeFileSync(h, `servers:\n  - name: broken\n    command: node ${stub} a: b\n    package: broken\n`);
    const { code, out } = run(prCheck, ['--base', b, '--head', h]);
    expect(code).toBe(2);
    expect(out).toContain(`${h} does not parse as YAML:`);
    expect(out).toContain('nothing was launched');
    expect(out).not.toContain('YAMLParseError');
    expect(out).not.toContain('    at ');
    expect(launched()).toBe(false);
    wroteNothing();
  }, 60_000);

  it('honours an explicit --max-entries', () => {
    const [b, h] = docs([], [stubEntry('s0'), stubEntry('s1')]);
    expect(run(prCheck, ['--base', b, '--head', h, '--max-entries', '1']).code).toBe(2);
    expect(launched()).toBe(false);
  }, 60_000);

  it('lists a self-containerised entry without launching it, and names the maintainer path', () => {
    // Host mode on purpose: here the harness would hand `docker run …` straight
    // to the shim on PATH, so an empty invocation log is the proof.
    const [b, h] = docs([], [entry('containerised', { command: 'docker run --rm -i ghcr.io/example/x' })]);
    const { code, out } = run(prCheck, ['--base', b, '--head', h]);
    expect(code).toBe(0);
    expect(out).toContain('containerised (added): listed, not launched here');
    expect(out).toContain('resweep.yml servers=containerised');
    expect(out).not.toContain(' tokens / ');
    expect(dockerCalls()).toEqual([]);
    wroteNothing();
  }, 60_000);

  it('lists a remote entry without launching it', () => {
    const [b, h] = docs([], [entry('endpoint', { remote: true, command: 'https://mcp.example.invalid/sse' })]);
    const { code, out } = run(prCheck, ['--base', b, '--head', h]);
    expect(code).toBe(0);
    expect(out).toContain('endpoint (added): remote — listed, not measured');
  }, 60_000);

  it('fails the check when the added entry does not launch as written, with the evidence printed', () => {
    const [b, h] = docs([], [entry('broken', { command: `node -e "console.error('no such subcommand'); process.exit(1)"`, timeoutSeconds: 10 })]);
    const { code, out } = run(prCheck, ['--base', b, '--head', h]);
    expect(code).toBe(1);
    expect(out).toMatch(/broken \(added\): startup-failure \(\d+s\)/);
    expect(out).toContain('no such subcommand');
    expect(out).toContain('does not launch as written');
    wroteNothing();
  }, 60_000);

  it('refuses a malformed head document before anything is launched, in the schema check\'s voice', () => {
    const bad = { ...stubEntry('typo'), timeoutSecond: 240 } as unknown as ServerEntry;
    const [b, h] = docs([], [bad]);
    const { code, out } = run(prCheck, ['--base', b, '--head', h]);
    expect(code).toBe(2);
    expect(out).toContain('typo.timeoutSecond: unknown field');
    expect(out).toContain('nothing was launched');
    expect(launched()).toBe(false);
  }, 60_000);

  it('exits 1 with HARNESS FAULT when docker fails as docker, and calls it the runner, not the entry', () => {
    const [b, h] = docs([], [stubEntry('victim', { dockerImage: 'mcp-ctx-shim-img' })]);
    const { code, out } = run(prCheck, ['--base', b, '--head', h, '--docker']);
    expect(code).toBe(1);
    expect(out).toContain('HARNESS FAULT');
    expect(out).toContain('docker could not run the container for victim');
    expect(out).not.toContain('startup-failure');
    expect(dockerCalls().some((l) => l.startsWith('image inspect mcp-ctx-shim-img'))).toBe(true);
    wroteNothing();
  }, 60_000);

  it('needs --base, and says so without launching anything', () => {
    const { code, out } = run(prCheck, []);
    expect(code).toBe(2);
    expect(out).toContain('usage');
    expect(launched()).toBe(false);
  }, 60_000);

  /**
   * The README's instruction for a would-be contributor used to be the
   * persisting form: results/<name>/measurement.json, badges/<name>.json and a
   * history.csv row written into the checkout, from a laptop, with nothing in
   * .gitignore or the suite to refuse the commit. `--no-persist` is the form
   * the README now gives, and the contrast case is what proves the flag is
   * what made the difference.
   */
  describe('npm run sweep -- --no-persist', () => {
    it('prints the number, says where the record would have gone, and writes nothing', () => {
      const { code, out } = run(sweepRun, ['--no-persist', '--name', 'mine', '--command', `node ${stub}`, '--timeout', '10000']);
      expect(code).toBe(0);
      expect(out).toMatch(/mine: \d+ tokens across 1 tools \(measured\)/);
      expect(out).toContain('nothing written');
      expect(out).toContain('results/mine/measurement.json');
      expect(out).toContain('badges/mine.json');
      wroteNothing();
      expect(existsSync(join(root, 'results', 'history.csv'))).toBe(false);
    }, 60_000);

    it('is the form the README gives a contributor, and the persisting form is gone from it', () => {
      // The instruction is the one path a would-be contributor follows, so the
      // suite reads it rather than trusting a docblock that says it changed.
      const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
      const section = readme.slice(readme.indexOf('## Measure your own server'));
      const block = section.slice(0, section.indexOf('\n## ', 1));
      expect(block).toContain('npm run sweep -- --no-persist');
      expect(block).not.toContain('cat badges/');
      expect(block).not.toMatch(/npm run sweep -- --name/);
    });

    it('is the flag that made the difference — without it the CLI still persists', () => {
      const { code } = run(sweepRun, ['--name', 'mine', '--command', `node ${stub}`, '--timeout', '10000']);
      expect(code).toBe(0);
      expect(existsSync(join(root, 'results', 'mine', 'measurement.json'))).toBe(true);
      expect(existsSync(join(root, 'badges', 'mine.json'))).toBe(true);
      expect(existsSync(join(root, 'results', 'history.csv'))).toBe(true);
    }, 60_000);
  });
});

/**
 * The properties the check's safety rests on are only observable on a real
 * pull request from a stranger, which is the one event this repository has
 * never had. So they are asserted from the file, the way workflows.test.ts
 * asserts the rotation's.
 */
describe('the pull-request measurement workflow', () => {
  const text = readFileSync(join(wfDir, 'pr-check.yml'), 'utf8');
  const wf = parse(text) as {
    on: { pull_request: { paths: string[] } };
    permissions: Record<string, string>;
    jobs: Record<string, { 'timeout-minutes': number }>;
  };
  const runLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('run:') || l.startsWith('git ') || l.startsWith('npx '));
  const invocation = runLines.find((l) => l.includes('pr-check.ts'))!;

  it('runs on pull_request for servers.yaml changes, never pull_request_target', () => {
    // The target-checkout trigger hands the pull request's code a write token;
    // it must not appear even in a comment, so nobody copies it from here.
    expect(Object.keys(wf.on)).toEqual(['pull_request']);
    expect(wf.on.pull_request.paths).toEqual(['servers.yaml']);
    expect(text).not.toContain('pull_request_target');
  });

  it('holds a read-only token and mounts no secret', () => {
    expect(wf.permissions).toEqual({ contents: 'read' });
    expect(text).not.toContain('secrets.');
    expect(text).not.toContain('contents: write');
  });

  it('does not persist the checkout credential where the launched process could read it', () => {
    expect(text).toContain('persist-credentials: false');
  });

  it('measures in the same isolation and with the same cold-runner budget as the rotation', () => {
    expect(invocation).toBeDefined();
    expect(invocation).toContain('--docker');
    expect(invocation).toContain('--base');
    const timeout = /--default-timeout (\d+)/.exec(invocation);
    expect(timeout).not.toBeNull();
    expect(Number(timeout![1])).toBeGreaterThan(60);
  });

  it('expands the base sha from the environment rather than inlining it', () => {
    for (const l of runLines) expect(l).not.toContain('${{');
    expect(text).toContain('github.event.pull_request.base.sha');
  });

  it('pushes nothing', () => {
    for (const needle of ['git push', 'git commit', 'git config user.name']) expect(text).not.toContain(needle);
  });

  it('is capped, and the cap is derived from the entry cap and the retry arithmetic', () => {
    // A working MCP server never exits on its own, so an uncapped job would
    // run until GitHub's six-hour limit. The bound: one entry can cost its
    // budget once and then TIMEOUT_RETRY_FACTOR times more on the retry;
    // entries are measured one at a time; at most --max-entries of them.
    const job = Object.values(wf.jobs)[0];
    expect(job['timeout-minutes']).toBeGreaterThan(0);
    const budget = Number(/--default-timeout (\d+)/.exec(invocation)![1]);
    const maxEntries = Number(/--max-entries (\d+)/.exec(invocation)![1]);
    expect(maxEntries).toBe(DEFAULT_MAX_ENTRIES);
    const measuringMinutes = launchBudgetSeconds(maxEntries, budget) / 60;
    expect(measuringMinutes).toBe((maxEntries * budget * (1 + TIMEOUT_RETRY_FACTOR)) / 60);
    expect(job['timeout-minutes']).toBeGreaterThanOrEqual(measuringMinutes);
  });

  it('says in its own comment what holds the bound, since the count alone does not', () => {
    // The entry's own timeoutSeconds replaces the default and is unbounded
    // above; the script's sum refusal is what keeps the job under its limit,
    // and the comment beside timeout-minutes has to say so or the next reader
    // sizes the minutes from the count.
    const comment = text.slice(text.indexOf('# Derived from'), text.indexOf('timeout-minutes:'));
    expect(comment).toContain('timeoutSeconds');
    expect(comment).toContain('servers-schema.ts');
    expect(comment).toContain('refuses');
  });

  it('runs no step that writes a file or needs a secret', () => {
    expect(text).not.toContain('measure-divergence');
    expect(text).not.toContain('cross-check.ts');
    expect(text).not.toContain('regen.ts');
  });
});
