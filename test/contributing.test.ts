import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { knownFields, validateEntry } from '../src/sweep/servers-schema.js';
import { failsCheck } from '../src/sweep/pr-check.js';
import type { ServerEntry } from '../src/sweep/report.js';
import type { Measurement } from '../src/core/types.js';

/**
 * CONTRIBUTING.md is the one page a stranger reads before touching
 * `servers.yaml`, and every sentence in it is a claim about something else in
 * this repository: the schema's field table, the order of steps that leaves a
 * pull request green, the command that writes nothing, what the pull-request
 * check launches and what it refuses, how long an entry waits after merge.
 * None of those is checked by the page's own words. The schema drifts when a
 * field is added; the workflows drift when a job is renamed; the count guard
 * (`test/page-numbers.test.ts`) does not scan this file at all.
 *
 * So every expectation here is derived from the thing the sentence describes —
 * `FIELDS` through `knownFields` and the validator's own messages, the
 * workflow ymls' `run:` lines, `pr-check.ts`'s source and exit policy,
 * `resweep.yml`'s cron and shard default, `ROADMAP.md`'s own wording — rather
 * than restated as literals a second time. A literal here would be the same
 * hand-written claim in two places, which is the failure the page exists to
 * avoid.
 */
const repoRoot = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');
const contributing = read('CONTRIBUTING.md');
const wfDir = join(repoRoot, '.github', 'workflows');

/** The text of one `## ` section, up to the next one. */
function section(heading: string): string {
  const start = contributing.indexOf(`\n## ${heading}`);
  expect(start, `section '${heading}' exists`).toBeGreaterThanOrEqual(0);
  const next = contributing.indexOf('\n## ', start + 1);
  return contributing.slice(start, next < 0 ? undefined : next);
}

/** Prose wraps; a sentence is its words, not its layout. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

const backticked = (text: string) => [...text.matchAll(/`([A-Za-z][A-Za-z0-9-]*)`/g)].map((m) => m[1]);

/** A complete, valid entry — the shape servers-schema.test.ts mutates. */
const base = (): ServerEntry => ({
  name: 'a',
  command: 'npx -y a',
  package: 'a',
  env: [],
  metric: 1,
  metricSource: 'https://example.invalid',
  category: 'community',
  repo: 'https://github.com/example/a',
});

const servers = (parse(read('servers.yaml')) as { servers: ServerEntry[] }).servers;
const entry = (name: string): ServerEntry => {
  const e = servers.find((s) => s.name === name);
  expect(e, `servers.yaml has ${name}`).toBeDefined();
  return e!;
};

/** Workflow files whose trigger includes `pull_request`, with the `run:` lines they execute. */
function pullRequestRunLines(): { file: string; runs: string[] }[] {
  return readdirSync(wfDir)
    .filter((f) => f.endsWith('.yml'))
    .map((file) => {
      const text = readFileSync(join(wfDir, file), 'utf8');
      const wf = parse(text) as { on?: Record<string, unknown> | string[] };
      const triggers = Array.isArray(wf.on) ? wf.on : Object.keys(wf.on ?? {});
      const runs = text
        .split('\n')
        .map((l) => l.trim())
        .map((l) => l.replace(/^- /, ''))
        .filter((l) => l.startsWith('run:'));
      return { file, triggers, runs };
    })
    .filter((w) => w.triggers.includes('pull_request'))
    .map(({ file, runs }) => ({ file, runs }));
}

describe('CONTRIBUTING.md', () => {
  it('exists at the repository root, linked from the README sentence that invites contributions', () => {
    expect(existsSync(join(repoRoot, 'CONTRIBUTING.md'))).toBe(true);
    const readme = read('README.md');
    const invite = readme.indexOf('contributions welcome');
    expect(invite).toBeGreaterThanOrEqual(0);
    // The link extends that sentence rather than opening a section of its own:
    // README's numbers are regen-maintained and the page is edited one line
    // at a time.
    const sentence = readme.slice(invite, readme.indexOf('\n\n', invite));
    expect(sentence).toContain('](CONTRIBUTING.md)');
  });

  it('links only files that exist', () => {
    for (const m of contributing.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^https?:/.test(target)) continue;
      expect(existsSync(join(repoRoot, target)), `link target ${target}`).toBe(true);
    }
  });
});

