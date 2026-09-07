import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rpcErrorMessage, clampNotes } from '../src/sweep/client.js';
import {
  classifyFailure,
  measureServer,
  PROTOCOL_MISMATCH_EVIDENCE,
  retriesWithLongerTimeout,
  retriesWithoutSharedCache,
} from '../src/sweep/run.js';
import { isGood } from '../src/sweep/harness-guard.js';
import { failsCheck } from '../src/sweep/pr-check.js';
import { rowFor } from '../src/sweep/history.js';
import { toBadge } from '../src/core/badge.js';
import { failedMeasurement } from '../src/core/canonical.js';
import { PROTOCOL_VERSION } from '../src/core/protocol.js';

const repoRoot = join(import.meta.dirname, '..');

/**
 * Unlike `evidence-tail.test.ts`, these are not transcriptions: no server has
 * sent this repository either code yet — 0 of 103 records carry `-32601`,
 * `-32022`, `server/discover` or `2026-07-28`. They are built from the shapes
 * `schema/2026-07-28/schema.ts` defines (METHOD_NOT_FOUND at line 314,
 * UNSUPPORTED_PROTOCOL_VERSION and `UnsupportedProtocolVersionError` at 450 and
 * 483, read 2026-09-08), through the same function the wire path uses, so a
 * change to that function's phrasing moves these with it rather than leaving
 * them agreeing with a format nothing emits.
 */
const REMOVED_INITIALIZE = rpcErrorMessage('initialize', {
  code: -32601,
  message: 'method not found',
});

const WRONG_REVISION = rpcErrorMessage('initialize', {
  code: -32022,
  message: 'Unsupported protocol version',
  data: { supported: ['2026-07-28', '2025-11-25'], requested: PROTOCOL_VERSION },
});

/** The same refusal from a server whose own message runs past the notes cap. */
const VERBOSE_REVISION = rpcErrorMessage('initialize', {
  code: -32022,
  message:
    'Unsupported protocol version. ' +
    'Please consult the server documentation for the revisions this deployment accepts. '.repeat(10),
  data: { supported: ['2026-07-28'], requested: PROTOCOL_VERSION },
});

/** A server that has no tools is a fact about the server, not about the protocol. */
const NO_TOOLS = rpcErrorMessage('tools/list', { code: -32601, message: 'method not found' });

/**
 * The same version refusal, on a later request. `-32022` was introduced by
 * `2026-07-28` — `2025-11-25` has neither the constant nor `server/discover` —
 * and that revision carries the protocol version in a per-request `_meta`
 * field, so any request can be the one refused. This is the realistic shape,
 * not the `initialize` one.
 */
const WRONG_REVISION_LATER = rpcErrorMessage('tools/list', {
  code: -32022,
  message: 'Unsupported protocol version',
  data: { supported: ['2026-07-28'], requested: PROTOCOL_VERSION },
});

