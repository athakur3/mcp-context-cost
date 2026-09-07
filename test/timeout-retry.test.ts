import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  measureServer,
  retriesWithLongerTimeout,
  TIMEOUT_CONFIRMED_PREFIX,
  TIMEOUT_RETRY_FACTOR,
} from '../src/sweep/run.js';
import { PROTOCOL_VERSION } from '../src/core/protocol.js';

/**
 * A stdio MCP server that hangs for its first `STUB_HANG_LAUNCHES` launches and
 * answers normally after — the shape of a server that starts slowly under sweep
 * concurrency and normally once the pool drains.
 */
const STUB = `
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const state = process.env.STUB_STATE;
const launched = existsSync(state) ? Number(readFileSync(state, 'utf8')) : 0;
writeFileSync(state, String(launched + 1));

if (launched < Number(process.env.STUB_HANG_LAUNCHES ?? '0')) {
  process.stdin.resume();            // read the request, never answer it
  setInterval(() => {}, 1000);
} else {
  let buf = '';
  const reply = (id, result) =>
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n');
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.method === 'initialize') {
        const v = process.env.STUB_PROTOCOL_VERSION ?? '2025-06-18';
        reply(msg.id, {
          // 'none' omits the field entirely — a server violating a required
          // field, which is a different fact from naming another revision.
          ...(v === 'none' ? {} : { protocolVersion: v }),
          capabilities: {},
          serverInfo: { name: 'stub', version: '1.0.0' },
        });
      }
      else if (msg.method === 'tools/list')
        reply(msg.id, {
          tools: [
            {
              name: 'echo',
              description: 'Echo a string back.',
              inputSchema: { type: 'object', properties: { s: { type: 'string' } } },
            },
          ],
        });
    }
  });
  process.stdin.on('end', () => process.exit(0));
}
`;

let dir: string;
let stubPath: string;
let seq = 0;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mcp-ctx-timeout-'));
  stubPath = join(dir, 'stub.mjs');
  writeFileSync(stubPath, STUB);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Each case gets its own launch counter, so the stub's state never leaks between tests. */
function stubOpts(hangLaunches: number, timeoutMs: number, protocolVersion?: string) {
  return {
    argv: [process.execPath, stubPath],
    env: {
      STUB_STATE: join(dir, `state-${++seq}`),
      STUB_HANG_LAUNCHES: String(hangLaunches),
      ...(protocolVersion ? { STUB_PROTOCOL_VERSION: protocolVersion } : {}),
    },
    timeoutMs,
    persist: false as const,
  };
}

describe('retriesWithLongerTimeout', () => {
  it('retries a timeout', () => {
    expect(retriesWithLongerTimeout('timeout')).toBe(true);
  });

  it('does not retry any other failure — none of them is a contention symptom', () => {
    expect(retriesWithLongerTimeout('startup-failure')).toBe(false);
    expect(retriesWithLongerTimeout('auth-required')).toBe(false);
  });

  it('does not retry a successful measurement', () => {
    expect(retriesWithLongerTimeout('measured')).toBe(false);
    expect(retriesWithLongerTimeout('dynamic')).toBe(false);
  });
});

describe('measureServer timeout retry', () => {
  it('does not publish a timeout that only a narrow budget produced', async () => {
    // Hangs once, answers after: exactly what a slow start under concurrency
    // looks like. Without the retry this is published as a failure.
    const m = await measureServer('stub-slow-start', 'node stub.mjs', stubOpts(1, 400));
    expect(m.status).toBe('measured');
    expect(m.toolCount).toBe(1);
    expect(m.totalTokens).toBeGreaterThan(0);
    expect(m.notes ?? '').not.toContain(TIMEOUT_CONFIRMED_PREFIX);
    // The published row records the budget the number was actually measured on.
    expect(m.timeoutMs).toBe(400 * TIMEOUT_RETRY_FACTOR);
  }, 20_000);

  it('says so when a timeout survives the wider budget', async () => {
    const m = await measureServer('stub-hangs', 'node stub.mjs', stubOpts(99, 300));
    expect(m.status).toBe('timeout');
    expect(m.notes ?? '').toContain(TIMEOUT_CONFIRMED_PREFIX);
    // The note has to name the budget it survived, not the one it first failed.
    expect(m.notes ?? '').toContain(String(300 * TIMEOUT_RETRY_FACTOR));
    expect(m.timeoutMs).toBe(300 * TIMEOUT_RETRY_FACTOR);
  }, 20_000);

  it('leaves a healthy server on a single attempt', async () => {
    const m = await measureServer('stub-fast', 'node stub.mjs', stubOpts(0, 5_000));
    expect(m.status).toBe('measured');
    expect(m.timeoutMs).toBe(5_000);
  }, 20_000);
});

/**
 * The stub replies with the same string this probe sends, so asserting that
 * value would pass equally for an implementation that recorded the server's
 * answer and one that echoed our own pin — and the difference between those two
 * is the entire meaning of the field. So the stub is told to answer something
 * else, through an env knob rather than by editing its literal:
 * `src/core/protocol.ts` states that the stubs keep independent literals on
 * purpose, because a fixture importing the constant could no longer catch the
 * probe drifting.
 */
describe('the revision the server named', () => {
  it('is recorded from the reply, not echoed from what we asked for', async () => {
    const m = await measureServer('stub-negotiated', 'node stub.mjs', stubOpts(0, 5_000, '2025-03-26'));
    expect(m.negotiatedProtocolVersion).toBe('2025-03-26');
    expect(m.requestedProtocolVersion).toBe(PROTOCOL_VERSION);
    expect(m.negotiatedProtocolVersion).not.toBe(m.requestedProtocolVersion);
  });

  it('is absent, not guessed, when the server omits a field it is required to send', async () => {
    const m = await measureServer('stub-silent', 'node stub.mjs', stubOpts(0, 5_000, 'none'));
    expect(m.negotiatedProtocolVersion).toBeUndefined();
    expect(m.requestedProtocolVersion).toBe(PROTOCOL_VERSION);
    expect('negotiatedProtocolVersion' in JSON.parse(JSON.stringify(m))).toBe(false);
  });

  it('records what a healthy server answered', async () => {
    const m = await measureServer('stub-agrees', 'node stub.mjs', stubOpts(0, 5_000));
    expect(m.status).toBe('measured');
    expect(m.negotiatedProtocolVersion).toBe(m.requestedProtocolVersion);
  });
});
