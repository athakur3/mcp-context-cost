/**
 * The front pages' numbers, written by the same regeneration that writes the
 * leaderboard — and checked against the same data in the suite.
 *
 * README and docs/index.md state numbers as prose: how many candidates, how
 * many measured, the span, the sample tables, the Claude pair, the verify
 * transcript. Those sentences were written by hand, so they were true on the
 * day they were written and drifted with every scheduled re-sweep — by
 * 2026-09-03 the leaderboard said 68 measured while both pages said 69, the
 * exact front-page-contradicts-the-data failure repaired by hand once before
 * (2026-08-20) and re-created by the first sweep after it.
 *
 * The deferral tables got the durable fix first: a test reads the page's own
 * words against the resolver, so either side moving alone is a red check. That
 * works there because the tables change only when code changes. These numbers
 * change when *data* changes, on a schedule, with no human in the loop — a
 * check alone would schedule its own red main. So the numbers get the
 * leaderboard's treatment instead: regen patches them from results/, the
 * scheduled jobs commit the pages beside the data, and the suite asserts the
 * committed pages already agree — which fires only when someone changes data
 * without running regen, or rewords a sentence regen maintains.
 *
 * Each claim is a template: fixed words with slots. The words have to be on
 * the page as written (a missing anchor is a loud failure naming the claim,
 * never a silent skip), and only the slots are ever rewritten — spliced in
 * place, so the page's own line wrapping survives.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONTEXT_WINDOW } from '../audit/audit.js';
import { fieldSelectionShare, isCurrent } from '../core/divergence.js';
import { sessionStartLoad } from '../core/session-start.js';
import { isGood } from './harness-guard.js';
import { loadDivergence, loadRows, loadSessionStartRun, type Row, type ServerEntry } from './report.js';
import { collectChanges } from './regressions.js';

export interface PublishedStats {
  candidateTotal: number;
  measuredCount: number;
  max: { name: string; tokens: number };
  second: { name: string; tokens: number };
  min: { name: string; tokens: number };
  /** max/min, floored to two significant digits — a span claim must not overstate. */
  spanTimes: number;
  /** The heaviest server's share of the default context window, rounded %. */
  maxContextSharePct: number;
  /** The servers README's sample table names, with their current numbers. */
  sample: Record<string, { tokens: number; tools: number }>;
  claude: {
    runSize: number;
    /** Rows the leaderboard prints a claude number for: measured AND capture-current. */
    currentCount: number;
    heaviestClaudeName: string | null;
    /** `claudeTokens` is null when the published row no longer matches the capture on disk. */
    github: { badgeTokens: number; claudeTokens: number | null };
    notion: { badgeTokens: number; claudeTokens: number | null };
    /** The current row showing the largest field-selection effect, and its two counts. */
    widest: { server: string; full: number; mapped: number };
    /** Field-selection share across the run's *current* rows, as fractions of the payload. */
    shareMin: number;
    shareMax: number;
    /** claudeDelta / o200kFull across the run's rows that carry a number. */
    ratioMin: number;
    ratioMax: number;
  };
  deferralCostlierCount: number;
  /** Servers whose most recent cost movement went up / down (cost-regression/v1). */
  movement: { grew: number; shrank: number };
  verify: { serverName: string; tokens: number };
}

/** Named in README's sample table — the choice is editorial, the numbers are not. */
export const SAMPLE_SERVERS = [
  'github',
  'xcodebuildmcp',
  'brave-search',
  'notion',
  'playwright',
  'filesystem',
  'markitdown',
] as const;

export function floorToTwoSignificant(n: number): number {
  const whole = Math.floor(n);
  if (whole < 100) return whole;
  const magnitude = 10 ** (Math.floor(Math.log10(whole)) - 1);
  return Math.floor(whole / magnitude) * magnitude;
}