describe('classifyFailure reads a protocol refusal', () => {
  it('names the revision when initialize is the method that was refused', () => {
    expect(classifyFailure(REMOVED_INITIALIZE)).toBe('protocol-mismatch');
    expect(classifyFailure(WRONG_REVISION)).toBe('protocol-mismatch');
  });

  it('carries the versions the server says it speaks', () => {
    expect(WRONG_REVISION).toContain('"supported":["2026-07-28","2025-11-25"]');
  });

  /**
   * The false positive this pattern is bounded to avoid. Same code, different
   * method: a server that answers `initialize` and then has no `tools/list`
   * exposes no tools, and that is its own property, not this harness's pin.
   */
  it('leaves a -32601 answering tools/list as a startup-failure', () => {
    expect(classifyFailure(NO_TOOLS)).toBe('startup-failure');
    expect(PROTOCOL_MISMATCH_EVIDENCE.test(NO_TOOLS)).toBe(false);
  });

  /**
   * The other half of that boundary, and the reason the two codes are anchored
   * differently. `-32601` is meaningful only relative to a method; `-32022` is
   * meaningful only relative to a version, and can never mean "no tools"
   * whatever request carried it. Anchoring both to `initialize` published a
   * `startup-failure` about a working server — the exact harm this status
   * exists to prevent.
   */
  it('reads a -32022 answering tools/list as a protocol refusal all the same', () => {
    expect(classifyFailure(WRONG_REVISION_LATER)).toBe('protocol-mismatch');
    expect(WRONG_REVISION_LATER).not.toContain('answering initialize');
  });

  /**
   * A server's log does not get to choose its own status. An exit is an exit,
   * whatever the process printed on the way out — the words below are exactly
   * the ones a migrating server is most likely to print.
   */
  it('leaves a process exit that merely mentions the new revision as a startup-failure', () => {
    const exited =
      'server exited (code 1); stderr tail: FATAL: this build serves server/discover only ' +
      '(protocol 2026-07-28); no legacy handler registered';
    expect(classifyFailure(exited)).toBe('startup-failure');
  });

  /**
   * Branch order, pinned. `AUTH_EVIDENCE` is a word list matched against
   * third-party prose, and a server is entitled to mention a token while
   * refusing our revision; the protocol pattern needs our own phrasing plus a
   * specific code plus the method, so it is asked first.
   */
  it('stays a protocol refusal when the server also mentions a token', () => {
    const both = rpcErrorMessage('initialize', {
      code: -32022,
      message: 'Unsupported protocol version; re-authorize with a new api key after upgrading',
      data: { supported: ['2026-07-28'], requested: PROTOCOL_VERSION },
    });
    expect(both).toMatch(/api key/);
    expect(classifyFailure(both)).toBe('protocol-mismatch');
  });

  /**
   * The true positive this must not cost. `magic` answers `-32001`, which is
   * neither of the two codes, and it is the record that made `AUTH_EVIDENCE`
   * bound its alternatives in the first place (5e99a3d).
   */
  it('still reads the magic record on disk as auth-required', () => {
    const path = join(repoRoot, 'results', 'magic', 'measurement.json');
    expect(existsSync(path), 'results/magic/measurement.json').toBe(true);
    const m = JSON.parse(readFileSync(path, 'utf8')) as { status: string; notes: string };
    expect(m.notes.startsWith('server error -32001:')).toBe(true);
    expect(classifyFailure(m.notes)).toBe('auth-required');
    expect(m.status).toBe('auth-required');
  });
});

/**
 * The whole reason `rpcErrorMessage` puts `data` before the server's message.
 * `run.ts` clamps a record's notes by cutting the tail, so whichever of the two
 * sits last is the one a long message deletes.
 */
describe('the supported revisions survive the notes cap', () => {
  it('keeps them when the server message runs past the cap', () => {
    expect(VERBOSE_REVISION.length).toBeGreaterThan(700);
    expect(clampNotes(VERBOSE_REVISION, 700)).toContain('"supported":["2026-07-28"]');
  });

  it('would lose them if data came last — the ordering is load-bearing', () => {
    const dataLast = VERBOSE_REVISION.replace(
      / \[data: (.*?)\]: /,
      (_m, data: string) => `: `,
    ).concat(`; data: {"supported":["2026-07-28"],"requested":"${PROTOCOL_VERSION}"}`);
    expect(dataLast.length).toBeGreaterThan(700);
    expect(clampNotes(dataLast, 700)).not.toContain('2026-07-28');
  });

  it('classifies off the message before the cut, so the cap can never move a status', () => {
    expect(classifyFailure(VERBOSE_REVISION)).toBe('protocol-mismatch');
  });
});

