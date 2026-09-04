import { describe, it, expect } from 'vitest';
import { evidenceTail } from '../src/sweep/client.js';
import { classifyFailure } from '../src/sweep/run.js';

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

  it('honours the budget, keeping the end of what survives', () => {
    const long = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
    const kept = evidenceTail(long, 100);
    expect(kept.length).toBeLessThanOrEqual(100);
    expect(kept).toContain('line 199');
  });
});