describe('what an entry is', () => {
  const text = section('What an entry is');

  it('names every field the schema knows and no field it does not', () => {
    // Intersected with knownFields directly — not with the fields some
    // committed entry happens to use — so removing the last entry carrying
    // `dockerImage` cannot fail this for a reason unrelated to the page.
    const named = new Set(backticked(text).filter((id) => (knownFields as string[]).includes(id)));
    expect([...named].sort()).toEqual([...knownFields].sort());
  });

  it('marks required and optional the way the validator does', () => {
    const required = validateEntry({}, 0)
      .filter((p) => p.message === 'is required and absent')
      .map((p) => p.field!);
    expect(required.length).toBeGreaterThan(0);
    for (const field of knownFields) {
      const need = required.includes(field) ? 'required' : 'optional';
      expect(text, `${field} is ${need}`).toMatch(new RegExp(`^\\| \`${field}\` \\| ${need} \\|`, 'm'));
    }
  });

  it('lists the category values the validator accepts', () => {
    const bad = validateEntry({ ...base(), category: 'not-a-category' }, 0).find((p) => p.field === 'category')!;
    const categories = /must be one of (.*?) —/.exec(bad.message)![1].split(', ');
    expect(categories.length).toBeGreaterThan(1);
    for (const c of categories) expect(text).toContain(`\`${c}\``);
  });

  it('states the metricSource forms servers.yaml actually uses', () => {
    const sources = servers.map((s) => s.metricSource);
    for (const form of ['(npm weekly)', '(PyPI weekly)']) {
      expect(sources.some((s) => s.includes(form)), `servers.yaml uses ${form}`).toBe(true);
      expect(text).toContain(form);
    }
    for (const host of ['https://api.npmjs.org/downloads/point/last-week/', 'https://pypistats.org/packages/']) {
      expect(sources.some((s) => s.startsWith(host))).toBe(true);
      expect(text).toContain(host);
    }
    expect(text).toContain('unverified');
  });
});

describe('add an entry', () => {
  const text = section('Add an entry');

  it('names regen, the Unreleased bullet, npm test and the readiness gate, in the order that goes green', () => {
    // The numbered steps, not the paragraph above them that says why the
    // order matters (it names `npm test` first, as the failure a contributor
    // meets first).
    // Each numbered step opens with a bold instruction; the instruction, not
    // a later mention of the same tool as a reason, is what fixes the order.
    const steps = ['src/sweep/regen.ts', '## Unreleased', 'npm test', 'tools/release-readiness.ts'];
    const instructions = text
      .slice(text.indexOf('\n1. '))
      .split(/\n(?=\d+\. )/)
      .map((step) => /\*\*(.*?)\*\*/.exec(step)?.[1] ?? '');
    const at = steps.map((s) => instructions.findIndex((h) => h.includes(s)));
    for (const [i, s] of steps.entries()) expect(at[i], `a step says to run ${s}`).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < at.length; i++) expect(at[i], `${steps[i]} after ${steps[i - 1]}`).toBeGreaterThan(at[i - 1]);
  });

  it('describes the gate that makes the changelog bullet mandatory, and that gate still watches servers.yaml', () => {
    const gate = read('tools/release-readiness.ts');
    expect(gate).toContain('the changelog says nothing about work that ships');
    expect(gate).toMatch(/git\('diff', '--name-only'.*'servers\.yaml'/);
    expect(text).toContain('the changelog says nothing about work that ships');
    // The gate's whole test of the section is an emptiness test; the document
    // says so, and quotes the expression, so the two move together.
    expect(gate).toContain("section.includes('\\n- ')");
    expect(text).toContain("section.includes('\\n- ')");
    expect(flat(text)).toContain('never reads what the bullet says');
  });

  it('says to append rather than insert, for the reason shard.ts states', () => {
    expect(read('src/sweep/shard.ts')).toContain('inserting a server shifts the ones');
    expect(text).toContain('src/sweep/shard.ts');
    expect(text).toMatch(/[Aa]ppend/);
  });
});

