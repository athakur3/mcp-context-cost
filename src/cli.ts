#!/usr/bin/env node
/**
 * mcp-context-cost CLI — the dispute drill as a command.
 *
 *   mcp-context-cost audit [--budget N] [--claude] [--json]   measure the servers in your
 *                                                own MCP config; exit 1 if over budget.
 *   mcp-context-cost audit --baseline <report.json> [--max-increase N]   diff against a
 *                                                stored earlier report; exit 1 if this
 *                                                config change adds more than N tokens
 *                                                to every request (or if it can't tell).
 *                                                --claude adds each server's Anthropic-
 *                                                request cost where the published capture
 *                                                hash matches what's installed.
 *   mcp-context-cost verify <measurement.json> [--json]   re-derive the number from the
 *                                                published capture; exit 1 on mismatch
 *   mcp-context-cost verify --remote <url> [--json]   same, fetched from a measurement URL
 *   mcp-context-cost measure --name x --command "npx -y ..."   one-off measurement
 *   mcp-context-cost measure --remote <url> [--name x]   same, via the mcp-remote bridge
 *                                                (name defaults to the URL's hostname)
 *
 * Exit codes: 0 ok, 1 verification/measurement/budget failed, 2 usage error.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { canonicalString, countTokens, sha256Hex } from './core/canonical.js';
import { toBadge } from './core/badge.js';
import type { Measurement } from './core/types.js';

export function verifyMeasurement(m: Measurement): {
  ok: boolean;
  rederivedTokens: number | null;
  rederivedSha: string | null;
  problems: string[];
} {
  const problems: string[] = [];
  if (!m.rawToolsCapture) {
    return { ok: false, rederivedTokens: null, rederivedSha: null, problems: ['no rawToolsCapture in measurement'] };
  }
  const canonical = canonicalString(m.rawToolsCapture);
  const tokens = countTokens(canonical);
  const sha = sha256Hex(canonical);
  if (tokens !== m.totalTokens) problems.push(`token mismatch: re-derived ${tokens}, stored ${m.totalTokens}`);
  if (sha !== m.canonicalSha256) problems.push(`sha mismatch: re-derived ${sha}, stored ${m.canonicalSha256}`);
  if (m.toolCount !== m.rawToolsCapture.length)
    problems.push(`toolCount mismatch: capture has ${m.rawToolsCapture.length}, stored ${m.toolCount}`);
  return { ok: problems.length === 0, rederivedTokens: tokens, rederivedSha: sha, problems };
}

/** Derives a servers.yaml-style slug from a remote URL's hostname, e.g. mcp.deepwiki.com -> deepwiki. */
export function slugFromUrl(url: string): string {
  const host = new URL(url).hostname.replace(/^(www|mcp)\./, '');
  return host.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'remote';
}


/**
 * Report a `verify` failure and exit 1, in whichever shape the caller asked
 * for. `--json` is documented as putting `{ ok, rederivedTokens, rederivedSha,
 * problems }` on stdout; a script reading that gets nothing from a thrown
 * exception, so every failure path goes through here.
 */
function failVerify(json: boolean, problem: string): never {
  if (json) console.log(JSON.stringify({ ok: false, rederivedTokens: null, rederivedSha: null, problems: [problem] }));
  else console.error(problem);
  process.exit(1);
}