export function computePublishedStats(entries: ServerEntry[], root = process.cwd()): PublishedStats {
  const rows = loadRows(entries, root);
  const div = loadDivergence(root);
  const ss = loadSessionStartRun(root);

  const measured = rows
    .filter((r): r is Row & { m: NonNullable<Row['m']> } => r.m !== null && isGood(r.m.status))
    .filter((r) => typeof r.m.totalTokens === 'number')
    .sort((a, b) => b.m.totalTokens! - a.m.totalTokens!);
  if (measured.length < 2) throw new Error('fewer than two measured servers on disk — published stats cannot be computed');

  const asPair = (r: (typeof measured)[number]) => ({ name: r.entry.name, tokens: r.m.totalTokens! });
  const max = asPair(measured[0]);
  const min = asPair(measured[measured.length - 1]);
  if (min.tokens <= 0) throw new Error(`cheapest measured server (${min.name}) has no positive token count`);

  const sample: PublishedStats['sample'] = {};
  for (const name of SAMPLE_SERVERS) {
    const r = measured.find((x) => x.entry.name === name);
    if (!r || typeof r.m.toolCount !== 'number') {
      throw new Error(`README's sample table names ${name}, which has no current measurement`);
    }
    sample[name] = { tokens: r.m.totalTokens!, tools: r.m.toolCount };
  }

  if (!div) throw new Error('results/divergence.json is missing — README states its numbers');

  /**
   * A divergence row only where it still describes the capture on disk.
   *
   * The staleness gate is the whole discipline of this column, and skipping it
   * here is how README came to print two different costs for github on one
   * page: 54,422 from a row computed against bytes that no longer existed,
   * beside 54,622 from the measurement. `withClaude` below already applied
   * `isCurrent` to the very same run — the rule guarded one number and not its
   * neighbour.
   */
  const currentDivRow = (name: string) => {
    const d = div.servers[name];
    if (!d) throw new Error(`README's Claude table names ${name}, which is not in the divergence run`);
    const onDisk = rows.find((r) => r.entry.name === name)?.m?.canonicalSha256 ?? null;
    return isCurrent(d, onDisk) ? d : null;
  };
  /** The badge number comes from the measurement, never from a divergence row's copy of it. */
  const badgeTokensOf = (name: string) => {
    const r = measured.find((x) => x.entry.name === name);
    if (!r) throw new Error(`README's Claude table names ${name}, which has no current measurement`);
    return r.m.totalTokens!;
  };

  // Ranges are stated over the rows that are still current, for the same
  // reason: a range whose endpoint comes from a superseded capture describes a
  // set that no longer exists.
  const currentRows = Object.entries(div.servers).filter(([name, r]) =>
    isCurrent(r, rows.find((x) => x.entry.name === name)?.m?.canonicalSha256 ?? null),
  );
  const shares = currentRows
    .map(([, r]) => fieldSelectionShare(r))
    .filter((s): s is number => s !== null && s >= 0);
  const ratios = currentRows
    .filter(([, r]) => typeof r.claudeDelta === 'number' && r.claudeDelta > 0 && r.o200kFull > 0)
    .map(([, r]) => r.claudeDelta / r.o200kFull);
  if (shares.length === 0 || ratios.length === 0) {
    throw new Error('no current divergence row — METHODOLOGY states ranges over them; run `npm run divergence`');
  }
  // The exemplar METHODOLOGY names for the field-selection effect is whichever
  // current row shows it most, rather than a server hardcoded into the prose.
  const widest = currentRows
    .filter(([, r]) => (fieldSelectionShare(r) ?? -1) >= 0)
    .sort((a, b) => (fieldSelectionShare(b[1]) ?? 0) - (fieldSelectionShare(a[1]) ?? 0))[0]!;
  const withClaude = measured.filter((r) => isCurrent(div.servers[r.entry.name], r.m.canonicalSha256));
  const heaviest = [...withClaude].sort(
    (a, b) => div.servers[b.entry.name].claudeDelta - div.servers[a.entry.name].claudeDelta,
  )[0];

  const costlier = measured.filter((r) => {
    const load = sessionStartLoad(r.m, ss?.servers[r.entry.name]);
    return load !== null && load.totalTokens >= r.m.totalTokens!;
  });

  const { summary: movement } = collectChanges(entries, root);

  const githubRow = rows.find((r) => r.entry.name === 'github');
  if (!githubRow?.m || typeof githubRow.m.totalTokens !== 'number') {
    throw new Error('README quotes `verify` on results/github, which has no current measurement');
  }

  return {
    candidateTotal: rows.length,
    measuredCount: measured.length,
    max,
    second: asPair(measured[1]),
    min,
    spanTimes: floorToTwoSignificant(max.tokens / min.tokens),
    maxContextSharePct: Math.round((max.tokens / DEFAULT_CONTEXT_WINDOW) * 100),
    sample,
    claude: {
      runSize: Object.keys(div.servers).length,
      currentCount: withClaude.length,
      heaviestClaudeName: heaviest?.entry.name ?? null,
      github: { badgeTokens: badgeTokensOf('github'), claudeTokens: currentDivRow('github')?.claudeDelta ?? null },
      notion: { badgeTokens: badgeTokensOf('notion'), claudeTokens: currentDivRow('notion')?.claudeDelta ?? null },
      widest: { server: widest[0], full: widest[1].o200kFull, mapped: widest[1].o200kMapped },
      shareMin: Math.min(...shares),
      shareMax: Math.max(...shares),
      ratioMin: Math.min(...ratios),
      ratioMax: Math.max(...ratios),
    },
    deferralCostlierCount: costlier.length,
    movement: { grew: movement.grew, shrank: movement.shrank },
    verify: {
      serverName: githubRow.m.serverName ?? 'github',
      tokens: githubRow.m.totalTokens,
    },
  };
}

