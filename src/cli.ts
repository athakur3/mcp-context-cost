#!/usr/bin/env node
/**
 * mcp-context-cost CLI — the dispute drill as a command.
 *
 *   mcp-context-cost audit [--budget N] [--claude] [--json]   measure the servers in your
 *                                                own MCP config; exit 1 if over budget.
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

const [, , cmd, ...rest] = process.argv;

if (cmd === 'audit') {
  const argOf = (name: string) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const all = (name: string) =>
    rest.flatMap((a, i) => (a === `--${name}` && rest[i + 1] ? [rest[i + 1]] : []));
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

  const budget = numeric('budget');
  const { runAudit } = await import('./audit/run.js');
  const { formatReport } = await import('./audit/audit.js');
  const report = await runAudit({
    configPaths: all('config'),
    budget,
    contextWindow: numeric('context'),
    timeoutMs: numeric('timeout'),
    concurrency: numeric('concurrency'),
    docker: rest.includes('--docker'),
    claude: rest.includes('--claude'),
    divergenceUrl: argOf('divergence-url'),
    // Progress goes to stderr so `--json` stdout stays a single parseable object.
    onProgress: json ? undefined : (name, done, total) => process.stderr.write(`  [${done}/${total}] ${name}\n`),
  });

  if (report.configs.length === 0) {
    const where = report.problems.length ? `\n${report.problems.map((p) => `  ${p}`).join('\n')}` : '';
    if (json) console.log(JSON.stringify(report));
    else
      console.error(
        `no MCP config found. Looked in the standard Claude Desktop / Claude Code / Cursor / VS Code / Windsurf locations.${where}\n` +
          `Point at one explicitly: mcp-context-cost audit --config <path/to/mcp.json>`,
      );
    process.exit(1);
  }

  console.log(json ? JSON.stringify(report) : formatReport(report));
  process.exit(report.budget?.over ? 1 : 0);
} else if (cmd === 'verify') {
  const json = rest.includes('--json');
  const remoteIdx = rest.indexOf('--remote');
  const remoteUrl = remoteIdx >= 0 ? rest[remoteIdx + 1] : undefined;
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
      const problem = `failed to fetch ${remoteUrl}: ${(e as Error).message}`;
      if (json) console.log(JSON.stringify({ ok: false, rederivedTokens: null, rederivedSha: null, problems: [problem] }));
      else console.error(problem);
      process.exit(1);
    }
  } else {
    raw = readFileSync(path!, 'utf8');
  }
  const m = JSON.parse(raw) as Measurement;
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
  process.exit(ok ? 0 : 1);
} else if (cmd !== undefined && cmd !== '--help' && cmd !== '-h') {
  console.error(`unknown command: ${cmd}`);
  process.exit(2);
} else {
  console.log('mcp-context-cost — reproducible context-cost measurement for MCP servers');
  console.log('  audit [--config <path>] [--budget N] [--claude]  measure the servers in your own MCP config');
  console.log('        [--json] [--context N] [--timeout ms] [--concurrency N] [--docker]');
  console.log('  verify <measurement.json> [--json]    re-derive tokens+sha from the published capture');
  console.log('  verify --remote <url> [--json]        same, fetched from a measurement URL');
  console.log('  measure --name x --command "npx -y <server>"   run a one-off measurement');
  console.log('  measure --remote <url> [--name x]      measure a remote server via mcp-remote');
  console.log('exit codes: 0 ok, 1 verification/measurement/budget failed, 2 usage error');
}