describe('what the status does to everything downstream', () => {
  const m = failedMeasurement('protocol-mismatch', {
    serverName: 'stub',
    notes: REMOVED_INITIALIZE,
  });

  it('is not a number worth protecting', () => {
    expect(isGood('protocol-mismatch')).toBe(false);
  });

  /**
   * Neither retry fires, and correctly so: a cold package cache does not change
   * a protocol revision, and neither does a wider timeout budget.
   */
  it('is not retried', () => {
    expect(retriesWithLongerTimeout('protocol-mismatch')).toBe(false);
    expect(retriesWithoutSharedCache('protocol-mismatch', true, 'npx -y some-server')).toBe(false);
  });

  /**
   * Passes the pull-request check. The entry launched, the transport worked and
   * the server answered; the reason there is no number is the revision this
   * repository pins, which no contributor can change from their entry.
   */
  it('does not fail a contributor\'s pull request', () => {
    expect(failsCheck('protocol-mismatch')).toBe(false);
  });

  /** No row, so no fabricated drop to zero in the trend line. */
  it('writes no history row', () => {
    expect(rowFor('stub', m)).toBeNull();
  });

  it('badges as unknown rather than as a number', () => {
    expect(toBadge(m).message).toBe('unknown');
  });
});

/**
 * End to end, over a real stdio process. The stub answers `initialize` with the
 * error named in its environment and nothing else — which is all a server that
 * does not share our revision ever gets to say.
 */
const STUB = `
let buf = '';
const initErr = process.env.STUB_INIT_ERROR ? JSON.parse(process.env.STUB_INIT_ERROR) : null;
const toolsErr = process.env.STUB_TOOLS_ERROR ? JSON.parse(process.env.STUB_TOOLS_ERROR) : null;
const send = (id, body) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...body }) + '\\n');
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
      send(msg.id, initErr
        ? { error: initErr }
        : { result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'stub', version: '1.0.0' } } });
    else if (msg.method === 'tools/list' && toolsErr) send(msg.id, { error: toolsErr });
  }
});
process.stdin.on('end', () => process.exit(0));
`;

describe('a server that refuses the handshake, over a real process', () => {
  let dir: string;
  let stubPath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcp-ctx-protocol-'));
    stubPath = join(dir, 'stub.mjs');
    writeFileSync(stubPath, STUB);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const run = (env: Record<string, string>) =>
    measureServer('stub-protocol', 'node stub.mjs', {
      argv: [process.execPath, stubPath],
      env,
      timeoutMs: 5_000,
      persist: false as const,
    });
  const onInitialize = (error: unknown) => run({ STUB_INIT_ERROR: JSON.stringify(error) });
  const onToolsList = (error: unknown) => run({ STUB_TOOLS_ERROR: JSON.stringify(error) });

  it('records the removed handshake as protocol-mismatch, not startup-failure', async () => {
    const m = await onInitialize({ code: -32601, message: 'method not found' });
    expect(m.status).toBe('protocol-mismatch');
    expect(m.totalTokens).toBeNull();
  });

  /**
   * The case the whole design exists for: the server names the revisions it
   * does speak, and the published record quotes them.
   */
  it('quotes the revisions the server named', async () => {
    const m = await onInitialize({
      code: -32022,
      message: 'Unsupported protocol version',
      data: { supported: ['2026-07-28'], requested: PROTOCOL_VERSION },
    });
    expect(m.status).toBe('protocol-mismatch');
    expect(m.notes).toContain('2026-07-28');
    expect(m.notes).toContain('answering initialize');
  });

  /**
   * A server that keeps an `initialize` shim and refuses the version on the
   * next request. Before the two codes were anchored separately this published
   * `startup-failure` — a claim that working software did not come up.
   */
  it('reads a version refusal that arrives after the handshake', async () => {
    const m = await onToolsList({
      code: -32022,
      message: 'Unsupported protocol version',
      data: { supported: ['2026-07-28'], requested: PROTOCOL_VERSION },
    });
    expect(m.status).toBe('protocol-mismatch');
    expect(m.notes).toContain('answering tools/list');
    expect(m.notes).toContain('2026-07-28');
  });
});
