import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  parseJsonc,
  extractDeclaration,
  extractServers,
  configCandidates,
  loadConfigs,
  loadSettingsSources,
  settingsCandidates,
} from '../src/audit/config.js';
import { buildReport, formatReport, planBudgetFit, serverKey, DEFAULT_CONTEXT_WINDOW, type AuditReport } from '../src/audit/audit.js';
import { buildDiff, evaluateIncreaseGate, formatDiff, formatGate, parseBaselineReport } from '../src/audit/diff.js';
import {
  evaluateDeferral,
  resolveToolSearch,
  resolveToolSearchSources,
  toolSearchEnv,
  wireToClientRatio,
  PUBLISHED_WIRE_TO_CLIENT_RATIO,
  SHELL_SOURCE,
  TOOL_SEARCH_AUTO_SHARE,
  type ToolSearchEnv,
  type ToolSearchSource,
} from '../src/audit/deferral.js';
import { runAudit, fetchDivergence } from '../src/audit/run.js';
import { measureTools, failedMeasurement } from '../src/core/canonical.js';
import type { Measurement } from '../src/core/types.js';
import { TSX_CLI } from './tsx.js';

const execFileAsync = promisify(execFile);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const tools = JSON.parse(readFileSync(join(repoRoot, 'spec/fixtures/tools-basic.json'), 'utf8'));

const tmpDirs: string[] = [];
function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('parseJsonc', () => {
  it('parses plain JSON', () => {
    expect(parseJsonc('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips line and block comments', () => {
    expect(parseJsonc('{\n // note\n "a":1 /* inline */, "b":2\n}')).toEqual({ a: 1, b: 2 });
  });

  it('tolerates trailing commas in objects and arrays', () => {
    expect(parseJsonc('{"a":[1,2,],"b":2,}')).toEqual({ a: [1, 2], b: 2 });
  });

  it('leaves comment-like and comma-like text inside strings alone', () => {
    const doc = parseJsonc('{"url":"https://x.dev//p","desc":"ends with a comma, }"}') as Record<string, string>;
    expect(doc.url).toBe('https://x.dev//p');
    expect(doc.desc).toBe('ends with a comma, }');
  });

  it('preserves escaped quotes', () => {
    expect(parseJsonc('{"a":"say \\"hi\\" // now"}')).toEqual({ a: 'say "hi" // now' });
  });
});

describe('extractServers', () => {
  const meta = { client: 'test', source: '/cfg.json' };

  it('reads the mcpServers block with args and env', () => {
    const s = extractServers(
      { mcpServers: { memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], env: { API_KEY: 'secret-value' } } } },
      meta,
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({
      name: 'memory',
      transport: 'stdio',
      command: 'npx -y @modelcontextprotocol/server-memory',
      envVarNames: ['API_KEY'],
    });
    expect(s[0].argv).toEqual(['npx', '-y', '@modelcontextprotocol/server-memory']);
  });

  it("reads VS Code's servers block", () => {
    const s = extractServers({ servers: { fs: { command: 'node', args: ['server.js'] } } }, meta);
    expect(s.map((x) => x.name)).toEqual(['fs']);
  });

  it('reads Claude Code per-project servers keyed by directory', () => {
    const doc = { projects: { '/home/me/proj': { mcpServers: { local: { command: 'node', args: ['x.js'] } } } } };
    expect(extractServers(doc, { ...meta, cwd: '/home/me/proj' }).map((s) => s.name)).toEqual(['local']);
    expect(extractServers(doc, { ...meta, cwd: '/home/me/other' })).toEqual([]);
  });

  it('quotes args containing spaces so the printed command is copy-pasteable', () => {
    const s = extractServers(
      { mcpServers: { fs: { command: 'npx', args: ['-y', 'server-filesystem', '/Users/me/My Docs'] } } },
      meta,
    );
    expect(s[0].command).toBe('npx -y server-filesystem "/Users/me/My Docs"');
    expect(s[0].argv).toEqual(['npx', '-y', 'server-filesystem', '/Users/me/My Docs']);
  });

  it('classifies url entries as remote and skips disabled ones', () => {
    const s = extractServers(
      {
        mcpServers: {
          linear: { url: 'https://mcp.linear.app/sse', type: 'sse' },
          off: { command: 'node', args: ['x.js'], disabled: true },
        },
      },
      meta,
    );
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ name: 'linear', transport: 'remote', url: 'https://mcp.linear.app/sse' });
  });

  it('ignores malformed entries instead of throwing', () => {
    expect(extractServers({ mcpServers: { a: null, b: 'nope', c: {} } }, meta)).toEqual([]);
    expect(extractServers(null, meta)).toEqual([]);
  });
});

describe('extractDeclaration', () => {
  const meta = { client: 'claude-code', source: '/h/.claude.json' };

  it('reports the switched-off entries a config declares, alongside the live ones', () => {
    const d = extractDeclaration(
      {
        mcpServers: {
          off2: { command: 'node', args: ['b.js'], disabled: true },
          live: { command: 'node', args: ['a.js'] },
          off1: { url: 'https://mcp.linear.app/sse', disabled: true },
        },
      },
      meta,
    );
    expect(d.servers.map((s) => s.name)).toEqual(['live']);
    expect(d.disabled).toEqual(['off1', 'off2']); // sorted, so the sentence is stable
  });

  it('does not call a name disabled when another block declares it live', () => {
    const d = extractDeclaration(
      { mcpServers: { fs: { command: 'node', args: ['a.js'] } }, servers: { fs: { command: 'x', disabled: true } } },
      meta,
    );
    expect(d.servers.map((s) => s.name)).toEqual(['fs']);
    expect(d.disabled).toEqual([]);
  });

  it('does not call a malformed or absent entry disabled', () => {
    expect(extractDeclaration({ mcpServers: { a: null, b: 'nope', c: {} } }, meta).disabled).toEqual([]);
    expect(extractDeclaration({ otherKey: 1 }, meta).disabled).toEqual([]);
    expect(extractDeclaration(null, meta).disabled).toEqual([]);
  });
});

describe('configCandidates', () => {
  it('points at the per-platform Claude Desktop location', () => {
    const mac = configCandidates({ home: '/Users/me', cwd: '/proj', platform: 'darwin' });
    expect(mac[0].path).toBe('/Users/me/Library/Application Support/Claude/claude_desktop_config.json');
    const linux = configCandidates({ home: '/home/me', cwd: '/proj', platform: 'linux' });
    expect(linux[0].path).toBe('/home/me/.config/Claude/claude_desktop_config.json');
  });

  it('covers the project-local config files', () => {
    const paths = configCandidates({ home: '/h', cwd: '/proj', platform: 'darwin' }).map((c) => c.path);
    expect(paths).toContain('/proj/.mcp.json');
    expect(paths).toContain('/proj/.cursor/mcp.json');
    expect(paths).toContain('/proj/.vscode/mcp.json');
  });
});

describe('loadConfigs', () => {
  it('skips missing files, reports unparseable ones, keeps a parsed config that declares nothing', () => {
    const dir = tempDir('mcp-audit-cfg-');
    writeFileSync(join(dir, 'good.json'), '{"mcpServers":{"a":{"command":"node","args":["a.js"]}}}');
    writeFileSync(join(dir, 'bad.json'), '{not json');
    writeFileSync(join(dir, 'empty.json'), '{"otherKey":1}');
    const loaded = loadConfigs(
      [
        { client: 'x', path: join(dir, 'good.json') },
        { client: 'x', path: join(dir, 'bad.json') },
        { client: 'x', path: join(dir, 'empty.json') },
        { client: 'x', path: join(dir, 'nope.json') },
      ],
      dir,
    );
    expect(loaded).toHaveLength(3);
    expect(loaded[0].servers).toHaveLength(1);
    expect(loaded[0].declaresNothing).toBeUndefined();
    expect(loaded[1].error).toBeDefined();
    expect(loaded[1].declaresNothing).toBeUndefined(); // unreadable is not "declares nothing"
    expect(loaded[2]).toMatchObject({ source: join(dir, 'empty.json'), declaresNothing: true });
    expect(loaded[2].servers).toHaveLength(0);
    // A file that is not on the machine leaves no trace at all: that is the
    // direction the report must be able to tell apart from the one above.
    expect(loaded.some((c) => c.source === join(dir, 'nope.json'))).toBe(false);
    expect(loaded[2].allDisabled).toBeUndefined(); // declares nothing, not all-off
  });

  it('tells a config that switches every server off apart from one that declares none', () => {
    const dir = tempDir('mcp-audit-off-');
    writeFileSync(
      join(dir, 'alloff.json'),
      '{"mcpServers":{"redis":{"command":"node","args":["r.js"],"disabled":true},"linear":{"url":"https://x/sse","disabled":true}}}',
    );
    writeFileSync(join(dir, 'someoff.json'), '{"mcpServers":{"a":{"command":"node"},"b":{"command":"node","disabled":true}}}');
    const loaded = loadConfigs(
      [
        { client: 'x', path: join(dir, 'alloff.json') },
        { client: 'x', path: join(dir, 'someoff.json') },
      ],
      dir,
    );
    expect(loaded[0].servers).toHaveLength(0);
    expect(loaded[0].allDisabled).toEqual(['linear', 'redis']);
    expect(loaded[0].declaresNothing).toBeUndefined(); // it declares two; it does not declare nothing
    // One left on is a config with something to measure, and gets neither mark.
    expect(loaded[1].servers.map((s) => s.name)).toEqual(['a']);
    expect(loaded[1].allDisabled).toBeUndefined();
    expect(loaded[1].declaresNothing).toBeUndefined();
  });
});

function measurement(name: string, extraTools = 0): Measurement {
  const t = [...tools, ...Array.from({ length: extraTools }, (_, i) => ({ name: `extra_${i}`, description: 'x'.repeat(40) }))];
  return measureTools(t, { serverName: name });
}

