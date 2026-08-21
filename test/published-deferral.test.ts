import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONTEXT_WINDOW } from '../src/audit/audit.js';
import {
  evaluateDeferral,
  PUBLISHED_WIRE_TO_CLIENT_RATIO,
  TOOL_SEARCH_AUTO_SHARE,
  type DeferralVerdict,
  type ToolSearchEnv,
  type ToolSearchSetting,
  type ToolSearchSource,
} from '../src/audit/deferral.js';

/**
 * The published deferral tables, read against the resolver they describe.
 *
 * Two pages tell a reader what `audit` will say about their machine: the front
 * page, which is both what GitHub renders and the only document inside the npm
 * tarball, and the methodology page GitHub Pages serves. Both have drifted from
 * `src/audit/deferral.ts` while every check reported success — the methodology
 * table was repaired by hand on 2026-08-21 and the front page's on 2026-08-22,
 * and in between the front page told a reader whose settings file held the JSON
 * boolean `false` that deferral was off, which is exactly the machine the
 * command refuses to answer for. Repairing the instances does nothing about the
 * next one: there were 425 tests and not one of them opened either page.
 *
 * So every row of both tables is a case here — a machine, the words the page
 * uses for that machine, and the answer `evaluateDeferral` actually gives it.
 * The words have to be on the page as written, and the resolver has to agree
 * with them. Either side moving alone fails, which is the property being
 * bought: the drift was invisible from the code, and a resolver change is
 * invisible from the pages.
 */

const repoRoot = join(import.meta.dirname, '..');
const readRepo = (p: string) => readFileSync(join(repoRoot, p), 'utf8');

/** Prose wraps and rows do not; a claim is its words, not its layout. */
const flatten = (s: string) => s.replace(/\s+/g, ' ').trim();

const PAGE_FILES = {
  README: 'README.md',
  METHODOLOGY: 'docs/METHODOLOGY.md',
} as const;
type Page = keyof typeof PAGE_FILES;
const PAGES = Object.keys(PAGE_FILES) as Page[];

/** The header line of the deferral table on each page. */
const TABLE_HEADER: Record<Page, string> = {
  README: '| setting | what the audit reports |',
  METHODOLOGY: '| read | value | posture |',
};

const pageCache = new Map<Page, string>();
function pageText(page: Page): string {
  if (!pageCache.has(page)) pageCache.set(page, flatten(readRepo(PAGE_FILES[page])));
  return pageCache.get(page)!;
}