describe('the launch command', () => {
  const text = section('The launch command is not the package id');
  const items = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- `'));
  const subcommandItems = items.slice(0, items.findIndex((l) => l.includes('hana-cli')) < 0 ? items.length : undefined);

  it('quotes each subcommand example as the command servers.yaml runs, and none of them is a bare package', () => {
    for (const name of ['agent-device', 'githits', 'emailmd']) {
      const e = entry(name);
      expect(e.command).not.toBe(`npx -y ${e.package}`);
      expect(items.some((l) => l.startsWith(`- \`${e.command}\``)), `${name}'s command is a list item`).toBe(true);
    }
  });

  it('does not list hana-cli among the subcommand examples — it is a separate bin with an upstream bug', () => {
    const e = entry('hana-cli');
    for (const l of subcommandItems) expect(l).not.toContain('hana-cli');
    expect(items.some((l) => l.includes('hana-cli'))).toBe(false);
    expect(text).toContain(e.command);
    expect(text).toMatch(/not a subcommand|different case/);
    // The record: the entry is still a startup failure, and the page says so
    // rather than listing it as a recovery.
    const record = JSON.parse(read('results/hana-cli/measurement.json')) as Measurement;
    expect(record.status).toBe('startup-failure');
    expect(text).toMatch(/still fails/);
  });

  it('quotes the transport-flag examples verbatim', () => {
    for (const name of ['anki', 'grafana']) expect(text).toContain(entry(name).command);
    expect(entry('anki').command).toContain('--stdio');
    expect(entry('grafana').command).toContain('--transport stdio');
  });

  it('does not repeat the sentence about agent-device that the record refutes', () => {
    expect(contributing).not.toMatch(/prints (its )?help and exits 0/);
    expect(contributing).toContain('exits non-zero');
  });

  it('carries the listed-not-launched line exactly when pr-check.ts prints it', () => {
    const source = read('src/sweep/pr-check.ts');
    const printed = source.includes('listed, not launched here');
    expect(contributing.includes('listed, not launched')).toBe(printed);
    if (printed) expect(contributing).toContain("its command is its own `docker run`");
  });
});

