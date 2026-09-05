import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  formatProblems,
  knownFields,
  validateEntry,
  validateServers,
  type SchemaProblem,
} from '../src/sweep/servers-schema.js';

const repoRoot = join(import.meta.dirname, '..');
const doc = parse(readFileSync(join(repoRoot, 'servers.yaml'), 'utf8')) as unknown;

/**
 * The file this suite reads is the input to every published number, and it is
 * edited by hand. Nothing that consumes it validates it: `sweep-all`,
 * `regen`, `cross-check`, `session-start` and `dashboard` each `parse()` it and
 * cast straight to `ServerEntry[]`, so a misspelled key is a field that is
 * simply absent, and an absent optional field is indistinguishable from one
 * that was never wanted.
 *
 * The check is worth having on a file that is clean today because the cost of
 * a mistake in it is not a crash — it is a published number taken under
 * conditions nobody intended, discovered weeks later, if at all.
 */
describe('servers.yaml', () => {
  it('has no shape problems', () => {
    const problems = validateServers(doc);
    expect(formatProblems(problems)).toBe('');
  });

  it('is the file everything else in the repository reads', () => {
    // Guards against the suite passing over an empty or half-parsed document,
    // which would make every assertion above vacuous.
    const servers = (doc as { servers: unknown[] }).servers;
    expect(Array.isArray(servers)).toBe(true);
    expect(servers.length).toBeGreaterThan(100);
  });
});

/**
 * The field table in `servers-schema.ts` is declared `satisfies
 * Record<keyof ServerEntry, …>`, so a field added to the interface and not to
 * the table fails typecheck. This is the other direction, which the type
 * cannot see: a field in the table that the interface dropped, and a field
 * *used in the file* that neither knows about.
 */
describe('the field table', () => {
  it('covers every field the committed entries actually use', () => {
    const used = new Set<string>();
    for (const e of (doc as { servers: Record<string, unknown>[] }).servers) {
      for (const k of Object.keys(e)) used.add(k);
    }
    expect([...used].filter((k) => !knownFields.includes(k as never)).sort()).toEqual([]);
  });
});

/**
 * Each of these is a real way the file has been, or could be, written wrong.
 * They matter more than the pass above: a schema check that has never been
 * shown to reject anything is a schema check nobody knows the shape of.
 */
describe('an entry is rejected when', () => {
  const base = {
    name: 'demo',
    command: 'npx -y demo-mcp',
    package: 'demo-mcp',
    env: [],
    metric: 1,
    metricSource: 'https://example.invalid',
    category: 'community',
    repo: 'https://github.com/example/demo',
  };
  const check = (patch: Record<string, unknown>): SchemaProblem[] => validateEntry({ ...base, ...patch }, 0);
  const fields = (patch: Record<string, unknown>) => check(patch).map((p) => p.field ?? '').sort();

  it('accepts the entry the rest of these mutate', () => {
    expect(check({})).toEqual([]);
  });

  // The motivating case: YAML has no idea a key is meant to be `timeoutSeconds`.
  it('a field name is misspelled', () => {
    expect(fields({ timeoutSecond: 240 })).toEqual(['timeoutSecond']);
  });

  it('a required field is missing', () => {
    const e = { ...base } as Record<string, unknown>;
    delete e.metricSource;
    expect(validateEntry(e, 0).map((p) => p.field)).toEqual(['metricSource']);
  });

  it('the name would not be safe as a path', () => {
    expect(fields({ name: '../escape' })).toEqual(['name']);
    expect(fields({ name: 'Has Space' })).toEqual(['name']);
  });

  it('env holds values rather than names', () => {
    // Committing a value here is the one mistake in this file that would
    // publish a credential, so it fails on shape before anyone reviews it.
    expect(fields({ env: ['API_KEY=sk-live-123'] })).toEqual(['env']);
  });

  it('an envValues override names a variable the entry never asks for', () => {
    expect(fields({ env: ['A'], envValues: { B: 'x' } })).toEqual(['envValues']);
    expect(check({ env: ['A'], envValues: { A: 'x' } })).toEqual([]);
  });

  it('a declaration is missing the evidence that would corroborate it', () => {
    expect(fields({ notApplicable: { reason: 'needs a Redis' } })).toEqual(['notApplicable']);
    expect(fields({ notApplicable: { reason: 'needs a Redis', evidence: '  ' } })).toEqual(['notApplicable']);
  });

  it('a deprecation is not a dated reading', () => {
    const dep = { version: '0.3.1', source: 'https://npmjs.com/x', readOn: '2026-09-05' };
    expect(check({ deprecated: dep })).toEqual([]);
    expect(fields({ deprecated: { ...dep, readOn: 'September' } })).toEqual(['deprecated']);
    expect(fields({ deprecated: { ...dep, source: 'npm' } })).toEqual(['deprecated']);
  });

  it('a remote entry names a package instead of an endpoint', () => {
    expect(fields({ remote: true })).toEqual(['command']);
    expect(check({ remote: true, command: 'https://mcp.example.com/sse' })).toEqual([]);
  });

  it('an endpoint is listed without being marked remote', () => {
    // The inverse, and the likelier direction: a URL pasted into `command` on a
    // new entry would otherwise be handed to `sh -lc` inside a container.
    expect(fields({ command: 'https://mcp.example.com/sse' })).toEqual(['command']);
  });

  it('a timeout is not a whole number of seconds', () => {
    expect(fields({ timeoutSeconds: '240' })).toEqual(['timeoutSeconds']);
    expect(fields({ timeoutSeconds: 0 })).toEqual(['timeoutSeconds']);
    expect(fields({ timeoutSeconds: 1.5 })).toEqual(['timeoutSeconds']);
  });

  it('the category is not one the leaderboard groups on', () => {
    expect(fields({ category: 'misc' })).toEqual(['category']);
  });
});

describe('the document', () => {
  const entry = (name: string) => ({
    name,
    command: `npx -y ${name}`,
    package: name,
    env: [],
    metric: 1,
    metricSource: 'https://example.invalid',
    category: 'community',
    repo: 'https://github.com/example/x',
  });

  it('rejects two entries under one name', () => {
    // They would share results/<name>/measurement.json, and the second sweep in
    // the shard would overwrite the first's number with no diff to notice.
    const problems = validateServers({ servers: [entry('demo'), entry('demo')] });
    expect(problems.map((p) => p.message)).toEqual(['duplicates entry #1']);
  });

  it('rejects a document that is not a servers list at all', () => {
    expect(validateServers({}).length).toBe(1);
    expect(validateServers(null).length).toBe(1);
  });
});