export type PageFile = 'README.md' | 'docs/index.md' | 'docs/METHODOLOGY.md';
export const PAGE_FILES: PageFile[] = ['README.md', 'docs/index.md', 'docs/METHODOLOGY.md'];

/**
 * One maintained sentence. `template` is its exact words with slots — `{n}` a
 * comma-formatted count, `{d}` a bare integer, `{f}` a decimal, `{w}` a server
 * or package name — and `values` is what the slots must hold for the data on
 * disk.
 */
export interface Claim {
  file: PageFile;
  id: string;
  template: string;
  values(stats: PublishedStats): string[];
}

const fmt = (n: number) => n.toLocaleString('en-US');
/** A number, or the em-dash that means "no current measurement" everywhere else here. */
const q = (n: number | null) => (n === null ? '—' : fmt(n));

export const PAGE_CLAIMS: Claim[] = [
  {
    file: 'README.md',
    id: 'span',
    template: 'across the {n} servers measured, cost spans **{n}×**, from `{w}` at {n} tokens to `{w}` at {n}.',
    values: (s) => [fmt(s.measuredCount), fmt(s.spanTimes), s.min.name, fmt(s.min.tokens), s.max.name, fmt(s.max.tokens)],
  },
  {
    file: 'README.md',
    id: 'sample:github',
    template: '| github (official) | **{n} tokens** | {n} |',
    values: (s) => [fmt(s.sample.github.tokens), fmt(s.sample.github.tools)],
  },
  {
    file: 'README.md',
    id: 'sample:xcodebuildmcp',
    template: '| xcodebuildmcp | {n} | {n} |',
    values: (s) => [fmt(s.sample.xcodebuildmcp.tokens), fmt(s.sample.xcodebuildmcp.tools)],
  },
  {
    file: 'README.md',
    id: 'sample:brave-search',
    template: '| brave-search | {n} | {n} |',
    values: (s) => [fmt(s.sample['brave-search'].tokens), fmt(s.sample['brave-search'].tools)],
  },
  {
    file: 'README.md',
    id: 'sample:notion',
    template: '| notion | {n} | {n} |',
    values: (s) => [fmt(s.sample.notion.tokens), fmt(s.sample.notion.tools)],
  },
  {
    file: 'README.md',
    id: 'sample:playwright',
    template: '| playwright *(4.8M installs/week)* | {n} | {n} |',
    values: (s) => [fmt(s.sample.playwright.tokens), fmt(s.sample.playwright.tools)],
  },
  {
    file: 'README.md',
    id: 'sample:filesystem',
    template: '| filesystem (reference) | {n} | {n} |',
    values: (s) => [fmt(s.sample.filesystem.tokens), fmt(s.sample.filesystem.tools)],
  },
  {
    file: 'README.md',
    id: 'sample:markitdown',
    template: '| markitdown | {n} | {n} |',
    values: (s) => [fmt(s.sample.markitdown.tokens), fmt(s.sample.markitdown.tools)],
  },
  {
    file: 'README.md',
    id: 'measured-of-candidates',
    template: '*({n} of {n} popular servers measured, each row dated by its own most recent sweep — full table in',
    values: (s) => [fmt(s.measuredCount), fmt(s.candidateTotal)],
  },
  {
    file: 'README.md',
    id: 'divergence-ratio-range',
    // README's own copy of the range METHODOLOGY maintains. Found by the
    // page-number guard: three numbers written by hand beside the two
    // sentences regen already kept true.
    template: 'measured at {f}×–{f}× across {n} servers)',
    values: (s) => [s.claude.ratioMin.toFixed(2), s.claude.ratioMax.toFixed(2), fmt(s.claude.runSize)],
  },
  {
    file: 'README.md',
    id: 'repo-map:candidates',
    // The repo map's own count of servers.yaml. It said 82 against 106 on disk:
    // written by hand when the file held 82, and ninety lines from the
    // regen-maintained count that had moved four times since.
    template: '| `servers.yaml` | {n} curated candidates with live install metrics and provenance |',
    values: (s) => [fmt(s.candidateTotal)],
  },
  {
    file: 'README.md',
    id: 'divergence-run-size',
    // "the top N" was the selection rule until 2026-09-05, when the run widened
    // to every measured server and the rotation began refreshing each slice
    // beside the sweep that measures it. The words now say what the run is
    // rather than a rank, so they stay true while the count regen maintains
    // climbs from 20 toward the measured set.
    template: 'The run holds {n} rows — the measured servers it covered when it last ran',
    values: (s) => [fmt(s.claude.runSize)],
  },
  {
    file: 'README.md',
    id: 'divergence-current-count',
    template: 'prints a claude number for the {n} that still match today and silence for the rest',
    values: (s) => [fmt(s.claude.currentCount)],
  },
  {
    file: 'README.md',
    id: 'claude-table:github',
    template: '| github | {n} | **{q}** | most of the capture is `annotations`/`outputSchema` metadata Claude never sees |',
    values: (s) => [fmt(s.claude.github.badgeTokens), q(s.claude.github.claudeTokens)],
  },
  {
    file: 'README.md',
    id: 'claude-table:notion',
    template: '| notion | {n} | **{q}** | almost no metadata to drop, so the tokenizer difference dominates |',
    values: (s) => [fmt(s.claude.notion.badgeTokens), q(s.claude.notion.claudeTokens)],
  },
  {
    file: 'README.md',
    id: 'cost-movement',
    template: 'cost has moved at all, {n} moved up against {n} that moved down.',
    values: (s) => [fmt(s.movement.grew), fmt(s.movement.shrank)],
  },
  {
    file: 'README.md',
    id: 'movement-ratchet',
    // The same two counts as `cost-movement`, ninety lines below it and, until
    // now, written by hand: the badge section said "nine servers ratcheting
    // upward against one that got cheaper" while the maintained sentence above
    // said eleven against six.
    template: 'has {n} servers ratcheting upward against {n} that got cheaper,',
    values: (s) => [fmt(s.movement.grew), fmt(s.movement.shrank)],
  },
  {
    file: 'README.md',
    id: 'verify-transcript',
    template: '# OK {w}: {d} tokens (o200k_base, methodology 1.0) — capture, hash, and count all agree',
    values: (s) => [s.verify.serverName, String(s.verify.tokens)],
  },
  {
    file: 'docs/index.md',
    id: 'index:counts',
    template: 'We measure {n} popular MCP servers; {n} have a number today, and every failure is listed with its reason.',
    values: (s) => [fmt(s.candidateTotal), fmt(s.measuredCount)],
  },
  {
    file: 'docs/index.md',
    id: 'index:span',
    template:
      'The spread is {n}×: from `{w}` at {n} tokens to `{w}` at **{n} tokens** — {d}% of a 200K context window, before the agent takes a single action.',
    values: (s) => [fmt(s.spanTimes), s.min.name, fmt(s.min.tokens), s.max.name, fmt(s.max.tokens), String(s.maxContextSharePct)],
  },
  {
    file: 'docs/index.md',
    id: 'index:second-heaviest',
    template: 'Second-heaviest is `{w}` at {n}.',
    values: (s) => [s.second.name, fmt(s.second.tokens)],
  },
  {
    file: 'docs/METHODOLOGY.md',
    id: 'divergence:share-range',
    template: 'this removes between {f}% and **{f}%** of the payload ({w}: {n} → {n} tokens).',
    // The exemplar is whichever current row shows the effect most, not a server
    // named in the prose — a hardcoded name goes stale the week it is re-swept.
    values: (s) => [
      (s.claude.shareMin * 100).toFixed(1),
      (s.claude.shareMax * 100).toFixed(1),
      s.claude.widest.server,
      fmt(s.claude.widest.full),
      fmt(s.claude.widest.mapped),
    ],
  },
  {
    file: 'docs/METHODOLOGY.md',
    id: 'divergence:band-parenthetical',
    // The deferral section's own copy of the band. It was hand-written and held
    // to `PUBLISHED_WIRE_TO_CLIENT_RATIO` by a test, which worked only while the
    // constant tracked the run exactly — and the constant is a release-time
    // snapshot that is deliberately allowed to lag. Two pages quoting two
    // different sources for one number is the drift this file exists to end, so
    // both pages state the run and the constant is guarded separately.
    template: 'band ({f}×–{f}×\nacross {n} servers)',
    values: (s) => [s.claude.ratioMin.toFixed(2), s.claude.ratioMax.toFixed(2), fmt(s.claude.runSize)],
  },
  {
    file: 'docs/METHODOLOGY.md',
    id: 'divergence:ratio-range',
    template: 'it ranged from {f}× to {f}× across the {n} servers in the run,',
    values: (s) => [s.claude.ratioMin.toFixed(2), s.claude.ratioMax.toFixed(2), fmt(s.claude.runSize)],
  },
  {
    file: 'docs/METHODOLOGY.md',
    id: 'divergence:heaviest-pair',
    template: '{w} is the heaviest server on o200k and {w} is the heaviest on Claude.',
    values: (s) => {
      if (!s.claude.heaviestClaudeName) {
        throw new Error('no row has a current claude number — the heaviest-on-Claude sentence cannot be maintained');
      }
      return [s.max.name, s.claude.heaviestClaudeName];
    },
  },
];

