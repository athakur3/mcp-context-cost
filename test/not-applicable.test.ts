import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { classifyFailure, notApplicableReason, retriesWithoutSharedCache } from '../src/sweep/run.js';
import { isGood } from '../src/sweep/harness-guard.js';
import type { ServerEntry } from '../src/sweep/report.js';
import type { Measurement } from '../src/core/types.js';

const repoRoot = join(import.meta.dirname, '..');
const doc = parse(readFileSync(join(repoRoot, 'servers.yaml'), 'utf8')) as { servers: ServerEntry[] };

const SAFARI_FAILURE =
  'server exited (code 1); stderr tail: npm error code EBADPLATFORM\n' +
  'npm error notsup Unsupported platform for safari-mcp@2.17.1: wanted {"os":"darwin"} (current: {"os":"linux"})';

describe('notApplicableReason', () => {
  const declared = { reason: 'macOS only', evidence: 'EBADPLATFORM' };

  it('claims the failure only when the failure says so', () => {
    expect(notApplicableReason(declared, SAFARI_FAILURE)).toBe('macOS only');
  });

  it('matches regardless of case, since these strings are copied from logs', () => {
    expect(notApplicableReason({ ...declared, evidence: 'ebadplatform' }, SAFARI_FAILURE)).toBe(
      'macOS only',
    );
  });

  it('lets a stale annotation fail loudly rather than absorb a real breakage', () => {
    // The point of requiring corroboration. If safari-mcp one day ships a Linux
    // build and then breaks for its own reasons, the platform excuse must stop
    // applying — otherwise a genuine startup failure is published as "we can't
    // run this here" and nobody ever looks at it again.
    const different = 'server exited (code 1); stderr tail: TypeError: undefined is not a function';
    expect(notApplicableReason(declared, different)).toBeNull();
  });

  it('ignores a declaration with no evidence, which would excuse everything', () => {
    expect(notApplicableReason({ reason: 'trust me', evidence: '' }, SAFARI_FAILURE)).toBeNull();
    expect(notApplicableReason(undefined, SAFARI_FAILURE)).toBeNull();
  });
});

describe('not-applicable in the taxonomy', () => {
  it('is not a number on record, so the harness guard never counts it as good', () => {
    expect(isGood('not-applicable')).toBe(false);
  });

  it('does not pay the cold-cache retry a startup-failure pays', () => {
    // The retry exists to tell a poisoned package cache from a real breakage.
    // A macOS-only package will not install on the second attempt either, and
    // on a rotation these retries are a third of the wall clock.
    expect(retriesWithoutSharedCache('not-applicable', true, 'npx -y safari-mcp')).toBe(false);
  });
});

describe('classifyFailure reads this harness’s own phrasing', () => {
  it('does not call a server’s exit a timeout because its log says “timeout”', () => {
    // These messages carry the server's stderr now, so the bare word appears in
    // failures that are not timeouts at all.
    const exited =
      'server exited (code 1); stderr tail: Error: connection timeout contacting upstream';
    expect(classifyFailure(exited)).toBe('startup-failure');
  });

  it('still recognises a real one', () => {
    expect(classifyFailure('timeout after 240000ms waiting for initialize')).toBe('timeout');
    // ...including now that a timeout carries evidence of its own.
    expect(
      classifyFailure('timeout after 240000ms waiting for initialize; stderr tail: connecting…'),
    ).toBe('timeout');
  });
});

describe('the declarations in servers.yaml', () => {
  const declaring = doc.servers.filter((s) => s.notApplicable);

  it('exist, and each states both a reason and its evidence', () => {
    expect(declaring.length).toBeGreaterThan(0);
    for (const s of declaring) {
      expect(s.notApplicable!.reason.trim(), `${s.name} reason`).not.toBe('');
      expect(s.notApplicable!.evidence.trim(), `${s.name} evidence`).not.toBe('');
    }
  });

  it('are the only way a published record can carry the status', () => {
    // A `not-applicable` record with no declaration behind it would be a status
    // nothing corroborates — exactly what the evidence requirement prevents.
    const declared = new Set(declaring.map((s) => s.name));
    for (const s of doc.servers) {
      const p = join(repoRoot, 'results', s.name, 'measurement.json');
      if (!existsSync(p)) continue;
      const m = JSON.parse(readFileSync(p, 'utf8')) as Measurement;
      if (m.status !== 'not-applicable') continue;
      expect(declared.has(s.name), `${s.name} is published not-applicable`).toBe(true);
      expect(
        String(m.notes ?? '').toLowerCase(),
        `${s.name}'s record must contain its declared evidence`,
      ).toContain(s.notApplicable!.evidence.toLowerCase());
    }
  });
});
