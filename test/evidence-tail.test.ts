import { describe, it, expect } from 'vitest';
import { evidenceTail, clampNotes } from '../src/sweep/client.js';
import { classifyFailure, notApplicableReason } from '../src/sweep/run.js';

/**
 * Every fixture here is real stderr from a server in servers.yaml, reproduced
 * in the published isolation. The bug these cover is not that the notes read
 * badly — it is that a record was filed under the wrong status because the
 * words the classifier reads had been truncated away.
 */

/** `npx -y @stripe/mcp --tools=all`, no key in the environment. */
const STRIPE = [
  'npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory.',
  'npm warn deprecated glob@7.2.3: Old versions of glob are not supported.',
  'npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported',
  'The --tools flag has been removed. Tool permissions are now controlled by your Restricted API Key (RAK).',
  '',
  '🚨  Error initializing Stripe MCP server:',
  '',
  '   Stripe API key not provided. Please either pass it as an argument --api-key=$KEY or set the STRIPE_SECRET_KEY environment variable.',
  '',
  'Error: Stripe API key not provided. Please either pass it as an argument --api-key=$KEY or set the STRIPE_SECRET_KEY environment variable.',
  '    at parseArgs (/root/.npm/_npx/bce731a0395adf49/node_modules/@stripe/mcp/dist/cli.js:34:15)',
  '    at main (/root/.npm/_npx/bce731a0395adf49/node_modules/@stripe/mcp/dist/index.js:18:41)',
  '    at Object.<anonymous> (/root/.npm/_npx/bce731a0395adf49/node_modules/@stripe/mcp/dist/index.js:81:5)',
  '    at Module._compile (node:internal/modules/cjs/loader:1781:14)',
  '    at Object..js (node:internal/modules/cjs/loader:1913:10)',
  '    at Module.load (node:internal/modules/cjs/loader:1505:32)',
  '    at Function._load (node:internal/modules/cjs/loader:1309:12)',
  '    at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)',
  '    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:171:5)',
  '    at node:internal/main/run_main_module:36:49',
  '',
  'Node.js v22.23.2',
].join('\n');

/** `npx -y safari-mcp` on linux — npm refuses the install, and says so itself. */
const SAFARI = [
  'npm error code EBADPLATFORM',
  'npm error notsup Unsupported platform for safari-mcp@2.17.1: wanted {"os":"darwin"} (current: {"os":"linux"})',
  'npm error notsup Valid os:  darwin',
  'npm error notsup Actual os: linux',
].join('\n');

