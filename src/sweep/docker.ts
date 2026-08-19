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
  /**
   * Override the literal `dummy` value for specific `dummyEnv` names. Some
   * servers parse an env var's shape before ever reaching tools/list (a URI
   * scheme, a URL) and crash on a value that isn't real-looking rather than
   * a value that isn't a real credential — e.g. `NEO4J_URI=dummy` fails
   * `neo4j.exceptions.ConfigurationError` before the driver is even asked to
   * connect. A locally-scoped placeholder (`bolt://localhost:7687`) clears
   * that parse step without providing a working credential.
   */
  dummyEnvValues?: Record<string, string>;
  /** Container name, so a timed-out container can be force-removed. */
  containerName?: string;
  /**
   * Install `git` inside the container before launch. The slim base images
   * carry no VCS, so `uvx --from git+...` installs fail with "Git executable
   * not found" — this only prefixes the containerized invocation, never the
   * recorded `launchCommand`, so the published command stays what a user with
   * git already on PATH would actually run.
   */
  needsGit?: boolean;
  /**
   * Skip the shared npm/uv cache volumes, paying a cold install for a clean one.
   *
   * The caches are what make a re-sweep minutes instead of hours, but a cache
   * entry can go bad and stay bad: npm remembers a failed postinstall, and every
   * later install that resolves through it fails the same way. Observed
   * 2026-08-19 — a cached `esbuild@0.25.12` whose postinstall exits 1 made
   * `npx -y @shopify/dev-mcp@latest` exit 1 with no output, against a server that
   * installs and answers fine from an empty cache. Nothing in the exit code tells
   * that apart from a genuinely broken server, so the sweep retries here rather
   * than publishing the downgrade.
   */
  noSharedCache?: boolean;
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
    ...(opts.noSharedCache
      ? []
      : [
          '-v',
          'mcp-ctx-npm-cache:/tmp/.npm-cache',
          '-e',
          'npm_config_cache=/tmp/.npm-cache',
          '-v',
          'mcp-ctx-uv-cache:/tmp/.uv-cache',
          '-e',
          'UV_CACHE_DIR=/tmp/.uv-cache',
        ]),
  ];
  for (const name of opts.dummyEnv ?? []) {
    argv.push('-e', `${name}=${opts.dummyEnvValues?.[name] ?? 'dummy'}`);
  }
  const gitPrefix = opts.needsGit
    ? 'command -v git >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq --no-install-recommends git >/dev/null 2>&1); '
    : '';
  argv.push(image, 'sh', '-lc', gitPrefix + commandLine);
  return {
    command: 'docker',
    argv,
    isolation: {
      docker: true,
      image,
      network: 'bridge',
      note:
        'network enabled for package fetch; clean FS, no host credentials' +
        (opts.needsGit ? ', git installed' : '') +
        (opts.noSharedCache ? ', shared package cache bypassed' : ''),
    },
  };
}
