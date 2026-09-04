/**
 * `audit --baseline <report.json>` — what a config change costs every future session.
 *
 * `audit` answers "what do my servers cost right now". That is a number a reader
 * has to have an opinion about. A diff against a stored earlier report answers
 * the question that needs no opinion at all: *this change adds 17,000 tokens to
 * every request you will ever send from this client.* Same measurement path,
 * same per-config discipline — a baseline is just an earlier `audit --json`.
 *
 * The trap this file exists to avoid: a server that measured fine before and
 * fails to start now makes the total go DOWN. Subtracting two totals would
 * report that as an improvement, which is the flattering reading and the true
 * one having the same shape. So a server that changed measured-ness is never
 * given a delta — it is named, its known side is printed, and the direction of
 * the resulting error is stated ("understates by at least 9,246").
 */
import type { AuditConfigResult, AuditReport } from './audit.js';

export type ServerDeltaKind =
  | 'added'
  | 'removed'
  | 'changed'
  | 'unchanged'
  /** Measured in the baseline, not measurable now — the total understates. */
  | 'unmeasured-now'
  /** Not measurable in the baseline, measured now — the increase overstates. */
  | 'unmeasured-before'
  /** Present and unmeasured in both runs — contributes 0 to both totals, but hides cost. */
  | 'unmeasured-both';

export interface ServerDelta {
  name: string;
  kind: ServerDeltaKind;
  /** Baseline tokens; `null` when absent from the baseline or unmeasured in it. */
  before: number | null;
  /** Current tokens; `null` when gone from the config or unmeasured now. */
  after: number | null;
  /** Signed change. `null` whenever the two sides are not the same kind of number. */
  delta: number | null;
  /** Why a delta is missing, in a sentence a reader can act on. */
  note?: string;
}

export interface ConfigDiff {
  client: string;
  source: string;
  /** How this config was paired with a baseline config. */
  matchedBy: 'source' | 'sole-config' | 'unmatched';
  beforeTotal: number | null;
  afterTotal: number;
  /** afterTotal - beforeTotal, or `null` when there is no baseline to subtract. */
  delta: number | null;
  beforeShare: number | null;
  afterShare: number;
  /**
   * True when `delta` is the exact change in measured cost. False when a server
   * crossed the measured/unmeasured line, which moves the total for a reason
   * that is not a config change.
   */
  exact: boolean;
  /** Tokens the diff is known to be missing, and which way it leans. */
  understatedBy: number;
  overstatedBy: number;
  servers: ServerDelta[];
}

export interface AuditDiff {
  baselineGeneratedAt: string;
  baselineMethodologyVersion: string;
  /** False when something makes the two reports incommensurable at all (methodology bump). */
  comparable: boolean;
  /** Baseline configs that no current config matched — never silently dropped. */
  droppedConfigs: { client: string; source: string; totalTokens: number }[];
  warnings: string[];
  configs: ConfigDiff[];
  /**
   * The largest per-config increase. Per config, never merged: a context window
   * belongs to one client session, so a portfolio-wide "total delta" would
   * describe a session nobody runs. `null` when nothing could be compared.
   */
  worstIncrease: { source: string; delta: number } | null;
}

/** Parse and shape-check a stored report. A baseline that cannot be read is never "no change". */
export function parseBaselineReport(text: string): { report: AuditReport | null; problem?: string } {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { report: null, problem: `baseline is not JSON: ${(e as Error).message}` };
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { report: null, problem: 'baseline is not an audit report object' };
  }
  const r = doc as Partial<AuditReport>;
  if (!Array.isArray(r.configs)) {
    return { report: null, problem: "baseline has no 'configs' array — is it the output of `audit --json`?" };
  }
  if (typeof r.methodologyVersion !== 'string' || typeof r.encoding !== 'string') {
    return { report: null, problem: 'baseline is missing methodologyVersion/encoding — is it the output of `audit --json`?' };
  }
  for (const c of r.configs) {
    if (!c || typeof c !== 'object' || typeof (c as AuditConfigResult).source !== 'string') {
      return { report: null, problem: 'baseline has a config entry without a source path' };
    }
    // The number the diff subtracts from. Unchecked, a hand-trimmed or
    // jq-filtered baseline yields `after - undefined === NaN`, and `typeof NaN`
    // is 'number' — so the gate reported an increase of 0 and passed. A
    // baseline that cannot be read is never "no change".
    const total = (c as AuditConfigResult).totalTokens;
    if (typeof total !== 'number' || !Number.isFinite(total)) {
      return {
        report: null,
        problem: `baseline config ${(c as AuditConfigResult).source} has no usable totalTokens — is it the output of \`audit --json\`?`,
      };
    }
  }
  return { report: doc as AuditReport };
}

