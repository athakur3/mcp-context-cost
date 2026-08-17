/**
 * `audit` — measure the MCP servers a person actually has installed.
 *
 * The leaderboard answers "what does server X cost?". This answers the question
 * the person paying the bill has: "what do MY servers cost, together, before I
 * type anything?" Same measurement path as the sweep (dual tools/list capture,
 * o200k_base over canonical JSON, full status taxonomy), pointed at a client
 * config instead of servers.yaml.
 *
 * Totals are per config file, never merged across clients: a context window
 * belongs to one client session, so summing Cursor's servers into Claude
 * Desktop's total would describe a session nobody is running. Identical launch
 * commands shared by two configs are still only measured once.
 */
import { METHODOLOGY_VERSION } from '../core/canonical.js';
import { isCurrent, type DivergenceRun } from '../core/divergence.js';
import type { Measurement, MeasurementStatus, ToolMeasurement } from '../core/types.js';
import type { ConfiguredServer, LoadedConfig } from './config.js';

export const DEFAULT_CONTEXT_WINDOW = 200_000;

export type AuditStatus = MeasurementStatus | 'remote-not-measurable';

export interface AuditServerResult {
  name: string;
  transport: 'stdio' | 'remote';
  status: AuditStatus;
  tokens: number | null;
  toolCount: number | null;
  /** Share of this config's measured total, 0–1. */
  share: number | null;
  command?: string;
  url?: string;
  /** Names only — a server's env values never enter a report. */
  envVarNames: string[];
  canonicalSha256?: string | null;
  /**
   * Anthropic-request cost from the published Claude divergence run, only when
   * its captured hash matches this install (`--claude`). `null` means the
   * install doesn't match what was published — silence, not a stale guess.
   * `undefined` means `--claude` wasn't requested at all.
   */
  claudeTokens?: number | null;
  notes?: string;
}

export interface HeaviestTool {
  server: string;
  tool: string;
  tokens: number;
}

/**
 * What turning off the heaviest few tools would recover, for clients that let
 * you disable individual tools rather than whole servers (Claude Code's
 * per-tool permission rules, Cursor's per-tool toggles). `null` when there's
 * nothing worth trimming (one tool total, or no measured tokens).
 */
export interface TrimAdvice {
  tools: HeaviestTool[];
  recoverableTokens: number;
  recoverableShare: number;
}

export interface AuditConfigResult {
  client: string;
  source: string;
  totalTokens: number;
  toolCount: number;
  serverCount: number;
  contextShare: number;
  servers: AuditServerResult[];
  skipped: AuditServerResult[];
  heaviestTools: HeaviestTool[];
  trimAdvice: TrimAdvice | null;
}

const TRIM_TOOL_COUNT = 3;

function buildTrimAdvice(sortedTools: HeaviestTool[], totalTokens: number): TrimAdvice | null {
  if (totalTokens <= 0 || sortedTools.length < 2) return null;
  const trimmed = sortedTools.slice(0, TRIM_TOOL_COUNT);
  const recoverableTokens = trimmed.reduce((a, t) => a + t.tokens, 0);
  return { tools: trimmed, recoverableTokens, recoverableShare: recoverableTokens / totalTokens };
}

export interface AuditReport {
  methodologyVersion: string;
  encoding: 'o200k_base';
  generatedAt: string;
  contextWindow: number;
  configs: AuditConfigResult[];
  budget?: { limit: number; worstTotal: number; worstSource: string; over: boolean };
  /** Present only when a divergence run was supplied (`--claude`). */
  claudeDivergence?: { model: string; measuredAt: string };
  problems: string[];
}

/** Cache key for measurement reuse: the exact argv two configs would spawn. */
export function serverKey(s: ConfiguredServer): string {
  return JSON.stringify(s.argv ?? [s.url ?? s.name]);
}

function measuredOk(m: Measurement): boolean {
  return (m.status === 'measured' || m.status === 'dynamic') && typeof m.totalTokens === 'number';
}

/**
 * Assemble the report from configs + measurements. Pure: `runAudit` does the
 * spawning, this does the arithmetic, so totals and shares are testable without
 * launching a single server.
 */