describe('buildReport', () => {
  const cfg = (servers: unknown[]) =>
    [{ client: 'claude-desktop', source: '/cfg.json', servers }] as Parameters<typeof buildReport>[0];

  const stdio = (name: string, argv: string[]) => ({
    name,
    client: 'claude-desktop',
    source: '/cfg.json',
    transport: 'stdio' as const,
    command: argv.join(' '),
    argv,
    envVarNames: [],
  });

  it('totals a config, ranks servers, and computes shares', () => {
    const a = stdio('alpha', ['node', 'a.js']);
    const b = stdio('beta', ['node', 'b.js']);
    const measured = new Map([
      [serverKey(a), measurement('alpha')],
      [serverKey(b), measurement('beta', 6)],
    ]);
    const r = buildReport(cfg([a, b]), measured, { generatedAt: 'T' });
    expect(r.configs).toHaveLength(1);
    const c = r.configs[0];
    expect(c.servers.map((s) => s.name)).toEqual(['beta', 'alpha']); // heaviest first
    expect(c.totalTokens).toBe((c.servers[0].tokens ?? 0) + (c.servers[1].tokens ?? 0));
    expect(c.servers.reduce((a, s) => a + (s.share ?? 0), 0)).toBeCloseTo(1, 10);
    expect(c.contextShare).toBeCloseTo(c.totalTokens / DEFAULT_CONTEXT_WINDOW, 10);
  });

  it('puts failures and remote servers under skipped, not in the total', () => {
    const ok = stdio('ok', ['node', 'ok.js']);
    const broken = stdio('broken', ['node', 'broken.js']);
    const remote = { ...stdio('linear', []), transport: 'remote' as const, url: 'https://x/sse', argv: undefined };
    const measured = new Map([
      [serverKey(ok), measurement('ok')],
      [serverKey(broken), failedMeasurement('startup-failure', { serverName: 'broken', notes: 'server exited (code 1)' })],
    ]);
    const r = buildReport(cfg([ok, broken, remote]), measured, { generatedAt: 'T' });
    const c = r.configs[0];
    expect(c.servers.map((s) => s.name)).toEqual(['ok']);
    expect(c.skipped.map((s) => s.status).sort()).toEqual(['remote-not-measurable', 'startup-failure']);
    expect(c.totalTokens).toBe(c.servers[0].tokens);
  });

  it('never totals across config files', () => {
    const a = stdio('alpha', ['node', 'a.js']);
    const b = { ...stdio('beta', ['node', 'b.js']), client: 'cursor', source: '/other.json' };
    const measured = new Map([
      [serverKey(a), measurement('alpha')],
      [serverKey(b), measurement('beta', 6)],
    ]);
    const configs = [
      { client: 'claude-desktop', source: '/cfg.json', servers: [a] },
      { client: 'cursor', source: '/other.json', servers: [b] },
    ] as Parameters<typeof buildReport>[0];
    const r = buildReport(configs, measured, { generatedAt: 'T' });
    expect(r.configs).toHaveLength(2);
    expect(r.configs[0].source).toBe('/other.json'); // heaviest config first
    expect(r.configs[0].totalTokens).not.toBe(r.configs[0].totalTokens + r.configs[1].totalTokens);
  });

  it('gates the budget on the heaviest config', () => {
    const a = stdio('alpha', ['node', 'a.js']);
    const measured = new Map([[serverKey(a), measurement('alpha')]]);
    const total = measured.get(serverKey(a))!.totalTokens!;
    expect(buildReport(cfg([a]), measured, { budget: total - 1 }).budget).toMatchObject({ over: true });
    expect(buildReport(cfg([a]), measured, { budget: total }).budget).toMatchObject({ over: false });
  });

  it('says what to drop, not just that you are over', () => {
    // "BUDGET FAIL: 84,455 > 20,000" tells a reader they have a problem and nothing
    // about its shape. The person running audit is the person paying the tokens.
    const heavy = stdio('heavy', ['node', 'h.js']);
    const light = stdio('light', ['node', 'l.js']);
    const measured = new Map([
      [serverKey(heavy), measurement('heavy', 60)],
      [serverKey(light), measurement('light')],
    ]);
    const full = buildReport(cfg([heavy, light]), measured, { generatedAt: 'T' });
    const lightTokens = full.configs[0].servers.find((x) => x.name === 'light')!.tokens!;

    // A budget that only the light server fits: the heavy one must be named.
    const r = buildReport(cfg([heavy, light]), measured, {
      budget: lightTokens,
      generatedAt: 'T',
    });
    expect(r.budget!.over).toBe(true);
    const fit = r.budget!.fit!;
    expect(fit.drop.map((d) => d.name)).toEqual(['heavy']);
    expect(fit.feasible).toBe(true);
    expect(fit.keptCount).toBe(1);
    expect(fit.keptTokens).toBe(lightTokens);
    // The arithmetic has to close, or the reader cannot check it.
    expect(fit.drop[0].remaining).toBe(r.budget!.worstTotal - fit.drop[0].tokens);
    expect(fit.overBy).toBe(r.budget!.worstTotal - lightTokens);
  });

  it('drops heaviest first and stops as soon as it fits', () => {
    const a = stdio('a', ['node', 'a.js']);
    const b = stdio('b', ['node', 'b.js']);
    const c = stdio('c', ['node', 'c.js']);
    const measured = new Map([
      [serverKey(a), measurement('a', 90)],
      [serverKey(b), measurement('b', 40)],
      [serverKey(c), measurement('c')],
    ]);
    const full = buildReport(cfg([a, b, c]), measured, { generatedAt: 'T' });
    const total = full.configs[0].totalTokens;
    const aTokens = full.configs[0].servers.find((x) => x.name === 'a')!.tokens!;

    const fit = planBudgetFit(full.configs[0], total - aTokens);
    expect(fit.drop).toHaveLength(1);          // dropping the heaviest alone suffices
    expect(fit.drop[0].name).toBe('a');
    expect(fit.keptCount).toBe(2);
  });

  it('does not sell "drop everything" as a solution', () => {
    // A budget of 0 is satisfied by running no servers, which is arithmetically true and
    // useless. True-and-misleading is the exact pair this tool exists to keep apart.
    const a = stdio('a', ['node', 'a.js']);
    const measured = new Map([[serverKey(a), measurement('a')]]);
    const full = buildReport(cfg([a]), measured, { generatedAt: 'T' });
    const fit = planBudgetFit(full.configs[0], 0);
    expect(fit.keptCount).toBe(0);
    expect(fit.keptTokens).toBe(0);
    const out = formatReport(buildReport(cfg([a]), measured, { budget: 0, generatedAt: 'T' }));
    expect(out).toContain('no subset fits');
    expect(out).not.toContain('keeps 0 server');
  });

  it('computes no fit plan when already under budget', () => {
    const a = stdio('a', ['node', 'a.js']);
    const measured = new Map([[serverKey(a), measurement('a')]]);
    const total = measured.get(serverKey(a))!.totalTokens!;
    const r = buildReport(cfg([a]), measured, { budget: total + 1, generatedAt: 'T' });
    expect(r.budget!.over).toBe(false);
    expect(r.budget!.fit).toBeUndefined();
  });

  it('prints the drop plan and refuses to call it advice', () => {
    const heavy = stdio('heavy', ['node', 'h.js']);
    const light = stdio('light', ['node', 'l.js']);
    const measured = new Map([
      [serverKey(heavy), measurement('heavy', 60)],
      [serverKey(light), measurement('light')],
    ]);
    const full = buildReport(cfg([heavy, light]), measured, { generatedAt: 'T' });
    const lightTokens = full.configs[0].servers.find((x) => x.name === 'light')!.tokens!;
    const out = formatReport(
      buildReport(cfg([heavy, light]), measured, { budget: lightTokens, generatedAt: 'T' }),
    );
    expect(out).toContain('BUDGET FAIL');
    expect(out).toContain('drop  heavy');
    expect(out).toContain('fits');
    expect(out).toContain('arithmetic, not advice');
    // Under budget, none of the drop machinery should appear.
    const ok = formatReport(
      buildReport(cfg([heavy, light]), measured, {
        budget: full.configs[0].totalTokens + 1,
        generatedAt: 'T',
      }),
    );
    expect(ok).toContain('to spare');
    expect(ok).not.toContain('drop  ');
  });

  it('surfaces the heaviest individual tools', () => {
    const a = stdio('alpha', ['node', 'a.js']);
    const measured = new Map([[serverKey(a), measurement('alpha', 3)]]);
    const c = buildReport(cfg([a]), measured, {}).configs[0];
    expect(c.heaviestTools.length).toBeGreaterThan(0);
    expect(c.heaviestTools[0].tokens).toBeGreaterThanOrEqual(c.heaviestTools.at(-1)!.tokens);
    expect(c.heaviestTools[0].server).toBe('alpha');
  });

  describe('trimAdvice', () => {
    it('recovers the top 3 tools worth of tokens out of a larger set', () => {
      const a = stdio('alpha', ['node', 'a.js']);
      const measured = new Map([[serverKey(a), measurement('alpha', 3)]]); // 6 tools total
      const c = buildReport(cfg([a]), measured, {}).configs[0];
      expect(c.trimAdvice).not.toBeNull();
      expect(c.trimAdvice!.tools).toHaveLength(3);
      expect(c.trimAdvice!.tools).toEqual(c.heaviestTools.slice(0, 3));
      expect(c.trimAdvice!.recoverableTokens).toBe(c.trimAdvice!.tools.reduce((a, t) => a + t.tokens, 0));
      expect(c.trimAdvice!.recoverableShare).toBeCloseTo(c.trimAdvice!.recoverableTokens / c.totalTokens, 10);
      expect(c.trimAdvice!.recoverableShare).toBeLessThan(1); // tools remain beyond the trimmed set
    });

    it('is null when there is only one tool total — nothing to trim relative to', () => {
      const a = stdio('alpha', ['node', 'a.js']);
      const oneTool = measureTools([{ name: 'only_tool', description: 'x'.repeat(40) }], { serverName: 'alpha' });
      const measured = new Map([[serverKey(a), oneTool]]);
      const c = buildReport(cfg([a]), measured, {}).configs[0];
      expect(c.trimAdvice).toBeNull();
    });

    it('is null when the config has no measured tokens', () => {
      const broken = stdio('broken', ['node', 'broken.js']);
      const measured = new Map([[serverKey(broken), failedMeasurement('startup-failure', { serverName: 'broken' })]]);
      const c = buildReport(cfg([broken]), measured, {}).configs[0];
      expect(c.trimAdvice).toBeNull();
    });
  });

  it('records a config-level parse error as a problem', () => {
    const r = buildReport(
      [{ client: 'x', source: '/broken.json', servers: [], error: 'Unexpected token' }],
      new Map(),
      {},
    );
    expect(r.configs).toHaveLength(0);
    expect(r.problems[0]).toContain('/broken.json');
  });

  it('never serializes env values', () => {
    const a = { ...stdio('alpha', ['node', 'a.js']), envVarNames: ['API_KEY'], env: { API_KEY: 'super-secret-value' } };
    const measured = new Map([[serverKey(a), measurement('alpha')]]);
    const json = JSON.stringify(buildReport(cfg([a]), measured, {}));
    expect(json).toContain('API_KEY');
    expect(json).not.toContain('super-secret-value');
  });

  describe('claude divergence join (--claude)', () => {
    const divergenceRun = (servers: Record<string, { capturedSha256: string; claudeDelta: number }>) => ({
      method: 'tools-delta/v1',
      model: 'claude-opus-5',
      measuredAt: '2026-08-16',
      baselineTokens: 7,
      probeDelta: 328,
      servers: Object.fromEntries(
        Object.entries(servers).map(([name, row]) => [name, { ...row, toolCount: 1 }]),
      ),
    });

    it('attaches claudeTokens when the published capture hash matches the install', () => {
      const a = stdio('alpha', ['node', 'a.js']);
      const m = measurement('alpha');
      const measured = new Map([[serverKey(a), m]]);
      const divergence = divergenceRun({ alpha: { capturedSha256: m.canonicalSha256!, claudeDelta: 1234 } });
      const r = buildReport(cfg([a]), measured, { divergence });
      expect(r.configs[0].servers[0].claudeTokens).toBe(1234);
      expect(r.claudeDivergence).toEqual({ model: 'claude-opus-5', measuredAt: '2026-08-16' });
    });

    it('stays silent (null, not a stale number) when the hash no longer matches', () => {
      const a = stdio('alpha', ['node', 'a.js']);
      const measured = new Map([[serverKey(a), measurement('alpha')]]);
      const divergence = divergenceRun({ alpha: { capturedSha256: 'stale-hash-from-a-prior-sweep', claudeDelta: 1234 } });
      const r = buildReport(cfg([a]), measured, { divergence });
      expect(r.configs[0].servers[0].claudeTokens).toBeNull();
    });

    it('leaves claudeTokens undefined and omits claudeDivergence when --claude was not requested', () => {
      const a = stdio('alpha', ['node', 'a.js']);
      const measured = new Map([[serverKey(a), measurement('alpha')]]);
      const r = buildReport(cfg([a]), measured, {});
      expect(r.configs[0].servers[0].claudeTokens).toBeUndefined();
      expect(r.claudeDivergence).toBeUndefined();
      expect(JSON.stringify(r)).not.toContain('claudeTokens');
    });
  });
});

describe('formatReport', () => {
  const a = {
    name: 'alpha',
    client: 'claude-desktop',
    source: '/cfg.json',
    transport: 'stdio' as const,
    command: 'node a.js',
    argv: ['node', 'a.js'],
    envVarNames: [],
  };
  const report = buildReport(
    [{ client: 'claude-desktop', source: '/cfg.json', servers: [a] }] as Parameters<typeof buildReport>[0],
    new Map([[serverKey(a), measurement('alpha')]]),
    { budget: 1, generatedAt: 'T' },
  );

  it('renders the total, the context share, and the budget verdict', () => {
    const text = formatReport(report);
    expect(text).toContain('claude-desktop  /cfg.json');
    expect(text).toContain('alpha');
    expect(text).toContain('BUDGET FAIL');
    expect(text).toMatch(/% of a 200,000-token context window/);
  });

  it('states the wire-vs-billed caveat', () => {
    expect(formatReport(report)).toContain('wire tokens');
  });

  it('omits the claude column when --claude was not requested', () => {
    expect(formatReport(report)).not.toContain('Anthropic-request cost');
  });

  it('prints trim advice naming the recoverable tools and share', () => {
    const b = { ...a, name: 'beta', command: 'node b.js', argv: ['node', 'b.js'] };
    const withTrim = buildReport(
      [{ client: 'claude-desktop', source: '/cfg.json', servers: [a, b] }] as Parameters<typeof buildReport>[0],
      new Map([
        [serverKey(a), measurement('alpha', 3)],
        [serverKey(b), measurement('beta')],
      ]),
      { generatedAt: 'T' },
    );
    const text = formatReport(withTrim);
    expect(text).toContain('trim: disabling 3 tools');
    expect(text).toContain('per-tool filtering');
  });

  it('adds a claude column with a match and a "—" for a stale one', () => {
    const m = measurement('alpha');
    const withClaude = buildReport(
      [{ client: 'claude-desktop', source: '/cfg.json', servers: [a] }] as Parameters<typeof buildReport>[0],
      new Map([[serverKey(a), m]]),
      {
        generatedAt: 'T',
        divergence: {
          method: 'tools-delta/v1',
          model: 'claude-opus-5',
          measuredAt: '2026-08-16',
          baselineTokens: 7,
          probeDelta: 328,
          servers: { alpha: { capturedSha256: m.canonicalSha256!, claudeDelta: 999, toolCount: 1 } },
        },
      },
    );
    const text = formatReport(withClaude);
    expect(text).toContain('Anthropic-request cost');
    expect(text).toContain('999');
    expect(text).toContain('claude-opus-5');
  });
});

