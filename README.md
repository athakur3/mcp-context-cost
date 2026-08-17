# mcp-context-cost

[![npm](https://img.shields.io/npm/v/mcp-context-cost)](https://www.npmjs.com/package/mcp-context-cost)
[![CI](https://github.com/athakur3/mcp-context-cost/actions/workflows/ci.yml/badge.svg)](https://github.com/athakur3/mcp-context-cost/actions/workflows/ci.yml)

**Reproducible context-cost measurement for MCP servers — for the one you publish, and for
the stack you actually run.**

Every MCP server you wire into an agent injects its tool schemas into the model's context
before any work happens. That cost is invisible — and it varies by **1,700×** across
popular servers:

| server | context cost | tools |
|---|---:|---:|
| github (official) | **54,422 tokens** | 44 |
| brave-search | 25,456 | 8 |
| notion | 17,500 | 24 |
| playwright *(4.8M installs/week)* | 4,024 | 24 |
| filesystem (reference) | 2,823 | 14 |
| markitdown | 64 | 1 |

*(57 of 82 popular servers measured, 2026-08-16 sweep — full table in
[results/leaderboard.md](results/leaderboard.md); every failure is listed with its reason.
Each measured server also has a [detail page](https://athakur3.github.io/mcp-context-cost/servers/)
showing which tools its tokens are in.)*

This project makes that cost **legible and disputable**:

```
[context cost | 12,430 tokens]   ← shields.io badge, linked to the methodology
```

## What does *your* setup cost?

The leaderboard measures one server at a time. You don't run one server — you run a stack.
Point `audit` at your own MCP config and it measures every server you actually have installed:

```bash
npx -y mcp-context-cost audit
```

```
claude-desktop  ~/Library/Application Support/Claude/claude_desktop_config.json
  server               tools  tokens   share
  filesystem              14   2,823   35.7%
  memory                   9   2,378   30.1%
  everything              13   1,708   21.6%
  sequential-thinking      1     992   12.6%
  ────────────────────────────────────────────
  total                   37   7,901

  Every request in this client carries 7,901 tokens of tool schemas — 4.0% of a
  200,000-token context window, before you type anything.

  heaviest tools
    sequential-thinking · sequentialthinking      990
    memory · search_nodes                         323
```

It finds configs for Claude Desktop, Claude Code (`~/.claude.json`, `.mcp.json`), Cursor,
VS Code (`.vscode/mcp.json`), and Windsurf — or pass `--config <path>`. Servers are measured
by the same path as the published leaderboard (dual `tools/list` capture, `o200k_base` over
canonical JSON), so a server in both places gets the same number. Nothing is written to your
project, and env var **values** are never read into the output — only their names.

Totals are reported per config file, never merged: a context window belongs to one client
session, so summing Cursor's servers into Claude Desktop's total would describe a session
nobody runs.

One nuance: Claude Code's tool search (default-on in recent versions) defers full MCP
schemas until used, loading only tool names at session start. Audit totals are the weight
of the schema surface itself — what loads upfront in clients without deferral (Claude
Desktop, Cursor, VS Code, Windsurf today), and what Claude Code's documented fallback
modes still load. Deferral-aware reporting is on the roadmap.

**In CI**, make it a gate — the bundlesize move for agents:

```bash
npx -y mcp-context-cost audit --config .mcp.json --budget 20000
# exits 1 when the stack exceeds the budget, so a PR adding a 25K-token server fails
```

Add `--claude` to annotate each server with its Anthropic-request cost from the published
[Claude divergence](docs/METHODOLOGY.md#claude-divergence) run — an exact number when the
published capture hash matches what you have installed, `—` (silence, not a stale guess)
when it doesn't (today the run covers the top 15 measured servers, so most installs will
show a mix):

```
  server               tools  tokens   share   claude
  github                  44  54,422   95.8%   18,406
  memory                   9   2,378    4.2%       —
```

Flags: `--json` (full report on stdout, progress on stderr), `--budget N`, `--context N`
(default 200,000), `--timeout ms`, `--concurrency N`, `--docker`, `--claude`.

## What it costs on Claude

The badge counts every byte a server returns. An Anthropic request carries only `name`,
`description`, and `input_schema` — and counts them with a denser tokenizer. Both effects are
now measured against a pinned model and published beside the badge, and they do not cancel:

| server | badge (o200k) | Claude (`claude-opus-5`) | |
|---|---:|---:|---|
| github | 54,422 | **18,406** | 81% of the capture is `annotations`/`outputSchema` metadata Claude never sees |
| notion | 17,500 | **33,560** | almost no metadata to drop, so the tokenizer difference dominates |

So the heaviest server on the badge is not the heaviest server on Claude. Per-server
breakdowns are on each [detail page](https://athakur3.github.io/mcp-context-cost/servers/);
the method is [Claude divergence](docs/METHODOLOGY.md#claude-divergence).

## Why trust the number?

Every badge is backed by a `measurement.json` containing the raw `tools/list` capture, the
SHA-256 of its canonical bytes, the pinned tokenizer (`o200k_base`), and the exact launch
command. Disputes reduce to a byte-level diff:

```bash
npx -y mcp-context-cost verify results/github/measurement.json
# OK github-mcp-server: 54422 tokens (o200k_base, methodology 1.0) — capture, hash, and count all agree

# or point it at a published measurement.json directly, no clone required
npx -y mcp-context-cost verify --remote https://raw.githubusercontent.com/athakur3/mcp-context-cost/main/results/github/measurement.json
```

Add `--json` for scripting (`{ ok, serverName, rederivedTokens, rederivedSha, problems, badge }`
on stdout, `badge` omitted on failure). Exit codes: `0` ok, `1` verification/measurement
failed, `2` usage error.

Full definition: [docs/METHODOLOGY.md](docs/METHODOLOGY.md) — what is counted, what the
number is *not*, config policy, failure taxonomy, frozen color bands, known divergences.

## What's in the repo

| path | what |
|---|---|
| `src/core/` | the measurement spec, executable — canonical form, tokenizer, bands, badge JSON |
| `src/sweep/` | raw-wire MCP stdio client + Dockerized batch sweep + leaderboard/dashboard generators |
| `src/audit/` | client-config discovery (5 clients, JSONC-tolerant) + the per-stack report |
| `src/cli.ts` | `audit` (measure your own stack), `verify` (re-derive any published number), `measure` |
| `spec/fixtures/` | golden vectors shared by the TypeScript and bash implementations |
| `tools/` | the one script that calls a network API (Claude divergence); kept out of the package so the library stays offline |
| `upstream/` | staged contribution to [sd2k/mcp-tokens-action](https://github.com/sd2k/mcp-tokens-action): `badge.sh` + action patch + tests |
| `servers.yaml` | 82 curated candidates with live install metrics and provenance |
| `results/` · `badges/` | measurements, leaderboard, history series, shields endpoint JSONs |
| `docs/` | methodology, dashboard, and a generated page per measured server |

## Measure your own server

```bash
npm ci
npm run sweep -- --name my-server --command "npx -y my-mcp-server"
cat badges/my-server.json   # strict shields.io endpoint JSON
```

Then in your README:

```markdown
[![context cost](https://img.shields.io/endpoint?url=<raw URL of badges/my-server.json>)](<link target>)
```

Point the link at the measurement behind the number — for servers in this sweep that is
`https://athakur3.github.io/mcp-context-cost/servers/<name>.html`; otherwise the
methodology page. A badge nobody can audit is decoration.

Or self-serve from CI via the (staged) mcp-tokens-action badge inputs — see
[upstream/action-patch.md](upstream/action-patch.md).

## Development

```bash
npm test                        # 105 TS tests incl. golden fixtures + dispute drills
npx tsc --noEmit                # typecheck
./upstream/tests/badge-test.sh  # 21 bash tests — byte-identical to the TS reference
npm run sweep:all -- --docker   # full curated sweep (Docker isolation)
```

Notable engineering choices: the MCP client is a deliberate ~150-line raw-wire
implementation (SDK schema-parsing can reorder keys, which would corrupt canonical bytes);
sweep servers run in credential-free Docker containers with recorded isolation; the badge
color bands are frozen against the observed distribution of the first full sweep.

## Status

Active. The leaderboard refreshes weekly; badge PRs are open across the ecosystem and
[sd2k/mcp-tokens-action#5](https://github.com/sd2k/mcp-tokens-action/pull/5) proposes the
self-serve badge path upstream. See [ROADMAP.md](ROADMAP.md) for what's next —
contributions welcome, especially new `servers.yaml` entries.

MIT © 2026
