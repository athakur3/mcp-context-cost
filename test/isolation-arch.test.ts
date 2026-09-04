import { describe, it, expect } from 'vitest';
import { measuringArch } from '../src/sweep/run.js';

/**
 * `local-mcp` sat published as a startup failure on the strength of a run whose
 * real finding was that the machine was arm64 and the package ships no arm64
 * runtime. Nothing in the record said which architecture produced it, so the
 * claim looked like a fact about the server. These pin the shape of the answer.
 */
describe('measuringArch', () => {
  it('reports linux for a container whatever the host is', () => {
    // The isolation image is linux even when the sweep runs from a Mac; saying
    // `darwin` there would describe the laptop, not the measurement.
    expect(measuringArch(true).startsWith('linux/')).toBe(true);
  });

  it('reports the host platform when nothing is containerised', () => {
    expect(measuringArch(false).startsWith(`${process.platform}/`)).toBe(true);
  });

  it("speaks Docker's vocabulary, so records compare against image platforms", () => {
    // Node says `x64` where Docker says `amd64`. A record that mixed the two
    // could not be compared against the platform an image was built for.
    const both = `${measuringArch(true)} ${measuringArch(false)}`;
    expect(both).not.toContain('x64');
    if (process.arch === 'x64') expect(measuringArch(true)).toBe('linux/amd64');
  });

  it('is a single platform/arch pair, not a sentence', () => {
    expect(measuringArch(true)).toMatch(/^[a-z0-9]+\/[a-z0-9]+$/);
    expect(measuringArch(false)).toMatch(/^[a-z0-9]+\/[a-z0-9]+$/);
  });
});
