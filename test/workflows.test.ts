import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The weekly self-badge job republishes `results/memory/measurement.json` — a
 * row that sits in the same leaderboard as 68 others, all measured in Docker
 * isolation. Two numbers taken under different isolation are not comparable
 * (different Node, different resolution of an `@latest` tag, different ambient
 * environment), which is why `history.csv` records the isolation and the trend
 * line refuses to span a change in it.
 *
 * So a host measurement here is not a smaller version of the right thing: it
 * gives one published row a provenance none of its neighbours have, and — since
 * the weekly job and the full sweep would then alternate — leaves `memory` the
 * one server that can never draw a sparkline. This asserts the invocation, not
 * the outcome, because the outcome is only visible on a Monday.
 */
const workflow = readFileSync(
  join(import.meta.dirname, '..', '.github', 'workflows', 'self-badge.yml'),
  'utf8',
);

/** The `npm run sweep` command lines the workflow actually executes. */
function sweepInvocations(yaml: string): string[] {
  return yaml
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('run:') && l.includes('npm run sweep'));
}

describe('self-badge workflow', () => {
  it('measures in the same isolation as every other published row', () => {
    const runs = sweepInvocations(workflow);
    expect(runs.length).toBe(1);
    expect(runs[0]).toContain('--docker');
  });

  it('pins the measured package version', () => {
    // This job holds contents:write and pushes; an unpinned `@latest` here is a
    // third-party package with commit access to the repo's published data.
    expect(sweepInvocations(workflow)[0]).toMatch(/server-memory@\d/);
  });

  it('allows more than the default budget for a cold runner', () => {
    // No shared package cache survives between jobs, so the first capture pays
    // an image pull plus a full install — the 60s default would time out.
    const timeout = /--timeout (\d+)/.exec(sweepInvocations(workflow)[0]);
    expect(timeout).not.toBeNull();
    expect(Number(timeout![1])).toBeGreaterThan(60_000);
  });
});