export function buildReport(
  configs: LoadedConfig[],
  measured: Map<string, Measurement>,
  opts: {
    contextWindow?: number;
    budget?: number;
    generatedAt?: string;
    /** Published `tools-delta/v1` run to join against (`--claude`); omit to skip the join. */
    divergence?: DivergenceRun | null;
  } = {},
): AuditReport {
  const contextWindow = opts.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const problems: string[] = [];
  const results: AuditConfigResult[] = [];

  for (const cfg of configs) {
    if (cfg.error) {
      problems.push(`${cfg.source}: ${cfg.error}`);
      continue;
    }
    const ok: AuditServerResult[] = [];
    const skipped: AuditServerResult[] = [];
    const tools: HeaviestTool[] = [];

    for (const s of cfg.servers) {
      const base = {
        name: s.name,
        transport: s.transport,
        command: s.command,
        url: s.url,
        envVarNames: s.envVarNames,
      };
      if (s.transport === 'remote') {
        skipped.push({
          ...base,
          status: 'remote-not-measurable',
          tokens: null,
          toolCount: null,
          share: null,
          notes: `remote endpoint (${s.url ?? 'url'}) — stdio measurement does not apply`,
        });
        continue;
      }
      const m = measured.get(serverKey(s));
      if (!m) {
        skipped.push({ ...base, status: 'startup-failure', tokens: null, toolCount: null, share: null, notes: 'not measured' });
        continue;
      }
      if (!measuredOk(m)) {
        skipped.push({
          ...base,
          status: m.status,
          tokens: null,
          toolCount: null,
          share: null,
          notes: m.notes?.split('\n')[0]?.slice(0, 200),
        });
        continue;
      }
      const divRow = opts.divergence?.servers[s.name];
      ok.push({
        ...base,
        status: m.status,
        tokens: m.totalTokens,
        toolCount: m.toolCount,
        share: null, // filled once the total is known
        canonicalSha256: m.canonicalSha256,
        claudeTokens: opts.divergence ? (isCurrent(divRow, m.canonicalSha256 ?? null) ? divRow.claudeDelta : null) : undefined,
        notes: m.status === 'dynamic' ? m.notes : undefined,
      });
      for (const t of m.tools) tools.push({ server: s.name, tool: t.name, tokens: t.tokens });
    }

    const totalTokens = ok.reduce((a, s) => a + (s.tokens ?? 0), 0);
    const toolCount = ok.reduce((a, s) => a + (s.toolCount ?? 0), 0);
    ok.sort((a, b) => (b.tokens ?? 0) - (a.tokens ?? 0));
    for (const s of ok) s.share = totalTokens > 0 ? (s.tokens ?? 0) / totalTokens : 0;
    tools.sort((a, b) => b.tokens - a.tokens);

    results.push({
      client: cfg.client,
      source: cfg.source,
      totalTokens,
      toolCount,
      serverCount: ok.length,
      // Deliberately no band: the color bands were frozen against the per-server
      // distribution (n=57). A config total is a different population, so calling
      // a 7,901-token *stack* "moderate" would borrow a scale that doesn't mean
      // that here. Share of the context window is the honest framing.
      contextShare: totalTokens / contextWindow,
      servers: ok,
      skipped,
      heaviestTools: tools.slice(0, 5),
      trimAdvice: buildTrimAdvice(tools, totalTokens),
    });
  }

  results.sort((a, b) => b.totalTokens - a.totalTokens);

  const report: AuditReport = {
    methodologyVersion: METHODOLOGY_VERSION,
    encoding: 'o200k_base',
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    contextWindow,
    configs: results,
    problems,
  };

  if (opts.divergence) {
    report.claudeDivergence = { model: opts.divergence.model, measuredAt: opts.divergence.measuredAt };
  }

  if (typeof opts.budget === 'number') {
    // The worst config is the gate: passing because your *lightest* client fits
    // would be a green check on a session you don't run.
    const worst = results[0];
    report.budget = {
      limit: opts.budget,
      worstTotal: worst?.totalTokens ?? 0,
      worstSource: worst?.source ?? '(none)',
      over: (worst?.totalTokens ?? 0) > opts.budget,
    };
  }
  return report;
}

