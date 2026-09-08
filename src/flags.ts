/**
 * The one flag reader — for the CLI, the sweep scripts and the tools alike.
 *
 * This is its own module rather than part of cli.ts for a reason that only
 * shows up at import time: cli.ts dispatches on `process.argv` at the top
 * level, so importing it *runs the CLI* against the importing script's own
 * argv — `npx tsx src/sweep/sweep-all.ts --docker` would print
 * `unknown command: --docker` and exit 2 before the sweep's first line.
 * Everything here is pure functions over an argv array, safe to import from
 * any script. cli.ts imports from here and does not re-export, so there is
 * exactly one home and no second door back to the side effect.
 */

/**
 * Reject flags this build does not know.
 *
 * An older CLI used to ignore an unrecognised flag and carry on. That is the exact failure
 * this project exists to catch, in our own tool: `audit --baseline base.json
 * --max-increase 2000` on a build without those flags ran a plain audit and **exited 0** —
 * a green CI check on a gate that never ran. The README documents flags before they are
 * published, so the version skew is not hypothetical; it is the normal case for anyone
 * running `npx -y mcp-context-cost`.
 *
 * So an unknown flag is a usage error, and the message names the running version, because
 * the likeliest cause is that the reader's command is newer than their install.
 */
export function unknownFlags(
  argv: string[],
  spec: { value: string[]; boolean: string[] },
): string[] {
  const known = new Set([...spec.value, ...spec.boolean]);
  const unknown: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!; // the loop condition establishes it
    if (!tok.startsWith('--')) continue;
    const [name = ''] = tok.slice(2).split('=');
    if (!known.has(name)) {
      unknown.push(tok.split('=')[0] ?? tok);
      continue;
    }
    // Skip a value-taking flag's value, so `--command "--weird"` is not read as a flag.
    if (spec.value.includes(name) && !tok.includes('=')) i++;
  }
  return unknown;
}

/**
 * Whether a token is another flag of *this* command, rather than a value that
 * merely looks like one.
 *
 * The distinction is load-bearing: `--command "--weird"` is a legitimate launch
 * command this CLI has always accepted, while `--max-increase --json` is a
 * value slot swallowed by the next flag. Deciding on the `--` prefix alone
 * cannot tell them apart; deciding against the command's own flag list can, and
 * the list is already declared at every call site.
 */
function isKnownFlagToken(tok: string, known: Set<string>): boolean {
  return tok.startsWith('--') && known.has(tok.slice(2).split('=')[0] ?? '');
}

/** Every flag name a command accepts — what tells a value apart from the next flag. */
export const knownFlagNames = (spec: { value: string[]; boolean: string[] }) =>
  new Set([...spec.value, ...spec.boolean]);

/**
 * Every value a value-taking flag was given, in either accepted spelling:
 * `--flag value` and `--flag=value`.
 *
 * Both forms are read here because reading only one of them is the same bug as
 * ignoring an unknown flag. `--max-increase=100` was accepted by
 * `unknownFlags` (which splits on `=`) and then invisible to a reader that only
 * matched the bare token, so the gate it asked for silently did not run and the
 * command exited 0 — a green check on a check that never happened.
 */
export function flagValues(argv: string[], name: string, known: Set<string> = new Set()): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!; // the loop condition establishes it
    if (tok === `--${name}`) {
      const next = argv[i + 1];
      // Another flag of this command is not this flag's value; that case is a
      // usage error, caught by `valuelessFlags`, and never read as a value.
      if (next !== undefined && !isKnownFlagToken(next, known)) out.push(next);
      continue;
    }
    if (tok.startsWith(`--${name}=`)) out.push(tok.slice(name.length + 3));
  }
  return out;
}

/** The last value given for a flag, or undefined when the flag is absent. */
export function flagValue(
  argv: string[],
  name: string,
  known: Set<string> = new Set(),
): string | undefined {
  const values = flagValues(argv, name, known);
  return values.length ? values[values.length - 1] : undefined;
}

/**
 * Value-taking flags that appear with no usable value.
 *
 * A flag present without its value is a *usage error*, never an absent flag.
 * `--max-increase` as the last argument — what a CI template renders when its
 * variable is empty — otherwise reads as "no gate was asked for", and the run
 * exits 0 on a change that should have failed it. That is the same green-check
 * failure `unknownFlags` exists to prevent, reached through a different door,
 * so it is refused in the same place and with the same severity.
 */
export function valuelessFlags(
  argv: string[],
  spec: { value: string[]; boolean: string[] },
): string[] {
  const known = knownFlagNames(spec);
  const bad: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!; // the loop condition establishes it
    if (!tok.startsWith('--')) continue;
    const [name = ''] = tok.slice(2).split('=');
    if (!spec.value.includes(name)) continue;
    if (tok.includes('=')) {
      if (tok.slice(name.length + 3) === '') bad.push(`--${name}`);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || isKnownFlagToken(next, known)) bad.push(`--${name}`);
    else i++; // consume the value, so `--command "--weird"` is not re-read as a flag
  }
  return bad;
}
