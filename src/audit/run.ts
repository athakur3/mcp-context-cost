/**
 * Audit orchestration: discover configs, measure each distinct server once,
 * hand the results to `buildReport`.
 *
 * Kept apart from audit.ts so the arithmetic stays spawn-free and testable.
 */
import { homedir } from 'node:os';
import { measureServer } from '../sweep/run.js';
import type { Measurement } from '../core/types.js';
import { buildReport, serverKey, type AuditReport } from './audit.js';
import { configCandidates, loadConfigs, type ConfiguredServer, type LoadedConfig } from './config.js';

export interface AuditOptions {
  /** Explicit config path(s); when empty, every known client location is tried. */
  configPaths?: string[];
  cwd?: string;
  home?: string;
  timeoutMs?: number;
  concurrency?: number;
  docker?: boolean;
  contextWindow?: number;
  budget?: number;
  onProgress?: (name: string, done: number, total: number) => void;
}

export function discover(opts: AuditOptions = {}): LoadedConfig[] {
  const cwd = opts.cwd ?? process.cwd();
  const home = opts.home ?? homedir();
  const candidates =
    opts.configPaths && opts.configPaths.length
      ? opts.configPaths.map((path) => ({ client: 'explicit', path }))
      : configCandidates({ home, cwd, platform: process.platform, appData: process.env.APPDATA });
  return loadConfigs(candidates, cwd);
}

/** Measure every distinct stdio server across the given configs, once each. */
export async function measureAll(
  configs: LoadedConfig[],
  opts: AuditOptions = {},
): Promise<Map<string, Measurement>> {
  const unique = new Map<string, ConfiguredServer>();
  for (const cfg of configs) {
    for (const s of cfg.servers) {
      if (s.transport !== 'stdio') continue;
      // Two clients pointing at the same argv are one measurement, not two.
      if (!unique.has(serverKey(s))) unique.set(serverKey(s), s);
    }
  }

  const queue = [...unique.entries()];
  const total = queue.length;
  const measured = new Map<string, Measurement>();
  let done = 0;

  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [key, s] = next;
      const m = await measureServer(s.name, s.command ?? '', {
        argv: s.argv,
        env: s.env,
        timeoutMs: opts.timeoutMs ?? 60_000,
        docker: opts.docker,
        persist: false,
      });
      measured.set(key, m);
      opts.onProgress?.(s.name, ++done, total);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 3, total || 1)) }, worker));
  return measured;
}

export async function runAudit(opts: AuditOptions = {}): Promise<AuditReport> {
  const configs = discover(opts);
  const measured = await measureAll(configs, opts);
  return buildReport(configs, measured, {
    contextWindow: opts.contextWindow,
    budget: opts.budget,
  });
}
