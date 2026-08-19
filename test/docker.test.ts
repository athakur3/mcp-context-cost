import { describe, it, expect } from 'vitest';
import { dockerize } from '../src/sweep/docker.js';
import { retriesWithoutSharedCache } from '../src/sweep/run.js';

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

describe('shared package cache bypass', () => {
  it('mounts both shared caches by default', () => {
    const d = dockerize('npx -y demo');
    expect(d.argv).toContain('mcp-ctx-npm-cache:/tmp/.npm-cache');
    expect(d.argv).toContain('mcp-ctx-uv-cache:/tmp/.uv-cache');
    expect(d.argv).toContain('npm_config_cache=/tmp/.npm-cache');
    expect(d.argv).toContain('UV_CACHE_DIR=/tmp/.uv-cache');
    expect(d.isolation.note).not.toContain('cache bypassed');
  });

  it('drops the cache mounts and their env vars when noSharedCache is set', () => {
    const d = dockerize('npx -y demo', { noSharedCache: true });
    expect(d.argv.join(' ')).not.toContain('mcp-ctx-npm-cache');
    expect(d.argv.join(' ')).not.toContain('mcp-ctx-uv-cache');
    expect(d.argv.join(' ')).not.toContain('npm_config_cache');
    expect(d.argv.join(' ')).not.toContain('UV_CACHE_DIR');
    expect(d.isolation.note).toContain('shared package cache bypassed');
  });

  it('records the bypass in isolation.note without changing anything else about the run', () => {
    const warm = dockerize('npx -y demo', { dummyEnv: ['API_KEY'] });
    const cold = dockerize('npx -y demo', { dummyEnv: ['API_KEY'], noSharedCache: true });
    expect(cold.isolation.image).toBe(warm.isolation.image);
    expect(cold.isolation.network).toBe(warm.isolation.network);
    expect(cold.argv.slice(-3)).toEqual(warm.argv.slice(-3));
    expect(cold.argv).toContain('API_KEY=dummy');
  });

  it('composes with needsGit, naming both in the note', () => {
    const d = dockerize('uvx --from git+https://example.invalid/x.git x', {
      needsGit: true,
      noSharedCache: true,
    });
    expect(d.isolation.note).toContain('git installed');
    expect(d.isolation.note).toContain('shared package cache bypassed');
  });
});

describe('retriesWithoutSharedCache', () => {
  it('retries a docker startup-failure', () => {
    expect(retriesWithoutSharedCache('startup-failure', true, 'npx -y demo')).toBe(true);
  });

  it('does not retry a timeout or an auth wall — neither is a cache symptom', () => {
    expect(retriesWithoutSharedCache('timeout', true, 'npx -y demo')).toBe(false);
    expect(retriesWithoutSharedCache('auth-required', true, 'npx -y demo')).toBe(false);
  });

  it('does not retry a successful measurement', () => {
    expect(retriesWithoutSharedCache('measured', true, 'npx -y demo')).toBe(false);
    expect(retriesWithoutSharedCache('dynamic', true, 'npx -y demo')).toBe(false);
  });

  it('does not retry outside docker mode — there is no shared cache mount to drop', () => {
    expect(retriesWithoutSharedCache('startup-failure', false, 'npx -y demo')).toBe(false);
  });

  it('does not retry a command that is already its own docker run', () => {
    expect(retriesWithoutSharedCache('startup-failure', true, '  docker run --rm -i thing')).toBe(false);
  });
});
