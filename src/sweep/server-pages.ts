/**
 * Per-server detail pages: docs/servers/<name>.md plus an index.
 *
 * These are the badge's click-through target. A badge says "12,430 tokens";
 * the page behind it says which tools those tokens are in, what launched the
 * server, the hash of the bytes counted, and the one command that re-derives
 * the number. Generated from results/ only — no network, no timestamps beyond
 * the measurement's own, so regenerating without a new sweep is a no-op diff.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Measurement } from '../core/types.js';
import { bandColor, BAND_META } from '../core/bands.js';
import { deprecationText, loadDivergence, mdCell, type ServerEntry } from './report.js';
import { parseHistory, plottableSeries, type HistoryRow } from './history.js';
import { claudeRatio, fieldSelectionShare, isCurrent, type DivergenceRow, type DivergenceRun } from '../core/divergence.js';

/**
 * Pages are served from GitHub Pages (docs/), but results/ and badges/ are not
 * published there — links into them must be absolute repo URLs.
 */
const REPO_URL = 'https://github.com/athakur3/mcp-context-cost';
const BLOB = `${REPO_URL}/blob/main`;
const PAGES_URL = 'https://athakur3.github.io/mcp-context-cost';

/** Longest per-tool table we print inline; the rest live in the raw capture. */
const MAX_TOOL_ROWS = 30;

const fmt = (n: number) => n.toLocaleString('en-US');

/** True when a measurement produced a number we can stand behind. */
function isMeasured(m: Measurement | null): m is Measurement {
  return !!m && (m.status === 'measured' || m.status === 'dynamic') && typeof m.totalTokens === 'number';
}