const n = (x: number) => x.toLocaleString('en-US');
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Human output. JSON output is the report object itself. */
export function formatReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(
    `mcp-context-cost audit · methodology ${report.methodologyVersion} · ${report.encoding} · context window ${n(report.contextWindow)}`,
  );

  const showClaude = !!report.claudeDivergence;

  for (const cfg of report.configs) {
    lines.push('');
    lines.push(`${cfg.client}  ${cfg.source}`);

    const rows = cfg.servers.map((s) => ({
      name: s.name,
      tools: s.toolCount === null ? '—' : String(s.toolCount),
      tokens: s.tokens === null ? '—' : n(s.tokens),
      share: s.share === null ? '—' : pct(s.share),
      claude: s.claudeTokens == null ? '—' : n(s.claudeTokens),
    }));
    const w = {
      name: Math.max(6, ...rows.map((r) => r.name.length), 'total'.length),
      tools: Math.max(5, ...rows.map((r) => r.tools.length)),
      tokens: Math.max(6, ...rows.map((r) => r.tokens.length), n(cfg.totalTokens).length),
      claude: Math.max(6, ...rows.map((r) => r.claude.length)),
    };
    const line = (name: string, tools: string, tokens: string, share: string, claude: string) =>
      `  ${name.padEnd(w.name)}  ${tools.padStart(w.tools)}  ${tokens.padStart(w.tokens)}  ${share.padStart(6)}` +
      (showClaude ? `  ${claude.padStart(w.claude)}` : '');

    lines.push(line('server', 'tools', 'tokens', 'share', 'claude'));
    for (const r of rows) lines.push(line(r.name, r.tools, r.tokens, r.share, r.claude));
    lines.push(`  ${'─'.repeat(w.name + w.tools + w.tokens + 14 + (showClaude ? w.claude + 2 : 0))}`);
    lines.push(line('total', String(cfg.toolCount), n(cfg.totalTokens), '', ''));

    lines.push('');
    lines.push(
      `  Every request in this client carries ${n(cfg.totalTokens)} tokens of tool schemas — ` +
        `${pct(cfg.contextShare)} of a ${n(report.contextWindow)}-token context window, before you type anything.`,
    );

    if (cfg.heaviestTools.length) {
      lines.push('');
      lines.push('  heaviest tools');
      const tw = Math.max(...cfg.heaviestTools.map((t) => `${t.server} · ${t.tool}`.length));
      for (const t of cfg.heaviestTools) {
        lines.push(`    ${`${t.server} · ${t.tool}`.padEnd(tw)}  ${n(t.tokens).padStart(7)}`);
      }
    }

    if (cfg.trimAdvice) {
      const names = cfg.trimAdvice.tools.map((t) => `${t.server}·${t.tool}`).join(', ');
      lines.push('');
      lines.push(
        `  trim: disabling ${cfg.trimAdvice.tools.length} tool${cfg.trimAdvice.tools.length === 1 ? '' : 's'} ` +
          `(${names}) would recover ${n(cfg.trimAdvice.recoverableTokens)} tokens ` +
          `(${pct(cfg.trimAdvice.recoverableShare)} of this config) — if your client supports per-tool filtering.`,
      );
    }

    if (cfg.skipped.length) {
      lines.push('');
      lines.push('  not measured');
      const sw = Math.max(...cfg.skipped.map((s) => s.name.length));
      for (const s of cfg.skipped) {
        lines.push(`    ${s.name.padEnd(sw)}  ${s.status}${s.notes ? ` — ${s.notes}` : ''}`);
      }
    }
  }

  if (showClaude) {
    lines.push('');
    lines.push(
      `  claude = Anthropic-request cost from the ${report.claudeDivergence!.measuredAt} ${report.claudeDivergence!.model} ` +
        `divergence run, shown only where the published capture hash matches this install; '—' means no current match.`,
    );
  }

  if (report.problems.length) {
    lines.push('');
    lines.push('problems');
    for (const p of report.problems) lines.push(`  ${p}`);
  }

  if (report.budget) {
    lines.push('');
    lines.push(
      report.budget.over
        ? `BUDGET FAIL: ${n(report.budget.worstTotal)} > ${n(report.budget.limit)} (${report.budget.worstSource})`
        : `budget ok: ${n(report.budget.worstTotal)} ≤ ${n(report.budget.limit)}`,
    );
  }

  lines.push('');
  lines.push(
    'These are wire tokens — what the server puts on the wire, counted with o200k_base. What your model is billed',
  );
  lines.push(
    'differs per provider: measured ratios run 0.34×–1.92× on Anthropic requests. See docs/METHODOLOGY.md §claude-divergence.',
  );
  return lines.map((l) => l.replace(/\s+$/, '')).join('\n');
}

/** Top-level tool list across every config — used by nothing yet, handy for --json consumers. */
export function allHeaviestTools(report: AuditReport, limit = 10): HeaviestTool[] {
  return report.configs
    .flatMap((c) => c.heaviestTools)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, limit);
}

export type { ToolMeasurement };
