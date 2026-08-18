import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseJsonc, extractServers, configCandidates, loadConfigs } from '../src/audit/config.js';
import { buildReport, formatReport, planBudgetFit, serverKey, DEFAULT_CONTEXT_WINDOW } from '../src/audit/audit.js';
import { runAudit, fetchDivergence } from '../src/audit/run.js';
import { measureTools, failedMeasurement } from '../src/core/canonical.js';
import type { Measurement } from '../src/core/types.js';

const execFileAsync = promisify(execFile);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const tools = JSON.parse(readFileSync(join(repoRoot, 'spec/fixtures/tools-basic.json'), 'utf8'));

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
    const dir = mkdtempSync(join(tmpdir(), 'mcp-audit-cfg-'));
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
    const dir = mkdtempSync(join(tmpdir(), 'mcp-audit-cli-'));
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
    const dir = mkdtempSync(join(tmpdir(), 'mcp-audit-none-'));
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
    const dir = mkdtempSync(join(tmpdir(), 'mcp-audit-claude-'));
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
    const dir = mkdtempSync(join(tmpdir(), 'mcp-audit-claude-fail-'));
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
