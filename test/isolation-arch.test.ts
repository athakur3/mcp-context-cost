import { describe, it, expect } from 'vitest';
import { measuringArch, observedArch } from '../src/sweep/run.js';
import { containerPlatform, platformFromUname } from '../src/sweep/docker.js';

/**
 * `local-mcp` sat published as a startup failure on the strength of a run whose
 * real finding was that the machine was arm64 and the package ships no arm64
 * runtime. Nothing in the record said which architecture produced it, so the
 * claim looked like a fact about the server.
 *
 * The field that fixed that was itself derived rather than observed: for a
 * container it assumed `linux` and kept the *host's* `process.arch`. Nothing
 * here passes `--platform`, but `docker pull` and `docker run` both honour
 * `DOCKER_DEFAULT_PLATFORM`, and an image with no manifest for the host runs
 * emulated — so an amd64 container on an Apple Silicon laptop recorded
 * `linux/arm64`. A field that can be wrong about the one thing it exists to
 * establish is worse than an absent one, which is the shape of these.
 */
describe('measuringArch — the process, not a container', () => {
  it('reports the platform this process is on', () => {
    expect(measuringArch().startsWith(`${process.platform}/`)).toBe(true);
  });

  it("speaks Docker's vocabulary, so records compare against image platforms", () => {
    // Node says `x64` where Docker says `amd64`. A record that mixed the two
    // could not be compared against the platform an image was built for.
    expect(measuringArch()).not.toContain('x64');
    if (process.arch === 'x64') expect(measuringArch()).toBe(`${process.platform}/amd64`);
  });

  it('is a single platform/arch pair, not a sentence', () => {
    expect(measuringArch()).toMatch(/^[a-z0-9]+\/[a-z0-9]+$/);
  });
});

describe('containerPlatform — asked of a container, not of its host', () => {
  const runner = (result: { code: number | null; stdout?: string; stderr?: string }) => {
    const calls: string[][] = [];
    const run = async (args: string[]) => {
      calls.push(args);
      return { code: result.code, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    };
    return { calls, run };
  };

  it('asks a container what it is, and speaks the answer back in Docker terms', async () => {
    const { calls, run } = runner({ code: 0, stdout: 'Linux x86_64\n' });
    expect(await containerPlatform('node:22-slim', { run })).toBe('linux/amd64');
    expect(calls[0]).toEqual(['run', '--rm', '--pull=missing', 'node:22-slim', 'uname', '-sm']);
  });

  it('reports the emulated architecture, which is the whole point', async () => {
    // The case the old code got wrong, and the case `docker image inspect` also
    // gets wrong: on this machine 2026-09-05 inspect answered `linux/arm64` for
    // a tag whose container came up `x86_64` under DOCKER_DEFAULT_PLATFORM.
    const { run } = runner({ code: 0, stdout: 'Linux x86_64\n' });
    expect(await containerPlatform('emulated', { run })).toBe('linux/amd64');
  });

  it('answers null rather than guessing when docker cannot say', async () => {
    for (const result of [
      { code: 1, stderr: 'No such image' },
      { code: null, stderr: 'spawn docker ENOENT' },
      { code: 0, stdout: '' },
      { code: 0, stdout: 'Linux' },
    ]) {
      const { run } = runner(result);
      expect(await containerPlatform('img', { run }), JSON.stringify(result)).toBeNull();
    }
  });
});

describe('platformFromUname', () => {
  it('maps the machine names a container actually reports', () => {
    expect(platformFromUname('Linux x86_64')).toBe('linux/amd64');
    expect(platformFromUname('Linux aarch64')).toBe('linux/arm64');
    expect(platformFromUname('Linux armv7l')).toBe('linux/arm/v7');
  });

  it('returns nothing for a machine name it does not know', () => {
    // Deriving one from a pattern would be the same inference this replaces.
    expect(platformFromUname('Linux sparc64')).toBeNull();
    expect(platformFromUname('nonsense')).toBeNull();
    expect(platformFromUname('')).toBeNull();
  });
});

describe('observedArch — what gets written into the record', () => {
  it('answers for an uncontained run from this process', async () => {
    expect(await observedArch({ docker: false })).toBe(measuringArch());
  });

  it('records nothing for a container this harness did not launch', async () => {
    // A `servers.yaml` command that is itself a `docker run` names no image
    // here: the harness never chose it and cannot see inside it. Absent means
    // unknown, which is true; the host's architecture would be a claim about
    // someone else's container.
    expect(
      await observedArch({ docker: true, note: 'command is itself a docker run (host-spawned container)' }),
    ).toBeUndefined();
  });
});