type ServerState = { present: boolean; tokens: number | null };

function statesOf(cfg: AuditConfigResult): Map<string, ServerState> {
  const out = new Map<string, ServerState>();
  for (const s of cfg.servers ?? []) out.set(s.name, { present: true, tokens: typeof s.tokens === 'number' ? s.tokens : null });
  // A skipped server IS in the config; it just has no number. Keeping it distinct
  // from absent is the whole reason `removed` and `unmeasured-now` are separate kinds.
  for (const s of cfg.skipped ?? []) if (!out.has(s.name)) out.set(s.name, { present: true, tokens: null });
  return out;
}

export function diffConfig(before: AuditConfigResult | null, after: AuditConfigResult, matchedBy: ConfigDiff['matchedBy']): ConfigDiff {
  const afterShare = after.contextShare;
  if (!before) {
    return {
      client: after.client,
      source: after.source,
      matchedBy: 'unmatched',
      beforeTotal: null,
      afterTotal: after.totalTokens,
      delta: null,
      beforeShare: null,
      afterShare,
      exact: false,
      understatedBy: 0,
      overstatedBy: 0,
      servers: [],
    };
  }

  const b = statesOf(before);
  const a = statesOf(after);
  const servers: ServerDelta[] = [];
  let understatedBy = 0;
  let overstatedBy = 0;
  let exact = true;

  for (const name of new Set([...b.keys(), ...a.keys()])) {
    const bs = b.get(name);
    const as = a.get(name);

    if (bs && !as) {
      servers.push(
        bs.tokens === null
          ? { name, kind: 'removed', before: null, after: null, delta: null, note: 'was in the config but never measured — removing it changed no measured cost' }
          : { name, kind: 'removed', before: bs.tokens, after: null, delta: -bs.tokens },
      );
      continue;
    }
    if (!bs && as) {
      if (as.tokens === null) {
        // Unknown, not zero — so the total this diff subtracts from does not
        // contain it and the increase understates. Marking the config inexact
        // is what stops `--max-increase` from passing: a server added in a PR
        // and unmeasurable in CI (no credential — the ordinary case) otherwise
        // reads as +0 and clears even a zero-token allowance.
        exact = false;
        servers.push({
          name,
          kind: 'added',
          before: null,
          after: null,
          delta: null,
          note: 'added but not measurable — its cost is unknown, not zero',
        });
      } else {
        servers.push({ name, kind: 'added', before: null, after: as.tokens, delta: as.tokens });
      }
      continue;
    }
    if (!bs || !as) continue;

    if (bs.tokens !== null && as.tokens !== null) {
      const delta = as.tokens - bs.tokens;
      servers.push({ name, kind: delta === 0 ? 'unchanged' : 'changed', before: bs.tokens, after: as.tokens, delta });
    } else if (bs.tokens !== null && as.tokens === null) {
      exact = false;
      understatedBy += bs.tokens;
      servers.push({
        name,
        kind: 'unmeasured-now',
        before: bs.tokens,
        after: null,
        delta: null,
        note: `measured ${bs.tokens.toLocaleString('en-US')} in the baseline and could not be measured now — its cost is missing from the total, not gone from your config`,
      });
    } else if (bs.tokens === null && as.tokens !== null) {
      exact = false;
      overstatedBy += as.tokens;
      servers.push({
        name,
        kind: 'unmeasured-before',
        before: null,
        after: as.tokens,
        delta: null,
        note: `could not be measured in the baseline and measures ${as.tokens.toLocaleString('en-US')} now — this cost is newly visible, not necessarily new`,
      });
    } else {
      servers.push({
        name,
        kind: 'unmeasured-both',
        before: null,
        after: null,
        delta: null,
        note: 'not measurable in either run — contributes 0 to both totals and hides an unknown cost',
      });
    }
  }

  // Biggest movers first; ties and non-deltas fall to the bottom in name order.
  servers.sort((x, y) => Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0) || x.name.localeCompare(y.name));

  return {
    client: after.client,
    source: after.source,
    matchedBy,
    beforeTotal: before.totalTokens,
    afterTotal: after.totalTokens,
    delta: after.totalTokens - before.totalTokens,
    beforeShare: before.contextShare ?? null,
    afterShare,
    exact,
    understatedBy,
    overstatedBy,
    servers,
  };
}

