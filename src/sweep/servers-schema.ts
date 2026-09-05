/**
 * A shape check over `servers.yaml`, and the one thing nothing else here does:
 * refuse a key nobody reads.
 *
 * The file is hand-edited YAML behind every published number, and YAML's
 * failure mode is silence. `timeoutSecond: 240` parses, loads, sweeps, and
 * times out at the default budget for as long as nobody rereads the line;
 * `notApplicable` with a `reason` and no `evidence` declares a limitation the
 * corroboration rule can never confirm. Neither is a crash, so neither is
 * caught by the sweep that consumes them — the entry simply behaves as though
 * the field were absent, which it is.
 *
 * The division of labour with the tests that already read this file is
 * deliberate. `not-applicable.test.ts` asks whether a declaration is *true* —
 * whether the record on disk still carries the evidence it claims — and
 * `deprecated.test.ts` asks the same of a deprecation's version and source.
 * Those are questions about the world. This module asks only whether the entry
 * is *shaped* like one the loaders can read, which is a question about the
 * file, and it asks it of all 106 entries rather than of the handful that
 * happen to carry the field today.
 *
 * Exported as a function rather than written inline in the test because the
 * read-only pull-request check is the second caller: a stranger's entry has to
 * fail this before anything measures it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { ServerEntry } from './report.js';

export interface SchemaProblem {
  /** The entry's `name`, or `entry #N` when the entry has no usable one. */
  entry: string;
  field?: string;
  message: string;
}

/**
 * Every field an entry may carry, and whether it is required.
 *
 * Kept as data rather than as a chain of `if`s so that `knownFields` below can
 * be compared against the `ServerEntry` interface itself: a field added to the
 * type and not to this table is a field this check would silently permit under
 * "unknown key" — the exact hole it exists to close, reopened one level up.
 */
const FIELDS = {
  name: 'required',
  command: 'required',
  package: 'required',
  env: 'required',
  metric: 'required',
  metricSource: 'required',
  category: 'required',
  repo: 'required',
  remote: 'optional',
  dockerImage: 'optional',
  timeoutSeconds: 'optional',
  needsGit: 'optional',
  aptPackages: 'optional',
  envValues: 'optional',
  notApplicable: 'optional',
  deprecated: 'optional',
} as const satisfies Record<keyof ServerEntry, 'required' | 'optional'>;

export const knownFields = Object.keys(FIELDS) as (keyof typeof FIELDS)[];

/**
 * `name` is not just a label: it is `results/<name>/`, `badges/<name>.json` and
 * `docs/servers/<name>.md`. A space or a slash in it would write outside the
 * directory the sweep believes it is writing to, so the shape is pinned here
 * rather than discovered at the first `mkdir`.
 */
const NAME = /^[a-z0-9][a-z0-9._-]*$/;

/**
 * What an `env` entry may be: a name a shell accepts, since docker mode passes
 * each one as `-e NAME=…`. Exported so the registry scan's test can pick the
 * live variable that fails it (`2Captcha_API_KEY`) from the fixture instead of
 * carrying a second copy of the rule.
 */
