/**
 * Docker isolation for sweep measurements: clean filesystem, no ambient
 * credentials, non-interactive, resource-capped. Network stays enabled because
 * npx/uvx launches fetch the package at startup — the isolation claim is
 * "credential-free clean environment", not an airgap, and each measurement
 * records the isolation actually used.
 */
export interface DockerOptions {
  /** Base image; default node:22-slim (use a uv image for python servers). */
  image?: string;
  /** Extra env var NAMES to pass through with dummy values. */
  dummyEnv?: string[];
  /** Container name, so a timed-out container can be force-removed. */
  containerName?: string;
}

// ECR Public / ghcr mirrors — Docker Hub pulls hang on some networks (observed
// on this machine 2026-08-16: hub pulls stall indefinitely while ECR works).
export const DEFAULT_NODE_IMAGE = 'public.ecr.aws/docker/library/node:22-slim';
export const DEFAULT_PYTHON_IMAGE = 'ghcr.io/astral-sh/uv:python3.12-bookworm-slim';

export interface IsolationRecord {
  docker: boolean;
  image?: string;
  network?: string;
  note?: string;
}

/**
 * Wrap a launch command line in `docker run`. The inner command is passed to
 * `sh -lc` inside the container; quoting is preserved by argv (no host shell).
 */
export function dockerize(
  commandLine: string,
  opts: DockerOptions = {},
): { command: string; argv: string[]; isolation: IsolationRecord } {
  const image = opts.image ?? (commandLine.trimStart().startsWith('uvx') ? DEFAULT_PYTHON_IMAGE : DEFAULT_NODE_IMAGE);
  const argv = [
    'run',
    '--rm',
    '-i',
    ...(opts.containerName ? ['--name', opts.containerName] : []),
    '--pull=missing',
    '--memory=1g',
    '--pids-limit=512',
    '--security-opt',
    'no-new-privileges',
    '-e',
    'HOME=/tmp',
    '-w',
    '/tmp',
    // Shared package caches across containers — packages only, no credentials.
    '-v',
    'mcp-ctx-npm-cache:/tmp/.npm-cache',
    '-e',
    'npm_config_cache=/tmp/.npm-cache',
    '-v',
    'mcp-ctx-uv-cache:/tmp/.uv-cache',
    '-e',
    'UV_CACHE_DIR=/tmp/.uv-cache',
  ];
  for (const name of opts.dummyEnv ?? []) {
    argv.push('-e', `${name}=dummy`);
  }
  argv.push(image, 'sh', '-lc', commandLine);
  return {
    command: 'docker',
    argv,
    isolation: {
      docker: true,
      image,
      network: 'bridge',
      note: 'network enabled for package fetch; clean FS, no host credentials',
    },
  };
}