/**
 * Pair current configs with baseline configs.
 *
 * Exact source path first. Then one deliberate fallback: if each side has
 * exactly one config, they are the same config seen from two machines — the CI
 * case, where a baseline recorded at /Users/… meets a checkout at /home/runner/….
 * Anything looser would pair two unrelated clients and call the difference a
 * change, so everything else stays unmatched and says so.
 */
export function pairConfigs(
  before: AuditConfigResult[],
  after: AuditConfigResult[],
): { pairs: { before: AuditConfigResult | null; after: AuditConfigResult; matchedBy: ConfigDiff['matchedBy'] }[]; dropped: AuditConfigResult[] } {
  const unusedBefore = new Map(before.map((c) => [c.source, c]));
  const pairs: { before: AuditConfigResult | null; after: AuditConfigResult; matchedBy: ConfigDiff['matchedBy'] }[] = [];

  for (const cur of after) {
    const hit = unusedBefore.get(cur.source);
    if (hit) {
      unusedBefore.delete(cur.source);
      pairs.push({ before: hit, after: cur, matchedBy: 'source' });
    } else {
      pairs.push({ before: null, after: cur, matchedBy: 'unmatched' });
    }
  }

  // One on each side reads as the same config seen from two machines, where the
  // path legitimately differs (a laptop's baseline against a CI checkout). It
  // does not survive the clients differing: a Claude Desktop baseline against a
  // Claude Code run compares two unrelated stacks, and the gate then rests on
  // that difference. The paths may differ; what they are configs *for* may not.
  if (
    before.length === 1 &&
    after.length === 1 &&
    pairs[0].before === null &&
    before[0].client === after[0].client
  ) {
    pairs[0] = { before: before[0], after: after[0], matchedBy: 'sole-config' };
    unusedBefore.delete(before[0].source);
  }

  return { pairs, dropped: [...unusedBefore.values()] };
}