describe('check it locally', () => {
  const text = section('Check it locally');
  const runTs = read('src/sweep/run.ts');

  it('gives the --no-persist form and never the persisting one', () => {
    expect(runTs).toContain('--no-persist');
    expect(text).toContain('npm run sweep -- --no-persist');
    expect(contributing).not.toMatch(/npm run sweep -- --name/);
  });

  it('quotes what the flag prints', () => {
    expect(runTs).toContain('nothing written:');
    expect(text).toContain('nothing written');
    expect(text).toContain('never from');
  });

  it('carries the laptop rule in the words ROADMAP.md states under Not planned', () => {
    const roadmap = read('ROADMAP.md');
    const notPlanned = roadmap.slice(roadmap.indexOf('\n## Not planned'));
    const bullet = notPlanned
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('- ') && l.includes('developer machine'));
    expect(bullet).toBeDefined();
    expect(flat(text)).toContain(flat(bullet!.slice(2)));
  });

  it('hands out no raw docker probe recipe', () => {
    // The harness caps every launch and force-removes every container it
    // created (run.ts `finally`); a hand-written `docker run` has neither.
    for (const line of contributing.split('\n')) {
      if (line.trimStart().startsWith('- `docker run')) continue; // a quoted servers.yaml command
      if (line.includes('mcp/grafana')) continue;
      expect(line).not.toMatch(/^\s*(?:\$ )?docker run/);
      expect(line).not.toMatch(/timeout \d+ docker/);
    }
  });

  it('gives run.ts\'s reason for the cleanup, in run.ts\'s words', () => {
    // The document once said every working MCP server never exits; the
    // record says some. The sentence quotes the comment above the `finally`.
    const run = read('src/sweep/run.ts');
    const reason = "some servers don't exit on stdin close";
    expect(run).toContain(reason);
    expect(run).toMatch(/spawn\('docker', \['rm', '-f'/);
    expect(flat(text)).toContain(reason);
    expect(text).toContain('`docker rm -f`');
    expect(flat(text)).not.toMatch(/never exits on its own/);
  });
});

describe('timeoutSeconds', () => {
  const text = section('timeoutSeconds');

  it('states the budget the rotation and the check run with, read from the ymls', () => {
    const budgets = new Set<string>();
    for (const file of ['resweep.yml', 'pr-check.yml']) {
      const m = /--default-timeout (\d+)/.exec(readFileSync(join(wfDir, file), 'utf8'));
      expect(m, `${file} sets --default-timeout`).not.toBeNull();
      budgets.add(m![1]);
    }
    expect(budgets.size).toBe(1);
    expect(text).toContain(`--default-timeout ${[...budgets][0]}`);
  });

  it('points at the measured basis agent-device carries, and says the other values are not a precedent', () => {
    const yaml = read('servers.yaml');
    const basis = /# (Cold install measured at \d+s uncontended)/.exec(yaml);
    expect(basis).not.toBeNull();
    expect(text).toContain(basis![1]);
    expect(text).toContain(`timeoutSeconds: ${entry('agent-device').timeoutSeconds}`);
    expect(text).toMatch(/not a precedent/);
  });

  it('says what a timeout costs, from run.ts', () => {
    expect(read('src/sweep/run.ts')).toContain('export const TIMEOUT_RETRY_FACTOR = 2');
    expect(text).toContain('TIMEOUT_RETRY_FACTOR');
    expect(text).toContain('double');
  });
});

describe('env', () => {
  const text = section('env: names, never values');

  it('says names only, and the validator still rejects a value', () => {
    expect(validateEntry({ ...base(), env: ['API_KEY=x'] }, 0).some((p) => p.field === 'env')).toBe(true);
    expect(text).toContain('`NAME=dummy`');
    expect(read('src/sweep/docker.ts')).toContain("?? 'dummy'");
  });

  it('quotes what the self-containerised examples carry on their lines', () => {
    // github is the pure NAME=dummy shape; grafana carries a shaped localhost
    // URL beside its dummy. The document says which is which, in the
    // entries' own flags, so a change to either command line surfaces here.
    for (const name of ['github', 'grafana']) {
      const cmd = entry(name).command;
      expect(cmd.startsWith('docker run')).toBe(true);
      for (const flag of cmd.match(/-e \S+=\S+/g)!) expect(text).toContain(`\`${flag}\``);
    }
    expect(entry('github').command).toMatch(/-e \S+=dummy/);
    expect(entry('grafana').command).toMatch(/-e \S+=http:\/\/localhost/);
  });

  it('describes envValues by the entries that use it', () => {
    for (const name of ['elasticsearch', 'keboola']) {
      expect(entry(name).envValues, `${name} has envValues`).toBeDefined();
      expect(text).toContain(`\`${name}\``);
    }
    expect(validateEntry({ ...base(), envValues: { NOT_LISTED: 'x' } }, 0).some((p) => p.field === 'envValues')).toBe(true);
  });

  it('calls auth-required a finding, as the taxonomy does', () => {
    expect(read('docs/METHODOLOGY.md')).toContain('`auth-required` | won\'t start or list tools without real credentials');
    expect(text).toContain('`auth-required`');
    expect(text).toMatch(/finding/);
  });
});

describe('what happens on the pull request', () => {
  const text = section('What happens on the pull request');
  const prWorkflows = pullRequestRunLines();
  const measuring = prWorkflows.filter((w) => w.runs.some((l) => l.includes('pr-check.ts')));

  it('names pr-check exactly when a pull_request workflow runs it', () => {
    expect(contributing.includes('pr-check')).toBe(measuring.length > 0);
    for (const w of measuring) expect(text).toContain(w.file);
  });

  it('says every pull_request workflow holds a read-only token, and each one does', () => {
    expect(prWorkflows.length).toBeGreaterThan(0);
    for (const w of prWorkflows) {
      const wf = parse(readFileSync(join(wfDir, w.file), 'utf8')) as { permissions?: Record<string, string> };
      expect(wf.permissions, `${w.file} declares permissions`).toEqual({ contents: 'read' });
    }
    expect(text).toContain('read-only token');
  });

  it('names ci.yml and what it runs', () => {
    const ci = prWorkflows.find((w) => w.file === 'ci.yml');
    expect(ci).toBeDefined();
    expect(text).toContain('ci.yml');
    for (const needle of ['npm test', 'tools/release-readiness.ts']) {
      expect(ci!.runs.some((l) => l.includes(needle))).toBe(true);
    }
    expect(text).toContain('npm test');
  });

  it('places the readiness gate in ci.yml where the yml has it', () => {
    // The add-an-entry step that says to run the gate once claimed it was
    // what ci.yml runs last; the yml's last run: line is the badge golden
    // tests. The claim is allowed only when the yml's own last line makes it.
    const ci = prWorkflows.find((w) => w.file === 'ci.yml')!;
    const last = ci.runs[ci.runs.length - 1];
    const step = section('Add an entry')
      .split(/\n(?=\d+\. )/)
      .find((s) => s.includes('**Run `npx tsx tools/release-readiness.ts`'))!;
    expect(step).toBeDefined();
    if (!last.includes('release-readiness')) expect(flat(step)).not.toMatch(/runs last/);
    const after = ci.runs.slice(ci.runs.findIndex((l) => l.includes('release-readiness')) + 1);
    if (after.some((l) => l.includes('badge'))) expect(flat(step)).toContain('badge golden tests run after it');
  });

  it('states the check\'s permissions and its run-line flags as the yml has them', () => {
    for (const w of measuring) {
      const yml = readFileSync(join(wfDir, w.file), 'utf8');
      const wf = parse(yml) as { permissions: Record<string, string> };
      for (const [k, v] of Object.entries(wf.permissions)) expect(text).toContain(`${k}: ${v}`);
      const invocation = w.runs.find((l) => l.includes('pr-check.ts'))!;
      for (const flag of ['--max-entries', '--default-timeout']) {
        const m = new RegExp(`${flag} (\\d+)`).exec(invocation);
        expect(m, `${flag} on the run line`).not.toBeNull();
        expect(text).toContain(`${flag} ${m![1]}`);
      }
      expect(text).toContain('persist: false');
    }
  });

  it('lists the pass and fail statuses the way failsCheck decides them', () => {
    const statuses: Measurement['status'][] = [
      'measured',
      'dynamic',
      'auth-required',
      'startup-failure',
      'timeout',
      'not-applicable',
    ];
    const line = (label: string) => {
      const m = new RegExp(`^- \\*\\*${label}\\*\\*:(.*(?:\\n(?![-\\n]).*)*)`, 'm').exec(text);
      expect(m, `a '${label}' item`).not.toBeNull();
      return new Set(backticked(m![1]));
    };
    const pass = line('pass');
    const fail = line('fail');
    for (const s of statuses) {
      expect(fail.has(s), `${s} listed as failing`).toBe(failsCheck(s));
      expect(pass.has(s), `${s} listed as passing`).toBe(!failsCheck(s));
    }
  });

  it('says a first pull request waits for Approve and run, as pr-check.yml records', () => {
    for (const w of measuring) {
      expect(readFileSync(join(wfDir, w.file), 'utf8')).toContain('Approve and run');
    }
    expect(text).toContain('Approve and run');
  });

  it('gives the reviewer a list, and does not repeat the provenance summary servers.yaml promises but lacks', () => {
    expect(text).toContain('What the reviewer checks');
    for (const needle of ['`metricSource`', '`timeoutSeconds`', 'Provenance']) expect(text).toContain(needle);
    expect(contributing).not.toMatch(/provenance summary/);
  });
});

describe('after merge', () => {
  const text = section('After merge');
  const resweep = readFileSync(join(wfDir, 'resweep.yml'), 'utf8');

  it('names the status the reports print for an unmeasured entry', () => {
    expect(read('src/sweep/report.ts')).toContain("'not-yet-run'");
    expect(text).toContain('`not-yet-run`');
  });

  it('states the wait from the rotation\'s cron and shard default', () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
    const cron = /cron: '([^']*)'/.exec(resweep)![1].trim().split(/\s+/);
    expect(text).toContain(days[Number(cron[4])]);
    const shards = Number(/inputs\.shards \|\| '(\d+)'/.exec(resweep)![1]);
    expect(flat(text)).toContain(`${words[shards]} ${days[Number(cron[4])]}s`);
  });

  it('names the dispatch input as an option the workflow offers, not a promise', () => {
    expect(resweep).toMatch(/^\s+servers:\n\s+description:/m);
    expect(text).toContain('resweep.yml');
    expect(text).toContain('servers=');
    expect(text).toMatch(/\*may\*/);
    expect(text).toMatch(/not a promise/);
  });

  it('agrees with METHODOLOGY about where a not-yet-run row appears', () => {
    const row = read('docs/METHODOLOGY.md')
      .split('\n')
      .find((l) => l.startsWith('| `not-yet-run` |'))!;
    expect(row).toBeDefined();
    expect(row).not.toContain('interim leaderboards only');
    expect(row).toContain('rotation');
  });
});