/**
 * Claims whose truth the data decides but whose words no template can rewrite —
 * prose whose shape would have to change with the answer. These are asserted in
 * the suite, never patched: if one goes false a person rewrites the sentence.
 */
export interface CheckClaim {
  file: PageFile;
  id: string;
  /** The page's words, template-escaped like any claim (wrapping-tolerant). */
  words: string;
  /** null when the data agrees with the words; otherwise why it does not. */
  holds(stats: PublishedStats): string | null;
}

export const CHECK_CLAIMS: CheckClaim[] = [
  {
    file: 'README.md',
    id: 'heaviest-differs-on-claude',
    words: 'the heaviest server on the badge is not the heaviest server on Claude',
    holds: (s) =>
      s.claude.heaviestClaudeName === null
        ? 'no row has a current claude number, so there is no heaviest server on Claude'
        : s.claude.heaviestClaudeName === s.max.name
          ? `the heaviest server on the badge (${s.max.name}) IS the heaviest on Claude now`
          : null,
  },
  {
    file: 'README.md',
    id: 'movement-usually-upward',
    // The sentence's shape, not its numbers: the section argues for a gate in
    // CI, and the argument only stands while upward movement outnumbers
    // downward. Asserted rather than patched — if it flips, a person rewrites
    // the paragraph rather than regen inverting its meaning under them.
    words: 'when a cost does move it usually moves up',
    holds: (s) =>
      s.movement.grew > s.movement.shrank
        ? null
        : `${s.movement.grew} server(s) moved up against ${s.movement.shrank} down — upward movement is no longer the majority`,
  },
  {
    file: 'README.md',
    id: 'deferring-costlier-somewhere',
    words: 'for at least one server in the published set it costs **more** than loading the definitions would',
    holds: (s) =>
      s.deferralCostlierCount >= 1
        ? null
        : 'no measured server currently costs more at session start than its definitions',
  },
];