export function buildDiff(baseline: AuditReport, current: AuditReport): AuditDiff {
  const warnings: string[] = [];
  let comparable = true;

  if (baseline.methodologyVersion !== current.methodologyVersion) {
    comparable = false;
    warnings.push(
      `methodology changed (${baseline.methodologyVersion} → ${current.methodologyVersion}) — token counts from the two runs are not the same measurement`,
    );
  }
  if (baseline.encoding !== current.encoding) {
    comparable = false;
    warnings.push(`encoding changed (${baseline.encoding} → ${current.encoding}) — the counts are in different units`);
  }
  if (baseline.contextWindow !== current.contextWindow) {
    // Shares move, token counts do not. Worth saying, not worth invalidating.
    warnings.push(
      `context window changed (${baseline.contextWindow.toLocaleString('en-US')} → ${current.contextWindow.toLocaleString('en-US')}) — shares are not comparable, token counts still are`,
    );
  }

  const { pairs, dropped } = pairConfigs(baseline.configs, current.configs);
  const configs = pairs.map((p) => diffConfig(p.before, p.after, p.matchedBy));

  for (const c of configs) {
    if (c.matchedBy === 'unmatched') {
      warnings.push(`${c.source}: no matching config in the baseline — its ${c.afterTotal.toLocaleString('en-US')} tokens are shown as a total, not a change`);
    }
    if (c.matchedBy === 'sole-config' && c.source !== baseline.configs[0]?.source) {
      warnings.push(`paired ${c.source} with the baseline's ${baseline.configs[0]?.source} — one config on each side, different paths`);
    }
  }
  for (const d of dropped) {
    warnings.push(
      `${d.source}: in the baseline (${d.totalTokens.toLocaleString('en-US')} tokens) and not found now — a config that disappeared is not a config that got cheaper`,
    );
  }

  const increases = configs.filter((c) => typeof c.delta === 'number' && (c.delta as number) > 0);
  increases.sort((a, b) => (b.delta as number) - (a.delta as number));

  return {
    baselineGeneratedAt: baseline.generatedAt,
    baselineMethodologyVersion: baseline.methodologyVersion,
    comparable,
    droppedConfigs: dropped.map((d) => ({ client: d.client, source: d.source, totalTokens: d.totalTokens })),
    warnings,
    configs,
    worstIncrease: increases.length ? { source: increases[0].source, delta: increases[0].delta as number } : null,
  };
}

const n = (x: number) => x.toLocaleString('en-US');
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${n(Math.abs(x))}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
/** `--config <path>` records the client as 'explicit', which is a parser detail, not a name. */
const clientLabel = (client: string) => (client === 'explicit' || !client ? 'this client' : client);

export function formatDiff(diff: AuditDiff, contextWindow: number): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`diff vs baseline measured ${diff.baselineGeneratedAt} (methodology ${diff.baselineMethodologyVersion})`);

  for (const c of diff.configs) {
    lines.push('');
    if (c.matchedBy === 'unmatched' || c.delta === null || c.beforeTotal === null) {
      lines.push(`  ${c.source}  ${n(c.afterTotal)} tokens — no baseline for this config, so nothing to compare`);
      continue;
    }

    const rows = c.servers.filter((s) => s.kind !== 'unchanged');
    lines.push(`  ${c.source}`);
    lines.push(`    ${n(c.beforeTotal)}  →  ${n(c.afterTotal)}   ${signed(c.delta)}`);

    if (rows.length) {
      lines.push('');
      const w = Math.max(...rows.map((r) => r.name.length), 6);
      for (const r of rows) {
        const from = r.before === null ? '—' : n(r.before);
        const to = r.after === null ? '—' : n(r.after);
        const d = r.delta === null ? '' : `  ${signed(r.delta)}`;
        lines.push(`    ${r.kind.padEnd(17)} ${r.name.padEnd(w)}  ${from.padStart(9)} → ${to.padStart(9)}${d}`);
      }
    }

    const unchanged = c.servers.length - rows.length;
    if (unchanged) lines.push(`    (${unchanged} server${unchanged === 1 ? '' : 's'} unchanged)`);

    lines.push('');
    if (!c.exact) {
      // The headline sentence is where a skimmer stops, so it must not assert a change
      // this run could not establish. A server that died takes its tokens out of the
      // total exactly like a server you uninstalled — printing "removes 2,378 tokens"
      // and correcting it two lines down is the flattering reading getting read.
      lines.push(`    Not a clean comparison: a server changed measured-ness between the two runs.`);
      lines.push(`    The measured total moved ${signed(c.delta)}, but that is not what your config did.`);
      lines.push('');
      for (const r of c.servers) {
        if (r.kind === 'unmeasured-now' || r.kind === 'unmeasured-before') lines.push(`      ${r.name}: ${r.note}`);
      }
      if (c.understatedBy) lines.push(`      → true cost is at least ${n(c.understatedBy)} higher than the ${n(c.afterTotal)} measured now.`);
      if (c.overstatedBy) lines.push(`      → up to ${n(c.overstatedBy)} of that movement was already being paid, just unmeasured.`);
    } else if (c.delta === 0) {
      lines.push(`    No change: this config costs the same ${n(c.afterTotal)} tokens per request as the baseline.`);
    } else if (c.delta > 0) {
      lines.push(
        `    This change adds ${n(c.delta)} tokens to every request in ${clientLabel(c.client)} — ` +
          `${pct(c.beforeShare ?? 0)} → ${pct(c.afterShare)} of a ${n(contextWindow)}-token context window.`,
      );
    } else {
      lines.push(
        `    This change removes ${n(Math.abs(c.delta))} tokens from every request in ${clientLabel(c.client)} — ` +
          `${pct(c.beforeShare ?? 0)} → ${pct(c.afterShare)} of a ${n(contextWindow)}-token context window.`,
      );
    }

    const blind = c.servers.filter((r) => r.kind === 'unmeasured-both' || ((r.kind === 'added' || r.kind === 'removed') && r.delta === null));
    if (blind.length) {
      lines.push('');
      for (const r of blind) lines.push(`    ${r.name}: ${r.note}`);
    }
  }

  if (diff.warnings.length) {
    lines.push('');
    lines.push('  diff warnings');
    for (const w of diff.warnings) lines.push(`    ${w}`);
  }

  if (!diff.comparable) {
    lines.push('');
    lines.push('  The two runs are not the same measurement, so the numbers above are not a change.');
    lines.push('  Re-record the baseline with this version: mcp-context-cost audit --json > baseline.json');
  }

  return lines.join('\n');
}

