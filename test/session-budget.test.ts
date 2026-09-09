import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport, formatReport, serverKey } from '../src/audit/audit.js';
import type { LoadedConfig } from '../src/audit/config.js';
import type { ToolSearchSource } from '../src/audit/deferral.js';
import { measureTools } from '../src/core/canonical.js';
import type { Measurement } from '../src/core/types.js';

/**
 * `--budget` gates the costliest SESSION — decided 2026-09-09. A context
 * window belongs to one session; claude-code loads `~/.claude.json` and
 * `<cwd>/.mcp.json` into one, the managed file alone where deployed, and a
 * denied server into none. Per-file totals stay file facts. Every case here
 * is a pair: what the old worst-file gate said, and why that was the wrong
 * answer for a session someone actually runs.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const tools = JSON.parse(readFileSync(join(repoRoot, 'spec/fixtures/tools-basic.json'), 'utf8'));

const MANAGED = '/Library/Application Support/ClaudeCode/managed-mcp.json';

function measurement(name: string, extraTools = 0): Measurement {
  const t = [
    ...tools,
    ...Array.from({ length: extraTools }, (_, i) => ({
      name: `extra_${i}`,
      description: 'x'.repeat(40),
    })),
  ];
  return measureTools(t, { serverName: name });
}

const stdio = (name: string, argv: string[], client: string, source: string) => ({
  name,
  client,
  source,
  transport: 'stdio' as const,
  command: argv.join(' '),
  argv,
  envVarNames: [],
});

describe('the budget gates the costliest session', () => {
  const home = stdio('alpha', ['node', 'a.js'], 'claude-code', '/home/.claude.json');
  const proj = stdio('beta', ['node', 'b.js'], 'claude-code', '/w/.mcp.json');
  const configs: LoadedConfig[] = [
    { client: 'claude-code', source: '/home/.claude.json', servers: [home] },
    { client: 'claude-code', source: '/w/.mcp.json', servers: [proj] },
  ];
  const measured = new Map([
    [serverKey(home), measurement('alpha')],
    [serverKey(proj), measurement('beta')],
  ]);

  it('two claude-code files under the limit apiece still fail when their session is over it', () => {
    const probe = buildReport(configs, measured, { generatedAt: 'T' });
    const [a, b] = probe.configs.map((c) => c.totalTokens);
    const limit = Math.max(a!, b!) + 1; // every file fits; the session does not
    const r = buildReport(configs, measured, { generatedAt: 'T', budget: limit });
    expect(a! + b!).toBeGreaterThan(limit);
    expect(r.budget).toMatchObject({ over: true, worstTotal: a! + b! });
    expect(r.budget!.worstSource).toBe('/home/.claude.json + /w/.mcp.json');
  });

  it('two files of another client stay two sessions — the worst single file gates', () => {
    const d1 = stdio('alpha', ['node', 'a.js'], 'cursor', '/home/.cursor/mcp.json');
    const d2 = stdio('beta', ['node', 'b.js'], 'cursor', '/w/.cursor/mcp.json');
    const cfgs: LoadedConfig[] = [
      { client: 'cursor', source: '/home/.cursor/mcp.json', servers: [d1] },
      { client: 'cursor', source: '/w/.cursor/mcp.json', servers: [d2] },
    ];
    const m = new Map([
      [serverKey(d1), measurement('alpha')],
      [serverKey(d2), measurement('beta')],
    ]);
    const probe = buildReport(cfgs, m, { generatedAt: 'T' });
    const worstFile = Math.max(...probe.configs.map((c) => c.totalTokens));
    const r = buildReport(cfgs, m, { generatedAt: 'T', budget: worstFile });
    expect(r.budget).toMatchObject({ over: false, worstTotal: worstFile });
    expect(r.budget!.worstSource).not.toContain(' + ');
  });

  it('under exclusive control the session is the managed file, and a heavier user file cannot fail it', () => {
    const managedServer = stdio('gh', ['node', 'gh.js'], 'claude-code', MANAGED);
    const heavy = stdio('mine', ['node', 'mine.js'], 'claude-code', '/home/.claude.json');
    const cfgs: LoadedConfig[] = [
      { client: 'claude-code', source: '/home/.claude.json', servers: [heavy] },
      { client: 'claude-code', source: MANAGED, managed: true, servers: [managedServer] },
    ];
    const m = new Map([
      [serverKey(managedServer), measurement('gh')],
      [serverKey(heavy), measurement('mine', 8)], // the suppressed file is the heavier one
    ]);
    const probe = buildReport(cfgs, m, { generatedAt: 'T' });
    const managedTotal = probe.configs.find((c) => c.managed)!.totalTokens;
    const userTotal = probe.configs.find((c) => !c.managed)!.totalTokens;
    expect(userTotal).toBeGreaterThan(managedTotal);
    const r = buildReport(cfgs, m, { generatedAt: 'T', budget: managedTotal });
    expect(r.budget).toMatchObject({ over: false, worstTotal: managedTotal });
    expect(r.budget!.worstSource).toBe(MANAGED);
  });

  it("a suppressed file's unmeasured server is nobody's bill and cannot fail the check", () => {
    const managedServer = stdio('gh', ['node', 'gh.js'], 'claude-code', MANAGED);
    const walled = {
      ...stdio('walled', [], 'claude-code', '/home/.claude.json'),
      transport: 'remote' as const,
      url: 'https://walled.example/mcp',
      argv: undefined,
      command: undefined,
    };
    const cfgs: LoadedConfig[] = [
      { client: 'claude-code', source: '/home/.claude.json', servers: [walled] },
      { client: 'claude-code', source: MANAGED, managed: true, servers: [managedServer] },
    ];
    const m = new Map([[serverKey(managedServer), measurement('gh')]]);
    const r = buildReport(cfgs, m, { generatedAt: 'T', budget: 1_000_000 });
    expect(r.budget!.unestablished).toBeUndefined();
    expect(r.budget!.over).toBe(false);
  });

  it('a denied server leaves the session bill and the budget, never the file total', () => {
    const deny: ToolSearchSource = {
      scope: 'user-settings',
      source: '/home/.claude/settings.json',
      state: 'read',
      vars: {},
      mcpPolicy: { denied: [{ serverName: 'beta' }] },
    } as ToolSearchSource;
    const probe = buildReport(configs, measured, { generatedAt: 'T' });
    const [a, b] = probe.configs.map((c) => c.totalTokens);
    const r = buildReport(configs, measured, { generatedAt: 'T', budget: a!, settings: [deny] });
    // beta is denied, so the session is alpha alone — exactly the limit.
    expect(r.budget).toMatchObject({ over: false, worstTotal: a! });
    expect(r.sessions?.find((s) => s.client === 'claude-code')).toMatchObject({
      totalTokens: a!,
      deniedTokens: b!,
    });
  });

  it('the fit plan drops servers across both files of the session', () => {
    const r = buildReport(configs, measured, { generatedAt: 'T', budget: 1 });
    expect(r.budget!.fit!.drop.map((d) => d.name).toSorted()).toEqual(['alpha', 'beta']);
  });

  it('the report prints the session line and the gate names the session', () => {
    const probe = buildReport(configs, measured, { generatedAt: 'T' });
    const sum = probe.configs.reduce((x, c) => x + c.totalTokens, 0);
    const text = formatReport(buildReport(configs, measured, { generatedAt: 'T', budget: sum }));
    expect(text).toContain('one claude-code session loads 2 config files together');
    expect(text).toContain('That session figure is what --budget gates');
    expect(text).toContain('costliest session: /home/.claude.json + /w/.mcp.json');
  });
});