describe('audit CLI', () => {
  it('measures a real server from a config file and leaves no files behind', () => {
    const dir = tempDir('mcp-audit-cli-');
    writeFileSync(
      join(dir, 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
          linear: { url: 'https://mcp.example/sse' },
        },
      }),
    );
    const out = execFileSync(
      process.execPath,
      [TSX_CLI, join(repoRoot, 'src/cli.ts'), 'audit', '--config', join(dir, 'mcp.json'), '--json'],
      { cwd: dir, encoding: 'utf8', timeout: 180_000 },
    );
    const report = JSON.parse(out);
    expect(report.configs).toHaveLength(1);
    expect(report.configs[0].servers[0]).toMatchObject({ name: 'memory', status: 'measured' });
    expect(report.configs[0].totalTokens).toBeGreaterThan(1000);
    expect(report.configs[0].skipped[0]).toMatchObject({ name: 'linear', status: 'remote-not-measurable' });
    // audit runs in someone's own project — it must not write results/ or badges/
    expect(readdirSync(dir).sort()).toEqual(['mcp.json']);
  }, 200_000);

  it('exits 1 when no config is found', () => {
    const dir = tempDir('mcp-audit-none-');
    let code = 0;
    try {
      execFileSync(process.execPath, [TSX_CLI, join(repoRoot, 'src/cli.ts'), 'audit', '--config', join(dir, 'missing.json')], {
        cwd: dir,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (e) {
      code = (e as { status: number }).status;
    }
    expect(code).toBe(1);
  });

  it('exits 2 on a malformed --budget', () => {
    let code = 0;
    try {
      execFileSync(process.execPath, [TSX_CLI, join(repoRoot, 'src/cli.ts'), 'audit', '--budget', 'lots'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (e) {
      code = (e as { status: number }).status;
    }
    expect(code).toBe(2);
  });
});

describe('fetchDivergence', () => {
  const server = createServer((req, res) => {
    if (req.url === '/ok.json') {
      res.end(JSON.stringify({ model: 'claude-opus-5', measuredAt: '2026-08-16', servers: { x: { capturedSha256: 'abc', claudeDelta: 1 } } }));
    } else if (req.url === '/garbage.json') {
      res.end('not json');
    } else {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  let base = '';
  const ready = new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      base = typeof addr === 'object' && addr ? `http://127.0.0.1:${addr.port}` : '';
      resolve();
    });
  });
  afterAll(() => server.close());

  it('parses a reachable divergence run', async () => {
    await ready;
    const { run, problem } = await fetchDivergence(`${base}/ok.json`);
    expect(problem).toBeUndefined();
    expect(run?.model).toBe('claude-opus-5');
  });

  it('returns a problem, not a throw, on a 404', async () => {
    await ready;
    const { run, problem } = await fetchDivergence(`${base}/missing.json`);
    expect(run).toBeNull();
    expect(problem).toContain('HTTP 404');
  });

  it('returns a problem, not a throw, on malformed JSON', async () => {
    await ready;
    const { run, problem } = await fetchDivergence(`${base}/garbage.json`);
    expect(run).toBeNull();
    expect(problem).toContain('malformed');
  });
});

describe('audit CLI --claude', () => {
  it('joins claudeTokens from a reachable divergence source, end to end', async () => {
    const dir = tempDir('mcp-audit-claude-');
    const configPath = join(dir, 'mcp.json');
    writeFileSync(
      configPath,
      JSON.stringify({ mcpServers: { memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] } } }),
    );

    // Learn the real capture hash first — the divergence fixture must match it to prove
    // the join, not just that a fetch happened.
    const base = await runAudit({ configPaths: [configPath] });
    const memory = base.configs[0].servers[0];
    expect(memory.name).toBe('memory');

    const server = createServer((req, res) => {
      res.end(
        JSON.stringify({
          method: 'tools-delta/v1',
          model: 'claude-opus-5',
          measuredAt: '2026-08-16',
          baselineTokens: 7,
          probeDelta: 328,
          servers: { memory: { capturedSha256: memory.canonicalSha256, claudeDelta: 4242, toolCount: memory.toolCount } },
        }),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    const divergenceUrl = typeof addr === 'object' && addr ? `http://127.0.0.1:${addr.port}/divergence.json` : '';

    try {
      // execFileSync would block this process's event loop while the child's fetch tries
      // to reach the server that lives in this same process — deadlock. Use the async form.
      const { stdout } = await execFileAsync(
        process.execPath,
        [TSX_CLI, join(repoRoot, 'src/cli.ts'), 'audit', '--config', configPath, '--claude', '--divergence-url', divergenceUrl, '--json'],
        { cwd: dir, encoding: 'utf8', timeout: 180_000 },
      );
      const report = JSON.parse(stdout);
      expect(report.configs[0].servers[0]).toMatchObject({ name: 'memory', claudeTokens: 4242 });
      expect(report.claudeDivergence).toMatchObject({ model: 'claude-opus-5' });
    } finally {
      server.close();
    }
  }, 200_000);

  it('degrades to no join and a recorded problem when the divergence source is unreachable', async () => {
    const dir = tempDir('mcp-audit-claude-fail-');
    const configPath = join(dir, 'mcp.json');
    writeFileSync(
      configPath,
      JSON.stringify({ mcpServers: { memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] } } }),
    );
    const r = await runAudit({ configPaths: [configPath], claude: true, divergenceUrl: 'http://127.0.0.1:1/unreachable' });
    expect(r.configs[0].servers[0].claudeTokens).toBeUndefined();
    expect(r.problems.some((p) => p.includes('claude divergence'))).toBe(true);
  }, 200_000);
});

// ---------------------------------------------------------------------------
// audit --baseline: the config diff
// ---------------------------------------------------------------------------

type DiffSrv = { name: string; tokens: number | null };

/** Minimal but real AuditReport, so diff tests never depend on spawning a server. */
function reportOf(
  configs: { source: string; client?: string; servers: DiffSrv[]; env?: ToolSearchEnv }[],
  over: Partial<AuditReport> = {},
): AuditReport {
  return {
    methodologyVersion: '1.0',
    encoding: 'o200k_base',
    generatedAt: '2026-08-01T00:00:00.000Z',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    problems: [],
    configs: configs.map((c) => {
      const ok = c.servers.filter((s) => s.tokens !== null);
      const bad = c.servers.filter((s) => s.tokens === null);
      const totalTokens = ok.reduce((a, s) => a + (s.tokens ?? 0), 0);
      return {
        client: c.client ?? 'claude-desktop',
        source: c.source,
        totalTokens,
        toolCount: ok.length,
        serverCount: ok.length,
        contextShare: totalTokens / (over.contextWindow ?? DEFAULT_CONTEXT_WINDOW),
        servers: ok.map((s) => ({
          name: s.name,
          transport: 'stdio' as const,
          status: 'measured' as const,
          tokens: s.tokens,
          toolCount: 1,
          share: totalTokens > 0 ? (s.tokens ?? 0) / totalTokens : 0,
          envVarNames: [],
        })),
        skipped: bad.map((s) => ({
          name: s.name,
          transport: 'stdio' as const,
          status: 'startup-failure' as const,
          tokens: null,
          toolCount: null,
          share: null,
          envVarNames: [],
        })),
        heaviestTools: [],
        trimAdvice: null,
        deferral: evaluateDeferral(
          {
            client: c.client ?? 'claude-desktop',
            sources: [c.source],
            servers: ok.map((s) => ({ tokens: s.tokens ?? 0 })),
            skippedCount: bad.length,
            sharedMeasurements: 0,
          },
          { contextWindow: over.contextWindow ?? DEFAULT_CONTEXT_WINDOW, env: c.env },
        ),
      };
    }),
    ...over,
  };
}

const CFG = '/cfg.json';
const byName = (d: ReturnType<typeof buildDiff>, name: string) =>
  d.configs[0].servers.find((s) => s.name === name)!;

describe('buildDiff', () => {
  it('reports an added server as tokens added to every request', () => {
    const before = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }] }]);
    const after = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }, { name: 'b', tokens: 17_000 }] }]);
    const d = buildDiff(before, after);
    expect(d.configs[0]).toMatchObject({ beforeTotal: 5_000, afterTotal: 22_000, delta: 17_000, exact: true });
    expect(byName(d, 'b')).toMatchObject({ kind: 'added', before: null, after: 17_000, delta: 17_000 });
    expect(byName(d, 'a').kind).toBe('unchanged');
    expect(d.worstIncrease).toEqual({ source: CFG, delta: 17_000 });
    expect(formatDiff(d, DEFAULT_CONTEXT_WINDOW)).toContain('adds 17,000 tokens to every request');
  });

  it('reports a removed server and a grown schema with signed deltas', () => {
    const before = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }, { name: 'b', tokens: 9_000 }] }]);
    const after = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 6_200 }] }]);
    const d = buildDiff(before, after);
    expect(byName(d, 'b')).toMatchObject({ kind: 'removed', before: 9_000, after: null, delta: -9_000 });
    expect(byName(d, 'a')).toMatchObject({ kind: 'changed', delta: 1_200 });
    expect(d.configs[0].delta).toBe(-7_800);
    expect(d.worstIncrease).toBeNull();
    expect(formatDiff(d, DEFAULT_CONTEXT_WINDOW)).toContain('removes 7,800 tokens');
  });

  it('says nothing changed when nothing changed', () => {
    const r = () => reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }] }]);
    const d = buildDiff(r(), r());
    expect(d.configs[0]).toMatchObject({ delta: 0, exact: true });
    const out = formatDiff(d, DEFAULT_CONTEXT_WINDOW);
    expect(out).toContain('No change');
    expect(out).toContain('(1 server unchanged)');
  });

  // The flattering reading and the true one have the same shape here: a server that
  // died takes its tokens out of the total exactly like a server you uninstalled.
  it('never reports a server that stopped measuring as a saving', () => {
    const before = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }, { name: 'heavy', tokens: 9_246 }] }]);
    const after = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }, { name: 'heavy', tokens: null }] }]);
    const d = buildDiff(before, after);
    const heavy = byName(d, 'heavy');
    expect(heavy).toMatchObject({ kind: 'unmeasured-now', before: 9_246, after: null, delta: null });
    expect(d.configs[0].exact).toBe(false);
    expect(d.configs[0].understatedBy).toBe(9_246);
    const out = formatDiff(d, DEFAULT_CONTEXT_WINDOW);
    expect(out).toContain('Not a clean comparison');
    expect(out).toContain('at least 9,246 higher');
    // The flattering sentence must not be printed at all, not merely corrected afterwards:
    // the headline is where a skimmer stops reading.
    expect(out).not.toMatch(/removes [\d,]+ tokens/);
    expect(out).toContain('not what your config did');
  });

  it('marks newly measurable cost as newly visible, not new', () => {
    const before = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }, { name: 'fixed', tokens: null }] }]);
    const after = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }, { name: 'fixed', tokens: 4_000 }] }]);
    const d = buildDiff(before, after);
    expect(byName(d, 'fixed')).toMatchObject({ kind: 'unmeasured-before', before: null, after: 4_000, delta: null });
    expect(d.configs[0]).toMatchObject({ exact: false, overstatedBy: 4_000, delta: 4_000 });
    const out = formatDiff(d, DEFAULT_CONTEXT_WINDOW);
    expect(out).toContain('up to 4,000 of that movement was already being paid');
    expect(out).not.toMatch(/adds [\d,]+ tokens to every request/);
  });

  it('keeps a server unmeasurable in both runs visible as a blind spot, not as zero', () => {
    const before = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }, { name: 'dead', tokens: null }] }]);
    const after = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }, { name: 'dead', tokens: null }] }]);
    const d = buildDiff(before, after);
    expect(byName(d, 'dead').kind).toBe('unmeasured-both');
    expect(d.configs[0]).toMatchObject({ exact: true, delta: 0 }); // it moved neither total
    expect(formatDiff(d, DEFAULT_CONTEXT_WINDOW)).toContain('hides an unknown cost');
  });

  it('gives no delta for adding or removing a server that was never measured', () => {
    const before = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }, { name: 'gone', tokens: null }] }]);
    const after = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }, { name: 'new', tokens: null }] }]);
    const d = buildDiff(before, after);
    expect(byName(d, 'gone')).toMatchObject({ kind: 'removed', delta: null });
    expect(byName(d, 'new')).toMatchObject({ kind: 'added', delta: null });
    expect(formatDiff(d, DEFAULT_CONTEXT_WINDOW)).toContain('its cost is unknown, not zero');
  });

  it('does not let a config that vanished read as a config that got cheaper', () => {
    const before = reportOf([
      { source: CFG, servers: [{ name: 'a', tokens: 5_000 }] },
      { source: '/other.json', client: 'cursor', servers: [{ name: 'b', tokens: 8_000 }] },
    ]);
    const after = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }] }]);
    const d = buildDiff(before, after);
    expect(d.configs).toHaveLength(1);
    expect(d.configs[0].delta).toBe(0);
    expect(d.droppedConfigs).toEqual([{ client: 'cursor', source: '/other.json', totalTokens: 8_000 }]);
    expect(d.warnings.join('\n')).toContain('not a config that got cheaper');
  });

  it('shows a config with no baseline as a total, not as a change', () => {
    const before = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }] }]);
    const after = reportOf([
      { source: CFG, servers: [{ name: 'a', tokens: 5_000 }] },
      { source: '/new.json', client: 'cursor', servers: [{ name: 'b', tokens: 8_000 }] },
    ]);
    const d = buildDiff(before, after);
    const fresh = d.configs.find((c) => c.source === '/new.json')!;
    expect(fresh).toMatchObject({ matchedBy: 'unmatched', beforeTotal: null, delta: null });
    expect(formatDiff(d, DEFAULT_CONTEXT_WINDOW)).toContain('no baseline for this config');
  });

  it('pairs one config against one config across machines, and refuses to guess beyond that', () => {
    const before = reportOf([{ source: '/Users/dev/.cursor/mcp.json', servers: [{ name: 'a', tokens: 5_000 }] }]);
    const after = reportOf([{ source: '/home/runner/work/repo/.vscode/mcp.json', servers: [{ name: 'a', tokens: 5_500 }] }]);
    const one = buildDiff(before, after);
    expect(one.configs[0]).toMatchObject({ matchedBy: 'sole-config', delta: 500 });

    const twoBefore = reportOf([
      { source: '/a/one.json', servers: [{ name: 'a', tokens: 5_000 }] },
      { source: '/a/two.json', servers: [{ name: 'b', tokens: 1_000 }] },
    ]);
    const twoAfter = reportOf([
      { source: '/b/one.json', servers: [{ name: 'a', tokens: 5_000 }] },
      { source: '/b/two.json', servers: [{ name: 'b', tokens: 1_000 }] },
    ]);
    const two = buildDiff(twoBefore, twoAfter);
    expect(two.configs.every((c) => c.matchedBy === 'unmatched')).toBe(true);
    expect(two.droppedConfigs).toHaveLength(2);
  });

  it('refuses to compare across a methodology or encoding change', () => {
    const before = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }] }], { methodologyVersion: '0.9' });
    const after = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }] }]);
    const d = buildDiff(before, after);
    expect(d.comparable).toBe(false);
    expect(d.warnings.join('\n')).toContain('not the same measurement');
    expect(formatDiff(d, DEFAULT_CONTEXT_WINDOW)).toContain('Re-record the baseline');

    const enc = buildDiff(reportOf([{ source: CFG, servers: [] }], { encoding: 'cl100k_base' as 'o200k_base' }), after);
    expect(enc.comparable).toBe(false);
  });

  it('treats a context-window change as a share caveat, not a broken comparison', () => {
    const before = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }] }], { contextWindow: 100_000 });
    const after = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 6_000 }] }]);
    const d = buildDiff(before, after);
    expect(d.comparable).toBe(true);
    expect(d.configs[0].delta).toBe(1_000);
    expect(d.warnings.join('\n')).toContain('shares are not comparable, token counts still are');
  });
});