/** Installed version, for error messages that need to say which one you are running. */
export function cliVersion(): string {
  try {
    return createRequire(import.meta.url)('../package.json').version as string;
  } catch {
    return 'unknown';
  }
}

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
export function unknownFlags(argv: string[], spec: { value: string[]; boolean: string[] }): string[] {
  const known = new Set([...spec.value, ...spec.boolean]);
  const unknown: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const name = tok.slice(2).split('=')[0];
    if (!known.has(name)) {
      unknown.push(tok.split('=')[0]);
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
  return tok.startsWith('--') && known.has(tok.slice(2).split('=')[0]);
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
    const tok = argv[i];
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
export function flagValue(argv: string[], name: string, known: Set<string> = new Set()): string | undefined {
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
export function valuelessFlags(argv: string[], spec: { value: string[]; boolean: string[] }): string[] {
  const known = knownFlagNames(spec);
  const bad: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const name = tok.slice(2).split('=')[0];
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

function rejectUnknownFlags(cmd: string, argv: string[], spec: { value: string[]; boolean: string[] }): void {
  const bad = unknownFlags(argv, spec);
  if (bad.length) {
    const all = [...spec.value, ...spec.boolean].sort().map((f) => `--${f}`).join(' ');
    console.error(`unknown flag for \`${cmd}\`: ${bad.join(', ')}`);
    console.error(`this is mcp-context-cost ${cliVersion()} — if you copied the command from the README,`);
    console.error(`your install may be older than the docs. Try: npx -y mcp-context-cost@latest ${cmd} ...`);
    console.error(`known flags for ${cmd}: ${all}`);
    process.exit(2);
  }
  const empty = valuelessFlags(argv, spec);
  if (empty.length) {
    console.error(`flag with no value for \`${cmd}\`: ${empty.join(', ')}`);
    console.error(`a flag given without its value is refused rather than ignored: ignoring it would run`);
    console.error(`a command that quietly does less than it was asked to — a gate that never gates.`);
    process.exit(2);
  }
}

const [, , cmd, ...rest] = process.argv;

if (cmd === 'audit') {
  const spec = {
    value: [
      'config',
      'budget',
      'baseline',
      'max-increase',
      'context',
      'timeout',
      'concurrency',
      'divergence-url',
      'tool-shape-url',
      'capture-index-url',
    ],
    boolean: ['json', 'docker', 'claude', 'suggest', 'changed'],
  };
  rejectUnknownFlags('audit', rest, spec);
  // The same flag list the rejection used, so a value that merely looks like a
  // flag (`--command "--weird"`) is told apart from a value slot swallowed by
  // the next flag.
  const known = knownFlagNames(spec);
  const argOf = (name: string) => flagValue(rest, name, known);
  const all = (name: string) => flagValues(rest, name, known);
  const json = rest.includes('--json');
  const numeric = (name: string): number | undefined => {
    const raw = argOf(name);
    if (raw === undefined) return undefined;
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) {
      console.error(`--${name} must be a positive number, got '${raw}'`);
      process.exit(2);
    }
    return v;
  };

  const nonNegative = (name: string): number | undefined => {
    const raw = argOf(name);
    if (raw === undefined) return undefined;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) {
      console.error(`--${name} must be zero or a positive number, got '${raw}'`);
      process.exit(2);
    }
    return v;
  };

  const budget = numeric('budget');
  const baselinePath = argOf('baseline');
  const maxIncrease = nonNegative('max-increase');
  if (maxIncrease !== undefined && !baselinePath) {
    console.error('--max-increase needs a --baseline to measure the increase against');
    process.exit(2);
  }

  const { buildDiff, evaluateIncreaseGate, parseBaselineReport } = await import('./audit/diff.js');

  // Read and shape-check the baseline BEFORE measuring anything: a typo in the path
  // should cost a second, not a full server sweep that is then thrown away.
  let baseline: import('./audit/audit.js').AuditReport | undefined;
  if (baselinePath) {
    let raw: string;
    try {
      raw = readFileSync(baselinePath, 'utf8');
    } catch (e) {
      console.error(`cannot read baseline ${baselinePath}: ${(e as Error).message}`);
      process.exit(2);
    }
    const parsed = parseBaselineReport(raw);
    if (!parsed.report) {
      console.error(`${baselinePath}: ${parsed.problem}`);
      process.exit(2);
    }
    baseline = parsed.report;
  }

  const { runAudit } = await import('./audit/run.js');
  const { formatReport } = await import('./audit/audit.js');
  const { DockerHarnessFault } = await import('./sweep/docker.js');
  let report;
  try {
    report = await runAudit({
      configPaths: all('config'),
      budget,
      contextWindow: numeric('context'),
      timeoutMs: numeric('timeout'),
      concurrency: numeric('concurrency'),
      docker: rest.includes('--docker'),
      claude: rest.includes('--claude'),
      divergenceUrl: argOf('divergence-url'),
      suggest: rest.includes('--suggest'),
      toolShapeUrl: argOf('tool-shape-url'),
      changed: rest.includes('--changed'),
      captureIndexUrl: argOf('capture-index-url'),
      // Progress goes to stderr so `--json` stdout stays a single parseable object.
      onProgress: json ? undefined : (name, done, total) => process.stderr.write(`  [${done}/${total}] ${name}\n`),
    });
  } catch (e) {
    // Docker failing as docker means every measurement through it would be a
    // statement about this machine, so the audit refuses whole rather than
    // reporting each server as broken.
    if (e instanceof DockerHarnessFault) {
      console.error(`audit --docker cannot answer for this machine: ${e.message}`);
      console.error('Fix Docker here, or run without --docker.');
      process.exit(1);
    }
    throw e;
  }

  if (report.configs.length === 0) {
    const where = report.problems.length ? `\n${report.problems.map((p) => `  ${p}`).join('\n')}` : '';
    const empty: { client: string; source: string; allDisabled?: string[] }[] = report.emptyConfigs ?? [];
    if (json) console.log(JSON.stringify(report));
    // A machine whose client config was found, opened and parsed, and has
    // nothing to total, is told that — being told no client was found anywhere
    // would send a reader looking for an install they already have. Which of
    // the two reasons it is gets said, because "declares nothing" is a false
    // statement about a file that declares servers and switches them off.
    else if (empty.some((c) => c.allDisabled?.length))
      console.error(
        `${empty.length === 1 ? 'an MCP client config was found' : `${empty.length} MCP client configs were found`}, ` +
          `and ${empty.length === 1 ? 'it has no server' : 'none of them has a server'} to measure:\n` +
          empty
            .map((c) => {
              const off = c.allDisabled ?? [];
              if (!off.length) return `  ${c.client}: ${c.source} — declares no servers at all`;
              return (
                `  ${c.client}: ${c.source} — declares ${off.length} server${off.length === 1 ? '' : 's'}, ` +
                `and ${off.length === 1 ? 'it is' : 'every one of them is'} switched off: ${off.join(', ')}`
              );
            })
            .join('\n') +
          `${where}\n` +
          `${empty.length === 1 ? 'It was' : 'They were'} read and parsed; a switched-off server is not started, so it costs nothing to measure.\n` +
          `Switch one back on, declare one, or point at a different config: mcp-context-cost audit --config <path/to/mcp.json>`,
      );
    else if (empty.length)
      console.error(
        `${empty.length === 1 ? 'an MCP client config was found' : `${empty.length} MCP client configs were found`}, ` +
          `and ${empty.length === 1 ? 'it declares' : 'they declare'} no servers:\n` +
          empty.map((c) => `  ${c.client}: ${c.source}`).join('\n') +
          `${where}\n` +
          `${empty.length === 1 ? 'It was' : 'They were'} read and parsed; there is simply nothing declared to measure.\n` +
          `Declare a server in one of them, or point at a different config: mcp-context-cost audit --config <path/to/mcp.json>`,
      );
    else if (all('config').length)
      // A path the user named is not a discovery miss. Saying "looked in the
      // standard locations" describes something the command did not do, and
      // then advises doing the thing they just did.
      console.error(
        `no MCP config found at the path(s) given: ${all('config').join(', ')}. ` +
          `Nothing else was searched, because --config was set.`,
      );
    else
      console.error(
        `no MCP config found. Looked in the standard Claude Desktop / Claude Code / Cursor / VS Code / Windsurf locations.${where}\n` +
          `Point at one explicitly: mcp-context-cost audit --config <path/to/mcp.json>`,
      );
    process.exit(1);
  }

  if (baseline) {
    report.diff = buildDiff(baseline, report);
    if (maxIncrease !== undefined) report.increaseGate = evaluateIncreaseGate(report.diff, maxIncrease);
  }

  console.log(json ? JSON.stringify(report) : formatReport(report));
  process.exit(report.budget?.over || report.increaseGate?.pass === false ? 1 : 0);
} else if (cmd === 'verify') {
  const spec = { value: ['remote'], boolean: ['json'] };
  rejectUnknownFlags('verify', rest, spec);
  const json = rest.includes('--json');
  const remoteUrl = flagValue(rest, 'remote', knownFlagNames(spec));
  const path = rest.find((a) => !a.startsWith('--') && a !== remoteUrl);
  if (!remoteUrl && !path) {
    console.error('usage: mcp-context-cost verify <measurement.json> [--json]');
    console.error('       mcp-context-cost verify --remote <url> [--json]');
    process.exit(2);
  }
  let raw: string;
  if (remoteUrl) {
    try {
      const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = await res.text();
    } catch (e) {
      failVerify(json, `failed to fetch ${remoteUrl}: ${(e as Error).message}`);
    }
  } else {
    try {
      raw = readFileSync(path!, 'utf8');
    } catch (e) {
      // The remote branch above reports a failed fetch in the documented shape;
      // this one used to throw, so `--json` produced a stack trace on stderr and
      // nothing at all on stdout — the contract a script parses.
      failVerify(json, `cannot read ${path}: ${(e as Error).message}`);
    }
  }
  let m: Measurement;
  try {
    m = JSON.parse(raw!) as Measurement;
  } catch (e) {
    // Reachable remotely: a proxy, a captive portal or an HTML error page
    // served with status 200 passes the `res.ok` check above and arrives here.
    failVerify(json, `${remoteUrl ?? path} is not valid JSON: ${(e as Error).message}`);
  }
  const r = verifyMeasurement(m);
  if (json) {
    console.log(JSON.stringify({ serverName: m.serverName, ...r, badge: r.ok ? toBadge(m) : undefined }));
    process.exit(r.ok ? 0 : 1);
  }
  if (r.ok) {
    console.log(
      `OK ${m.serverName}: ${r.rederivedTokens} tokens (${m.encoding}, methodology ${m.methodologyVersion}) — capture, hash, and count all agree`,
    );
    console.log(`badge: ${JSON.stringify(toBadge(m))}`);
    process.exit(0);
  }
  console.error(`FAIL ${m.serverName}:`);
  for (const p of r.problems) console.error(`  - ${p}`);
  process.exit(1);
} else if (cmd === 'measure') {
  const spec = {
    value: ['name', 'command', 'remote', 'timeout', 'docker-image', 'baseline', 'max-increase', 'budget'],
    boolean: ['docker'],
  };
  rejectUnknownFlags('measure', rest, spec);
  const known = knownFlagNames(spec);
  const argOf = (name: string) => flagValue(rest, name, known);
  const command = argOf('command');
  const remoteUrl = argOf('remote');
  if (remoteUrl && !/^https?:\/\//i.test(remoteUrl)) {
    console.error(`--remote must be an http(s) URL, got '${remoteUrl}'`);
    process.exit(2);
  }
  if (!command && !remoteUrl) {
    console.error('usage: mcp-context-cost measure --name <slug> --command "npx -y <server>" [--timeout ms] [--docker]');
    console.error('       mcp-context-cost measure --remote <url> [--name <slug>] [--timeout ms] [--docker]');
    process.exit(2);
  }
  const name = argOf('name') ?? (remoteUrl ? slugFromUrl(remoteUrl) : undefined);
  if (!name) {
    console.error('usage: mcp-context-cost measure --name <slug> --command "npx -y <server>" [--timeout ms] [--docker]');
    process.exit(2);
  }
  const {
    diffServer,
    evaluateServerGate,
    formatServerDiff,
    parseBaselineMeasurement,
  } = await import('./core/server-diff.js');

  // Gate limits are read before anything is measured: an unusable number is a
  // usage error, and finding that out after a two-minute container launch is
  // the wrong time to find it out.
  const numericFlag = (flag: string): number | undefined => {
    const raw = argOf(flag);
    if (raw === undefined) return undefined;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0) {
      console.error(`--${flag} must be a non-negative number, got '${raw}'`);
      process.exit(2);
    }
    return v;
  };
  const maxIncrease = numericFlag('max-increase');
  const budget = numericFlag('budget');
  const baselinePath = argOf('baseline');
  if (maxIncrease !== undefined && !baselinePath) {
    console.error('--max-increase needs --baseline <measurement.json> to compare against');
    process.exit(2);
  }

  let baseline: Measurement | null = null;
  if (baselinePath) {
    let raw: string;
    try {
      raw = readFileSync(baselinePath, 'utf8');
    } catch (e) {
      console.error(`cannot read baseline ${baselinePath}: ${(e as Error).message}`);
      process.exit(2);
    }
    const parsed = parseBaselineMeasurement(raw);
    if (!parsed.measurement) {
      console.error(`${baselinePath}: ${parsed.problem}`);
      process.exit(2);
    }
    baseline = parsed.measurement;
  }

  const { measureServer } = await import('./sweep/run.js');
  const m = await measureServer(name, remoteUrl ? `npx -y mcp-remote ${remoteUrl}` : command!, {
    timeoutMs: Number(argOf('timeout') ?? 60_000),
    docker: rest.includes('--docker'),
    dockerImage: argOf('docker-image'),
    argv: remoteUrl ? ['npx', '-y', 'mcp-remote', remoteUrl] : undefined,
  });
  const ok = m.status === 'measured' || m.status === 'dynamic';
  console.log(
    ok
      ? `${name}: ${m.totalTokens} tokens across ${m.toolCount} tools (${m.status}) — results/${name}/measurement.json, badges/${name}.json`
      : `${name}: ${m.status} — ${m.notes ?? ''}`,
  );

  if (baseline || budget !== undefined || maxIncrease !== undefined) {
    const diff = diffServer(name, baseline, m);
    if (baseline) {
      console.log('');
      console.log(`diff vs baseline ${baselinePath}`);
      console.log(formatServerDiff(diff));
    }
    const gate = evaluateServerGate(diff, { budget, maxIncrease });
    if (!gate.pass) {
      console.log('');
      console.error(gate.failure);
      process.exit(1);
    }
  }

  process.exit(ok ? 0 : 1);
} else if (cmd !== undefined && cmd !== '--help' && cmd !== '-h') {
  console.error(`unknown command: ${cmd}`);
  process.exit(2);
} else {
  console.log('mcp-context-cost — reproducible context-cost measurement for MCP servers');
  console.log('  audit [--config <path>] [--budget N] [--claude]  measure the servers in your own MCP config');
  console.log('        [--json] [--context N] [--timeout ms] [--concurrency N] [--docker]');
  console.log('        [--baseline <report.json>] [--max-increase N]   diff against an earlier');
  console.log('                                              audit --json report; --max-increase');
  console.log('                                              fails when a change adds too much');
  console.log('  verify <measurement.json> [--json]    re-derive tokens+sha from the published capture');
  console.log('  verify --remote <url> [--json]        same, fetched from a measurement URL');
  console.log('  measure --name x --command "npx -y <server>"   run a one-off measurement');
  console.log('  measure --remote <url> [--name x]      measure a remote server via mcp-remote');
  console.log('        [--baseline <measurement.json>] [--max-increase N] [--budget N]');
  console.log('                                              gate your own server in CI: fail the');
  console.log('                                              build when a change adds too much');
  console.log('exit codes: 0 ok, 1 verification/measurement/budget failed, 2 usage error');
}
