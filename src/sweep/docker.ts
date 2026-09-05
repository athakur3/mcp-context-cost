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
   * Debian packages to install before launch, for a server whose runtime needs
   * a native library the slim base image does not carry.
   *
   * The same argument as `needsGit`, and the same shape: these are libraries a
   * user's own machine already has, so installing them moves the container
   * *towards* the conditions a plain `npx -y` run would find rather than away
   * from them. `azure` is the case — a .NET server that fails on
   * `node:22-slim` with "Couldn't find a valid ICU package", and again on
   * libssl once ICU is satisfied. With both present it measures.
   *
   * Distinct from an env var that changes the server's own behaviour (see
   * `elasticsearch` and `OTEL_SDK_DISABLED`), which is a different decision.
   * The isolation record names what was installed either way, so a reader can
   * see that the container was not the plain one.
   */
  aptPackages?: string[];
  /**
   * Extra `-v` bind mounts, verbatim (`host:container:ro`). Used to hand a
   * host-verified binary into the container (the cross-check CLI); mounts here
   * should be read-only so the isolation claim — clean FS, no host credentials
   * — survives them.
   */
  binds?: string[];
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

/** The image a launch command gets when the entry does not name one. */
export function defaultImageFor(commandLine: string): string {
  return commandLine.trimStart().startsWith('uvx') ? DEFAULT_PYTHON_IMAGE : DEFAULT_NODE_IMAGE;
}

/**
 * Docker failed, not the server. A measurement that ends this way is a
 * statement about this machine — the daemon, the registry, the network — and
 * must never be recorded as the server's startup-failure: the 2026-08-26
 * re-sweep published exactly that lie about `sequential-thinking` when the
 * runner could not pull the base image, and the harness guard never saw it
 * because it watches for populations of regressions, not single rows.
 */
export class DockerHarnessFault extends Error {}

/**
 * Whether a capture-failure message describes `docker run` failing as docker
 * rather than the contained server failing as itself.
 *
 * Docker reserves exit code 125 for its own failures, but a contained process
 * that exits 125 passes that code through indistinguishably — so the code alone
 * is not enough, and docker's own stderr voice ("Unable to find image …",
 * "docker: Error response from daemon: …", "docker: Cannot connect …") is
 * required alongside it. Only meaningful for a command this code wrapped in
 * `docker run` itself; a config whose command is already `docker run …` owns
 * its exit codes.
 */
export function isDockerRunFailure(message: string): boolean {
  return /server exited \(code 125\)/.test(message) && /Unable to find image|docker: /.test(message);
}

export interface EnsureImageOptions {
  /** Run one docker invocation — injectable so tests never need a daemon. */
  run?: (args: string[]) => Promise<{ code: number | null; stdout?: string; stderr: string }>;
  /** Waits between pull attempts; attempts = delays + 1. */
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
}

function runDocker(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return import('node:child_process').then(
    ({ spawn }) =>
      new Promise((resolve) => {
        const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => (stdout = (stdout + chunk).slice(-4000)));
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk: string) => (stderr = (stderr + chunk).slice(-4000)));
        child.on('error', (err) => resolve({ code: null, stdout, stderr: String(err.message) }));
        child.on('exit', (code) => resolve({ code, stdout, stderr }));
      }),
  );
}

async function ensureImageOnce(image: string, opts: EnsureImageOptions): Promise<void> {
  const run = opts.run ?? runDocker;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delays = opts.delaysMs ?? [2_000, 8_000];
  const noDocker = (stderr: string) =>
    new DockerHarnessFault(`docker is not runnable on this machine: ${stderr.trim() || 'spawn docker failed'}`);

  const inspect = await run(['image', 'inspect', image]);
  if (inspect.code === 0) return;
  if (inspect.code === null && /ENOENT/i.test(inspect.stderr)) throw noDocker(inspect.stderr);

  let lastStderr = '';
  for (let attempt = 1; attempt <= delays.length + 1; attempt++) {
    const pull = await run(['pull', image]);
    if (pull.code === 0) return;
    lastStderr = pull.stderr;
    // A missing docker binary cannot appear on a later attempt.
    if (pull.code === null && /ENOENT/i.test(pull.stderr)) throw noDocker(pull.stderr);
    if (attempt <= delays.length) await sleep(delays[attempt - 1]);
  }
  throw new DockerHarnessFault(
    `could not pull ${image} after ${delays.length + 1} attempts — ` +
      `a statement about this machine and its registry path, not about any server: ${lastStderr.slice(-300).trim()}`,
  );
}

const ensured = new Map<string, Promise<void>>();

