/**
 * Self-contained HTML dashboard generated from results/ + servers.yaml.
 *   npx tsx src/sweep/dashboard.ts [--out docs/dashboard.html]
 * Regenerate after every sweep; the file doubles as the published artifact.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import type { Measurement } from '../core/types.js';
import type { ServerEntry } from './report.js';
import { bandColor, BAND_META } from '../core/bands.js';

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Row {
  entry: ServerEntry;
  m: Measurement | null;
}

export function generateDashboard(root = process.cwd()): string {
  const doc = parse(readFileSync(join(root, 'servers.yaml'), 'utf8')) as { servers: ServerEntry[] };
  const rows: Row[] = doc.servers.map((entry) => {
    const p = join(root, 'results', entry.name, 'measurement.json');
    return { entry, m: existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Measurement) : null };
  });

  const measured = rows
    .filter((r) => r.m && (r.m.status === 'measured' || r.m.status === 'dynamic') && r.m.totalTokens !== null)
    .sort((a, b) => (b.m!.totalTokens ?? 0) - (a.m!.totalTokens ?? 0));
  const pending = rows.filter((r) => !r.m && !r.entry.remote);
  const failed = rows.filter((r) => (r.m && !measured.includes(r)) || r.entry.remote);

  const totals = measured.map((r) => r.m!.totalTokens as number);
  const median = totals.length ? totals.slice().sort((a, b) => a - b)[Math.floor(totals.length / 2)] : 0;
  const max = totals.length ? Math.max(...totals) : 1;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

  const barRows = measured
    .map((r, i) => {
      const m = r.m!;
      const t = m.totalTokens as number;
      const band = bandColor(t);
      const meta = BAND_META[band];
      const largest = [...m.tools].sort((a, b) => b.tokens - a.tokens)[0];
      const pct = Math.max(1.2, (t / max) * 100);
      // The whole row is the link to the server's detail page (docs/servers/).
      return `<a class="row" href="servers/${encodeURIComponent(r.entry.name)}.html" data-tip="${esc(m.toolCount)} tools · largest: ${esc(largest?.name)} (${fmt(largest?.tokens ?? 0)} tok) · ${esc(r.entry.category)} · ${esc(m.status)}${m.serverVersion ? ' · v' + esc(String(m.serverVersion).replace(/^v/, '')) : ''}">
  <span class="rank">${i + 1}</span>
  <span class="name">${esc(r.entry.name)}</span>
  <span class="track"><span class="bar" style="width:${pct.toFixed(1)}%"></span></span>
  <span class="val"><span class="dot dot-${band}" aria-hidden="true"></span>${fmt(t)}<span class="bandname">${meta.label}</span></span>
</a>`;
    })
    .join('\n');

  const failRows = failed
    .map((r) => {
      const status = r.entry.remote ? 'remote-auth-wall' : (r.m?.status ?? 'not-run');
      const note = r.entry.remote ? 'OAuth-gated remote server; listed, not measured' : (r.m?.notes ?? '');
      return `<tr><td>${esc(r.entry.name)}</td><td><span class="chip">${esc(status)}</span></td><td class="note">${esc(note).slice(0, 160)}</td></tr>`;
    })
    .join('\n');

  const tableRows = measured
    .map((r, i) => {
      const m = r.m!;
      return `<tr><td>${i + 1}</td><td>${esc(r.entry.name)}</td><td class="num">${fmt(m.totalTokens as number)}</td><td class="num">${esc(m.toolCount)}</td><td>${esc(BAND_META[bandColor(m.totalTokens as number)].label)}</td><td>${esc(r.entry.category)}</td></tr>`;
    })
    .join('\n');

  const specimens = [measured[measured.length - 1], measured[0]]
    .filter(Boolean)
    .map((r) => {
      const t = r!.m!.totalTokens as number;
      const band = bandColor(t);
      return `<div class="specimen"><span class="badge"><span class="badge-l">context cost</span><span class="badge-r badge-${band}">${fmt(t)} tokens</span></span><code>badges/${esc(r!.entry.name)}.json</code></div>`;
    })
    .join('\n');

  return `<title>mcp-context-cost</title>
<style>
  :root {
    --bg: #F7F8F7; --surface: #FFFFFF; --ink: #17211D; --muted: #5C6B64;
    --line: #DCE2DF; --accent: #14635A; --accent-soft: rgba(20, 99, 90, 0.09);
    --track: #ECF0EE;
    --b-brightgreen: #2E7D4F; --b-green: #4F8A2E; --b-yellow: #A87A12;
    --b-orange: #BA5A1E; --b-red: #A63B2C;
    --badge-l: #555555; --badge-ink: #FFFFFF;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #151A18; --surface: #1C2321; --ink: #E4EAE7; --muted: #90A199;
      --line: #2C3531; --accent: #58B3A4; --accent-soft: rgba(88, 179, 164, 0.12);
      --track: #232B28;
      --b-brightgreen: #6FC08D; --b-green: #8CBE62; --b-yellow: #D3A748;
      --b-orange: #DB8A57; --b-red: #D97F6C;
    }
  }
  :root[data-theme="dark"] {
    --bg: #151A18; --surface: #1C2321; --ink: #E4EAE7; --muted: #90A199;
    --line: #2C3531; --accent: #58B3A4; --accent-soft: rgba(88, 179, 164, 0.12);
    --track: #232B28;
    --b-brightgreen: #6FC08D; --b-green: #8CBE62; --b-yellow: #D3A748;
    --b-orange: #DB8A57; --b-red: #D97F6C;
  }
  * { box-sizing: border-box; }
  body {
    background: var(--bg); color: var(--ink); margin: 0; padding: 0 20px 80px;
    font-family: "Avenir Next", "Helvetica Neue", system-ui, sans-serif;
    font-size: 15px; line-height: 1.55;
  }
  .wrap { max-width: 880px; margin: 0 auto; }
  header { padding: 48px 0 10px; }
  .eyebrow { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--accent); margin: 0 0 10px; }
  h1 { font-family: "Futura", "Avenir Next", "Century Gothic", sans-serif; font-weight: 700; font-size: clamp(1.9rem, 5vw, 2.6rem); margin: 0 0 10px; letter-spacing: -0.01em; }
  .sub { color: var(--muted); max-width: 62ch; margin: 0 0 8px; }
  h2 { font-family: "Futura", "Avenir Next", sans-serif; font-size: 1.15rem; font-weight: 600; margin: 44px 0 4px; }
  .h2sub { color: var(--muted); font-size: 0.88rem; margin: 0 0 16px; }
  a { color: var(--accent); }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 22px 0 6px; }
  .stat { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 12px 14px 10px; }
  .stat .n { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-variant-numeric: tabular-nums; font-size: 1.45rem; font-weight: 600; display: block; }
  .stat .l { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }

  .board { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; }
  .row { display: grid; grid-template-columns: 2ch minmax(120px, 190px) 1fr max-content; gap: 10px; align-items: center; padding: 3px 4px; border-radius: 4px; outline: none; color: inherit; text-decoration: none; }
  .row:hover, .row:focus-visible { background: var(--accent-soft); }
  .row:hover .name, .row:focus-visible .name { text-decoration: underline; }
  .rank { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
  .name { font-size: 0.86rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .track { background: var(--track); border-radius: 3px; height: 12px; overflow: hidden; }
  .bar { display: block; height: 100%; background: var(--accent); border-radius: 3px 3px 3px 3px; min-width: 3px; }
  .val { font-family: ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; font-size: 0.82rem; display: flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; box-shadow: 0 0 0 2px var(--surface); }
  .dot-brightgreen { background: var(--b-brightgreen); } .dot-green { background: var(--b-green); }
  .dot-yellow { background: var(--b-yellow); } .dot-orange { background: var(--b-orange); } .dot-red { background: var(--b-red); }
  .bandname { color: var(--muted); font-size: 0.72rem; min-width: 62px; }

  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 10px 2px 0; font-size: 0.78rem; color: var(--muted); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }

  #tip { position: fixed; pointer-events: none; background: var(--ink); color: var(--bg); font-size: 0.78rem; padding: 6px 9px; border-radius: 5px; max-width: 340px; display: none; z-index: 10; line-height: 1.4; }

  table { border-collapse: collapse; width: 100%; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; font-size: 0.85rem; }
  th { text-align: left; font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
  th, td { padding: 7px 12px; border-bottom: 1px solid var(--line); }
  tr:last-child td { border-bottom: none; }
  td.num { font-family: ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; text-align: right; }
  td.note { color: var(--muted); font-size: 0.8rem; }
  .chip { font-family: ui-monospace, Menlo, monospace; font-size: 11px; background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
  .tablewrap { overflow-x: auto; }

  .specimen { display: flex; align-items: center; gap: 14px; margin: 8px 0; }
  .badge { display: inline-flex; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 11px; border-radius: 3px; overflow: hidden; line-height: 1; }
  .badge span { padding: 4px 7px; }
  .badge-l { background: var(--badge-l); color: var(--badge-ink); }
  .badge-r { color: var(--badge-ink); }
  .badge-brightgreen { background: #4c1; } .badge-green { background: #97ca00; color: #333; }
  .badge-yellow { background: #dfb317; color: #333; } .badge-orange { background: #fe7d37; } .badge-red { background: #e05d44; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 0.8rem; color: var(--muted); }
  pre { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 12px 14px; overflow-x: auto; font-size: 0.8rem; }
  details summary { cursor: pointer; color: var(--muted); font-size: 0.85rem; }
  footer { margin-top: 48px; border-top: 1px solid var(--line); padding-top: 16px; color: var(--muted); font-size: 0.8rem; font-family: ui-monospace, Menlo, monospace; }
  @media (prefers-reduced-motion: no-preference) { .bar { transition: width 0.4s ease; } }
</style>
<div class="wrap">
  <header>
    <p class="eyebrow">methodology v1.0 · o200k_base · generated ${now}</p>
    <h1>mcp-context-cost</h1>
    <p class="sub">What popular MCP servers cost in context tokens before the agent does any work — measured from raw <code>tools/list</code> captures, every number re-derivable from its published measurement file.</p>
  </header>

  <div class="stats">
    <div class="stat"><span class="n">${measured.length}<span style="font-size:0.9rem;color:var(--muted)">/${rows.length}</span></span><span class="l">servers measured</span></div>
    <div class="stat"><span class="n">${fmt(median)}</span><span class="l">median tokens</span></div>
    <div class="stat"><span class="n">${fmt(max === 1 ? 0 : max)}</span><span class="l">priciest (${esc(measured[0]?.entry.name ?? '—')})</span></div>
    <div class="stat"><span class="n">${pending.length}</span><span class="l">pending sweep</span></div>
  </div>

  <h2>Leaderboard</h2>
  <p class="h2sub">Tokens = o200k_base count of the canonical <code>tools/list</code> bytes. Hover or focus a row for detail; open a row for its per-tool breakdown.</p>
  <div class="board">
${barRows || '<p class="h2sub">Sweep in progress — first results land shortly.</p>'}
  </div>
  <div class="legend">
    <span><span class="dot dot-brightgreen"></span>lean &lt;1K</span>
    <span><span class="dot dot-green"></span>light 1–5K</span>
    <span><span class="dot dot-yellow"></span>moderate 5–15K</span>
    <span><span class="dot dot-orange"></span>heavy 15–30K</span>
    <span><span class="dot dot-red"></span>very heavy ≥30K</span>
  </div>

  <h2>Not measured — and why</h2>
  <p class="h2sub">Every candidate appears; failures are findings, not omissions.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>server</th><th>status</th><th>note</th></tr></thead>
    <tbody>${failRows || '<tr><td colspan="3" class="note">none yet</td></tr>'}</tbody>
  </table></div>

  <h2>The badge</h2>
  <p class="h2sub">A shields.io endpoint badge backed by a reproducible measurement — merge one line into a README.</p>
  ${specimens || '<p class="h2sub">Specimens render once the sweep lands.</p>'}
  <pre>[![context cost](https://img.shields.io/endpoint?url=&lt;raw badges/&lt;server&gt;.json URL&gt;)](&lt;methodology URL&gt;)</pre>

  <details><summary>Full data table</summary>
  <div class="tablewrap" style="margin-top:10px"><table>
    <thead><tr><th>#</th><th>server</th><th>tokens</th><th>tools</th><th>band</th><th>category</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table></div>
  </details>

  <footer>
    Reproduce any number: <code>mcp-context-cost verify results/&lt;server&gt;/measurement.json</code> — re-derives tokens + SHA-256 from the raw capture.
    Bands are provisional until frozen against the full-sweep distribution.
  </footer>
</div>
<div id="tip" role="status"></div>
<script>
  (function () {
    var tip = document.getElementById('tip');
    document.querySelectorAll('.row[data-tip]').forEach(function (row) {
      function show() { tip.textContent = row.getAttribute('data-tip'); tip.style.display = 'block'; }
      function hide() { tip.style.display = 'none'; }
      row.addEventListener('mouseenter', show);
      row.addEventListener('focus', show);
      row.addEventListener('mouseleave', hide);
      row.addEventListener('blur', hide);
      row.addEventListener('mousemove', function (e) {
        var x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
        tip.style.left = x + 'px';
        tip.style.top = Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 8) + 'px';
      });
      row.addEventListener('focus', function () {
        var r = row.getBoundingClientRect();
        tip.style.left = r.left + 'px';
        tip.style.top = r.bottom + 6 + 'px';
      });
    });
  })();
</script>
`;
}

const isMain = process.argv[1]?.endsWith('dashboard.ts') || process.argv[1]?.endsWith('dashboard.js');
if (isMain) {
  const i = process.argv.indexOf('--out');
  const out = i >= 0 ? process.argv[i + 1] : 'docs/dashboard.html';
  const html = generateDashboard();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)}KB)`);
}
