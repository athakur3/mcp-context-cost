#!/usr/bin/env node
/**
 * mcp-context-cost CLI — the dispute drill as a command.
 *
 *   mcp-context-cost verify <measurement.json> [--json]   re-derive the number from the
 *                                                published capture; exit 1 on mismatch
 *   mcp-context-cost measure --name x --command "npx -y ..."   one-off measurement
 *
 * Exit codes: 0 ok, 1 verification/measurement failed, 2 usage error.
 */
import { readFileSync } from 'node:fs';
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

const [, , cmd, ...rest] = process.argv;

if (cmd === 'verify') {
  const json = rest.includes('--json');
  const path = rest.find((a) => !a.startsWith('--'));
  if (!path) {
    console.error('usage: mcp-context-cost verify <measurement.json> [--json]');
    process.exit(2);
  }
  const m = JSON.parse(readFileSync(path, 'utf8')) as Measurement;
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
  const argOf = (name: string) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const name = argOf('name');
  const command = argOf('command');
  if (!name || !command) {
    console.error('usage: mcp-context-cost measure --name <slug> --command "npx -y <server>" [--timeout ms] [--docker]');
    process.exit(2);
  }
  const { measureServer } = await import('./sweep/run.js');
  const m = await measureServer(name, command, {
    timeoutMs: Number(argOf('timeout') ?? 60_000),
    docker: rest.includes('--docker'),
    dockerImage: argOf('docker-image'),
  });
  const ok = m.status === 'measured' || m.status === 'dynamic';
  console.log(
    ok
      ? `${name}: ${m.totalTokens} tokens across ${m.toolCount} tools (${m.status}) — results/${name}/measurement.json, badges/${name}.json`
      : `${name}: ${m.status} — ${m.notes ?? ''}`,
  );
  process.exit(ok ? 0 : 1);
} else if (cmd !== undefined && cmd !== '--help' && cmd !== '-h') {
  console.error(`unknown command: ${cmd}`);
  process.exit(2);
} else {
  console.log('mcp-context-cost — reproducible context-cost measurement for MCP servers');
  console.log('  verify <measurement.json> [--json]    re-derive tokens+sha from the published capture');
  console.log('  measure --name x --command "npx -y <server>"   run a one-off measurement');
  console.log('exit codes: 0 ok, 1 verification/measurement failed, 2 usage error');
}