describe('what gets in', () => {
  const text = section('What gets in');

  it('calls an expected failure a finding, keeps deprecated entries, and states no metric floor', () => {
    expect(read('servers.yaml')).toContain('findings, not\n  # omissions');
    expect(text).toMatch(/findings, not\s+omissions/);
    expect(servers.some((s) => s.deprecated)).toBe(true);
    expect(text).toContain('`deprecated`');
    expect(text).toMatch(/No metric floor/);
    expect(text).not.toMatch(/at least [\d,]+ (weekly )?downloads/);
  });

  it('describes remote entries by the shapes the file has', () => {
    expect(servers.some((s) => s.remote === true)).toBe(true);
    expect(servers.some((s) => s.command.startsWith('npx -y mcp-remote '))).toBe(true);
    expect(text).toContain('`remote: true`');
    expect(text).toContain('mcp-remote');
  });
});

describe('the page states no live count', () => {
  it('has no digits followed by the nouns the data is counted in, outside code and links', () => {
    const blank = (m: string) => m.replace(/[^\n]/g, ' ');
    const prose = contributing
      .replace(/^```[\s\S]*?^```/gm, blank)
      .replace(/`[^`\n]*`/g, blank)
      .replace(/\]\([^)]*\)/g, blank)
      .replace(/https?:\/\/\S+/g, blank);
    const hits = [...prose.matchAll(/\d[\d,]*\s+(?:[A-Za-z]+\s+){0,2}(?:servers?|entries|candidates?|files?|values?)\b/gi)];
    expect(hits.map((h) => h[0])).toEqual([]);
  });
});