const escapeLiteral = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');

/** Fixed words with `\s+` for every gap (prose wraps; a claim is its words, not its layout). */
export function compileTemplate(template: string): RegExp {
  let source = '';
  let last = 0;
  for (const slot of template.matchAll(/\{[ndwfq]\}/g)) {
    source += escapeLiteral(template.slice(last, slot.index));
    source +=
      slot[0] === '{n}'
        ? '([\\d,]+)'
        : slot[0] === '{d}'
          ? '(\\d+)'
          : slot[0] === '{f}'
            ? '(\\d+\\.\\d+)'
            : // `{q}` is a number that may not exist: the em-dash the leaderboard
              // already prints for a row whose capture has moved on.
              slot[0] === '{q}'
              ? '([\\d,]+|—)'
              : '([A-Za-z0-9._-]+)';
    last = slot.index + slot[0].length;
  }
  source += escapeLiteral(template.slice(last));
  return new RegExp(source, 'dg');
}

export interface ClaimApplication {
  text: string;
  /** Why the claim could not be applied — a missing or ambiguous anchor. */
  problem: string | null;
  /** True when a slot was rewritten. */
  changed: boolean;
}

/** Apply one claim: find its anchor exactly once, splice the slots to `want`, touch nothing else. */
export function applyClaim(
  text: string,
  claim: Pick<Claim, 'file' | 'id' | 'template'>,
  want: string[],
): ClaimApplication {
  const matches = [...text.matchAll(compileTemplate(claim.template))];
  if (matches.length !== 1) {
    return {
      text,
      changed: false,
      problem:
        matches.length === 0
          ? `${claim.file}: claim '${claim.id}' not found — the sentence regen maintains is gone or reworded`
          : `${claim.file}: claim '${claim.id}' matches ${matches.length} places — the anchor is ambiguous`,
    };
  }
  const match = matches[0];
  const got = match.slice(1);
  if (got.length !== want.length) {
    return {
      text,
      changed: false,
      problem: `${claim.file}: claim '${claim.id}' has ${got.length} slots but ${want.length} values — the claim itself is broken`,
    };
  }
  if (got.every((g, i) => g === want[i])) return { text, problem: null, changed: false };
  // Right-to-left so earlier slot offsets stay valid; the `d` flag supplies indices.
  const indices = match.indices!;
  for (let g = want.length; g >= 1; g--) {
    const [start, end] = indices[g]!;
    text = text.slice(0, start) + want[g - 1] + text.slice(end);
  }
  return { text, problem: null, changed: true };
}

