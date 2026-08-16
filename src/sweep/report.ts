/**
 * Leaderboard generation from results/<name>/measurement.json + servers.yaml
 * metadata. Every yaml entry appears — failures included, no silent drops.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Measurement } from '../core/types.js';

export interface ServerEntry {
  name: string;
  command: string;
  package?: string;
  env?: string[];
  metric?: number;
  metricSource?: string;
  category?: string;
  repo?: string;
  remote?: boolean;
  dockerImage?: string;
  timeoutSeconds?: number;
}

interface Row {
  entry: ServerEntry;
  m: Measurement | null;
}

/** Neutralize markdown/table syntax in third-party strings (tool names, notes). */
export function mdCell(s: unknown): string {
  return String(s ?? '')
    .replace(/[|`[\]<>]/g, (c) => `\\${c}`)
    .replace(/\r?\n/g, ' ')
    .slice(0, 160);
}

function csvCell(s: unknown): string {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function loadRows(entries: ServerEntry[], root = process.cwd()): Row[] {
  return entries.map((entry) => {
    const p = join(root, 'results', entry.name, 'measurement.json');
    return { entry, m: existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Measurement) : null };
  });
}

export function writeLeaderboard(entries: ServerEntry[], root = process.cwd()): void {
  const rows = loadRows(entries, root);
  const measured = rows
    .filter((r) => r.m && (r.m.status === 'measured' || r.m.status === 'dynamic'))
    .sort((a, b) => (b.m!.totalTokens ?? 0) - (a.m!.totalTokens ?? 0));
  const unmeasured = rows.filter((r) => !measured.includes(r));

  const md: string[] = [];
  md.push('# MCP server context-cost leaderboard');
  md.push('');
  md.push(
    `Tokens = o200k_base count of the canonical \`tools/list\` bytes ([methodology v1.0](../docs/METHODOLOGY.md)). ` +
      `Measured ${measured.length}/${rows.length} candidates; every candidate is listed — failures are findings, not omissions. ` +
      `Server names link to their per-tool breakdown.`,
  );
  md.push('');
  md.push('| # | server | tokens | tools | largest tool | status | category |');
  md.push('|---:|---|---:|---:|---|---|---|');
  measured.forEach((r, i) => {
    const m = r.m!;
    const largest = [...m.tools].sort((a, b) => b.tokens - a.tokens)[0];
    const link = `[${mdCell(r.entry.name)}](../docs/servers/${encodeURIComponent(r.entry.name)}.md)`;
    md.push(
      `| ${i + 1} | ${link} | ${m.totalTokens!.toLocaleString('en-US')} | ${m.toolCount} | ` +
        `${largest ? `${mdCell(largest.name)} (${largest.tokens.toLocaleString('en-US')})` : '—'} | ${m.status} | ${mdCell(r.entry.category)} |`,
    );
  });
  md.push('');
  if (unmeasured.length > 0) {
    md.push('## Not measured (and why)');
    md.push('');
    md.push('| server | status | note |');
    md.push('|---|---|---|');
    for (const r of unmeasured) {
      const status = r.entry.remote ? 'remote-auth-wall' : (r.m?.status ?? 'not-yet-run');
      md.push(`| ${mdCell(r.entry.name)} | ${status} | ${mdCell(r.m?.notes)} |`);
    }
    md.push('');
  }
  writeFileSync(join(root, 'results', 'leaderboard.md'), md.join('\n') + '\n');

  const csv: string[] = ['name,tokens,toolCount,status,category,metric,metricSource'];
  for (const r of rows) {
    const m = r.m;
    csv.push(
      [
        csvCell(r.entry.name),
        m?.totalTokens ?? '',
        m?.toolCount ?? '',
        r.entry.remote ? 'remote-auth-wall' : (m?.status ?? 'not-yet-run'),
        csvCell(r.entry.category),
        r.entry.metric ?? '',
        csvCell(r.entry.metricSource),
      ].join(','),
    );
  }
  writeFileSync(join(root, 'results', 'leaderboard.csv'), csv.join('\n') + '\n');
}

/** Percentile helper for freezing color bands against the observed distribution. */
export function percentiles(entries: ServerEntry[], root = process.cwd()): Record<string, number> {
  const totals = loadRows(entries, root)
    .map((r) => r.m?.totalTokens)
    .filter((t): t is number => typeof t === 'number')
    .sort((a, b) => a - b);
  // Nearest-rank percentile: ceil(p/100 * n) as 1-based rank (unbiased at exact multiples).
  const at = (p: number) =>
    totals[Math.min(totals.length - 1, Math.max(0, Math.ceil((p / 100) * totals.length) - 1))] ?? 0;
  return { p25: at(25), p50: at(50), p75: at(75), p90: at(90), n: totals.length };
}
