import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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

  /**
   * The published statuses these two produced. An unbounded `auth` alternative
   * matched inside `authority` and an unbounded `token` inside
   * `PublicKeyToken`, so a TLS trust failure in this harness's own container
   * and a .NET assembly name were each published as "this server wants a
   * credential" — a claim about someone else's software that the record did
   * not support.
   */
  it('does not read a credential request into a word that merely contains one', () => {
    const tls =
      'server exited (code 1); stderr tail: {"level":"error","message":"Request failed",' +
      '"error":"tls: failed to verify certificate: x509: certificate signed by unknown authority"}';
    expect(classifyFailure(tls)).toBe('startup-failure');

    const dotnet =
      'server exited (code 0); stderr tail: System.Private.CoreLib, Version=9.0.0.0, ' +
      'Culture=neutral, PublicKeyToken=null';
    expect(classifyFailure(dotnet)).toBe('startup-failure');

    // Neither is a near miss of a real one: a tokenizer is not a token either.
    expect(classifyFailure('server exited (code 1); stderr tail: tokenizer init failed')).toBe(
      'startup-failure',
    );
  });

  /**
   * The six records that genuinely say so, in the words they actually use.
   * Bounding the pattern is only correct if it still reads every one of them —
   * `tracker_token` in particular, where `\b` would have failed because it
   * counts `_` as part of the word.
   */
  it('still reads every phrasing a measured server has actually used', () => {
    const genuine: Record<string, string> = {
      gdrive: "Credentials not found. Please run with 'auth' argument first.",
      gmail: 'Error: OAuth keys file not found. Please place gcp-oauth.keys.json in current directory',
      keboola: "Client error '401 Unauthorized' for url 'https://connection.keboola.com/v2/storage/tokens/verify'",
      magic: 'Not authenticated - your API key is missing or was reset.',
      stripe: 'Invalid API key format. Expected sk_* (secret key) or rk_* (restricted key).',
      'yandex-tracker':
        'Value error, tracker_token or tracker_iam_token or tracker_sa_* must be set when oauth_enabled is False',
    };
    for (const [server, tail] of Object.entries(genuine)) {
      expect(classifyFailure(`server exited (code 1); stderr tail: ${tail}`), server).toBe('auth-required');
    }
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

  /**
   * A declaration this repository publishes has to be one the data actually
   * supports, or it is an annotation that will never fire while the entry goes
   * on being published as the failure the bucket exists to avoid.
   *
   * `redis-legacy` was declared on 2026-09-05 against the record below, whose
   * words the existing evidence rule already matched. `grafana` was considered
   * the same day and deliberately left undeclared, because its record said the
   * container came up and served SSE while this harness waited on stdio — a
   * cause its own evidence did not carry. Refusing to declare it is what left
   * the real question open, and the answer turned out to be a launch bug in
   * this repository: the `mcp/grafana` image's ENTRYPOINT hard-codes
   * `--transport sse`. Both it and `anki` now pass a stdio flag and measure.
   * The bucket stayed honest by staying empty.
   *
   * Going red here means the failure changed upstream and the annotation needs
   * revisiting, which is the outcome to want: it is the same staleness the
   * evidence requirement exists to catch, one level up.
   */
  it('is corroborated by the record on disk, not merely asserted', () => {
    for (const s of declaring) {
      const p = join(repoRoot, 'results', s.name, 'measurement.json');
      if (!existsSync(p)) continue;
      const m = JSON.parse(readFileSync(p, 'utf8')) as Measurement;
      if (isGood(m.status)) continue; // it measured: the declaration is dormant, not wrong
      expect(
        String(m.notes ?? '').toLowerCase(),
        `${s.name}: its declared evidence is not in its current record — either the failure ` +
          `changed upstream, or the evidence was never in the words`,
      ).toContain(s.notApplicable!.evidence.toLowerCase());
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

/**
 * `notApplicable` is a per-entry declaration, and every path that measures a
 * `servers.yaml` entry has to carry it. It reached one of three: `sweep-all`
 * passed it while `cross-check` and `session-start` iterate the same entries
 * and omitted it — so either would have published a declared entry as
 * `startup-failure`, the assertion about someone else's software the bucket
 * exists to prevent. Latent only because the declared servers happen to be
 * absent from those two outputs.
 *
 * Structural rather than behavioural, because the defect is a missing line at
 * a call site: a fourth sweep path added later would reintroduce it silently,
 * and no test of the three that exist today would notice.
 */
describe('every sweep path that measures a servers.yaml entry forwards its declaration', () => {
  const sweepDir = join(repoRoot, 'src', 'sweep');

  it('passes notApplicable wherever it measures an entry', () => {
    const sites: { file: string; forwards: boolean }[] = [];
    for (const file of readdirSync(sweepDir).filter((f) => f.endsWith('.ts')).sort()) {
      const src = readFileSync(join(sweepDir, file), 'utf8');
      // The shape that measures a servers.yaml entry: the entry's own name and
      // command, then an options object. The other three call sites in the
      // package measure something that is not an entry — an ad-hoc `--command`,
      // a remote URL, or a server out of the *user's* config — and have no
      // declaration to forward.
      for (const call of src.matchAll(/measureServer\(\s*e\.name\s*,\s*e\.command\s*,\s*\{/g)) {
        const close = src.indexOf('});', call.index);
        const options = src.slice(call.index, close === -1 ? call.index + 800 : close);
        sites.push({ file, forwards: /notApplicable:\s*e\.notApplicable/.test(options) });
      }
    }
    // A rename that made the pattern stop matching would otherwise pass this
    // test by finding nothing at all.
    expect(sites.map((s) => s.file)).toEqual(['cross-check.ts', 'session-start.ts', 'sweep-all.ts']);
    expect(sites.filter((s) => !s.forwards).map((s) => s.file)).toEqual([]);
  });
});
