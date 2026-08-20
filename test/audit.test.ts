import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseJsonc, extractServers, configCandidates, loadConfigs } from '../src/audit/config.js';
import { buildReport, formatReport, planBudgetFit, serverKey, DEFAULT_CONTEXT_WINDOW, type AuditReport } from '../src/audit/audit.js';
import { buildDiff, evaluateIncreaseGate, formatDiff, formatGate, parseBaselineReport } from '../src/audit/diff.js';
import { evaluateDeferral, TOOL_SEARCH_THRESHOLD_SHARE } from '../src/audit/deferral.js';
import { runAudit, fetchDivergence } from '../src/audit/run.js';
import { measureTools, failedMeasurement } from '../src/core/canonical.js';
import type { Measurement } from '../src/core/types.js';

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
  it('skips missing files, reports unparseable ones, ignores configs with no servers', () => {
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
    expect(loaded).toHaveLength(2);
    expect(loaded[0].servers).toHaveLength(1);
    expect(loaded[1].error).toBeDefined();
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
      'npx',
      ['tsx', join(repoRoot, 'src/cli.ts'), 'audit', '--config', join(dir, 'mcp.json'), '--json'],
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
      execFileSync('npx', ['tsx', join(repoRoot, 'src/cli.ts'), 'audit', '--config', join(dir, 'missing.json')], {
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
      execFileSync('npx', ['tsx', join(repoRoot, 'src/cli.ts'), 'audit', '--budget', 'lots'], {
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
        'npx',
        ['tsx', join(repoRoot, 'src/cli.ts'), 'audit', '--config', configPath, '--claude', '--divergence-url', divergenceUrl, '--json'],
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
  configs: { source: string; client?: string; servers: DiffSrv[] }[],
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
          { client: c.client ?? 'claude-desktop', totalTokens, skipped: bad },
          over.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
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
      const stdout = execFileSync('npx', ['tsx', join(repoRoot, 'src/cli.ts'), ...args], {
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

describe('deferral — whether this client loads the total up front', () => {
  const cw = DEFAULT_CONTEXT_WINDOW;
  const threshold = cw * TOOL_SEARCH_THRESHOLD_SHARE; // 20,000 for a 200,000-token window

  const verdict = (client: string, totalTokens: number, skipped = 0, contextWindow = cw) =>
    evaluateDeferral({ client, totalTokens, skipped: Array(skipped).fill(null) }, contextWindow);

  it('places a Claude Code stack that is over the threshold on the deferred side', () => {
    const d = verdict('claude-code', 84_455);
    expect(d).toMatchObject({
      posture: 'defers-by-default',
      mechanism: 'tool search',
      thresholdTokens: threshold,
      distanceTokens: 84_455 - threshold,
      crosses: true,
      deferrableIsFloor: false,
    });
    expect(d.exceptions.length).toBeGreaterThan(0);
  });

  it('places a Claude Code stack that is under the threshold on the loaded-up-front side', () => {
    expect(verdict('claude-code', 12_000)).toMatchObject({ crosses: false, distanceTokens: -8_000 });
  });

  it('activates at the threshold, not only above it', () => {
    expect(verdict('claude-code', threshold).crosses).toBe(true);
    expect(verdict('claude-code', threshold - 1).crosses).toBe(false);
  });

  it('moves the threshold with the context window it is given', () => {
    // 50,000 crosses 10% of 200,000 and does not come close to 10% of 1,000,000.
    expect(verdict('claude-code', 50_000).crosses).toBe(true);
    const wide = verdict('claude-code', 50_000, 0, 1_000_000);
    expect(wide).toMatchObject({ thresholdTokens: 100_000, crosses: false });
  });

  it('refuses to say "under" when an unmeasured server could carry it over', () => {
    // Measured 12,000 is under 20,000 — but a server that produced no number
    // still serves tools to a real session, so the total is a floor.
    const d = verdict('claude-code', 12_000, 1);
    expect(d).toMatchObject({ deferrableIsFloor: true, crosses: null });
  });

  it('still says "over" from a floor that is already over — more cannot take it back under', () => {
    expect(verdict('claude-code', 84_455, 2)).toMatchObject({ deferrableIsFloor: true, crosses: true });
  });

  it('records the absence of a deferral rule for the other known clients, with no threshold', () => {
    for (const client of ['claude-desktop', 'cursor', 'vscode', 'windsurf']) {
      expect(verdict(client, 84_455)).toMatchObject({
        posture: 'no-deferral-on-record',
        mechanism: null,
        thresholdTokens: null,
        distanceTokens: null,
        crosses: null,
      });
    }
  });

  it('says the client is unknown for a config named with --config', () => {
    expect(verdict('explicit', 84_455).posture).toBe('client-unknown');
    expect(verdict('some-client-shipped-after-this-was-written', 1).posture).toBe('client-unknown');
  });

  it('is attached to every config a report carries, and survives --json', () => {
    const report = reportOf([
      { source: CFG, client: 'claude-code', servers: [{ name: 'a', tokens: 84_455 }] },
      { source: '/two.json', client: 'cursor', servers: [{ name: 'b', tokens: 84_455 }] },
    ]);
    const roundTripped = JSON.parse(JSON.stringify(report)) as AuditReport;
    expect(roundTripped.configs.map((c) => c.deferral.posture).sort()).toEqual([
      'defers-by-default',
      'no-deferral-on-record',
    ]);
    expect(roundTripped.configs.find((c) => c.client === 'claude-code')!.deferral.thresholdTokens).toBe(threshold);
  });
});

describe('formatReport states where the cost is paid', () => {
  // Prose is asserted against the text with its line breaks flattened, so a
  // re-wrap for terminal width is not a test failure — the sentence is.
  const render = (client: string, tokens: number, servers: DiffSrv[] = []) =>
    formatReport(
      reportOf([{ source: CFG, client, servers: [{ name: 'a', tokens }, ...servers] }]),
    ).replace(/\s+/g, ' ');

  it('tells a Claude Code reader over the threshold that these tokens are not loaded up front', () => {
    const out = render('claude-code', 84_455);
    expect(out).toContain('claude-code defers tool definitions by default (tool search)');
    expect(out).toContain('84,455 is 64,455 over the threshold of 20,000 (10.0% of the context window)');
    expect(out).toContain('NOT loaded up front');
    // ...and where it is paid in full anyway.
    expect(out).toContain('ANTHROPIC_BASE_URL');
    expect(out).not.toContain('every request carries these tokens before you');
  });

  it('tells a Claude Code reader under the threshold that every request still carries them', () => {
    const out = render('claude-code', 12_000);
    expect(out).toContain('does not reach it: 12,000 is 8,000 under the threshold of 20,000');
    expect(out).toContain('deferral does not activate and every request carries these tokens before you type anything');
    expect(out).not.toContain('NOT loaded up front');
  });

  it('prints an undecided stack as undecided, naming the servers that left it that way', () => {
    const out = render('claude-code', 12_000, [{ name: 'broken', tokens: null }]);
    expect(out).toContain('cannot be said');
    expect(out).toContain('at least 12,000');
    expect(out).toContain('1 server(s) here produced no number and what they serve counts toward it too');
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
});
