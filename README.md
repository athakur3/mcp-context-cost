# mcp-context-cost

[![npm](https://img.shields.io/npm/v/mcp-context-cost)](https://www.npmjs.com/package/mcp-context-cost)
[![CI](https://github.com/athakur3/mcp-context-cost/actions/workflows/ci.yml/badge.svg)](https://github.com/athakur3/mcp-context-cost/actions/workflows/ci.yml)

**What do the MCP servers in your config cost you before you type anything — and what did
that last config change add to every session you will ever run?**

Every MCP server you wire into an agent injects its tool schemas into the model's context on
every single request. You pay that whether or not the agent ends up using the tools, and no
client shows you the number. Point `audit` at your own MCP config:

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

  7,901 tokens of tool schemas — 4.0% of a 200,000-token context window.
  No default deferral is on record for claude-desktop, so every request
  carries these tokens before you type anything — an absence of a record
  about the client, not a measurement of it.

  heaviest tools
    sequential-thinking · sequentialthinking      990
    memory · search_nodes                         323

  trim: disabling 3 tools (sequential-thinking·sequentialthinking, memory·search_nodes,
  memory·open_nodes) would recover 1,635 tokens (20.7% of this config) — if your client
  supports per-tool filtering.
```

It finds configs for Claude Desktop, Claude Code (`~/.claude.json`, `.mcp.json`), Cursor,
VS Code (`.vscode/mcp.json`), and Windsurf — or pass `--config <path>`. Servers are measured
by the same path as the published leaderboard (dual `tools/list` capture, `o200k_base` over
canonical JSON), so a server in both places gets the same number. Nothing is written to your
project, and env var **values** are never read into the output — only their names.

Totals are reported per config file, never merged: a context window belongs to one client
session, so summing Cursor's servers into Claude Desktop's total would describe a session
nobody runs.

### Where this cost is paid in full, and where it is deferred away

Not every client puts every tool definition in context on every request, so the total above
is not automatically your bill. Which client reads the config, and how that client is
configured **on this machine**, decides it — and `audit` reads that rather than assuming it.

**Clients with no default deferral on record** — Claude Desktop, Cursor, VS Code, Windsurf.
The total is what every request carries, as in the example above. That sentence is an
absence of a record about those clients, not a measurement of them, and the report says so
in those words.

**Claude Code defers MCP tool definitions by default** (its **tool search**): they are not
in context at session start, and load when the model reaches for one. Three variables move
that, and `audit` reads all three — from the shell it runs in *and* from the `env` block of
Claude Code's own settings files (managed, `.claude/settings.local.json`,
`.claude/settings.json`, `~/.claude/settings.json`), because a machine that switched
deferral off in a settings file is not a machine running the default:

| setting | what the audit reports |
|---|---|
| nothing set (the default) | every definition deferred, at any size — no threshold applies |
| `ENABLE_TOOL_SEARCH=true` | same: every definition deferred |
| `ENABLE_TOOL_SEARCH=false` | deferral off — every request carries the full total |
| `ENABLE_TOOL_SEARCH=auto` / `auto:N` | deferred only once definitions reach 10% / N% of the context window |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` set | tool search off — read first, because `ENABLE_TOOL_SEARCH` cannot override it |
| `ANTHROPIC_BASE_URL` off `api.anthropic.com` | falls back to loading up front — consulted only while `ENABLE_TOOL_SEARCH` is unset |
| anything else in `ENABLE_TOOL_SEARCH` | not a documented value, so nothing is claimed from it |

On a machine where none of them is set, the same stack reads:

```
  7,901 tokens of tool schemas — 4.0% of a 200,000-token context window.
  claude-code defers every MCP tool definition (tool search), with no threshold —
  ENABLE_TOOL_SEARCH is unset here, which is the documented default. These tokens are NOT loaded
  up front at any size; they load when the model reaches for a tool. Size
  decides nothing here, so none of the arithmetic above changes the answer.
  Where this was read — Claude Code takes these variables from the shell it
  starts in and from the env block of its own settings files:
    this shell — sets none of them
    4 other settings file(s) it reads are not on this machine
  The full number is paid where deferral does not apply:
    a Microsoft Foundry deployment hosted on Azure, which rejects tool search server-side
    Google Cloud's Agent Platform on a model earlier than the Claude 4.5 generation
    a model without support for tool_reference blocks (before Sonnet 4.5 / Haiku 4.5 / Opus 4.5)
    a server pinned with "alwaysLoad": true, whose tools load at session start regardless
```

Set `ENABLE_TOOL_SEARCH=false` in that shell and the same config reports the opposite —
`loads every tool definition up front here`, naming the variable and the place it was read
from. Deferring is also not free: what a deferring client *does* load at session start —
tool names plus the server's `instructions` — is measured per server and published in the
leaderboard's `session start` column, and for at least one server in the published set it
costs **more** than loading the definitions would.

Three things the report will not do: it will not convert between units silently (in
threshold mode the stack is compared as a range, because the audit counts wire bytes and the
threshold is counted in what the client sends to the API — measured at 0.20×–1.92× across 20
servers); it will not pick a winner when two places on the machine set the same variable to
different values, or when a settings file exists and cannot be read; and it will not pass an
absence of a record off as a measurement. The first two print as unanswered questions. The
third prints as an answer that names itself: for the four discovered clients with no default
on record — `claude-desktop`, `cursor`, `vscode`, `windsurf` — the tokens are counted as
loaded up front, and the report says so in those words, "an absence of a record about the
client, not a measurement of it".
Full model, sources and dates: [METHODOLOGY §who pays the number](docs/METHODOLOGY.md#who-pays).

**In CI**, make it a gate — the bundlesize move for agents:

```bash
npx -y mcp-context-cost audit --config .mcp.json --budget 20000
# exits 1 when the stack exceeds the budget, so a PR adding a 25K-token server fails
```

The budget is an absolute ceiling. What a reviewer actually wants to know is what *this pull
request* did, so record a baseline and diff against it:

```bash
npx -y mcp-context-cost audit --config .mcp.json --json > baseline.json          # on main
npx -y mcp-context-cost audit --config .mcp.json --baseline baseline.json --max-increase 2000
```

```
diff vs baseline measured 2026-08-18T01:51:49.555Z (methodology 1.0)

  .mcp.json
    2,378  →  5,201   +2,823

    added             filesystem          — →     2,823  +2,823
    (1 server unchanged)

    This change adds 2,823 tokens to every request in this client — 1.2% → 2.6% of a
    200,000-token context window.

INCREASE FAIL:
  .mcp.json: +2,823 tokens per request, over the 2,000 allowed
```

> **Version note.** `--baseline` and `--max-increase` shipped in **0.4.0** (published
> 2026-08-18, and the current `latest`), so the command above gates on
> `npx -y mcp-context-cost@latest`. Pinning to **0.3.0 or earlier** does not gate, and fails
> quietly: those builds ignore flags they do not recognise, so the same command produces a
> plain audit and **exit 0** — a passing CI check on a gate that never ran. 0.4.0 rejects
> unknown flags with exit 2 instead. Pin at or above 0.4.0, or do not pin.

A baseline is just a stored `audit --json` report, so any artifact store works. Without
`--max-increase` the diff is informational and the exit code is unchanged.

[`examples/github-actions.yml`](examples/github-actions.yml) is the whole thing as a workflow:
measure the base branch, measure the PR, fail on the difference.

`--max-increase` fails on more than the number — it also fails whenever the increase could
not be established. A server that measured yesterday and won't start today takes its tokens
out of the total in exactly the way uninstalling it would, and reporting that as a saving is
the one mistake this tool must not make. So a server that crossed the measured/unmeasured
line, a config with no baseline, or a baseline config this run never found each fail the
gate and name themselves:

```
    Not a clean comparison: a server changed measured-ness between the two runs.
    The measured total moved −2,378, but that is not what your config did.

      memory: measured 2,378 in the baseline and could not be measured now — its cost is
              missing from the total, not gone from your config
      → true cost is at least 2,378 higher than the 0 measured now.

INCREASE FAIL:
  .mcp.json: a server changed measured-ness, so the change could not be established exactly
```

Add `--claude` to annotate each server with its Anthropic-request cost from the published
[Claude divergence](docs/METHODOLOGY.md#claude-divergence) run — an exact number when the
published capture hash matches what you have installed, `—` (silence, not a stale guess)
when it doesn't (today the run covers the top 20 measured servers, so most installs will
show a mix):

```
  server               tools  tokens   share   claude
  github                  44  54,422   95.8%   18,406
  memory                   9   2,378    4.2%       —
```

Flags: `--json` (full report on stdout, progress on stderr), `--budget N`,
`--baseline <report.json>`, `--max-increase N`, `--context N` (default 200,000),
`--timeout ms`, `--concurrency N`, `--docker`, `--claude`.

## Where the numbers come from

The number `audit` gives you is the same measurement, run across a curated set of public
servers — which is how you can tell it is a measurement and not this tool's opinion. It also
shows what you are choosing between: across the 69 servers measured, cost spans **1,700×**,
from the 32-token `postgres` reference server to github's 54,422. The table below starts at
markitdown's 64 tokens, an 850× spread; the full range is in
[results/leaderboard.md](results/leaderboard.md).

| server | context cost | tools |
|---|---:|---:|
| github (official) | **54,422 tokens** | 44 |
| brave-search | 25,456 | 8 |
| notion | 17,500 | 24 |
| playwright *(4.8M installs/week)* | 4,024 | 24 |
| filesystem (reference) | 2,823 | 14 |
| markitdown | 64 | 1 |

*(69 of 82 popular servers measured, sweeps of 2026-08-18 and 2026-08-19 — full table in
[results/leaderboard.md](results/leaderboard.md); every failure is listed with its reason.
Each measured server also has a [detail page](https://athakur3.github.io/mcp-context-cost/servers/)
showing which tools its tokens are in.)*

If you publish a server, the same measurement is available as a badge, so your users can see
the cost before they install rather than after:

```
[context cost | 12,430 tokens]   ← shields.io badge, linked to the methodology
```

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

Every published number is backed by a `measurement.json` containing the raw `tools/list`
capture, the SHA-256 of its canonical bytes, the pinned tokenizer (`o200k_base`), and the
exact launch command. Disputes reduce to a byte-level diff:

```bash
npx -y mcp-context-cost verify results/github/measurement.json
# OK github-mcp-server: 54422 tokens (o200k_base, methodology 1.0) — capture, hash, and count all agree

# or point it at a published measurement.json directly, no clone required
npx -y mcp-context-cost verify --remote https://raw.githubusercontent.com/athakur3/mcp-context-cost/main/results/github/measurement.json
```

Add `--json` for scripting (`{ ok, serverName, rederivedTokens, rederivedSha, problems, badge }`
on stdout, `badge` omitted on failure). Exit codes: `0` ok, `1` verification/measurement
failed, `2` usage error.

`audit` runs that same code path on your own machine and reports each server's
`canonicalSha256` in `--json`, so you can check that the version you installed is byte-identical
to the one that was published — which is exactly what `--claude` uses to decide whether it is
allowed to show you a number.

Full definition: [docs/METHODOLOGY.md](docs/METHODOLOGY.md) — what is counted, what the
number is *not*, config policy, failure taxonomy, frozen color bands, known divergences.

## What's in the repo

| path | what |
|---|---|
| `src/core/` | the measurement spec, executable — canonical form, tokenizer, bands, badge JSON |
| `src/sweep/` | raw-wire MCP stdio client + Dockerized batch sweep + leaderboard/dashboard generators |
| `src/audit/` | client-config discovery (5 clients, JSONC-tolerant), the per-stack report, and the baseline diff |
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

How many projects outside this repository actually display it is a dated reading rather
than a guess — [docs/adoption.md](docs/adoption.md), regenerated by `npm run adoption`,
which publishes the queries it ran and every file it examined. A zero there means the
search ran and found none; if it could not run, it says that instead of publishing a zero.

Or self-serve from CI via the (staged) mcp-tokens-action badge inputs — see
[upstream/action-patch.md](upstream/action-patch.md).

## Development

```bash
npm test                        # 403 TS tests incl. golden fixtures + dispute drills
npx tsc --noEmit                # typecheck
./upstream/tests/badge-test.sh  # 21 bash tests — byte-identical to the TS reference
npm run sweep:all -- --docker   # full curated sweep (Docker isolation)
```

Notable engineering choices: the MCP client is a deliberate ~220-line raw-wire
implementation (SDK schema-parsing can reorder keys, which would corrupt canonical bytes);
sweep servers run in credential-free Docker containers with recorded isolation; the badge
color bands are frozen against the observed distribution of the first full sweep.

## Status

Active. 46 of the 69 numbers come from the sweep of 2026-08-19 and 23 from 2026-08-18. Two
weekly jobs re-measure the set — one reference server (`memory`) every Monday, and a rotating
sixth of the list every Wednesday, so the full set turns over in six weeks — but treat the
leaderboard as a dated snapshot rather than a live feed. Badge PRs are open across the
ecosystem and [sd2k/mcp-tokens-action#5](https://github.com/sd2k/mcp-tokens-action/pull/5)
proposes the self-serve badge path upstream. See [ROADMAP.md](ROADMAP.md) for what's next —
contributions welcome, especially new `servers.yaml` entries.

MIT © 2026