export const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const CATEGORIES = ['official-reference', 'vendor-official', 'community'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Shape-check one entry. `index` names it when its own `name` is unusable. */
export function validateEntry(raw: unknown, index: number): SchemaProblem[] {
  const problems: SchemaProblem[] = [];
  const label = isPlainObject(raw) && typeof raw.name === 'string' && raw.name ? raw.name : `entry #${index + 1}`;
  const bad = (message: string, field?: string) => problems.push({ entry: label, field, message });

  if (!isPlainObject(raw)) {
    bad(`is ${Array.isArray(raw) ? 'a list' : typeof raw}, not a mapping`);
    return problems;
  }
  const e = raw;

  for (const key of Object.keys(e)) {
    if (!(key in FIELDS)) bad(`unknown field — nothing reads it, so it does nothing`, key);
  }
  for (const [key, need] of Object.entries(FIELDS)) {
    if (need === 'required' && e[key] === undefined) bad('is required and absent', key);
  }

  if (typeof e.name === 'string' && !NAME.test(e.name)) {
    bad(`must be a slug — it becomes results/<name>/, badges/<name>.json and docs/servers/<name>.md`, 'name');
  } else if (e.name !== undefined && typeof e.name !== 'string') {
    bad('must be a string', 'name');
  }

  for (const key of ['command', 'package', 'metricSource', 'repo'] as const) {
    const v = e[key];
    if (v !== undefined && (typeof v !== 'string' || v.trim() === '')) bad('must be a non-empty string', key);
  }

  if (e.category !== undefined && !CATEGORIES.includes(String(e.category))) {
    bad(`must be one of ${CATEGORIES.join(', ')} — the leaderboard groups on it`, 'category');
  }

  if (e.metric !== undefined && (typeof e.metric !== 'number' || !Number.isFinite(e.metric) || e.metric < 0)) {
    bad('must be a non-negative number — it is the install metric the row is ranked by', 'metric');
  }

  const env = e.env;
  if (env !== undefined) {
    if (!Array.isArray(env)) bad('must be a list of variable NAMES (values are never committed)', 'env');
    else {
      for (const n of env) {
        if (typeof n !== 'string' || !ENV_NAME.test(n)) {
          bad(`holds ${JSON.stringify(n)}, which is not an environment variable name`, 'env');
        }
      }
    }
  }

  for (const key of ['remote', 'needsGit'] as const) {
    if (e[key] !== undefined && typeof e[key] !== 'boolean') bad('must be true or false', key);
  }

  // A remote entry keeps its endpoint in `command` — that is the string the
  // mcp-remote bridge is handed, and the string the listing prints. So the rule
  // is not "remote instead of command" but "remote means command is a URL": an
  // entry marked remote whose command is an `npx` line would be listed as an
  // unmeasurable endpoint while naming a package anyone could measure.
  if (e.remote === true && typeof e.command === 'string' && !/^https?:\/\//.test(e.command)) {
    bad('is remote, so its command must be the endpoint URL', 'command');
  }
  if (e.remote !== true && typeof e.command === 'string' && /^https?:\/\//.test(e.command)) {
    bad('is a URL, so the entry must be marked remote: true', 'command');
  }

  const apt = e.aptPackages;
  if (apt !== undefined) {
    // The names are joined into a shell word list inside the container, so this
    // character class is the boundary: a value that is not a package name never
    // reaches `sh -lc`.
    if (!Array.isArray(apt) || apt.length === 0) bad('must be a non-empty list of Debian package names', 'aptPackages');
    else {
      for (const n of apt) {
        if (typeof n !== 'string' || !/^[a-z0-9][a-z0-9+._-]*$/.test(n)) {
          bad(`holds ${JSON.stringify(n)}, which is not a Debian package name`, 'aptPackages');
        }
      }
    }
  }

  if (e.dockerImage !== undefined && (typeof e.dockerImage !== 'string' || e.dockerImage.trim() === '')) {
    bad('must be a non-empty image reference', 'dockerImage');
  }

  const t = e.timeoutSeconds;
  if (t !== undefined && (typeof t !== 'number' || !Number.isInteger(t) || t <= 0)) {
    bad('must be a whole number of seconds greater than zero', 'timeoutSeconds');
  }

  const values = e.envValues;
  if (values !== undefined) {
    if (!isPlainObject(values)) bad('must be a mapping of variable name to placeholder', 'envValues');
    else {
      const declared = new Set(Array.isArray(env) ? env.map(String) : []);
      for (const [k, v] of Object.entries(values)) {
        if (typeof v !== 'string') bad(`${k} must be a string`, 'envValues');
        // An override for a variable the entry never asks for is injected by
        // nobody: docker mode iterates `env`, so the placeholder that was
        // supposed to get the server past a URI parse never reaches it.
        if (!declared.has(k)) bad(`overrides ${k}, which the entry does not list in env`, 'envValues');
      }
    }
  }

  const na = e.notApplicable;
  if (na !== undefined) {
    if (!isPlainObject(na)) bad('must be a mapping with reason and evidence', 'notApplicable');
    else {
      for (const key of ['reason', 'evidence'] as const) {
        const v = na[key];
        // `evidence` empty is the dangerous half: `notApplicableReason` returns
        // null on a falsy evidence string, so the declaration is inert and the
        // entry goes on being published as the failure the bucket exists to
        // avoid asserting.
        if (typeof v !== 'string' || v.trim() === '') bad(`${key} is required and must be non-empty`, 'notApplicable');
      }
      for (const key of Object.keys(na)) {
        if (key !== 'reason' && key !== 'evidence') bad(`unknown key ${key}`, 'notApplicable');
      }
    }
  }

  const dep = e.deprecated;
  if (dep !== undefined) {
    if (!isPlainObject(dep)) bad('must be a mapping with version, source and readOn', 'deprecated');
    else {
      for (const key of ['version', 'source', 'readOn'] as const) {
        const v = dep[key];
        if (typeof v !== 'string' || v.trim() === '') bad(`${key} is required and must be non-empty`, 'deprecated');
      }
      if (typeof dep.source === 'string' && !/^https?:\/\//.test(dep.source)) {
        bad('source must be a URL — a published claim carries its evidence', 'deprecated');
      }
      // A dated reading with no date is not a dated reading.
      if (typeof dep.readOn === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(dep.readOn)) {
        bad('readOn must be YYYY-MM-DD', 'deprecated');
      }
      if (dep.replacement !== undefined && typeof dep.replacement !== 'string') {
        bad('replacement must be a string when present', 'deprecated');
      }
      for (const key of Object.keys(dep)) {
        if (!['version', 'source', 'readOn', 'replacement'].includes(key)) bad(`unknown key ${key}`, 'deprecated');
      }
    }
  }

  return problems;
}

/** Shape-check the whole document, including the invariants that span entries. */
export function validateServers(doc: unknown): SchemaProblem[] {
  if (!isPlainObject(doc) || !Array.isArray(doc.servers)) {
    return [{ entry: 'servers.yaml', message: 'must be a mapping with a `servers` list' }];
  }
  const problems: SchemaProblem[] = [];
  const seen = new Map<string, number>();
  doc.servers.forEach((raw, i) => {
    problems.push(...validateEntry(raw, i));
    const name = isPlainObject(raw) && typeof raw.name === 'string' ? raw.name : null;
    if (!name) return;
    // Names are keys: two entries sharing one would write the same
    // results/<name>/measurement.json, and the later sweep in the shard would
    // silently overwrite the earlier one's number.
    const first = seen.get(name);
    if (first !== undefined) problems.push({ entry: name, field: 'name', message: `duplicates entry #${first + 1}` });
    else seen.set(name, i);
  });
  return problems;
}

/** One problem per line, in the voice the pull-request check prints. */
export function formatProblems(problems: SchemaProblem[]): string {
  return problems.map((p) => `${p.entry}${p.field ? `.${p.field}` : ''}: ${p.message}`).join('\n');
}

export function loadServersDoc(root = process.cwd()): unknown {
  return parse(readFileSync(join(root, 'servers.yaml'), 'utf8'));
}
