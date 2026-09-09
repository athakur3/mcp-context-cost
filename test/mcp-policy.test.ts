import { describe, it, expect } from 'vitest';
import {
  extractSourcePolicy,
  evaluateMcpPolicy,
  urlMatches,
  type PolicyServer,
} from '../src/audit/mcp-policy.js';

/**
 * The evaluation tables on code.claude.com/docs/en/managed-mcp.md (read
 * 2026-09-09) are executable — the accordions under §Example configuration
 * enumerate verdicts for URL-only, command-only, and mixed allowlists, and the
 * wildcard table under §How a server is evaluated enumerates URL matches. The
 * vectors below are those tables, transcribed, so a drift between this module
 * and the page it models is a red test naming the row.
 */

const src = (
  scope: string,
  source: string,
  policy: ReturnType<typeof extractSourcePolicy>,
  state = 'read',
) => ({ scope, source, state, policy });

const remote = (name: string, url: string): PolicyServer => ({ name, transport: 'remote', url });
const stdio = (name: string, argv: string[]): PolicyServer => ({
  name,
  transport: 'stdio',
  argv,
});

describe('urlMatches — the documented wildcard table', () => {
  it('matches all paths on a specific domain', () => {
    expect(urlMatches('https://mcp.example.com/*', 'https://mcp.example.com/api')).toBe(true);
  });
  it('a pattern with no path matches any path', () => {
    expect(urlMatches('https://mcp.example.com', 'https://mcp.example.com/api/v2')).toBe(true);
    expect(urlMatches('https://mcp.example.com', 'https://mcp.example.com')).toBe(true);
  });
  it('matches any subdomain', () => {
    expect(urlMatches('https://*.example.com/*', 'https://api.internal.example.com/mcp')).toBe(
      true,
    );
    expect(urlMatches('https://*.example.com/*', 'https://example.com/mcp')).toBe(false);
  });
  it('matches any port on localhost', () => {
    expect(urlMatches('http://localhost:*/*', 'http://localhost:8080/mcp')).toBe(true);
  });
  it('matches any scheme to a specific domain', () => {
    expect(urlMatches('*://mcp.example.com/*', 'http://mcp.example.com/x')).toBe(true);
  });
  it('hostname is case-insensitive, path stays case-sensitive', () => {
    expect(urlMatches('https://Mcp.Example.com/*', 'https://mcp.example.com/api')).toBe(true);
    expect(urlMatches('https://mcp.example.com/API', 'https://mcp.example.com/api')).toBe(false);
  });
  it('does not match a different domain', () => {
    expect(urlMatches('https://mcp.example.com/*', 'https://external.example.com/mcp')).toBe(false);
  });
});

describe('extractSourcePolicy', () => {
  it('returns undefined for a document setting none of the three keys', () => {
    expect(extractSourcePolicy({ env: { FOO: '1' } })).toBeUndefined();
    expect(extractSourcePolicy(null)).toBeUndefined();
  });
  it('carries lists as written and non-lists as unreadable', () => {
    expect(extractSourcePolicy({ deniedMcpServers: [{ serverName: 'x' }] })).toEqual({
      denied: [{ serverName: 'x' }],
    });
    expect(extractSourcePolicy({ allowedMcpServers: 'nope' })).toEqual({ allowed: 'unreadable' });
  });
  it('reads the managed-only flag as a boolean and anything else as unreadable', () => {
    expect(extractSourcePolicy({ allowManagedMcpServersOnly: true })).toEqual({
      allowManagedMcpServersOnly: true,
    });
    expect(extractSourcePolicy({ allowManagedMcpServersOnly: 'yes' })).toEqual({
      allowManagedMcpServersOnly: 'unreadable',
    });
  });
});

describe('the denylist — applied, because nothing overrides a deny', () => {
  it('blocks by name, command, and URL, naming the entry and its file', () => {
    const servers = [
      remote('gh', 'https://api.githubcopilot.com/mcp/'),
      stdio('bad', ['npx', '-y', 'unapproved-package']),
      stdio('dangerous-server', ['node', 'x.js']),
      stdio('fine', ['node', 'ok.js']),
    ];
    const ev = evaluateMcpPolicy(servers, [
      src('user-settings', '/u/settings.json', {
        denied: [
          { serverName: 'dangerous-server' },
          { serverCommand: ['npx', '-y', 'unapproved-package'] },
          { serverUrl: 'https://*.githubcopilot.com/*' },
        ],
      }),
    ]);
    expect(ev.denied.map((d) => d.server).toSorted()).toEqual(['bad', 'dangerous-server', 'gh']);
    expect(ev.denied.find((d) => d.server === 'bad')!.entry).toContain('serverCommand');
    expect(ev.denied[0]!.source).toBe('/u/settings.json');
  });

  it('commands match exactly — every argument, in order', () => {
    const ev = evaluateMcpPolicy(
      [stdio('a', ['npx', 'server']), stdio('b', ['npx', '-y', 'server', '--flag'])],
      [src('user-settings', '/u', { denied: [{ serverCommand: ['npx', '-y', 'server'] }] })],
    );
    expect(ev.denied).toEqual([]);
  });

  it('an entry carrying ${} is never evaluated, and is returned as set', () => {
    const ev = evaluateMcpPolicy(
      [stdio('a', ['/home/me/bin/server'])],
      [src('user-settings', '/u', { denied: [{ serverCommand: ['${HOME}/bin/server'] }] })],
    );
    expect(ev.denied).toEqual([]);
    expect(ev.denyUnevaluated).toHaveLength(1);
    expect(ev.denyUnevaluated[0]!.reason).toBe('contains ${} expansion');
  });

  it('ignores sources that were not read', () => {
    const ev = evaluateMcpPolicy(
      [stdio('a', ['x'])],
      [src('managed-settings', '/m', { denied: [{ serverName: 'a' }] }, 'unreadable')],
    );
    expect(ev.denied).toEqual([]);
    expect(ev.sources).toEqual([]);
  });
});