describe('formatReport with a diff attached', () => {
  it('renders the diff and gate above the methodology footnote, and never says "explicit"', () => {
    const before = reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 5_000 }] }]);
    const after = reportOf([{ source: CFG, client: 'explicit', servers: [{ name: 'a', tokens: 5_000 }, { name: 'b', tokens: 900 }] }]);
    after.diff = buildDiff(before, after);
    after.increaseGate = evaluateIncreaseGate(after.diff, 100);
    const out = formatReport(after);

    // The closing verdict is still rendered, and still never puts the internal
    // 'explicit' client label inside a claim — it appears once, as the config
    // header, and nowhere else.
    expect(out).toContain('tokens of tool schemas');
    expect(out).toContain('Which client reads this config is not known here');
    expect(out.match(/\bexplicit\b/g)).toHaveLength(1);
    expect(out.indexOf('diff vs baseline')).toBeGreaterThan(-1);
    expect(out.indexOf('INCREASE FAIL')).toBeGreaterThan(out.indexOf('diff vs baseline'));
    expect(out.indexOf('These are wire tokens')).toBeGreaterThan(out.indexOf('INCREASE FAIL'));
  });
});

describe('parseBaselineReport', () => {
  it('accepts a real audit --json report', () => {
    const raw = JSON.stringify(reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 1 }] }]));
    expect(parseBaselineReport(raw).report).toBeTruthy();
  });

  it.each([
    ['not json at all', '{nope'],
    ['a bare array', '[]'],
    ['an object with no configs', '{"methodologyVersion":"1.0","encoding":"o200k_base"}'],
    ['a report missing methodology', '{"configs":[]}'],
    ['a config with no source', '{"methodologyVersion":"1.0","encoding":"o200k_base","configs":[{"totalTokens":1}]}'],
  ])('rejects %s with a problem, never a silent empty diff', (_label, raw) => {
    const r = parseBaselineReport(raw);
    expect(r.report).toBeNull();
    expect(r.problem).toBeTruthy();
  });
});

describe('evaluateIncreaseGate', () => {
  const diffOf = (b: DiffSrv[], a: DiffSrv[]) =>
    buildDiff(reportOf([{ source: CFG, servers: b }]), reportOf([{ source: CFG, servers: a }]));

  it('passes an increase inside the limit and fails one over it', () => {
    const d = diffOf([{ name: 'a', tokens: 5_000 }], [{ name: 'a', tokens: 5_000 }, { name: 'b', tokens: 900 }]);
    expect(evaluateIncreaseGate(d, 1_000)).toMatchObject({ pass: true, increase: 900 });
    const over = evaluateIncreaseGate(d, 899);
    expect(over.pass).toBe(false);
    expect(formatGate(over)).toContain('+900 tokens per request, over the 899 allowed');
  });

  it('passes a decrease and an exact no-change', () => {
    expect(evaluateIncreaseGate(diffOf([{ name: 'a', tokens: 5_000 }], [{ name: 'a', tokens: 10 }]), 0).pass).toBe(true);
    expect(evaluateIncreaseGate(diffOf([{ name: 'a', tokens: 5_000 }], [{ name: 'a', tokens: 5_000 }]), 0)).toMatchObject({
      pass: true,
      increase: 0,
    });
  });

  // The gate's whole reason to exist: green must mean checked, not merely not-red.
  it('fails when a server stopped measuring, even though the total went down', () => {
    const d = diffOf(
      [{ name: 'a', tokens: 5_000 }, { name: 'heavy', tokens: 9_000 }],
      [{ name: 'a', tokens: 5_000 }, { name: 'heavy', tokens: null }],
    );
    expect(d.configs[0].delta).toBeLessThan(0);
    const gate = evaluateIncreaseGate(d, 0);
    expect(gate.pass).toBe(false);
    expect(gate.reasons.join(' ')).toContain('could not be established exactly');
  });

  it('fails on an unmatched config, a dropped config, and an incomparable baseline', () => {
    const unmatched = buildDiff(
      reportOf([{ source: CFG, servers: [] }]),
      reportOf([{ source: CFG, servers: [] }, { source: '/new.json', servers: [{ name: 'b', tokens: 8_000 }] }]),
    );
    expect(evaluateIncreaseGate(unmatched, 100_000).pass).toBe(false);

    const droppedCfg = buildDiff(
      reportOf([{ source: CFG, servers: [] }, { source: '/gone.json', servers: [{ name: 'b', tokens: 8_000 }] }]),
      reportOf([{ source: CFG, servers: [] }]),
    );
    expect(evaluateIncreaseGate(droppedCfg, 100_000).pass).toBe(false);

    const stale = buildDiff(
      reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 1 }] }], { methodologyVersion: '0.9' }),
      reportOf([{ source: CFG, servers: [{ name: 'a', tokens: 1 }] }]),
    );
    expect(evaluateIncreaseGate(stale, 100_000).pass).toBe(false);
  });

  it('reports no increase to measure rather than a zero when nothing was comparable', () => {
    const d = buildDiff(reportOf([]), reportOf([]));
    const gate = evaluateIncreaseGate(d, 0);
    expect(gate.increase).toBeNull();
    expect(formatGate(gate)).toContain('no change to measure');
  });
});