/**
 * Make sure a base image is present before any container needs it, retrying the
 * pull. `docker run --pull=missing` pulls lazily, so a transient registry
 * failure lands mid-measurement and gets read as the server refusing to start —
 * pulling up front, with retries, is what keeps a registry hiccup from ever
 * reaching a measurement. Failures throw `DockerHarnessFault`.
 *
 * Results are memoized per image for the life of the process (only on the real
 * docker path — injected runners are for tests), so concurrent sweep workers
 * share one pull, and an image that could not be pulled after retries is not
 * re-attempted by every remaining server in the sweep.
 */
export function ensureImage(image: string, opts: EnsureImageOptions = {}): Promise<void> {
  if (opts.run) return ensureImageOnce(image, opts);
  let p = ensured.get(image);
  if (!p) {
    p = ensureImageOnce(image, opts);
    // Mark handled so a memoized rejection never trips unhandled-rejection
    // before the next caller awaits it.
    p.catch(() => {});
    ensured.set(image, p);
  }
  return p;
}

/**
 * `uname` names, in Docker's vocabulary. Explicit rather than derived: an
 * unrecognised machine name returns nothing, because a mapping guessed from a
 * pattern would be the same kind of inference this function exists to remove.
 */
const UNAME_ARCH: Record<string, string> = {
  x86_64: 'amd64',
  amd64: 'amd64',
  aarch64: 'arm64',
  arm64: 'arm64',
  armv7l: 'arm/v7',
  armv6l: 'arm/v6',
  i386: '386',
  i686: '386',
  ppc64le: 'ppc64le',
  s390x: 's390x',
  riscv64: 'riscv64',
};

/** Parse `uname -sm` output into `<platform>/<arch>`, or null if it is not that. */
export function platformFromUname(output: string): string | null {
  const [kernel, machine] = output.trim().split(/\s+/);
  const arch = UNAME_ARCH[(machine ?? '').toLowerCase()];
  if (!kernel || !arch) return null;
  return `${kernel.toLowerCase()}/${arch}`;
}

/**
 * The platform a container for this image actually runs as, asked of a
 * container rather than inferred from the machine that starts one.
 *
 * `isolation.arch` exists to tell a broken server apart from one that ships no
 * build for the architecture it was tried on, and it was being derived instead
 * of observed: the platform half was assumed to be `linux` and the
 * architecture half was the *host's* `process.arch`. Nothing here passes
 * `--platform`, but `docker run` honours `DOCKER_DEFAULT_PLATFORM` and an
 * image with no manifest for the host is emulated — so an amd64 container on
 * an Apple Silicon laptop recorded `linux/arm64`. A field that can be wrong
 * about the one thing it exists to establish is worse than no field.
 *
 * The obvious cheap answer does not work, which is why this starts a
 * container. `docker image inspect` reports the variant the local store
 * prefers, and on this machine 2026-09-05 it answered `linux/arm64` for a tag
 * whose container, under `DOCKER_DEFAULT_PLATFORM=linux/amd64`, came up as
 * `x86_64` — the same wrong answer as the host inference, reached a different
 * way. Only the container knows.
 *
 * One `docker run` per image, memoized for the life of the process, so a sweep
 * pays it about twice: once for the node base and once for the python one.
 * Returns null when docker cannot say, leaving `arch` absent — which the
 * record already documents as "unknown, never the same as yours".
 */
export async function containerPlatform(image: string, opts: EnsureImageOptions = {}): Promise<string | null> {
  const run = opts.run ?? runDocker;
  if (!opts.run) {
    const cached = platforms.get(image);
    if (cached !== undefined) return cached;
  }
  const r = await run(['run', '--rm', '--pull=missing', image, 'uname', '-sm']);
  const platform = r.code === 0 ? platformFromUname(String(r.stdout ?? '')) : null;
  if (!opts.run) platforms.set(image, platform);
  return platform;
}

const platforms = new Map<string, string | null>();

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
  const image = opts.image ?? defaultImageFor(commandLine);
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
  for (const bind of opts.binds ?? []) {
    argv.push('-v', bind);
  }
  for (const name of opts.dummyEnv ?? []) {
    argv.push('-e', `${name}=${opts.dummyEnvValues?.[name] ?? 'dummy'}`);
  }
  const gitPrefix = opts.needsGit
    ? 'command -v git >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq --no-install-recommends git >/dev/null 2>&1); '
    : '';
  // Package names are validated by the schema check before they reach here, and
  // they are joined into a shell word list — so the schema's character class is
  // what keeps this from being an injection point.
  const packages = opts.aptPackages ?? [];
  const aptPrefix = packages.length
    ? `apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq --no-install-recommends ${packages.join(' ')} >/dev/null 2>&1; `
    : '';
  argv.push(image, 'sh', '-lc', gitPrefix + aptPrefix + commandLine);
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
        // Named rather than summarised: a record whose container carried extra
        // libraries has to say which, or the number is not reproducible from it.
        (packages.length ? `, installed ${packages.join(' ')}` : '') +
        (opts.noSharedCache ? ', shared package cache bypassed' : ''),
    },
  };
}
