import { describe, it, expect } from 'vitest';
import { dockerize } from '../src/sweep/docker.js';

describe('dockerize', () => {
  it('runs the command as-is when git is not needed', () => {
    const d = dockerize('uvx mcp-server-time');
    const shArgs = d.argv.slice(-3);
    expect(shArgs).toEqual(['sh', '-lc', 'uvx mcp-server-time']);
    expect(d.isolation.note).not.toContain('git');
  });

  it('prefixes a git-install step when needsGit is set, without touching the command itself', () => {
    const d = dockerize('uvx --from git+https://github.com/redis/mcp-redis.git redis-mcp-server', {
      needsGit: true,
    });
    const shCommand = d.argv[d.argv.length - 1];
    expect(shCommand.startsWith('command -v git >/dev/null')).toBe(true);
    expect(shCommand).toContain('apt-get install -y -qq --no-install-recommends git');
    expect(shCommand.endsWith('uvx --from git+https://github.com/redis/mcp-redis.git redis-mcp-server')).toBe(true);
    expect(d.isolation.note).toContain('git installed');
  });

  it('injects the literal dummy value for a dummyEnv name with no override', () => {
    const d = dockerize('uvx mcp-neo4j-cypher', { dummyEnv: ['NEO4J_USERNAME'] });
    expect(d.argv).toContain('NEO4J_USERNAME=dummy');
  });

  it('uses the per-name override instead of the literal dummy value', () => {
    const d = dockerize('uvx mcp-neo4j-cypher', {
      dummyEnv: ['NEO4J_URI', 'NEO4J_USERNAME'],
      dummyEnvValues: { NEO4J_URI: 'bolt://localhost:7687' },
    });
    expect(d.argv).toContain('NEO4J_URI=bolt://localhost:7687');
    expect(d.argv).toContain('NEO4J_USERNAME=dummy');
  });

  it('never changes the recorded isolation.docker/image/network shape', () => {
    const withoutGit = dockerize('npx -y demo');
    const withGit = dockerize('npx -y demo', { needsGit: true });
    expect(withoutGit.isolation.docker).toBe(true);
    expect(withGit.isolation.docker).toBe(true);
    expect(withGit.isolation.image).toBe(withoutGit.isolation.image);
    expect(withGit.isolation.network).toBe(withoutGit.isolation.network);
  });
});