const rowCache = new Map<Page, string[]>();
/** The body rows of a page's deferral table, in the order it prints them. */
function tableRows(page: Page): string[] {
  if (rowCache.has(page)) return rowCache.get(page)!;
  const lines = readRepo(PAGE_FILES[page]).split('\n');
  const head = lines.indexOf(TABLE_HEADER[page]);
  // A page that no longer carries the table has not passed this check; it has
  // removed it. Refusing here is the same rule the product applies to a gate
  // whose answer could not be established.
  if (head < 0) throw new Error(`${PAGE_FILES[page]} no longer carries the deferral table`);
  if (!lines[head + 1].startsWith('|-')) throw new Error(`${PAGE_FILES[page]}: no table under that header`);
  const rows: string[] = [];
  for (let i = head + 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(flatten(lines[i]));
  rowCache.set(page, rows);
  return rows;
}

/**
 * The postures the resolver can return, and the reasons it refuses, read out of
 * the declarations that carry them. A posture added to the code with nothing
 * published about it fails the coverage test below rather than shipping quietly.
 */
function unionMembers(declaration: string): string[] {
  const src = readRepo('src/audit/deferral.ts');
  const at = src.indexOf(declaration);
  if (at < 0) throw new Error(`deferral.ts no longer declares \`${declaration}\` — this check cannot be established`);
  const body = src.slice(at + declaration.length, src.indexOf(';', at));
  const members = [...body.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  if (members.length === 0) throw new Error(`no members read from \`${declaration}\``);
  return members;
}
const MODES = unionMembers('export type DeferralMode =');
const REFUSAL_REASONS = unionMembers('unresolved?:');

/** The share the pages print for bare `auto`, taken from the constant itself. */
const AUTO_PCT = String(Number((TOOL_SEARCH_AUTO_SHARE * 100).toFixed(6)));

const USER = '/home/u/.claude/settings.json';
const LOCAL = '/proj/.claude/settings.local.json';

const settingsFile = (
  scope: ToolSearchSource['scope'],
  source: string,
  vars: ToolSearchEnv,
): ToolSearchSource => ({ scope, source, state: 'read', vars });

/** A settings file that parsed and sets these to something not readable as a value. */
const holdsUnreadably = (name: ToolSearchSource['unreadable']): ToolSearchSource => ({
  scope: 'user-settings',
  source: USER,
  state: 'read',
  vars: {},
  unreadable: name,
});

/** A settings file that is there and could not be opened. */
const unreadableFile: ToolSearchSource = {
  scope: 'user-settings',
  source: USER,
  state: 'unreadable',
  vars: {},
};

/** A machine, as the audit reads one: a client, a shell, and settings files. */
interface Machine {
  client?: string;
  env?: ToolSearchEnv;
  settings?: ToolSearchSource[];
}

/** What a page says about that machine, verbatim. */
interface Claim {
  README?: string;
  METHODOLOGY?: string;
}

interface Case {
  what: string;
  machines: Machine[];
  mode: string;
  unresolved?: NonNullable<ToolSearchSetting['unresolved']>;
  thresholdShare?: number | null;
  /** A whole row of the page's deferral table. */
  row?: Claim;
  /** A sentence outside the table — the refusals, and the clients rule. */
  prose?: Claim;
}

const CASES: Case[] = [
  {
    what: 'a machine that sets none of the three gets the documented default',
    machines: [{}, { env: {} }, { settings: [] }],
    mode: 'defers-all',
    row: {
      README: '| nothing set (the default) | every definition deferred, at any size — no threshold applies |',
      METHODOLOGY: '| | otherwise / nothing set anywhere | the documented default: every definition deferred, no threshold |',
    },
  },
  {
    what: 'ENABLE_TOOL_SEARCH=true defers every definition at any size',
    machines: [
      { env: { ENABLE_TOOL_SEARCH: 'true' } },
      { settings: [settingsFile('user-settings', USER, { ENABLE_TOOL_SEARCH: 'true' })] },
    ],
    mode: 'defers-all',
    row: {
      README: '| `ENABLE_TOOL_SEARCH=true` | same: every definition deferred |',
      METHODOLOGY: '| 2. `ENABLE_TOOL_SEARCH` | `true` | every definition deferred, at any size |',
    },
  },
  {
    what: 'ENABLE_TOOL_SEARCH=false, as a string, loads every definition up front',
    machines: [
      { env: { ENABLE_TOOL_SEARCH: 'false' } },
      { settings: [settingsFile('user-settings', USER, { ENABLE_TOOL_SEARCH: 'false' })] },
    ],
    mode: 'loads-upfront',
    row: {
      README:
        '| `ENABLE_TOOL_SEARCH=false` | deferral off — every request carries the full total. In a settings `env` block that is the **string** `"false"`; the JSON boolean `false` is the last row, not this one |',
      METHODOLOGY: '| | `false` | loads up front |',
    },
  },
  {
    what: 'auto and auto:N put the stack against a share of the window',
    machines: [
      { env: { ENABLE_TOOL_SEARCH: 'auto' } },
      { settings: [settingsFile('user-settings', USER, { ENABLE_TOOL_SEARCH: 'auto' })] },
    ],
    mode: 'threshold',
    thresholdShare: TOOL_SEARCH_AUTO_SHARE,
    row: {
      README:
        '| `ENABLE_TOOL_SEARCH=auto` / `auto:N` | deferred only once definitions reach ' +
        AUTO_PCT +
        '% / N% of the context window |',
      METHODOLOGY:
        '| | `auto` / `auto:N` (N = 0–100) | deferred once the definitions reach ' +
        AUTO_PCT +
        '% / N% of the context window |',
    },
  },
  {
    what: 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS is read first and ENABLE_TOOL_SEARCH does not override it',
    machines: [
      { env: { CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1' } },
      { env: { CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1', ENABLE_TOOL_SEARCH: 'true' } },
      {
        settings: [settingsFile('user-settings', USER, { CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1' })],
        env: { ENABLE_TOOL_SEARCH: 'true' },
      },
    ],
    mode: 'loads-upfront',
    row: {
      README:
        '| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` set | tool search off — read first, because `ENABLE_TOOL_SEARCH` cannot override it |',
      METHODOLOGY:
        '| 1. `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` | any non-empty value | tool search off — loads up front. Read first because it cannot be overridden by `ENABLE_TOOL_SEARCH` |',
    },
  },
  {
    what: 'a base URL off api.anthropic.com, or one that does not parse, falls back to loading up front',
    machines: [
      { env: { ANTHROPIC_BASE_URL: 'https://proxy.internal/v1' } },
      { env: { ANTHROPIC_BASE_URL: 'not a url?key=redacted' } },
      { settings: [settingsFile('user-settings', USER, { ANTHROPIC_BASE_URL: 'https://proxy.internal/v1' })] },
    ],
    mode: 'loads-upfront',
    row: {
      README:
        '| `ANTHROPIC_BASE_URL` off `api.anthropic.com` | falls back to loading up front — consulted only while `ENABLE_TOOL_SEARCH` is unset |',
      METHODOLOGY:
        '| 3. `ANTHROPIC_BASE_URL` | host other than `api.anthropic.com`, or a value that does not parse | loads up front. Consulted only while `ENABLE_TOOL_SEARCH` is unset |',
    },
  },
  {
    what: 'an undocumented ENABLE_TOOL_SEARCH value claims nothing',
    machines: [
      { env: { ENABLE_TOOL_SEARCH: 'maybe' } },
      { env: { ENABLE_TOOL_SEARCH: 'auto:101' } },
      { settings: [settingsFile('user-settings', USER, { ENABLE_TOOL_SEARCH: 'yes' })] },
    ],
    mode: 'setting-unrecognized',
    row: {
      README: '| anything else in `ENABLE_TOOL_SEARCH` | not a documented value, so nothing is claimed from it |',
      METHODOLOGY: '| | anything else | **unrecognized** — no posture is claimed from it |',
    },
    prose: {
      README: 'and when `ENABLE_TOOL_SEARCH` holds a value Claude Code does not document',
      METHODOLOGY: 'when `ENABLE_TOOL_SEARCH` holds an undocumented value',
    },
  },
  {
    what: 'any of the three, set in a settings env block to something that is not a string, is an unknown',
    machines: [
      { settings: [holdsUnreadably(['ENABLE_TOOL_SEARCH'])] },
      { settings: [holdsUnreadably(['CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS'])] },
      { settings: [holdsUnreadably(['ANTHROPIC_BASE_URL'])] },
    ],
    mode: 'setting-unresolved',
    unresolved: 'value-unreadable',
    row: {
      README:
        '| any of the three set, in a settings `env` block, to something that is not a string — a JSON boolean, a number, `null` | it is set there and what it is set to is unknown, so no posture is claimed: the report says whether these tokens are deferred cannot be said from it |',
      METHODOLOGY:
        '| at 1, 2 or 3 | set by the place that would decide, to something that is not a readable string — an `env` block holding a JSON boolean, a number or `null` | **unreadable** — the variable is set there and what it is set to is unknown, so no posture is claimed and the report says whether these tokens are deferred cannot be said from it. A settings file holding `false` rather than `"false"` is this row, not the `false` row above |',
    },
    prose: {
      README: 'when the place that would decide sets the variable to something that is not a string',
      METHODOLOGY: 'when the place that would decide sets the variable to a value this cannot read',
    },
  },
  {
    what: 'two places setting the same variable differently is refused, not resolved',
    machines: [
      {
        env: { ENABLE_TOOL_SEARCH: 'true' },
        settings: [settingsFile('user-settings', USER, { ENABLE_TOOL_SEARCH: 'false' })],
      },
    ],
    mode: 'setting-unresolved',
    unresolved: 'sources-disagree',
    prose: {
      README: 'when two places set the same variable to different values',
      METHODOLOGY: 'when two places set the same variable to different values and no order between them is on record',
    },
  },
  {
    what: 'a settings file that exists and cannot be read is refused, not treated as empty',
    machines: [{ settings: [unreadableFile] }, { env: { ENABLE_TOOL_SEARCH: 'true' }, settings: [unreadableFile] }],
    mode: 'setting-unresolved',
    unresolved: 'source-unreadable',
    prose: {
      README: 'when a settings file exists and cannot be read',
      METHODOLOGY: 'when a settings file exists and cannot be read, since what it sets is unknown rather than nothing',
    },
  },
  {
    what: 'a readable value above an unreadable one still decides',
    machines: [
      {
        settings: [
          settingsFile('local-settings', LOCAL, { ENABLE_TOOL_SEARCH: 'false' }),
          holdsUnreadably(['ENABLE_TOOL_SEARCH']),
        ],
      },
    ],
    mode: 'loads-upfront',
    prose: {
      METHODOLOGY:
        'so a readable value above an unreadable one is still the value in force, and an unreadable one beneath it decides nothing',
    },
  },
  {
    what: 'the four discovered clients with no default on record are said to pay in full',
    machines: [
      { client: 'claude-desktop' },
      { client: 'cursor' },
      { client: 'vscode' },
      { client: 'windsurf' },
    ],
    mode: 'no-deferral-on-record',
    prose: {
      README: '**Clients with no default deferral on record** — Claude Desktop, Cursor, VS Code, Windsurf.',
      METHODOLOGY: 'No default deferral is on record for Claude Desktop, Cursor, VS Code or Windsurf',
    },
  },
  {
    what: 'a config named with --config gets no posture, because which client reads it is unknown',
    machines: [{ client: 'explicit' }],
    mode: 'client-unknown',
    prose: {
      METHODOLOGY:
        'A config passed as `--config <path>` is read the same way, because which client reads that file is not knowable from the file.',
    },
  },
];

const verdictFor = (m: Machine): DeferralVerdict =>
  evaluateDeferral(
    {
      client: m.client ?? 'claude-code',
      sources: ['/machine/.mcp.json'],
      servers: [{ tokens: 5_000 }],
      skippedCount: 0,
      sharedMeasurements: 0,
    },
    { contextWindow: DEFAULT_CONTEXT_WINDOW, env: m.env, settings: m.settings },
  );

describe('the published deferral tables describe the resolver', () => {
  for (const c of CASES) {
    it(c.what, () => {
      for (const m of c.machines) {
        const verdict = verdictFor(m);
        expect(verdict.mode, `the resolver answers ${JSON.stringify(m)} differently from the page`).toBe(c.mode);
        expect(verdict.setting?.unresolved ?? null).toBe(c.unresolved ?? null);
        if (c.thresholdShare !== undefined) expect(verdict.thresholdShare).toBe(c.thresholdShare);
      }
      for (const page of PAGES) {
        const row = c.row?.[page];
        if (row) {
          expect(tableRows(page), `${PAGE_FILES[page]} no longer carries this row`).toContain(flatten(row));
        }
        const prose = c.prose?.[page];
        if (prose) {
          expect(pageText(page), `${PAGE_FILES[page]} no longer says this`).toContain(flatten(prose));
        }
      }
    });
  }

  it('checks every row of both tables, and neither table has a row nothing checks', () => {
    // A bijection, not a subset: a row added to a page is a claim about the
    // resolver that nothing here has put to it, which is the state both pages
    // were already in.
    for (const page of PAGES) {
      const claimed = CASES.map((c) => c.row?.[page])
        .filter((r): r is string => Boolean(r))
        .map(flatten);
      expect(new Set(claimed).size, `${PAGE_FILES[page]}: two cases claim the same row`).toBe(claimed.length);
      expect([...tableRows(page)].sort()).toEqual([...claimed].sort());
    }
  });

  it('publishes something about every posture the resolver can return', () => {
    for (const mode of MODES) {
      const covered = CASES.filter((c) => c.mode === mode && (c.row || c.prose));
      expect(covered.length, `\`${mode}\` is a posture no published page describes`).toBeGreaterThan(0);
    }
    for (const reason of REFUSAL_REASONS) {
      const covered = CASES.filter((c) => c.unresolved === reason && (c.row || c.prose));
      expect(covered.length, `\`${reason}\` is a refusal no published page describes`).toBeGreaterThan(0);
    }
  });

  it('states no case that no page makes a claim about', () => {
    // The other direction of the same rule: this file is a reading of what is
    // published, not a second test suite for the resolver.
    expect(CASES.filter((c) => !c.row && !c.prose).map((c) => c.what)).toEqual([]);
  });

  it('counts its refusals on the front page as the resolver counts them', () => {
    const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
    const refusals = new Set(
      CASES.filter((c) => c.mode === 'setting-unresolved' || c.mode === 'setting-unrecognized').map(
        (c) => c.unresolved ?? c.mode,
      ),
    );
    expect(pageText('README')).toContain(`which is ${NUMBER_WORDS[refusals.size]} refusals and not one`);
  });

  it('prints the threshold share both pages quote', () => {
    expect(verdictFor({ env: { ENABLE_TOOL_SEARCH: 'auto' } }).thresholdShare).toBe(TOOL_SEARCH_AUTO_SHARE);
    // The `N%` half of the same row: the page promises the number is the one
    // asked for, not the default in disguise.
    expect(verdictFor({ env: { ENABLE_TOOL_SEARCH: 'auto:35' } }).thresholdShare).toBe(0.35);
    expect(verdictFor({ env: { ENABLE_TOOL_SEARCH: 'auto:0' } }).thresholdShare).toBe(0);
  });

  it('consults the base URL only while ENABLE_TOOL_SEARCH is unset, as both rows say', () => {
    expect(
      verdictFor({ env: { ENABLE_TOOL_SEARCH: 'true', ANTHROPIC_BASE_URL: 'https://proxy.internal/v1' } }).mode,
    ).toBe('defers-all');
    expect(verdictFor({ env: { ANTHROPIC_BASE_URL: 'https://api.anthropic.com' } }).mode).toBe('defers-all');
  });

  it('quotes the unit-conversion band both pages print from the constant it is published as', () => {
    const { low, high, servers } = PUBLISHED_WIRE_TO_CLIENT_RATIO;
    const band = `${low.toFixed(2)}×–${high.toFixed(2)}× across ${servers} servers`;
    for (const page of PAGES) {
      expect(pageText(page), `${PAGE_FILES[page]} no longer prints the published band`).toContain(band);
    }
  });
});
