import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport, formatReport, serverKey } from '../src/audit/audit.js';
import {
  configCandidates,
  managedMcpPath,
  withManagedMcpCandidate,
  type LoadedConfig,
} from '../src/audit/config.js';
import type { ToolSearchSource } from '../src/audit/deferral.js';
import { measureTools } from '../src/core/canonical.js';
import type { Measurement } from '../src/core/types.js';

/**
 * The managed MCP file and the allow/deny lists, end to end through
 * `buildReport`. Semantics under test are the vendor's:
 * code.claude.com/docs/en/managed-mcp.md, read 2026-09-09 — a deployed
 * `managed-mcp.json` means a claude-code session loads only its servers; an
 * empty one disables MCP; the lists filter what loads, deny first. What this
 * audit adds is the direction rule: only deny is ever applied, and only to
 * session-level claims — a file's own total is a fact about the file.
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

const stdio = (
  name: string,
  argv: string[],
  client = 'claude-code',
  source = '/home/.claude.json',
) => ({
  name,
  client,
  source,
  transport: 'stdio' as const,
  command: argv.join(' '),
  argv,
  envVarNames: [],
});

const settings = (
  scope: string,
  source: string,
  mcpPolicy: NonNullable<ToolSearchSource['mcpPolicy']>,
): ToolSearchSource => ({ scope, source, state: 'read', vars: {}, mcpPolicy }) as ToolSearchSource;

describe('managedMcpPath / withManagedMcpCandidate', () => {
  it('names the one documented path per platform', () => {
    expect(managedMcpPath('darwin')).toBe(MANAGED);
    expect(managedMcpPath('linux')).toBe('/etc/claude-code/managed-mcp.json');
    expect(managedMcpPath('win32')).toBe('C:\\Program Files\\ClaudeCode\\managed-mcp.json');
  });

  it('splices the managed candidate ahead of the claude-code configs', () => {
    const cands = withManagedMcpCandidate(
      configCandidates({ home: '/h', cwd: '/w', platform: 'linux' }),
      'linux',
    );
    const i = cands.findIndex((c) => c.managed);
    expect(i).toBeGreaterThan(-1);
    expect(cands[i]!.client).toBe('claude-code');
    expect(cands[i]!.path).toBe('/etc/claude-code/managed-mcp.json');
    const firstCc = cands.findIndex((c) => c.client === 'claude-code');
    expect(firstCc).toBe(i);
  });
});

describe('exclusive control', () => {
  const managedServer = stdio('gh', ['node', 'gh.js'], 'claude-code', MANAGED);
  const userServer = stdio('mine', ['node', 'mine.js']);
  const configs: LoadedConfig[] = [
    { client: 'claude-code', source: '/home/.claude.json', servers: [userServer] },
    { client: 'claude-code', source: MANAGED, managed: true, servers: [managedServer] },
  ];
  const measured = new Map([
    [serverKey(managedServer), measurement('gh')],
    [serverKey(userServer), measurement('mine', 6)],
  ]);

  it('marks the rows, keeps both file totals, and reports the state', () => {
    const r = buildReport(configs, measured, { generatedAt: 'T' });
    expect(r.managedMcp).toEqual({
      path: MANAGED,
      state: 'exclusive',
      suppressed: ['/home/.claude.json'],
    });
    const managedRow = r.configs.find((c) => c.managed)!;
    const userRow = r.configs.find((c) => !c.managed)!;
    expect(userRow.suppressedByManagedMcp).toBe(MANAGED);
    expect(managedRow.totalTokens).toBeGreaterThan(0);
    expect(userRow.totalTokens).toBeGreaterThan(0); // a file fact, untouched
  });

  it('the session verdict spans only the managed file', () => {
    const r = buildReport(configs, measured, { generatedAt: 'T' });
    const row = r.configs.find((c) => !c.managed)!;
    // Shared by identity across the scope, so the suppressed row points at the
    // same verdict — whose sources name the managed file alone.
    expect(row.deferral).toBe(r.configs.find((c) => c.managed)!.deferral);
    expect(row.deferral.sources).toEqual([MANAGED]);
  });

  it('prints the banner on both rows', () => {
    const text = formatReport(buildReport(configs, measured, { generatedAt: 'T' }));
    expect(text).toContain('exclusive control: a claude-code session loads only the servers');
    expect(text).toContain(`does not load: ${MANAGED} has exclusive control`);
  });
});

describe('a managed file that disables MCP, and one that cannot be read', () => {
  const userServer = stdio('mine', ['node', 'mine.js']);
  const measured = new Map([[serverKey(userServer), measurement('mine')]]);

  it('an empty server map is reported as MCP disabled by policy', () => {
    const configs: LoadedConfig[] = [
      { client: 'claude-code', source: '/home/.claude.json', servers: [userServer] },
      { client: 'claude-code', source: MANAGED, managed: true, servers: [], declaresNothing: true },
    ];
    const r = buildReport(configs, measured, { generatedAt: 'T' });
    expect(r.managedMcp?.state).toBe('disabled');
    expect(r.configs[0]!.suppressedByManagedMcp).toBe(MANAGED);
    expect(r.configs[0]!.deferral.sources).toEqual([]);
    const text = formatReport(r);
    expect(text).toContain('MCP is disabled by policy');
  });

  it('an unreadable managed file refuses the session claim and suppresses nothing', () => {
    const configs: LoadedConfig[] = [
      { client: 'claude-code', source: '/home/.claude.json', servers: [userServer] },
      { client: 'claude-code', source: MANAGED, managed: true, servers: [], error: 'EACCES' },
    ];
    const r = buildReport(configs, measured, { generatedAt: 'T' });
    expect(r.managedMcp).toMatchObject({ state: 'unreadable', error: 'EACCES', suppressed: [] });
    // Which servers load cannot be said, so the user config keeps its own
    // session verdict rather than being claimed suppressed.
    expect(r.configs[0]!.suppressedByManagedMcp).toBeUndefined();
    expect(r.problems.some((p) => p.includes('EACCES'))).toBe(true);
    const text = formatReport(r);
    expect(text).toContain('could not be read — which servers a claude-code');
  });
});

describe('the denylist against a session', () => {
  const a = stdio('alpha', ['node', 'a.js']);
  const b = stdio('beta', ['node', 'b.js']);
  const configs: LoadedConfig[] = [
    { client: 'claude-code', source: '/home/.claude.json', servers: [a, b] },
  ];
  const measured = new Map([
    [serverKey(a), measurement('alpha')],
    [serverKey(b), measurement('beta', 6)],
  ]);
  const deny = settings('user-settings', '/home/.claude/settings.json', {
    denied: [{ serverName: 'beta' }],
  });

  it('leaves the file total alone and takes the server out of the session verdict', () => {
    const r = buildReport(configs, measured, { generatedAt: 'T', settings: [deny] });
    const row = r.configs[0]!;
    expect(row.servers.map((s) => s.name).toSorted()).toEqual(['alpha', 'beta']);
    expect(r.mcpPolicy?.denied).toHaveLength(1);
    expect(r.mcpPolicy!.denied[0]).toMatchObject({ server: 'beta', source: deny.source });
    expect(r.mcpPolicy!.denied[0]!.tokens).toBeGreaterThan(0);
    const text = formatReport(r);
    expect(text).toContain('blocked by deniedMcpServers');
    expect(text).toContain('beta');
  });

  it('applies to the managed set too — the vendor says deny overrides everything', () => {
    const managedServer = stdio('beta', ['node', 'b.js'], 'claude-code', MANAGED);
    const r = buildReport(
      [{ client: 'claude-code', source: MANAGED, managed: true, servers: [managedServer] }],
      new Map([[serverKey(managedServer), measurement('beta')]]),
      { generatedAt: 'T', settings: [deny] },
    );
    expect(r.mcpPolicy?.denied.map((d) => d.server)).toEqual(['beta']);
  });

  it('does not evaluate policy for other clients', () => {
    const desk = stdio('beta', ['node', 'b.js'], 'claude-desktop', '/desk.json');
    const r = buildReport(
      [{ client: 'claude-desktop', source: '/desk.json', servers: [desk] }],
      new Map([[serverKey(desk), measurement('beta')]]),
      { generatedAt: 'T', settings: [deny] },
    );
    expect(r.mcpPolicy?.denied ?? []).toEqual([]);
  });
});

describe('the allowlist against a session — reported, never applied', () => {
  const a = stdio('alpha', ['node', 'a.js']);
  const configs: LoadedConfig[] = [
    { client: 'claude-code', source: '/home/.claude.json', servers: [a] },
  ];
  const measured = new Map([[serverKey(a), measurement('alpha')]]);

  it('a server failing every read entry stays in every sum, as a named condition', () => {
    const r = buildReport(configs, measured, {
      generatedAt: 'T',
      settings: [
        settings('managed-settings', '/etc/claude-code/managed-settings.json', {
          allowed: [{ serverCommand: ['npx', 'approved'] }],
        }),
      ],
    });
    expect(r.mcpPolicy?.allow?.rows).toEqual([{ server: 'alpha', verdict: 'fails' }]);
    expect(r.configs[0]!.totalTokens).toBeGreaterThan(0);
    const text = formatReport(r);
    expect(text).toContain('an MCP allowlist is set in');
    expect(text).toContain('matched by nothing read here: alpha');
    expect(text).toContain('never a subtraction');
  });
});