describe('audit --baseline CLI', () => {
  const cli = (args: string[], cwd: string) => {
    try {
      const stdout = execFileSync(process.execPath, [TSX_CLI, join(repoRoot, 'src/cli.ts'), ...args], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, stdout, stderr: '' };
    } catch (e) {
      const err = e as { status: number; stdout: string; stderr: string };
      return { code: err.status, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
  };

  it('rejects an unreadable or malformed baseline before measuring anything', () => {
    const dir = tempDir('mcp-audit-baseline-');
    writeFileSync(join(dir, 'mcp.json'), '{"mcpServers":{"memory":{"command":"npx","args":["-y","@modelcontextprotocol/server-memory"]}}}');
    writeFileSync(join(dir, 'junk.json'), '{"hello":1}');

    const missing = cli(['audit', '--config', join(dir, 'mcp.json'), '--baseline', join(dir, 'nope.json')], dir);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('cannot read baseline');

    const junk = cli(['audit', '--config', join(dir, 'mcp.json'), '--baseline', join(dir, 'junk.json')], dir);
    expect(junk.code).toBe(2);
    expect(junk.stderr).toContain('audit --json');
  }, 60_000);

  it('rejects --max-increase without a baseline to measure against', () => {
    const dir = tempDir('mcp-audit-baseline-usage-');
    const r = cli(['audit', '--max-increase', '100'], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('needs a --baseline');
  }, 60_000);

  it('diffs a real measurement against its own stored report and passes a zero-increase gate', async () => {
    const dir = tempDir('mcp-audit-baseline-e2e-');
    const configPath = join(dir, 'mcp.json');
    writeFileSync(
      configPath,
      JSON.stringify({ mcpServers: { memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] } } }),
    );
    const baselinePath = join(dir, 'baseline.json');
    writeFileSync(baselinePath, JSON.stringify(await runAudit({ configPaths: [configPath] })));

    const r = cli(['audit', '--config', configPath, '--baseline', baselinePath, '--max-increase', '0', '--json'], dir);
    expect(r.code).toBe(0);
    const report = JSON.parse(r.stdout);
    expect(report.diff.configs[0]).toMatchObject({ delta: 0, exact: true, matchedBy: 'source' });
    expect(report.increaseGate).toMatchObject({ pass: true, increase: 0, limit: 0 });
  }, 300_000);
});

describe('deferral — reading the mode that is actually in force', () => {
  const cw = DEFAULT_CONTEXT_WINDOW;
  const auto = { ENABLE_TOOL_SEARCH: 'auto' };
  const threshold = cw * TOOL_SEARCH_AUTO_SHARE; // 20,000 for a 200,000-token window

  const verdict = (
    client: string,
    tokens: number[],
    opts: {
      env?: ToolSearchEnv;
      skipped?: number;
      sources?: string[];
      claude?: (number | null | undefined)[];
      contextWindow?: number;
      shared?: number;
    } = {},
  ) =>
    evaluateDeferral(
      {
        client,
        sources: opts.sources ?? [CFG],
        servers: tokens.map((t, i) => ({ tokens: t, claudeTokens: opts.claude?.[i] })),
        skippedCount: opts.skipped ?? 0,
        sharedMeasurements: opts.shared ?? 0,
      },
      { contextWindow: opts.contextWindow ?? cw, env: opts.env },
    );

  describe('the documented default defers everything, with no threshold at all', () => {
    it('defers a Claude Code stack of any size when ENABLE_TOOL_SEARCH is unset', () => {
      // The case the first version of this got wrong: a small default stack was
      // told deferral "does not activate" and that it paid these tokens.
      for (const tokens of [1, 2_378, 12_000, 84_455]) {
        expect(verdict('claude-code', [tokens])).toMatchObject({
          mode: 'defers-all',
          mechanism: 'tool search',
          thresholdShare: null,
          thresholdTokens: null,
          clientTokens: null,
          distanceTokens: null,
          crosses: null,
          setting: { variable: 'ENABLE_TOOL_SEARCH', value: null, readFromMachine: false },
        });
      }
    });

    it('names the conditions under which a deferring client pays in full anyway', () => {
      expect(verdict('claude-code', [12_000]).exceptions.length).toBeGreaterThan(0);
    });

    it('reports the stack total even where size decides nothing', () => {
      expect(verdict('claude-code', [2_000, 3_000]).wireTokens).toBe(5_000);
    });
  });

  describe('ENABLE_TOOL_SEARCH is read from the machine, not assumed', () => {
    const modeOf = (env: ToolSearchEnv) => verdict('claude-code', [12_000], { env }).mode;

    it('takes true and false at their documented meanings', () => {
      expect(modeOf({ ENABLE_TOOL_SEARCH: 'true' })).toBe('defers-all');
      expect(modeOf({ ENABLE_TOOL_SEARCH: 'false' })).toBe('loads-upfront');
    });

    it('treats auto as the opt-in threshold mode at 10%', () => {
      expect(verdict('claude-code', [12_000], { env: auto })).toMatchObject({
        mode: 'threshold',
        thresholdShare: TOOL_SEARCH_AUTO_SHARE,
        thresholdTokens: threshold,
        setting: { variable: 'ENABLE_TOOL_SEARCH', value: 'auto', readFromMachine: true },
      });
    });

    it('lets auto:N set the percentage anywhere from 0 to 100', () => {
      const share = (v: string) => verdict('claude-code', [12_000], { env: { ENABLE_TOOL_SEARCH: v } });
      expect(share('auto:5')).toMatchObject({ thresholdShare: 0.05, thresholdTokens: 10_000 });
      expect(share('auto:100')).toMatchObject({ thresholdShare: 1, thresholdTokens: cw });
      // auto:0 is a threshold every stack reaches — including an empty one.
      expect(share('auto:0').crosses).toBe(true);
      expect(verdict('claude-code', [], { env: { ENABLE_TOOL_SEARCH: 'auto:0' } }).crosses).toBe(true);
    });

    it('refuses to guess at a value Claude Code does not document', () => {
      for (const value of ['yes', 'TRUE', 'auto:101', 'auto:', '1']) {
        expect(verdict('claude-code', [12_000], { env: { ENABLE_TOOL_SEARCH: value } })).toMatchObject({
          mode: 'setting-unrecognized',
          crosses: null,
          setting: { value, readFromMachine: true },
        });
      }
    });

    it('lets disabled experimental betas override an explicit true, as documented', () => {
      expect(
        verdict('claude-code', [12_000], {
          env: { ENABLE_TOOL_SEARCH: 'true', CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1' },
        }),
      ).toMatchObject({
        mode: 'loads-upfront',
        setting: { variable: 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS', value: '1' },
      });
    });

    it('falls back to upfront behind a non-first-party base URL, and only while unset', () => {
      const base = (url: string, extra: ToolSearchEnv = {}) =>
        resolveToolSearch({ ANTHROPIC_BASE_URL: url, ...extra });
      expect(base('https://proxy.internal/v1').mode).toBe('loads-upfront');
      expect(base('not a url').mode).toBe('loads-upfront');
      expect(base('https://api.anthropic.com').mode).toBe('defers-all');
      expect(base('HTTPS://API.ANTHROPIC.COM/v1').mode).toBe('defers-all');
      // "Set ENABLE_TOOL_SEARCH explicitly to override that fallback."
      expect(base('https://proxy.internal/v1', { ENABLE_TOOL_SEARCH: 'true' }).mode).toBe('defers-all');
    });

    it('reports a base URL by hostname only, so a credential in it cannot reach a report', () => {
      // A base URL routed through a proxy commonly carries a credential in its
      // userinfo or query, and a report is shared (CI logs, a committed
      // --baseline). The mode decision needs the hostname and nothing else.
      const secret = 'https://svc:sk-secret-abc123@proxy.internal/v1?key=sk-live-9';
      const resolved = resolveToolSearch({ ANTHROPIC_BASE_URL: secret });
      expect(resolved).toMatchObject({ mode: 'loads-upfront', variable: 'ANTHROPIC_BASE_URL' });
      expect(resolved.value).toBe('proxy.internal');

      const servers = [
        {
          name: 'alpha',
          client: 'claude-code',
          source: CFG,
          transport: 'stdio' as const,
          command: 'node a.js',
          argv: ['node', 'a.js'],
          envVarNames: [],
        },
      ];
      const report = buildReport(
        [{ client: 'claude-code', source: CFG, servers }] as Parameters<typeof buildReport>[0],
        new Map([[serverKey(servers[0]), measurement('alpha')]]),
        { generatedAt: 'T', env: { ANTHROPIC_BASE_URL: secret } },
      );
      const text = formatReport(report);
      expect(text).toContain('ANTHROPIC_BASE_URL points at proxy.internal on this machine');
      for (const out of [text, JSON.stringify(report)]) {
        expect(out).not.toContain('sk-secret-abc123');
        expect(out).not.toContain('sk-live-9');
        expect(out).not.toContain('svc:');
      }
    });

    it('prints a marker, not the value, for a base URL that does not parse', () => {
      // The unreadable case must not fall back to echoing what was set.
      const resolved = resolveToolSearch({ ANTHROPIC_BASE_URL: 'not a url?key=sk-live-9' });
      expect(resolved).toMatchObject({ mode: 'loads-upfront', value: '(unreadable URL)' });
      expect(resolved.value).not.toContain('sk-live-9');
    });

    it('reads only the three variables that decide this', () => {
      expect(toolSearchEnv({ ENABLE_TOOL_SEARCH: 'auto', PATH: '/bin', HOME: '/root' })).toEqual({
        ENABLE_TOOL_SEARCH: 'auto',
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: undefined,
        ANTHROPIC_BASE_URL: undefined,
      });
    });
  });

  describe('the threshold is compared in the unit it is counted in', () => {
    const r = PUBLISHED_WIRE_TO_CLIENT_RATIO;
    /**
     * Derived from the band rather than written out, because the band moves
     * whenever the divergence run widens — and a fixture that hard-codes a
     * number the library derives is the drift this suite keeps finding
     * elsewhere. The overhead is added once for the stack, never per server.
     */
    const conv = (wire: number) => ({
      low: Math.round(wire * r.low + r.fixedOverhead),
      high: Math.round(wire * r.high + r.fixedOverhead),
    });

    it('converts the wire total into a range, because the two are different numbers', () => {
      const d = verdict('claude-code', [12_000], { env: auto });
      expect(d.clientTokens).toMatchObject({ ...conv(12_000), exact: 0, estimated: 1 });
      expect(d.ratio).toEqual(r);
    });

    it('refuses a definite answer when the range straddles the threshold', () => {
      // 12,000 wire is 8,000 "under" 20,000 only if the two are the same unit.
      // They are not: this stack is somewhere between 2,400 and 23,040.
      expect(verdict('claude-code', [12_000], { env: auto }).crosses).toBeNull();
      // ...and the error runs in both directions: 25,000 wire is not decisive either.
      expect(verdict('claude-code', [25_000], { env: auto }).crosses).toBeNull();
    });

    it('still answers when the whole range falls on one side', () => {
      const wide = conv(200_000);
      expect(verdict('claude-code', [200_000], { env: auto })).toMatchObject({
        crosses: true,
        distanceTokens: { low: wide.low - threshold, high: wide.high - threshold },
      });
      // Sized from the band: a stack small enough that even the top of its
      // range sits under the threshold, whatever the band currently is.
      const under = Math.floor((threshold - r.fixedOverhead) / r.high) - 1;
      expect(verdict('claude-code', [under], { env: auto }).crosses).toBe(false);
    });

    it('charges the tool framework overhead once for the stack, not once a server', () => {
      // The bug this replaces: the band used to carry the overhead inside it, so
      // a per-server multiply paid it once per server. On the small servers the
      // 2026-09-05 run reached, that overhead *was* the ratio — `postgres` at 32
      // wire tokens read 10.88×, and the published upper bound moved with it.
      const one = verdict('claude-code', [10_000], { env: auto }).clientTokens!;
      const two = verdict('claude-code', [5_000, 5_000], { env: auto }).clientTokens!;
      expect(two.high).toBe(one.high);
      expect(one.high - Math.round(10_000 * r.high)).toBe(r.fixedOverhead);
    });

    it('collapses the range onto published Anthropic counts where --claude supplied them', () => {
      const d = verdict('claude-code', [12_000], { env: auto, claude: [21_000] });
      expect(d.clientTokens).toMatchObject({ low: 21_000, high: 21_000, exact: 1, estimated: 0 });
      expect(d.crosses).toBe(true);
    });

    it('mixes exact and converted servers rather than dropping either', () => {
      const d = verdict('claude-code', [12_000, 8_000], { env: auto, claude: [21_000, null] });
      expect(d.clientTokens).toMatchObject({
        low: 21_000 + Math.round(8_000 * r.low),
        high: 21_000 + Math.round(8_000 * r.high),
        exact: 1,
        estimated: 1,
      });
    });

    it('takes the band from a supplied divergence run instead of the frozen one', () => {
      const run = {
        method: 'tools-delta/v1',
        model: 'claude-opus-5',
        measuredAt: '2026-08-19',
        baselineTokens: 7,
        probeDelta: 328,
        servers: {
          a: { o200kFull: 1_000, o200kMapped: 500, claudeDelta: 1_000, toolCount: 1, capturedSha256: 'x' },
          b: { o200kFull: 1_000, o200kMapped: 500, claudeDelta: 1_500, toolCount: 1, capturedSha256: 'y' },
          bad: { o200kFull: 0, o200kMapped: 0, claudeDelta: 0, toolCount: 0, capturedSha256: 'z', error: 'nope' },
        },
      };
      // 1,000 and 1,500 Claude tokens over 1,000 wire, less the run's own 328 of
      // fixed overhead: the band converts bytes, and the overhead is not bytes.
      expect(wireToClientRatio(run)).toMatchObject({
        low: 0.672,
        high: 1.172,
        fixedOverhead: 328,
        servers: 2,
      });
      // A run that never recorded the overhead converts as it always did rather
      // than guessing at a correction.
      expect(wireToClientRatio({ ...run, probeDelta: 0 })).toMatchObject({ low: 1, high: 1.5, fixedOverhead: 0 });
      expect(wireToClientRatio(null)).toEqual(PUBLISHED_WIRE_TO_CLIENT_RATIO);
      // A run with nothing usable falls back rather than inventing a band.
      expect(wireToClientRatio({ ...run, servers: {} })).toEqual(PUBLISHED_WIRE_TO_CLIENT_RATIO);
    });

    it('moves the threshold with the context window it is given', () => {
      const wide = verdict('claude-code', [200_000], { env: auto, contextWindow: 1_000_000 });
      expect(wide).toMatchObject({ thresholdTokens: 100_000, crosses: null });
    });
  });

  describe('an unmeasured server is a floor, not a zero', () => {
    it('refuses to say "under" when an unmeasured server could carry it over', () => {
      expect(verdict('claude-code', [10_000], { env: auto, skipped: 1 })).toMatchObject({
        isFloor: true,
        crosses: null,
      });
    });

    it('still says "over" from a floor that is already over — more cannot take it back under', () => {
      expect(verdict('claude-code', [200_000], { env: auto, skipped: 2 })).toMatchObject({
        isFloor: true,
        crosses: true,
      });
    });
  });

  describe('the other clients this tool discovers', () => {
    it('records the absence of a deferral rule, with no threshold and no setting', () => {
      for (const client of ['claude-desktop', 'cursor', 'vscode', 'windsurf']) {
        expect(verdict(client, [84_455], { env: auto })).toMatchObject({
          mode: 'no-deferral-on-record',
          mechanism: null,
          setting: null,
          thresholdTokens: null,
          clientTokens: null,
          crosses: null,
        });
      }
    });

    it('says the client is unknown for a config named with --config', () => {
      expect(verdict('explicit', [84_455]).mode).toBe('client-unknown');
      expect(verdict('some-client-shipped-after-this-was-written', [1]).mode).toBe('client-unknown');
    });
  });

  it('is attached to every config a report carries, and survives --json', () => {
    const report = reportOf([
      { source: CFG, client: 'claude-code', servers: [{ name: 'a', tokens: 84_455 }] },
      { source: '/two.json', client: 'cursor', servers: [{ name: 'b', tokens: 84_455 }] },
    ]);
    const roundTripped = JSON.parse(JSON.stringify(report)) as AuditReport;
    expect(roundTripped.configs.map((c) => c.deferral.mode).sort()).toEqual([
      'defers-all',
      'no-deferral-on-record',
    ]);
    expect(roundTripped.configs.find((c) => c.client === 'claude-code')!.deferral).toMatchObject({
      thresholdTokens: null,
      crosses: null,
    });
  });
});

describe('deferral — the configs one session reads together', () => {
  const stdio = (name: string, argv: string[], client: string, source: string) => ({
    name,
    client,
    source,
    transport: 'stdio' as const,
    command: argv.join(' '),
    argv,
    envVarNames: [],
  });

  const claudeCodeReport = (env: ToolSearchEnv) => {
    // The standard setup: user scope in ~/.claude.json, project scope in .mcp.json.
    const user = stdio('user-server', ['node', 'u.js'], 'claude-code', '/home/.claude.json');
    const project = stdio('project-server', ['node', 'p.js'], 'claude-code', '/proj/.mcp.json');
    const other = stdio('cursor-server', ['node', 'c.js'], 'cursor', '/home/.cursor/mcp.json');
    const measured = new Map([
      [serverKey(user), measurement('user-server')],
      [serverKey(project), measurement('project-server')],
      [serverKey(other), measurement('cursor-server')],
    ]);
    const configs = [
      { client: 'claude-code', source: '/home/.claude.json', servers: [user] },
      { client: 'claude-code', source: '/proj/.mcp.json', servers: [project] },
      { client: 'cursor', source: '/home/.cursor/mcp.json', servers: [other] },
    ] as Parameters<typeof buildReport>[0];
    return buildReport(configs, measured, { generatedAt: 'T', env });
  };

  it('judges both Claude Code configs once, against their sum', () => {
    const r = claudeCodeReport({ ENABLE_TOOL_SEARCH: 'auto' });
    const cc = r.configs.filter((c) => c.client === 'claude-code');
    expect(cc).toHaveLength(2);
    // One verdict object, shared: the session that loads both is one session.
    expect(cc[0].deferral).toBe(cc[1].deferral);
    expect(cc[0].deferral.sources.sort()).toEqual(['/home/.claude.json', '/proj/.mcp.json']);
    expect(cc[0].deferral.wireTokens).toBe(cc[0].totalTokens + cc[1].totalTokens);
  });

  it('still totals each config file separately', () => {
    const r = claudeCodeReport({ ENABLE_TOOL_SEARCH: 'auto' });
    const cc = r.configs.filter((c) => c.client === 'claude-code');
    expect(cc[0].totalTokens).toBeLessThan(cc[0].deferral.wireTokens);
    expect(cc[0].totalTokens).toBeGreaterThan(0);
  });

  it('does not merge a different client into that session', () => {
    const r = claudeCodeReport({});
    const cursor = r.configs.find((c) => c.client === 'cursor')!;
    const cc = r.configs.find((c) => c.client === 'claude-code')!;
    expect(cursor.deferral).not.toBe(cc.deferral);
    expect(cursor.deferral.sources).toEqual(['/home/.cursor/mcp.json']);
  });

  it('prints the shared verdict once, not once per file', () => {
    const out = formatReport(claudeCodeReport({ ENABLE_TOOL_SEARCH: 'auto' }));
    const stated = out.match(/defers tool definitions above a threshold/g) ?? [];
    expect(stated).toHaveLength(1);
    expect(out).toContain('These 2 config files are read into one claude-code session');
    expect(out).toContain('/home/.claude.json');
    expect(out).toContain('/proj/.mcp.json');
  });
});

describe('deferral — a stack measured as fewer servers than it has', () => {
  // Two entries that run the same command and differ only in the environment
  // they are given. Measurements are cached per command line, so one of them is
  // launched and its number is counted for both — and which one it is depends
  // on the order the configs were read in. `github-mcp-server` with different
  // GITHUB_TOOLSETS values is the published shape of this.
  const twin = (name: string, toolsets: string, source = '/home/.claude.json') => ({
    name,
    client: 'claude-code',
    source,
    transport: 'stdio' as const,
    command: 'node gh.js',
    argv: ['node', 'gh.js'],
    envVarNames: ['GITHUB_TOOLSETS'],
    env: { GITHUB_TOOLSETS: toolsets },
  });

  const all = twin('gh-all', 'all');
  const few = twin('gh-few', 'issues');
  const heavy = measurement('gh-all', 480);
  const light = measurement('gh-few');

  // auto:1 puts the threshold at 2,000 tokens, which the two possible sums sit
  // on opposite sides of: 2 × 6,917 is over it and 2 × 196 is well under.
  const auto1 = { ENABLE_TOOL_SEARCH: 'auto:1' };
  const configs = [
    { client: 'claude-code', source: '/home/.claude.json', servers: [all, few] },
  ] as Parameters<typeof buildReport>[0];
  const reportWith = (m: Measurement) =>
    buildReport(configs, new Map([[serverKey(all), m]]), { generatedAt: 'T', env: auto1 });

  it('counts the entries whose number was measured for a twin', () => {
    expect(reportWith(heavy).configs[0].deferral.sharedMeasurements).toBe(2);
  });

  it('claims no side of the threshold, because there is no total to hold against it', () => {
    expect(reportWith(heavy).configs[0].deferral).toMatchObject({
      mode: 'threshold',
      thresholdTokens: 2_000,
      clientTokens: null,
      distanceTokens: null,
      crosses: null,
    });
  });

  it('answers the same whichever twin the cache happened to hold', () => {
    // The defect this refuses: the same machine reported 13,834 wire tokens and
    // "at or above the threshold" in one order, and 392 and "below the
    // threshold — every request carries these tokens" in the other, against a
    // true sum of 7,113 whose range straddles the line.
    const verdicts = [heavy, light].map((m) => reportWith(m).configs[0].deferral);
    expect(verdicts.map((d) => d.crosses)).toEqual([null, null]);
    expect(verdicts.map((d) => d.clientTokens)).toEqual([null, null]);
    expect(new Set(verdicts.map((d) => d.thresholdTokens)).size).toBe(1);
  });

  it('says so in words, and states neither side nor a size', () => {
    for (const m of [heavy, light]) {
      const out = formatReport(reportWith(m)).replace(/\s+/g, ' ');
      expect(out).toContain('How big this stack is cannot be said here: 2 of the servers above');
      expect(out).toContain('differ only in the environment they are given');
      expect(out).toContain('nothing is wrong with the config');
      // The threshold is still where it is; only this stack's side is withheld.
      expect(out).toContain('deferral activates once the definitions reach 2,000 tokens');
      expect(out).not.toContain('below the threshold');
      expect(out).not.toContain('at or above the threshold');
      expect(out).not.toContain('every request carries these tokens before you type anything');
      expect(out).not.toContain('tokens on the wire');
    }
  });

  it('caveats the total in every mode, not only the one with a threshold', () => {
    // What the threshold branch alone did not cover. `auto:1` is one of six
    // modes and the rarest of them: the documented default is `defers-all`,
    // and `loads-upfront` is reached three ways, one of them any gateway or
    // proxy in ANTHROPIC_BASE_URL. In `loads-upfront` the total IS the whole
    // cost claim — "every request carries these tokens" — so an unestablished
    // one printed bare there is the worst place for it, not the safest.
    const modes: [string, ToolSearchEnv][] = [
      ['loads-upfront/setting', { ENABLE_TOOL_SEARCH: 'false' }],
      ['loads-upfront/betas', { CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1' }],
      ['loads-upfront/gateway', { ANTHROPIC_BASE_URL: 'https://proxy.example.com/v1' }],
      ['defers-all', {}],
      ['threshold', auto1],
      ['setting-unrecognized', { ENABLE_TOOL_SEARCH: 'maybe' }],
    ];
    for (const [label, env] of modes) {
      for (const m of [heavy, light]) {
        const r = buildReport(configs, new Map([[serverKey(all), m]]), { generatedAt: 'T', env });
        const out = formatReport(r).replace(/\s+/g, ' ');
        expect(r.configs[0].deferral.sharedMeasurements, label).toBe(2);
        expect(out, label).toContain('How big this stack is cannot be said here: 2 of the servers above');
        expect(out, label).toContain('nothing is wrong with the config');
      }
    }
  });

  it('caveats it for a client with no deferral on record, and for an unknown one', () => {
    // Both say the tokens are paid, from a total collapsed the same way.
    for (const client of ['cursor', 'mystery-client']) {
      const cfgs = [
        { client, source: '/cfg.json', servers: [{ ...all, client }, { ...few, client }] },
      ] as Parameters<typeof buildReport>[0];
      const r = buildReport(cfgs, new Map([[serverKey(all), heavy]]), { generatedAt: 'T' });
      const out = formatReport(r).replace(/\s+/g, ' ');
      expect(r.configs[0].deferral.sharedMeasurements, client).toBe(2);
      expect(out, client).toContain('How big this stack is cannot be said here: 2 of the servers above');
    }
  });

  it('survives --json, so a consumer sees the refusal too', () => {
    const round = JSON.parse(JSON.stringify(reportWith(heavy))) as AuditReport;
    expect(round.configs[0].deferral).toMatchObject({ sharedMeasurements: 2, crosses: null });
    expect(round.configs[0].deferral.clientTokens ?? null).toBeNull();
  });

  it('still decides a stack whose entries share a measurement legitimately', () => {
    // Same command AND same environment in two files one session reads: that is
    // one server measured once, which is what the cache key is for.
    const user = twin('gh', 'all');
    const project = twin('gh', 'all', '/proj/.mcp.json');
    const r = buildReport(
      [
        { client: 'claude-code', source: '/home/.claude.json', servers: [user] },
        { client: 'claude-code', source: '/proj/.mcp.json', servers: [project] },
      ] as Parameters<typeof buildReport>[0],
      new Map([[serverKey(user), light]]),
      { generatedAt: 'T', env: auto1 },
    );
    expect(r.configs[0].deferral).toMatchObject({
      sharedMeasurements: 0,
      crosses: false,
      wireTokens: 2 * light.totalTokens!,
    });
  });

  it('leaves a stack of distinct commands alone, however their environments differ', () => {
    const a = { ...twin('a', 'all'), command: 'node a.js', argv: ['node', 'a.js'] };
    const b = { ...twin('b', 'issues'), command: 'node b.js', argv: ['node', 'b.js'] };
    const r = buildReport(
      [{ client: 'claude-code', source: '/home/.claude.json', servers: [a, b] }] as Parameters<
        typeof buildReport
      >[0],
      new Map([
        [serverKey(a), light],
        [serverKey(b), light],
      ]),
      { generatedAt: 'T', env: auto1 },
    );
    expect(r.configs[0].deferral).toMatchObject({ sharedMeasurements: 0, crosses: false });
  });
});

describe('formatReport states where the cost is paid', () => {
  /**
   * The band and the numbers converted through it are derived here for the same
   * reason the pages derive them: a fixture that writes out `0.20×–1.92×` is a
   * second source for a number the library owns, and it goes stale the next time
   * the divergence run widens. That is precisely how this suite came to assert a
   * band the audit had stopped using.
   */
  const band = PUBLISHED_WIRE_TO_CLIENT_RATIO;
  const bandText = `${band.low.toFixed(2)}×–${band.high.toFixed(2)}×`;
  const side = (wire: number) => ({
    low: Math.round(wire * band.low + band.fixedOverhead),
    high: Math.round(wire * band.high + band.fixedOverhead),
  });
  const n = (v: number) => v.toLocaleString('en-US');

  // Prose is asserted against the text with its line breaks flattened, so a
  // re-wrap for terminal width is not a test failure — the sentence is.
  const render = (client: string, tokens: number, opts: { servers?: DiffSrv[]; env?: ToolSearchEnv } = {}) =>
    formatReport(
      reportOf([
        { source: CFG, client, env: opts.env, servers: [{ name: 'a', tokens }, ...(opts.servers ?? [])] },
      ]),
    ).replace(/\s+/g, ' ');

  it('tells a default Claude Code reader that size decides nothing and the tokens are deferred', () => {
    for (const tokens of [2_378, 84_455]) {
      const out = render('claude-code', tokens);
      expect(out).toContain('claude-code defers every MCP tool definition (tool search), with no threshold');
      expect(out).toContain('ENABLE_TOOL_SEARCH is unset here, which is the documented default');
      expect(out).toContain('NOT loaded up front at any size');
      // The sentence the old version printed at this size, which was false.
      expect(out).not.toContain('deferral does not activate');
      expect(out).not.toContain('every request carries these tokens before you type anything');
      expect(out).not.toContain('threshold of');
      // ...and where it is paid in full anyway.
      expect(out).toContain('Microsoft Foundry');
    }
  });

  it('tells a reader who turned tool search off that every request carries them', () => {
    const out = render('claude-code', 12_000, { env: { ENABLE_TOOL_SEARCH: 'false' } });
    expect(out).toContain('loads every tool definition up front here: tool search is off');
    expect(out).toContain('ENABLE_TOOL_SEARCH=false on this machine');
    expect(out).toContain('Every request carries these tokens before you type anything');
  });

  it('names the variable it could not interpret rather than guessing a side', () => {
    const out = render('claude-code', 12_000, { env: { ENABLE_TOOL_SEARCH: 'yes' } });
    expect(out).toContain('ENABLE_TOOL_SEARCH is set to "yes" on this machine');
    expect(out).toContain('not one of the values Claude Code documents');
    expect(out).toContain('cannot be said');
  });

  it('shows a threshold-mode reader the unit gap instead of a false certainty', () => {
    const out = render('claude-code', 12_000, { env: { ENABLE_TOOL_SEARCH: 'auto' } });
    expect(out).toContain('defers tool definitions above a threshold here (tool search)');
    expect(out).toContain('deferral activates once the definitions reach 20,000 tokens — 10.0% of the context window');
    expect(out).toContain('12,000 tokens on the wire');
    expect(out).toContain(bandText);
    expect(out).toContain(`between ${n(side(12_000).low)} and ${n(side(12_000).high)} tokens`);
    expect(out).toContain('that range straddles the 20,000-token threshold');
    expect(out).toContain('run with --claude');
  });

  it('states a decided threshold-mode stack in both directions', () => {
    const over = render('claude-code', 200_000, { env: { ENABLE_TOOL_SEARCH: 'auto' } });
    expect(over).toContain('at or above the threshold');
    expect(over).toContain('NOT loaded up front');
    const under = render('claude-code', 10_000, { env: { ENABLE_TOOL_SEARCH: 'auto' } });
    expect(under).toContain(`below the threshold — under by ${n(20_000 - side(10_000).high)} at the high end`);
    expect(under).toContain('deferral does not activate and every request carries these tokens');
  });

  it('prints an undecided stack as undecided, naming the servers that left it that way', () => {
    const out = render('claude-code', 10_000, {
      env: { ENABLE_TOOL_SEARCH: 'auto' },
      servers: [{ name: 'broken', tokens: null }],
    });
    expect(out).toContain('cannot be said');
    expect(out).toContain('at least 10,000');
    expect(out).toContain('1 server(s) here produced no number');
  });

  it('tells a reader of a client with no deferral record that this is an absence, not a measurement', () => {
    const out = render('cursor', 84_455);
    expect(out).toContain('No default deferral is on record for cursor');
    expect(out).toContain('every request carries these tokens');
    expect(out).toContain('an absence of a record about the client, not a measurement of it');
    expect(out).not.toContain('threshold');
  });

  it('keeps the measurement itself unconditional, and the claim about who pays it separate', () => {
    for (const client of ['claude-code', 'cursor']) {
      expect(render(client, 84_455)).toContain(
        '84,455 tokens of tool schemas — 42.2% of a 200,000-token context window.',
      );
    }
  });

  it('quotes one divergence band, in the verdict and in the footer alike', () => {
    const out = render('claude-code', 12_000, { env: { ENABLE_TOOL_SEARCH: 'auto' } });
    expect(out.split(bandText).length - 1, 'the verdict and the footer must quote one band').toBe(2);
  });
});

describe('the deferral posture is read from every place the machine sets it', () => {
  // The shell that runs an audit is not the machine's answer. Claude Code takes
  // ENABLE_TOOL_SEARCH from its own settings files too, and reading only the
  // shell reported the documented default — "these tokens are NOT loaded up
  // front at any size" — at a machine that had switched deferral off in
  // ~/.claude/settings.json and pays for every definition on every request.
  const USER = '/home/u/.claude/settings.json';
  const LOCAL = '/proj/.claude/settings.local.json';

  const file = (
    scope: ToolSearchSource['scope'],
    source: string,
    vars: ToolSearchEnv,
    state: ToolSearchSource['state'] = 'read',
  ): ToolSearchSource => ({ scope, source, state, vars });

  const shell = (vars: ToolSearchEnv): ToolSearchSource =>
    ({ scope: 'shell', source: SHELL_SOURCE, state: 'read', vars });

  /** A settings file that parsed, and sets these to something unreadable. */
  const held = (
    scope: ToolSearchSource['scope'],
    source: string,
    unreadable: ToolSearchSource['unreadable'],
  ): ToolSearchSource => ({ scope, source, state: 'read', vars: {}, unreadable });

  const srv = {
    name: 'alpha',
    client: 'claude-code',
    source: CFG,
    transport: 'stdio' as const,
    command: 'node a.js',
    argv: ['node', 'a.js'],
    envVarNames: [],
  };
  const configs = [{ client: 'claude-code', source: CFG, servers: [srv] }] as Parameters<
    typeof buildReport
  >[0];
  const report = (opts: { env?: ToolSearchEnv; settings?: ToolSearchSource[] }) =>
    buildReport(configs, new Map([[serverKey(srv), measurement('alpha')]]), {
      generatedAt: 'T',
      ...opts,
    });
  const text = (opts: { env?: ToolSearchEnv; settings?: ToolSearchSource[] }) =>
    formatReport(report(opts)).replace(/\s+/g, ' ');

  describe('resolveToolSearchSources', () => {
    it('lets a settings file decide it while the shell says nothing', () => {
      expect(
        resolveToolSearchSources([shell({}), file('user-settings', USER, { ENABLE_TOOL_SEARCH: 'false' })]),
      ).toMatchObject({ mode: 'loads-upfront', value: 'false', source: USER, readFromMachine: true });
    });

    it('takes the settings files in Claude Code documented precedence', () => {
      expect(
        resolveToolSearchSources([
          shell({}),
          file('local-settings', LOCAL, { ENABLE_TOOL_SEARCH: 'auto' }),
          file('user-settings', USER, { ENABLE_TOOL_SEARCH: 'false' }),
        ]),
      ).toMatchObject({ mode: 'threshold', source: LOCAL });
    });

    it('refuses where the shell and a settings file disagree, rather than picking one', () => {
      // There is no order on record here between them, and picking whichever
      // this happens to read first is how one machine gets two answers.
      expect(
        resolveToolSearchSources([
          shell({ ENABLE_TOOL_SEARCH: 'true' }),
          file('user-settings', USER, { ENABLE_TOOL_SEARCH: 'false' }),
        ]),
      ).toMatchObject({
        mode: 'setting-unresolved',
        unresolved: 'sources-disagree',
        variable: 'ENABLE_TOOL_SEARCH',
        value: null,
        readFromMachine: false,
      });
    });

    it('is not a disagreement when the two say the same thing', () => {
      expect(
        resolveToolSearchSources([
          shell({ ENABLE_TOOL_SEARCH: 'auto:5' }),
          file('user-settings', USER, { ENABLE_TOOL_SEARCH: ' auto:5 ' }),
        ]),
      ).toMatchObject({ mode: 'threshold', thresholdShare: 0.05 });
    });

    it('does not refuse over a variable that would have decided nothing', () => {
      // ANTHROPIC_BASE_URL is consulted only while ENABLE_TOOL_SEARCH is unset.
      expect(
        resolveToolSearchSources([
          shell({ ENABLE_TOOL_SEARCH: 'false', ANTHROPIC_BASE_URL: 'https://a.example/v1' }),
          file('user-settings', USER, { ANTHROPIC_BASE_URL: 'https://b.example/v1' }),
        ]),
      ).toMatchObject({ mode: 'loads-upfront', variable: 'ENABLE_TOOL_SEARCH' });
    });

    it('refuses on a settings file it could not read, which is not a file that sets nothing', () => {
      expect(
        resolveToolSearchSources([shell({}), file('user-settings', USER, {}, 'unreadable')]),
      ).toMatchObject({ mode: 'setting-unresolved', unresolved: 'source-unreadable' });
    });

    it('still reaches the documented default when every place was read and set nothing', () => {
      expect(
        resolveToolSearchSources([shell({}), file('user-settings', USER, {}, 'absent')]),
      ).toMatchObject({ mode: 'defers-all', readFromMachine: false, source: null });
    });

    // A settings file that sets the deciding variable to something this cannot
    // read as a value is not a settings file that sets nothing. Read as the
    // second, it produced the one verdict in this model that states a wrong
    // answer instead of no answer: the documented default, "these tokens are
    // NOT loaded up front at any size", at a machine whose own settings file
    // holds ENABLE_TOOL_SEARCH.
    it('refuses where a settings file sets the deciding variable to an unreadable value', () => {
      expect(
        resolveToolSearchSources([shell({}), held('user-settings', USER, ['ENABLE_TOOL_SEARCH'])]),
      ).toMatchObject({
        mode: 'setting-unresolved',
        unresolved: 'value-unreadable',
        variable: 'ENABLE_TOOL_SEARCH',
        value: null,
        readFromMachine: false,
        source: null,
      });
    });

    it('refuses the same way for the variable that is not overridable', () => {
      expect(
        resolveToolSearchSources([
          shell({}),
          held('user-settings', USER, ['CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS']),
        ]),
      ).toMatchObject({
        mode: 'setting-unresolved',
        unresolved: 'value-unreadable',
        variable: 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
      });
    });

    it('refuses rather than taking the shell, which it has no order against', () => {
      expect(
        resolveToolSearchSources([
          shell({ ENABLE_TOOL_SEARCH: 'true' }),
          held('user-settings', USER, ['ENABLE_TOOL_SEARCH']),
        ]),
      ).toMatchObject({ mode: 'setting-unresolved', unresolved: 'value-unreadable' });
    });

    // The other direction: an unknown that could not have decided anything must
    // not refuse an answer the machine actually gives, or every one of these
    // files becomes a refusal for a variable nothing was going to read.
    it('lets a higher-precedence readable value decide over an unreadable one below it', () => {
      expect(
        resolveToolSearchSources([
          shell({}),
          file('local-settings', LOCAL, { ENABLE_TOOL_SEARCH: 'false' }),
          held('user-settings', USER, ['ENABLE_TOOL_SEARCH']),
        ]),
      ).toMatchObject({ mode: 'loads-upfront', source: LOCAL, readFromMachine: true });
    });

    it('does not refuse over an unreadable value in a variable that decides nothing', () => {
      // ANTHROPIC_BASE_URL is consulted only while ENABLE_TOOL_SEARCH is unset.
      expect(
        resolveToolSearchSources([
          shell({ ENABLE_TOOL_SEARCH: 'true' }),
          held('user-settings', USER, ['ANTHROPIC_BASE_URL']),
        ]),
      ).toMatchObject({ mode: 'defers-all', variable: 'ENABLE_TOOL_SEARCH', readFromMachine: true });
    });
  });

  describe('the report', () => {
    it('tells a machine that switched tool search off in its settings that it pays', () => {
      const r = report({ env: {}, settings: [file('user-settings', USER, { ENABLE_TOOL_SEARCH: 'false' })] });
      expect(r.configs[0].deferral).toMatchObject({ mode: 'loads-upfront', setting: { source: USER } });
      const out = formatReport(r).replace(/\s+/g, ' ');
      expect(out).toContain('loads every tool definition up front here');
      expect(out).toContain('Every request carries these tokens before you type anything');
      expect(out).toContain(`${USER} — sets ENABLE_TOOL_SEARCH, which decided this`);
      // What it said about the same machine while it read only the shell.
      expect(out).not.toContain('is unset here, which is the documented default');
      expect(out).not.toContain('NOT loaded up front at any size');
    });

    it('names the places the documented default was read across', () => {
      const out = text({ env: {}, settings: [file('user-settings', USER, {})] });
      expect(out).toContain('ENABLE_TOOL_SEARCH is unset here, which is the documented default');
      expect(out).toContain('Where this was read');
      expect(out).toContain('this shell — sets none of them');
      expect(out).toContain(`${USER} — sets none of them`);
    });

    it('says so when the settings files were not read at all, instead of defaulting past them', () => {
      const out = text({ env: {} });
      expect(out).toContain('its settings files were NOT read here, so what they set is unknown');
    });

    it('counts the settings files that are simply not there', () => {
      const out = text({
        env: {},
        settings: [file('user-settings', USER, {}, 'absent'), file('local-settings', LOCAL, {}, 'absent')],
      });
      expect(out).toContain('2 other settings file(s) it reads are not on this machine');
      expect(out).not.toContain('were NOT read here');
    });

    it('states no verdict at all where the places disagree', () => {
      const out = text({
        env: { ENABLE_TOOL_SEARCH: 'true' },
        settings: [file('user-settings', USER, { ENABLE_TOOL_SEARCH: 'false' })],
      });
      expect(out).toContain('ENABLE_TOOL_SEARCH is set to different values by more than one place');
      expect(out).toContain('cannot be said from them');
      // Every sentence that would tell the reader an answer.
      expect(out).not.toContain('NOT loaded up front at any size');
      expect(out).not.toContain('Every request carries these tokens before you type anything');
      expect(out).not.toContain('deferral activates once');
    });

    it('states no verdict where a settings file could not be read', () => {
      const out = text({ env: {}, settings: [file('user-settings', USER, {}, 'unreadable')] });
      expect(out).toContain('could not be read — what it sets is unknown');
      expect(out).not.toContain('NOT loaded up front at any size');
      expect(out).not.toContain('Every request carries these tokens before you type anything');
    });

    it('states no verdict where the deciding variable is set to an unreadable value', () => {
      const out = text({ env: {}, settings: [held('user-settings', USER, ['ENABLE_TOOL_SEARCH'])] });
      expect(out).toContain('ENABLE_TOOL_SEARCH is set by a settings file Claude Code reads');
      expect(out).toContain('what it is set to is unknown');
      // The place is named as holding it, not as a file that sets none of them.
      expect(out).toContain(`${USER} — sets ENABLE_TOOL_SEARCH to a value this cannot read`);
      expect(out).not.toContain(`${USER} — sets none of them`);
      // Every sentence that would tell the reader an answer.
      expect(out).not.toContain('NOT loaded up front at any size');
      expect(out).not.toContain('is unset here, which is the documented default');
      expect(out).not.toContain('Every request carries these tokens before you type anything');
      expect(out).not.toContain('deferral activates once');
    });
  });

  describe('--json', () => {
    it('distinguishes a variable set nowhere from a place that was never read', () => {
      const readIt = JSON.parse(
        JSON.stringify(report({ env: {}, settings: [file('user-settings', USER, {})] })),
      ) as AuditReport;
      const never = JSON.parse(JSON.stringify(report({ env: {} }))) as AuditReport;
      for (const r of [readIt, never]) {
        // The field that cannot tell them apart, identical in both.
        expect(r.configs[0].deferral.setting).toMatchObject({ readFromMachine: false, value: null });
      }
      expect(readIt.configs[0].deferral.setting!.sources).toEqual([
        { scope: 'shell', source: SHELL_SOURCE, state: 'read', sets: [] },
        { scope: 'user-settings', source: USER, state: 'read', sets: [] },
      ]);
      expect(never.configs[0].deferral.setting!.sources).toEqual([
        { scope: 'shell', source: SHELL_SOURCE, state: 'read', sets: [] },
      ]);
    });

    it('publishes what a settings file sets by name, never by value', () => {
      // An env block is where a person keeps their keys, and a base URL routed
      // through a proxy carries a credential — same rule as config.ts.
      const secret = 'https://svc:sk-secret-abc123@proxy.internal/v1?key=sk-live-9';
      const r = report({
        env: {},
        settings: [file('user-settings', USER, { ENABLE_TOOL_SEARCH: 'false', ANTHROPIC_BASE_URL: secret })],
      });
      expect(r.configs[0].deferral.setting!.sources[1].sets).toEqual([
        'ENABLE_TOOL_SEARCH',
        'ANTHROPIC_BASE_URL',
      ]);
      for (const out of [formatReport(r), JSON.stringify(r)]) {
        expect(out).not.toContain('sk-secret-abc123');
        expect(out).not.toContain('sk-live-9');
        expect(out).not.toContain('proxy.internal');
      }
    });
  });

  describe('reading the files off disk', () => {
    it('takes the three variables out of an env block and leaves the rest', () => {
      const home = tempDir('mcc-home-');
      const cwd = tempDir('mcc-proj-');
      mkdirSync(join(home, '.claude'));
      writeFileSync(
        join(home, '.claude', 'settings.json'),
        JSON.stringify({
          env: { ENABLE_TOOL_SEARCH: 'auto:5', ANTHROPIC_API_KEY: 'sk-ant-DONOTREAD' },
          permissions: { allow: [] },
        }),
      );
      const read = loadSettingsSources(settingsCandidates({ home, cwd, platform: 'linux' }));
      const user = read.find((r) => r.scope === 'user-settings')!;
      expect(user).toMatchObject({ state: 'read', vars: { ENABLE_TOOL_SEARCH: 'auto:5' } });
      expect(JSON.stringify(user.vars)).not.toContain('sk-ant-DONOTREAD');
      expect(read.find((r) => r.scope === 'project-settings')).toMatchObject({ state: 'absent', vars: {} });
    });

    it('carries a variable set to something that is not a string as unknown, not as unset', () => {
      // `"ENABLE_TOOL_SEARCH": false` — the JSON boolean, which is what a person
      // writing a settings file by hand reaches for — used to be dropped, and the
      // file then looked identical to one that sets nothing at all.
      const cwd = tempDir('mcc-proj-');
      mkdirSync(join(cwd, '.claude'));
      writeFileSync(
        join(cwd, '.claude', 'settings.json'),
        JSON.stringify({ env: { ENABLE_TOOL_SEARCH: false, ANTHROPIC_BASE_URL: null } }),
      );
      const read = loadSettingsSources(
        settingsCandidates({ home: tempDir('mcc-home-'), cwd, platform: 'linux' }),
      );
      const project = read.find((r) => r.scope === 'project-settings')!;
      expect(project).toMatchObject({ state: 'read', vars: {} });
      expect(project.unreadable).toEqual(['ENABLE_TOOL_SEARCH', 'ANTHROPIC_BASE_URL']);

      // End to end, off a real file: the report withholds instead of asserting.
      const r = report({ env: {}, settings: read });
      expect(r.configs[0].deferral).toMatchObject({
        mode: 'setting-unresolved',
        setting: { unresolved: 'value-unreadable' },
      });
      expect(formatReport(r)).not.toContain('NOT loaded up front at any size');
    });

    it('leaves a file whose env block sets none of them setting none of them', () => {
      const cwd = tempDir('mcc-proj-');
      mkdirSync(join(cwd, '.claude'));
      writeFileSync(join(cwd, '.claude', 'settings.json'), JSON.stringify({ env: { OTHER: false } }));
      const read = loadSettingsSources(
        settingsCandidates({ home: tempDir('mcc-home-'), cwd, platform: 'linux' }),
      );
      const project = read.find((r) => r.scope === 'project-settings')!;
      expect(project).toMatchObject({ state: 'read', vars: {} });
      expect(project.unreadable).toBeUndefined();
      expect(report({ env: {}, settings: read }).configs[0].deferral.mode).toBe('defers-all');
    });

    it('calls a settings file it cannot parse unreadable, not a file that sets nothing', () => {
      const cwd = tempDir('mcc-proj-');
      mkdirSync(join(cwd, '.claude'));
      writeFileSync(join(cwd, '.claude', 'settings.json'), '{ "env": { oops');
      const read = loadSettingsSources(
        settingsCandidates({ home: tempDir('mcc-home-'), cwd, platform: 'linux' }),
      );
      expect(read.find((r) => r.scope === 'project-settings')).toMatchObject({ state: 'unreadable' });
    });

    it('lists the files in precedence order, and knows where the managed one lives', () => {
      const at = (platform: NodeJS.Platform, programData?: string) =>
        settingsCandidates({ home: '/h', cwd: '/c', platform, programData });
      expect(at('darwin').map((c) => c.scope)).toEqual([
        'managed-settings',
        'local-settings',
        'project-settings',
        'user-settings',
      ]);
      expect(at('darwin')[0].path).toBe('/Library/Application Support/ClaudeCode/managed-settings.json');
      expect(at('linux')[0].path).toBe('/etc/claude-code/managed-settings.json');
      expect(at('win32', 'D:\\PD')[0].path).toBe(join('D:\\PD', 'ClaudeCode', 'managed-settings.json'));
      expect(at('darwin')[3].path).toBe(join('/h', '.claude', 'settings.json'));
    });
  });
});

// ---------------------------------------------------------------------------
// A machine with a client installed that declares no servers is not a machine
// with no client. Before this, both ended up as the same empty report and the
// same sentence — the one distinction this project keeps everywhere else (an
// absence of a record is not a measurement) not kept here.
// ---------------------------------------------------------------------------

describe('a client that declares nothing vs no client at all', () => {
  it('records a parsed-but-empty config as itself, and gives it no report line', () => {
    const r = buildReport(
      [{ client: 'claude-code', source: '/h/.claude.json', servers: [], declaresNothing: true }],
      new Map(),
      { generatedAt: 'T' },
    );
    expect(r.configs).toHaveLength(0); // nothing to total
    expect(r.emptyConfigs).toEqual([{ client: 'claude-code', source: '/h/.claude.json' }]);
    expect(r.problems).toEqual([]); // declaring nothing is not a fault
  });

  it('records a config whose every declared server is switched off as that, not as declaring nothing', () => {
    const r = buildReport(
      [{ client: 'claude-code', source: '/h/.claude.json', servers: [], allDisabled: ['linear', 'redis'] }],
      new Map(),
      { generatedAt: 'T' },
    );
    expect(r.configs).toHaveLength(0); // still nothing to total
    expect(r.emptyConfigs).toEqual([
      { client: 'claude-code', source: '/h/.claude.json', allDisabled: ['linear', 'redis'] },
    ]);
    expect(r.problems).toEqual([]); // switching a server off is not a fault either
  });

  it('does not put an allDisabled list on a config that really declares nothing', () => {
    const r = buildReport(
      [{ client: 'claude-code', source: '/h/.claude.json', servers: [], declaresNothing: true }],
      new Map(),
      { generatedAt: 'T' },
    );
    expect(r.emptyConfigs[0].allDisabled).toBeUndefined();
  });

  it('records nothing when no config exists anywhere', () => {
    const r = buildReport([], new Map(), { generatedAt: 'T' });
    expect(r.configs).toHaveLength(0);
    expect(r.emptyConfigs).toEqual([]);
  });

  it('does not call an unreadable config empty', () => {
    const r = buildReport(
      [{ client: 'cursor', source: '/h/.cursor/mcp.json', servers: [], error: 'not json' }],
      new Map(),
      { generatedAt: 'T' },
    );
    expect(r.emptyConfigs).toEqual([]);
    expect(r.problems.join(' ')).toContain('not json');
  });
});
