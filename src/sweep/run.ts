/**
 * Single-server measurement runner:
 *   npm run sweep -- --name memory --command "npx -y @modelcontextprotocol/server-memory"
 * Writes results/<name>/measurement.json and badges/<name>.json.
 * Runs tools/list capture TWICE; differing tool sets -> status "dynamic".
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureTools } from './client.js';
import { dockerize } from './docker.js';
import { measureTools, failedMeasurement, canonicalString } from '../core/canonical.js';
import { toBadge } from '../core/badge.js';
import type { Measurement } from '../core/types.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export interface MeasureOptions {
  timeoutMs?: number;
  env?: Record<string, string>;
  root?: string;
  docker?: boolean;
  dockerImage?: string;
  /** env var NAMES to provide as dummy values (docker mode). */
  dummyEnv?: string[];
}

export async function measureServer(
  name: string,
  command: string,
  opts: MeasureOptions = {},
): Promise<Measurement> {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name) || name.includes('..')) {
    throw new Error(`invalid server name '${name}' — letters/digits/dot/dash/underscore only`);
  }
  const root = opts.root ?? process.cwd();
  let spec: string | { command: string; argv: string[] } = command;
  let isolation: Measurement['isolation'] = { docker: false };
  let containerName: string | undefined;
  if (opts.docker && command.trimStart().startsWith('docker ')) {
    // Command is already a container — wrapping it again would need docker-in-docker.
    isolation = { docker: true, note: 'command is itself a docker run (host-spawned container)' };
  } else if (opts.docker) {
    containerName = `mcp-ctx-${name}-${process.pid}-${Math.floor(Math.random() * 1e6)}`;
    const d = dockerize(command, { image: opts.dockerImage, dummyEnv: opts.dummyEnv, containerName });
    spec = { command: d.command, argv: d.argv };
    isolation = d.isolation;
  }
  let m: Measurement;
  try {
    const first = await captureTools(spec, opts);
    const second = await captureTools(spec, opts);
    m = measureTools(first.tools, {
      serverName: first.serverInfo?.name ?? name,
      serverVersion: first.serverInfo?.version,
      launchCommand: command,
      envVarNames: [...Object.keys(opts.env ?? {}), ...(opts.dummyEnv ?? [])],
    });
    m.isolation = isolation;
    m.timeoutMs = opts.timeoutMs ?? 60_000;
    if (canonicalString(first.tools) !== canonicalString(second.tools)) {
      m.status = 'dynamic';
      m.notes = 'tools/list differed between two runs; value is for the first capture';
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('timeout')
      ? 'timeout'
      : /auth|unauthorized|401|forbidden|credential|api.?key|token/i.test(msg)
        ? 'auth-required'
        : 'startup-failure';
    m = failedMeasurement(status, { serverName: name, launchCommand: command, notes: msg.slice(0, 700) });
    m.isolation = isolation;
    m.timeoutMs = opts.timeoutMs ?? 60_000;
  } finally {
    if (containerName) {
      // Killing the docker CLI on timeout orphans the container — remove it.
      const { spawn } = await import('node:child_process');
      spawn('docker', ['rm', '-f', containerName], { stdio: 'ignore' }).on('error', () => {});
    }
  }

  const resultDir = join(root, 'results', name);
  mkdirSync(resultDir, { recursive: true });
  writeFileSync(join(resultDir, 'measurement.json'), JSON.stringify(m, null, 2) + '\n');

  mkdirSync(join(root, 'badges'), { recursive: true });
  writeFileSync(join(root, 'badges', `${name}.json`), JSON.stringify(toBadge(m)) + '\n');
  return m;
}

const isMain = process.argv[1]?.endsWith('run.ts') || process.argv[1]?.endsWith('run.js');
if (isMain) {
  const name = arg('name');
  const command = arg('command');
  if (!name || !command) {
    console.error('usage: npm run sweep -- --name <slug> --command "<launch command>"');
    process.exit(2);
  }
  const m = await measureServer(name, command, {
    timeoutMs: Number(arg('timeout') ?? 60_000),
    docker: process.argv.includes('--docker'),
    dockerImage: arg('docker-image'),
  });
  // CLI path only — measureServer itself stays history-free so concurrent
  // sweep-all workers never race on the same file.
  const { appendHistory } = await import('./history.js');
  appendHistory();
  console.log(
    m.status === 'measured' || m.status === 'dynamic'
      ? `${name}: ${m.totalTokens} tokens across ${m.toolCount} tools (${m.status})`
      : `${name}: ${m.status} — ${m.notes ?? ''}`,
  );
  process.exit(m.status === 'measured' || m.status === 'dynamic' ? 0 : 1);
}