describe('evidenceTail', () => {
  it('keeps the message that says why, not the frames that say where', () => {
    const kept = evidenceTail(STRIPE);
    expect(kept).toContain('STRIPE_SECRET_KEY');
    expect(kept).not.toContain('at Module._compile');
  });

  it('is what decides the published status, not just how it reads', () => {
    // The regression: a plain tail spends the whole budget on stack frames, so
    // the words `api key` never reach the classifier and a server that merely
    // wants a credential is published as one that does not start.
    const plainTail = STRIPE.slice(-600);
    expect(plainTail).not.toMatch(/api.?key/i);
    expect(classifyFailure(`server exited (code 1); stderr tail: ${plainTail}`)).toBe(
      'startup-failure',
    );

    expect(classifyFailure(`server exited (code 1); stderr tail: ${evidenceTail(STRIPE)}`)).toBe(
      'auth-required',
    );
  });

  it('keeps npm’s own errors, which are the whole evidence when npm is what failed', () => {
    // Dropping every npm line would leave safari-mcp with an empty record: the
    // install never ran, so the server printed nothing of its own.
    const kept = evidenceTail(SAFARI);
    expect(kept).toContain('EBADPLATFORM');
    expect(kept).toContain('wanted {"os":"darwin"}');
  });

  it('keeps a stack when a stack is all there is', () => {
    const framesOnly = [
      '    at foo (/app/index.js:1:1)',
      '    at bar (/app/index.js:2:2)',
    ].join('\n');
    expect(evidenceTail(framesOnly)).toContain('at foo');
  });

  it('keeps nothing from nothing, so an empty stderr reads as no evidence', () => {
    expect(evidenceTail('')).toBe('');
    expect(evidenceTail('   \n  \n')).toBe('');
  });

  it('honours the budget, keeping both ends of what survives', () => {
    const long = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
    const kept = evidenceTail(long, 100);
    expect(kept.length).toBeLessThanOrEqual(100);
    expect(kept).toContain('line 199');
    expect(kept).toContain('line 0');
  });

  it('keeps the one line that explains a usage dump', () => {
    // kubernetes-mcp-server, reproduced: one sentence saying why, then its whole
    // usage screen. The screen is neither npm noise nor stack frames, so a
    // tail-only budget kept flag documentation and dropped the reason — and the
    // entry's declared evidence then had nothing to match against.
    const usage = [
      'Error: unable to create kubernetes target provider: no current-context is set and no contexts are defined in kubeconfig',
      "Configure a context with 'kubectl config set-context <name>'",
      'Usage:',
      '  kubernetes-mcp-server [command] [options] [flags]',
      ...Array.from({ length: 40 }, (_, i) => `      --flag-${i} string          some documentation for flag ${i}`),
    ].join('\n');

    const kept = evidenceTail(usage);
    expect(kept.length).toBeLessThanOrEqual(600);
    expect(kept).toContain('no current-context is set');
    expect(notApplicableReason({ reason: 'needs a kubeconfig', evidence: 'no current-context is set' }, kept)).toBe(
      'needs a kubeconfig',
    );
  });

  it('truncates a structured log line rather than dropping it whole', () => {
    // slack-mcp-server, reproduced. The entire message is one JSON line, longer
    // than the head budget — so a whole-lines rule keeps none of it and the
    // record says only that a child process exited. That is how slack came back
    // `startup-failure` when its own first line says it wants a token.
    const slack = [
      `{"level":"fatal","timestamp":"2026-09-04T05:27:07Z","message":"Authentication required: Either SLACK_MCP_XOXP_TOKEN, SLACK_MCP_XOXB_TOKEN, or both SLACK_MCP_XOXC_TOKEN and SLACK_MCP_XOXD_TOKEN must be provided","app":"slack-mcp-server","stacktrace":"${'github.com/korotovsky/slack-mcp-server/pkg/provider.New\\n\\t'.repeat(8)}"}`,
      'node:child_process:955',
      '    throw err;',
      'Error: Command failed: /tmp/.npm-cache/_npx/x/bin/slack-mcp-server-linux-amd64 --transport stdio',
      '  status: 1,',
      'Node.js v22.23.2',
    ].join('\n');

    const kept = evidenceTail(slack);
    expect(kept).toContain('Authentication required');
    expect(classifyFailure(`server exited (code 1); stderr tail: ${kept}`)).toBe('auth-required');
  });

  it('cuts on line boundaries, so an evidence string is never split in half', () => {
    const text = [
      'FATAL: the-token-that-matters was rejected',
      ...Array.from({ length: 60 }, (_, i) => `noise line number ${i} padding padding padding`),
    ].join('\n');
    const kept = evidenceTail(text, 200);
    expect(kept).toContain('the-token-that-matters');
    // No half-line at either seam.
    for (const line of kept.split('\n')) {
      if (line === '' || line.trim() === '[…]') continue;
      expect(text.split('\n')).toContain(line);
    }
  });
});

/**
 * A declared entry whose output grew until its evidence line sat in the middle:
 * npm noise and stack frames are gone, and what is left is still longer than the
 * budget, with the sentence that justifies the declaration nowhere near either
 * end. Before the evidence was passed down, this is the shape that turned a
 * declaration off by itself and republished a working server as broken.
 */
const BURIED = [
  ...Array.from({ length: 30 }, (_, i) => `preflight check ${i}: ok, continuing to the next step`),
  'The Windows/Linux Go server is in preview — check https://local-mcp.com for updates.',
  ...Array.from({ length: 30 }, (_, i) => `shutting down worker ${i} and releasing its handles`),
].join('\n');

const DECLARED = {
  reason: 'the vendor ships no Linux server yet',
  evidence: 'The Windows/Linux Go server is in preview',
};

