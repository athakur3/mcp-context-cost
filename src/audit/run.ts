/**
 * Audit orchestration: discover configs, measure each distinct server once,
 * hand the results to `buildReport`.
 *
 * Kept apart from audit.ts so the arithmetic stays spawn-free and testable.
 */
import { homedir } from 'node:os';
import { measureServer } from '../sweep/run.js';
import type { Measurement } from '../core/types.js';
import { parseDivergence, type DivergenceRun } from '../core/divergence.js';
import { parseToolShapeBaseline, type ToolShapeBaseline } from '../core/tool-shape.js';
import { parseCaptureIndex, type CaptureIndex } from '../core/capture-index.js';
import { buildReport, serverKey, type AuditReport } from './audit.js';
import { toolSearchEnv, type ToolSearchEnv, type ToolSearchSource } from './deferral.js';
import {
  configCandidates,
  loadConfigs,
  loadSettingsSources,
  settingsCandidates,
  type ConfiguredServer,
  type LoadedConfig,
} from './config.js';

/** Where the published `tools-delta/v1` run lives when `--claude` doesn't override it. */
export const DEFAULT_DIVERGENCE_URL =
  'https://raw.githubusercontent.com/athakur3/mcp-context-cost/main/results/divergence.json';

/** Where the published `tool-shape/v1` baseline lives when `--suggest` doesn't override it. */
export const DEFAULT_TOOL_SHAPE_URL =
  'https://raw.githubusercontent.com/athakur3/mcp-context-cost/main/results/tool-shape.json';

/** Where the published `capture-index/v1` lives when `--changed` doesn't override it. */
export const DEFAULT_CAPTURE_INDEX_URL =
  'https://raw.githubusercontent.com/athakur3/mcp-context-cost/main/results/capture-index.json';

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
  /** Join each measured server against the published Claude divergence run. */
  claude?: boolean;
  /** Override the divergence.json source — mainly for tests and self-hosted mirrors. */
  divergenceUrl?: string;
  /** Place this config's tools in the published tool-shape distribution and advise where the data can. */
  suggest?: boolean;
  /** Override the tool-shape.json source — mainly for tests and self-hosted mirrors. */
  toolShapeUrl?: string;
  /** Identify each server against the published capture history, by hash, and report what has moved. */
  changed?: boolean;
  /** Override the capture-index.json source — mainly for tests and self-hosted mirrors. */
  captureIndexUrl?: string;
  /**
   * The tool-search variables as this process's SHELL has them. Defaults to
   * this process's environment. Overridable so a test can state a machine
   * rather than inherit the one it runs on.
   */
  env?: ToolSearchEnv;
  /**
   * The same variables as Claude Code's own settings files set them — the other
   * half of the answer, and the half a shell cannot show. Defaults to reading
   * those files off the machine being audited (`discoverSettings`).
   */
  settings?: ToolSearchSource[];
  onProgress?: (name: string, done: number, total: number) => void;
}

/** Fetch and parse the published capture index. Never throws: a failure is a report problem, not a crash. */
export async function fetchCaptureIndex(url: string): Promise<{ index: CaptureIndex | null; problem?: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { index: null, problem: `capture index: HTTP ${res.status} fetching ${url}` };
    const index = parseCaptureIndex(await res.text());
    return index ? { index } : { index: null, problem: `capture index: malformed data at ${url}` };
  } catch (e) {
    return { index: null, problem: `capture index: failed to fetch ${url}: ${(e as Error).message}` };
  }
}

/** Fetch and parse the published tool-shape baseline. Never throws: a failure is a report problem, not a crash. */
export async function fetchToolShape(url: string): Promise<{ baseline: ToolShapeBaseline | null; problem?: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { baseline: null, problem: `tool shape: HTTP ${res.status} fetching ${url}` };
    const baseline = parseToolShapeBaseline(await res.text());
    return baseline ? { baseline } : { baseline: null, problem: `tool shape: malformed data at ${url}` };
  } catch (e) {
    return { baseline: null, problem: `tool shape: failed to fetch ${url}: ${(e as Error).message}` };
  }
}

/** Fetch and parse the published divergence run. Never throws: a failure is a report problem, not a crash. */
export async function fetchDivergence(url: string): Promise<{ run: DivergenceRun | null; problem?: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { run: null, problem: `claude divergence: HTTP ${res.status} fetching ${url}` };
    const run = parseDivergence(await res.text());
    return run ? { run } : { run: null, problem: `claude divergence: malformed data at ${url}` };
  } catch (e) {
    return { run: null, problem: `claude divergence: failed to fetch ${url}: ${(e as Error).message}` };
  }
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

/**
 * Read every settings file Claude Code would take its deferral setting from.
 *
 * A sibling of `discover` above and deliberately separate from it: that one
 * finds which servers exist, this one finds how the client treats them. The
 * setting does not live in a client config, and reading only the shell that
 * launched this audit answers for the wrong machine.
 */
export function discoverSettings(opts: AuditOptions = {}): ToolSearchSource[] {
  const cwd = opts.cwd ?? process.cwd();
  const home = opts.home ?? homedir();
  return loadSettingsSources(
    settingsCandidates({ home, cwd, platform: process.platform, programData: process.env.ProgramData }),
  );
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

  let divergence: DivergenceRun | null = null;
  let divergenceProblem: string | undefined;
  if (opts.claude) {
    const fetched = await fetchDivergence(opts.divergenceUrl ?? DEFAULT_DIVERGENCE_URL);
    divergence = fetched.run;
    divergenceProblem = fetched.problem;
  }

  let toolShape: ToolShapeBaseline | null = null;
  let toolShapeProblem: string | undefined;
  if (opts.suggest) {
    const fetched = await fetchToolShape(opts.toolShapeUrl ?? DEFAULT_TOOL_SHAPE_URL);
    toolShape = fetched.baseline;
    toolShapeProblem = fetched.problem;
  }

  let captureIndex: CaptureIndex | null = null;
  let captureIndexProblem: string | undefined;
  if (opts.changed) {
    const fetched = await fetchCaptureIndex(opts.captureIndexUrl ?? DEFAULT_CAPTURE_INDEX_URL);
    captureIndex = fetched.index;
    captureIndexProblem = fetched.problem;
  }

  const report = buildReport(configs, measured, {
    contextWindow: opts.contextWindow,
    budget: opts.budget,
    divergence,
    toolShape,
    captureIndex,
    env: opts.env ?? toolSearchEnv(process.env),
    settings: opts.settings ?? discoverSettings(opts),
  });
  if (divergenceProblem) report.problems.push(divergenceProblem);
  if (toolShapeProblem) report.problems.push(toolShapeProblem);
  if (captureIndexProblem) report.problems.push(captureIndexProblem);
  return report;
}