function isolationText(m: Measurement): string {
  const iso = m.isolation;
  if (!iso) return 'not recorded';
  if (!iso.docker) return 'host process (no container)';
  return ['docker', iso.image, iso.network ? `network ${iso.network}` : '', iso.note]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The Claude divergence section: the headline, the projection onto the three
 * fields an Anthropic tool definition carries, and Claude's own count of that
 * projection. Printed only when a current divergence row exists for this server.
 */
function divergenceSection(row: DivergenceRow, run: DivergenceRun): string[] {
  const share = fieldSelectionShare(row);
  const ratio = claudeRatio(row);
  const md: string[] = [];
  md.push('## What this costs on Claude');
  md.push('');
  md.push(
    `Measured ${mdCell(run.measuredAt)} against \`${mdCell(run.model)}\` via Anthropic's \`count_tokens\` ` +
      `(method \`${mdCell(run.method)}\`).`,
  );
  md.push('');
  md.push('| | tokens | |');
  md.push('|---|---:|---|');
  md.push(`| o200k, full capture | ${fmt(row.o200kFull)} | the badge number — every byte \`tools/list\` returned |`);
  md.push(
    `| o200k, Anthropic fields only | ${fmt(row.o200kMapped)} | ` +
      `${share === null ? '—' : `${(share * 100).toFixed(1)}% of the capture is MCP-only metadata`} |`,
  );
  md.push(
    `| **Claude, same fields** | **${fmt(row.claudeDelta)}** | ` +
      `${ratio === null ? '—' : `${ratio.toFixed(2)}× the badge number`} |`,
  );
  md.push('');
  md.push(
    `An Anthropic tool definition carries \`name\`, \`description\`, and \`input_schema\` and nothing else, so ` +
      `\`title\`, \`annotations\`, \`outputSchema\`, \`execution\`, and \`icons\` are dropped before the request — ` +
      `that is the second row. The third row is the same tools counted by Anthropic, which is larger than the ` +
      `second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own ` +
      `framing (at most ${fmt(run.probeDelta)} tokens of it fixed, measured against a single minimal tool). ` +
      `The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.`,
  );
  md.push('');
  return md;
}

/** One server's page. `history` is that server's rows, oldest first. */
export function renderServerPage(
  entry: ServerEntry,
  m: Measurement,
  history: HistoryRow[] = [],
  divergence: DivergenceRun | null = null,
): string {
  const total = m.totalTokens as number;
  const band = BAND_META[bandColor(total)];
  const tools = [...m.tools].sort((a, b) => b.tokens - a.tokens);
  const shown = tools.slice(0, MAX_TOOL_ROWS);
  const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—');

  const md: string[] = [];
  md.push(`# ${mdCell(entry.name)} — context cost`);
  md.push('');
  md.push(
    `**${fmt(total)} tokens** across ${m.toolCount} tools — *${band.label}* (${band.range}). ` +
      `Measured ${String(m.measuredAt).slice(0, 10)} under [methodology v${mdCell(m.methodologyVersion)}](../METHODOLOGY.html).`,
  );
  md.push('');
  md.push('| | |');
  md.push('|---|---|');
  md.push(`| server (self-reported) | ${mdCell(m.serverName)}${m.serverVersion ? ` v${mdCell(String(m.serverVersion).replace(/^v/, ''))}` : ''} |`);
  md.push(`| status | ${mdCell(m.status)} |`);
  // A reader who arrives here from a badge sees this page and not the
  // leaderboard, so the deprecation has to be on it too — beside the status,
  // where it is read as a fact about the package rather than about the run.
  if (entry.deprecated) md.push(`| package | ${deprecationText(entry)} |`);
  md.push(`| tokenizer | ${mdCell(m.provider)} / ${mdCell(m.encoding)} |`);
  md.push(`| launch command | \`${mdCell(m.launchCommand ?? entry.command)}\` |`);
  md.push(`| isolation | ${mdCell(isolationText(m))} |`);
  md.push(`| env vars supplied | ${m.envVarNames?.length ? m.envVarNames.map(mdCell).join(', ') : 'none'} |`);
  md.push(`| canonical SHA-256 | \`${mdCell(m.canonicalSha256)}\` |`);
  if (entry.category) md.push(`| category | ${mdCell(entry.category)} |`);
  if (entry.repo) md.push(`| source | ${mdCell(entry.repo)} |`);
  md.push('');
  if (m.status === 'dynamic') {
    md.push(
      '> This server\'s `tools/list` differed between two consecutive captures, so the number ' +
        'is the first capture and moves between sweeps. Treat it as a range, not a constant.',
    );
    md.push('');
  }

  md.push('## Where the tokens are');
  md.push('');
  md.push('| tool | tokens | share | description | schema |');
  md.push('|---|---:|---:|---:|---:|');
  for (const t of shown) {
    md.push(
      `| ${mdCell(t.name)} | ${fmt(t.tokens)} | ${pct(t.tokens)} | ${fmt(t.descriptionTokens)} | ${fmt(t.inputSchemaTokens)} |`,
    );
  }
  md.push('');
  if (tools.length > shown.length) {
    const rest = tools.slice(shown.length).reduce((s, t) => s + t.tokens, 0);
    md.push(
      `*${tools.length - shown.length} smaller tools omitted (${fmt(rest)} tokens combined) — ` +
        `all of them are in the [raw capture](${BLOB}/results/${encodeURIComponent(entry.name)}/measurement.json).*`,
    );
    md.push('');
  }
  md.push(
    'Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the ' +
      'array adds its own brackets and commas, and the tokenizer merges tokens across object ' +
      'boundaries. The badge number is always the count of the whole array, never a sum of parts.',
  );
  md.push('');

  const divRow = divergence?.servers[entry.name];
  if (divergence && isCurrent(divRow, m.canonicalSha256)) {
    md.push(...divergenceSection(divRow, divergence));
  }

  if (history.length > 1) {
    // A change is only a change if both numbers were taken the same way, so the
    // delta column is blank across an isolation boundary rather than reporting a
    // difference the harness produced.
    const plottable = plottableSeries(history);
    const comparableFrom = plottable.rows[0]?.date;
    md.push('## Over time');
    md.push('');
    md.push('| date | tokens | tools | release | measured in | change |');
    md.push('|---|---:|---:|---|---|---:|');
    history.forEach((h, i) => {
      const prev = history[i - 1];
      const comparable = prev && (!prev.isolation || !h.isolation || prev.isolation === h.isolation);
      const delta = prev && comparable ? h.tokens - prev.tokens : null;
      const change = !prev
        ? '—'
        : !comparable
          ? 'not comparable'
          : delta === 0
            ? 'no change'
            : `${delta! > 0 ? '+' : ''}${fmt(delta!)}`;
      md.push(
        `| ${mdCell(h.date)} | ${fmt(h.tokens)} | ${h.toolCount} | ` +
          // Same rule as the isolation cell beside it: what the row does not
          // record is printed as not recorded, never carried over from the row
          // above. A server that reports no version at `initialize` reads the
          // same way as a row written before the column existed, which is
          // accurate — in both cases nothing on disk says.
          `${mdCell(h.version || 'not recorded')} | ${mdCell(h.isolation || 'not recorded')} | ${change} |`,
      );
    });
    md.push('');
    if (plottable.dropped) {
      md.push(
        `> The first ${plottable.dropped} row${plottable.dropped === 1 ? ' was' : 's were'} measured under a ` +
          `different isolation than the current measurement, so the published trend starts at ` +
          `${mdCell(comparableFrom)}. Numbers taken on the host and inside a container are not ` +
          `interchangeable — the package a \`@latest\` tag resolves to, the runtime version and the ` +
          `ambient environment can all differ.`,
      );
      md.push('');
    } else if (plottable.conditionsUnknown) {
      md.push(
        '> Some of these sweeps predate the `isolation` column, so the conditions they were ' +
          'measured under are not on record.',
      );
      md.push('');
    }
    md.push(`Full series: [results/history.csv](${BLOB}/results/history.csv).`);
    md.push('');
  }

  md.push('## Re-derive it');
  md.push('');
  md.push('```bash');
  md.push(`npx -y mcp-context-cost verify results/${entry.name}/measurement.json`);
  md.push('```');
  md.push('');
  md.push(
    `That re-tokenizes the [published capture](${BLOB}/results/${encodeURIComponent(entry.name)}/measurement.json) ` +
      `and checks the count and the hash. If it disagrees with the badge, the badge is wrong — ` +
      `[open an issue](${REPO_URL}/issues) and it gets corrected.`,
  );
  md.push('');
  md.push(
    `[Badge JSON](${BLOB}/badges/${encodeURIComponent(entry.name)}.json) · ` +
      `[All servers](index.html) · [Leaderboard](${BLOB}/results/leaderboard.md) · ` +
      `[Methodology](../METHODOLOGY.html)`,
  );
  md.push('');
  return md.join('\n');
}

/** The index that lists every candidate — measured ones link to their page. */
export function renderServerIndex(rows: { entry: ServerEntry; m: Measurement | null }[]): string {
  const measured = rows.filter((r) => isMeasured(r.m)).sort((a, b) => (b.m!.totalTokens as number) - (a.m!.totalTokens as number));
  const rest = rows.filter((r) => !isMeasured(r.m));

  const md: string[] = [];
  md.push('# Server pages');
  md.push('');
  md.push(
    `One page per measured server: the per-tool breakdown behind the badge, the exact launch ` +
      `command, and the command that re-derives the number. ${measured.length} of ${rows.length} ` +
      `candidates measured.`,
  );
  md.push('');
  md.push('| # | server | tokens | tools | band |');
  md.push('|---:|---|---:|---:|---|');
  measured.forEach((r, i) => {
    const t = r.m!.totalTokens as number;
    md.push(
      `| ${i + 1} | [${mdCell(r.entry.name)}](${encodeURIComponent(r.entry.name)}.html) | ${fmt(t)} | ` +
        `${r.m!.toolCount} | ${BAND_META[bandColor(t)].label} |`,
    );
  });
  md.push('');
  if (rest.length > 0) {
    md.push('## Not measured');
    md.push('');
    md.push('No page: there is no number to show. The reason is recorded per candidate.');
    md.push('');
    md.push('| server | status |');
    md.push('|---|---|');
    for (const r of rest) {
      const status = r.entry.remote ? 'remote-auth-wall' : (r.m?.status ?? 'not-yet-run');
      md.push(`| ${mdCell(r.entry.name)} | ${mdCell(status)} |`);
    }
    md.push('');
  }
  md.push(`[Leaderboard](${BLOB}/results/leaderboard.md) · [Methodology](../METHODOLOGY.html) · [Dashboard](../dashboard.html)`);
  md.push('');
  return md.join('\n');
}

/** Write docs/servers/*.md for every measured server, plus the index. */
export function writeServerPages(entries: ServerEntry[], root = process.cwd()): { pages: number } {
  const outDir = join(root, 'docs', 'servers');
  mkdirSync(outDir, { recursive: true });

  const historyPath = join(root, 'results', 'history.csv');
  const history = existsSync(historyPath) ? parseHistory(readFileSync(historyPath, 'utf8')) : [];
  const divergence = loadDivergence(root);

  const rows = entries.map((entry) => {
    const p = join(root, 'results', entry.name, 'measurement.json');
    let m: Measurement | null = null;
    if (existsSync(p)) {
      try {
        m = JSON.parse(readFileSync(p, 'utf8')) as Measurement;
      } catch {
        m = null; // a half-written measurement should not abort the whole run
      }
    }
    return { entry, m };
  });

  let pages = 0;
  for (const { entry, m } of rows) {
    if (!isMeasured(m)) continue;
    const series = history
      .filter((h) => h.server === entry.name)
      .sort((a, b) => a.date.localeCompare(b.date));
    writeFileSync(join(outDir, `${entry.name}.md`), renderServerPage(entry, m, series, divergence));
    pages++;
  }
  writeFileSync(join(outDir, 'index.md'), renderServerIndex(rows));
  return { pages };
}

/** Public URL of a server's page — used by the leaderboard and the badge snippet. */
export function serverPageUrl(name: string): string {
  return `${PAGES_URL}/servers/${encodeURIComponent(name)}.html`;
}