export interface PagePatch {
  text: string;
  problems: string[];
  /** Claim ids whose slots were rewritten. */
  updated: string[];
}

/** Apply every claim for one page to its text. Slots are spliced in place; anchors are never rewritten. */
export function patchPageText(file: PageFile, text: string, stats: PublishedStats): PagePatch {
  const problems: string[] = [];
  const updated: string[] = [];
  for (const claim of PAGE_CLAIMS.filter((c) => c.file === file)) {
    const applied = applyClaim(text, claim, claim.values(stats));
    text = applied.text;
    if (applied.problem) problems.push(applied.problem);
    else if (applied.changed) updated.push(claim.id);
  }
  return { text, problems, updated };
}

export interface PublishedStatsResult {
  problems: string[];
  updated: string[];
  changedFiles: PageFile[];
}

/** Compute stats and report what regen would rewrite, without writing anything. */
export function verifyPublishedPages(entries: ServerEntry[], root = process.cwd()): PublishedStatsResult {
  return applyTo(entries, root, false);
}

/** Compute stats and rewrite the pages in place. Returns what changed and any refusals. */
export function applyPublishedStats(entries: ServerEntry[], root = process.cwd()): PublishedStatsResult {
  return applyTo(entries, root, true);
}

function applyTo(entries: ServerEntry[], root: string, write: boolean): PublishedStatsResult {
  const stats = computePublishedStats(entries, root);
  const problems: string[] = [];
  const updated: string[] = [];
  const changedFiles: PageFile[] = [];
  for (const file of PAGE_FILES) {
    const path = join(root, file);
    const before = readFileSync(path, 'utf8');
    const patch = patchPageText(file, before, stats);
    problems.push(...patch.problems);
    updated.push(...patch.updated);
    if (patch.text !== before) {
      changedFiles.push(file);
      if (write) writeFileSync(path, patch.text);
    }
  }
  return { problems, updated, changedFiles };
}
