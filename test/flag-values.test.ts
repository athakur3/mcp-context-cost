import { describe, it, expect } from 'vitest';
import { flagValue, flagValues, knownFlagNames, unknownFlags, valuelessFlags } from '../src/cli.js';

/**
 * A flag the CLI cannot read is a flag the CLI silently ignores, and an ignored
 * gate flag is the failure this project exists to catch: `--max-increase`
 * without a usable value once ran a plain measurement and exited 0 on a change
 * that should have failed the build — a green check on a check that never
 * happened, which is exactly what `unknownFlags` was added in 0.4.0 to prevent,
 * reached through a door it did not cover.
 *
 * Two doors existed. A flag given as the last argument (what a CI template
 * renders from an empty variable) read as "flag absent"; and `--flag=value` was
 * accepted by the unknown-flag check, which splits on `=`, then invisible to a
 * reader that only matched the bare token.
 */

const SPEC = { value: ['baseline', 'max-increase', 'command'], boolean: ['json', 'docker'] };
const KNOWN = knownFlagNames(SPEC);

describe('flagValues — both accepted spellings', () => {
  it('reads the space form', () => {
    expect(flagValue(['--max-increase', '100'], 'max-increase')).toBe('100');
  });

  it('reads the equals form', () => {
    expect(flagValue(['--max-increase=100'], 'max-increase')).toBe('100');
  });

  it('does not read a following flag as this flag’s value', () => {
    expect(flagValue(['--max-increase', '--json'], 'max-increase', KNOWN)).toBeUndefined();
  });

  it('is undefined for an absent flag, and never confuses a prefix', () => {
    expect(flagValue(['--budget', '5'], 'max-increase')).toBeUndefined();
    // `--max-increase` must not be matched by a reader looking for `--max`.
    expect(flagValue(['--max-increase', '100'], 'max')).toBeUndefined();
  });

  it('collects every occurrence for repeatable flags, in order, in either form', () => {
    expect(flagValues(['--config', 'a.json', '--config=b.json'], 'config')).toEqual(['a.json', 'b.json']);
    // A single reader takes the last, matching the previous behaviour.
    expect(flagValue(['--config', 'a.json', '--config=b.json'], 'config')).toBe('b.json');
  });
});

describe('valuelessFlags — a flag without its value is a usage error', () => {
  it('catches a value flag as the last argument', () => {
    expect(valuelessFlags(['--baseline', 'b.json', '--max-increase'], SPEC)).toEqual(['--max-increase']);
  });

  it('catches a value flag followed by another flag', () => {
    expect(valuelessFlags(['--max-increase', '--json'], SPEC)).toEqual(['--max-increase']);
  });

  it('catches an empty equals form', () => {
    expect(valuelessFlags(['--max-increase='], SPEC)).toEqual(['--max-increase']);
  });

  it('accepts both well-formed spellings', () => {
    expect(valuelessFlags(['--max-increase', '100', '--baseline=b.json'], SPEC)).toEqual([]);
  });

  it('says nothing about boolean flags, which have no value to miss', () => {
    expect(valuelessFlags(['--json', '--docker'], SPEC)).toEqual([]);
  });

  it('does not read a value that looks like a flag as a flag', () => {
    // `--command "--weird"` is a legitimate launch command, not a usage error.
    // The `--` prefix alone cannot tell it from a swallowed value slot; the
    // command's own flag list can, and only a KNOWN flag ends a value.
    expect(valuelessFlags(['--command', 'npx -y x', '--json'], SPEC)).toEqual([]);
    expect(valuelessFlags(['--command', '--weird-launcher'], SPEC)).toEqual([]);
    expect(flagValue(['--command', '--weird-launcher'], 'command', KNOWN)).toBe('--weird-launcher');
  });

  it('still catches a value slot swallowed by a known flag', () => {
    expect(valuelessFlags(['--max-increase', '--json'], SPEC)).toEqual(['--max-increase']);
    expect(flagValue(['--max-increase', '--json'], 'max-increase', KNOWN)).toBeUndefined();
  });
});

describe('unknownFlags still holds its own line', () => {
  it('rejects a flag this build does not know, in either spelling', () => {
    expect(unknownFlags(['--nope'], SPEC)).toEqual(['--nope']);
    expect(unknownFlags(['--nope=1'], SPEC)).toEqual(['--nope']);
  });

  it('accepts every known flag', () => {
    expect(unknownFlags(['--baseline', 'b.json', '--json', '--max-increase=5'], SPEC)).toEqual([]);
  });
});