describe('the allowlist — reported, never applied', () => {
  it('is absent when no read source sets it', () => {
    const ev = evaluateMcpPolicy([stdio('a', ['x'])], [src('user-settings', '/u', { denied: [] })]);
    expect(ev.allow).toBeUndefined();
  });

  it('URL-only allowlist: the accordion, row for row', () => {
    const ev = evaluateMcpPolicy(
      [
        remote('a', 'https://mcp.example.com/api'),
        remote('b', 'https://api.internal.example.com/mcp'),
        remote('c', 'https://external.example.com/mcp'),
        stdio('d', ['any', 'command']),
      ],
      [
        src('user-settings', '/u', {
          allowed: [
            { serverUrl: 'https://mcp.example.com/*' },
            { serverUrl: 'https://*.internal.example.com/*' },
          ],
        }),
      ],
    );
    expect(ev.allow!.rows.map((r) => r.verdict)).toEqual(['matches', 'matches', 'fails', 'fails']);
  });

  it('command-only allowlist: stdio must match a command; a remote has nothing to match', () => {
    const ev = evaluateMcpPolicy(
      [
        stdio('ok', ['npx', '-y', 'approved-package']),
        stdio('no', ['node', 'server.js']),
        remote('my-api', 'https://x.example.com/mcp'),
      ],
      [
        src('user-settings', '/u', {
          allowed: [{ serverCommand: ['npx', '-y', 'approved-package'] }],
        }),
      ],
    );
    expect(ev.allow!.rows.map((r) => r.verdict)).toEqual(['matches', 'fails', 'fails']);
  });

  it('mixed name and command: a name counts only for the transport with no stricter entries', () => {
    const ev = evaluateMcpPolicy(
      [
        stdio('local-tool', ['npx', '-y', 'approved-package']),
        stdio('local-tool2', ['node', 'server.js']),
        stdio('github', ['node', 'server.js']),
        remote('github', 'https://anything.example/mcp'),
        remote('other-api', 'https://anything.example/mcp'),
      ],
      [
        src('user-settings', '/u', {
          allowed: [{ serverName: 'github' }, { serverCommand: ['npx', '-y', 'approved-package'] }],
        }),
      ],
    );
    expect(ev.allow!.rows.map((r) => r.verdict)).toEqual([
      'matches',
      'fails',
      'fails',
      'matches',
      'fails',
    ]);
  });

  it('an empty allowlist allows nothing — different from unset', () => {
    const ev = evaluateMcpPolicy(
      [stdio('a', ['x']), remote('b', 'https://x.example/y')],
      [src('managed-settings', '/m', { allowed: [] })],
    );
    expect(ev.allow!.rows.every((r) => r.verdict === 'fails')).toBe(true);
  });

  it('allowlists merge across scopes — a user entry can admit what managed did not', () => {
    const ev = evaluateMcpPolicy(
      [stdio('mine', ['node', 'mine.js'])],
      [
        src('managed-settings', '/m', { allowed: [{ serverCommand: ['npx', 'approved'] }] }),
        src('user-settings', '/u', { allowed: [{ serverCommand: ['node', 'mine.js'] }] }),
      ],
    );
    expect(ev.allow!.rows[0]!.verdict).toBe('matches');
  });

  it('allowManagedMcpServersOnly from a managed source keeps only the managed allowlist', () => {
    const ev = evaluateMcpPolicy(
      [stdio('mine', ['node', 'mine.js'])],
      [
        src('managed-settings', '/m', {
          allowed: [{ serverCommand: ['npx', 'approved'] }],
          allowManagedMcpServersOnly: true,
        }),
        src('user-settings', '/u', { allowed: [{ serverCommand: ['node', 'mine.js'] }] }),
      ],
    );
    expect(ev.allow!.managedOnly).toEqual({ source: '/m' });
    expect(ev.allow!.rows[0]!.verdict).toBe('fails');
  });

  it('the flag in a user source does not narrow anything — only managed sources carry it', () => {
    const ev = evaluateMcpPolicy(
      [stdio('mine', ['node', 'mine.js'])],
      [
        src('managed-settings', '/m', { allowed: [{ serverCommand: ['npx', 'approved'] }] }),
        src('user-settings', '/u', {
          allowed: [{ serverCommand: ['node', 'mine.js'] }],
          allowManagedMcpServersOnly: true,
        }),
      ],
    );
    expect(ev.allow!.managedOnly).toBeUndefined();
    expect(ev.allow!.rows[0]!.verdict).toBe('matches');
  });

  it('an unreadable flag makes every verdict unevaluated — which pool applies cannot be said', () => {
    const ev = evaluateMcpPolicy(
      [stdio('a', ['x'])],
      [
        src('managed-settings', '/m', {
          allowed: [{ serverCommand: ['x'] }],
          allowManagedMcpServersOnly: 'unreadable',
        }),
      ],
    );
    expect(ev.allow!.rows[0]!.verdict).toBe('unevaluated');
  });

  it('a server that fails only clean entries is unevaluated when an entry was not evaluated', () => {
    const ev = evaluateMcpPolicy(
      [stdio('a', ['/home/me/bin/server'])],
      [
        src('user-settings', '/u', {
          allowed: [{ serverCommand: ['npx', 'other'] }, { serverCommand: ['${HOME}/bin/server'] }],
        }),
      ],
    );
    expect(ev.allow!.rows[0]!.verdict).toBe('unevaluated');
    expect(ev.allow!.unevaluated).toHaveLength(1);
  });
});