describe('evidenceTail keeps the evidence a declared status rests on', () => {
  it('is the whole bug: without it the middle goes, and the declaration goes with it', () => {
    const blind = evidenceTail(BURIED);
    expect(blind).not.toContain(DECLARED.evidence);
    expect(notApplicableReason(DECLARED, blind)).toBeNull();

    const kept = evidenceTail(BURIED, 600, DECLARED.evidence);
    expect(kept).toContain(DECLARED.evidence);
    expect(notApplicableReason(DECLARED, kept)).toBe(DECLARED.reason);
  });

  it('does not buy the evidence by overrunning the budget', () => {
    // A layout that keeps the sentence by ignoring the limit has only moved the
    // problem into the record, which is where the 700-character cap then cuts it.
    for (const limit of [120, 200, 300, 600]) {
      const kept = evidenceTail(BURIED, limit, DECLARED.evidence);
      expect(kept.length).toBeLessThanOrEqual(limit);
      expect(kept).toContain(DECLARED.evidence);
    }
  });

  it('still cuts on line boundaries around the line it anchors on', () => {
    const kept = evidenceTail(BURIED, 300, DECLARED.evidence);
    const source = BURIED.split('\n');
    for (const line of kept.split('\n')) {
      if (line === '' || line.trim() === '[…]') continue;
      expect(source).toContain(line);
    }
  });

  it('outranks the noise filters, because npm prints some evidence itself', () => {
    // safari-mcp declares EBADPLATFORM, and npm prints it on a line of its own.
    // A filter that reaches it first deletes the evidence before any budget runs.
    const noisy = ['npm warn EBADPLATFORM safari-mcp@2.17.1 is darwin-only', 'something else entirely'].join('\n');
    expect(evidenceTail(noisy)).not.toContain('EBADPLATFORM');
    expect(evidenceTail(noisy, 600, 'EBADPLATFORM')).toContain('EBADPLATFORM');
  });

  it('never conjures evidence that was not printed', () => {
    // The declaration has to keep failing when the server fails a different way —
    // that is the guard the whole mechanism exists for, and this must not weaken it.
    const different = Array.from({ length: 60 }, (_, i) => `panic: unrelated failure ${i}`).join('\n');
    const kept = evidenceTail(different, 600, DECLARED.evidence);
    expect(notApplicableReason(DECLARED, kept)).toBeNull();
  });

  it('windows around the match when the evidence is on one over-long line', () => {
    const line = `${'x'.repeat(900)} ${DECLARED.evidence} ${'y'.repeat(900)}`;
    const kept = evidenceTail(`${line}\nand a second line`, 400, DECLARED.evidence);
    expect(kept.length).toBeLessThanOrEqual(400);
    expect(kept).toContain(DECLARED.evidence);
  });
});

describe('clampNotes', () => {
  it('leaves a record that fits exactly as it is', () => {
    expect(clampNotes('short enough', 700, 'enough')).toBe('short enough');
  });

  it('cuts plainly when the evidence is already inside the kept prefix', () => {
    const text = `${DECLARED.evidence} — ${'tail padding '.repeat(80)}`;
    expect(clampNotes(text, 200, DECLARED.evidence)).toBe(text.slice(0, 200));
  });

  it('keeps the evidence when a blind cut would have removed it', () => {
    // windows-mcp's record sits at exactly the 700-character cap today, so the
    // margin here is one character of growth in somebody else's error message.
    const text = `${'a reason long enough to fill the front of the record. '.repeat(14)}${DECLARED.evidence} trailing`;
    expect(text.slice(0, 700)).not.toContain(DECLARED.evidence);
    const kept = clampNotes(text, 700, DECLARED.evidence);
    expect(kept.length).toBeLessThanOrEqual(700);
    expect(kept).toContain(DECLARED.evidence);
    expect(notApplicableReason(DECLARED, kept)).toBe(DECLARED.reason);
  });

  it('cuts plainly when there is no declaration to protect', () => {
    const text = 'z'.repeat(900);
    expect(clampNotes(text, 700)).toBe(text.slice(0, 700));
  });
});