export interface IncreaseGate {
  limit: number;
  pass: boolean;
  /** The increase the gate measured, when it got far enough to measure one. */
  increase: number | null;
  reasons: string[];
}

/**
 * `--max-increase N` — the CI gate. Fails on an increase over the limit, and
 * equally on any reason the increase could not be established.
 *
 * That second half is the point. A gate that passes when a server failed to
 * start, or when the baseline covered a config this run never found, is a green
 * check on a question nobody asked. Everything this portfolio has learned says
 * unchecked must not read as clean, so an inexact diff fails and names why.
 */
export function evaluateIncreaseGate(diff: AuditDiff, limit: number): IncreaseGate {
  const reasons: string[] = [];

  if (!diff.comparable) reasons.push('the baseline is not the same measurement as this run — nothing was compared');
  for (const c of diff.configs) {
    if (c.matchedBy === 'unmatched') {
      reasons.push(`${c.source}: no baseline to check its ${n(c.afterTotal)} tokens against`);
    } else if (!c.exact) {
      reasons.push(
        `${c.source}: a server's cost is not established on both sides, so the change could not be established exactly`,
      );
    }
  }
  for (const d of diff.droppedConfigs) {
    reasons.push(`${d.source}: covered by the baseline and not found in this run`);
  }

  // `Number.isFinite`, not `typeof === 'number'`: NaN passes the latter and
  // then compares false against every limit, which is a silent pass.
  const anyDelta = diff.configs.some((c) => Number.isFinite(c.delta));
  const worst = diff.worstIncrease?.delta;
  const increase = Number.isFinite(worst) ? (worst as number) : anyDelta ? 0 : null;
  if (reasons.length === 0 && increase !== null && increase > limit) {
    reasons.push(`${diff.worstIncrease!.source}: +${n(increase)} tokens per request, over the ${n(limit)} allowed`);
  }

  return { limit, pass: reasons.length === 0, increase, reasons };
}

export function formatGate(gate: IncreaseGate): string {
  if (gate.pass) {
    return `increase ok: ${gate.increase === null ? 'no change to measure' : `${signed(gate.increase)} tokens`} ≤ ${n(gate.limit)} allowed`;
  }
  return ['INCREASE FAIL:', ...gate.reasons.map((r) => `  ${r}`)].join('\n');
}
