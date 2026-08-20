# Changelog

## 0.4.0 — 2026-08-18

- **`audit --baseline <report.json>` + `--max-increase N`**: diff this run against a stored
  earlier `audit --json` report and gate on the difference. `audit` alone answers "what does
  my stack cost", which a reviewer has to form an opinion about; the diff answers what *this
  change* adds to every request from this client for as long as it stays. A baseline is just
  a stored `audit --json` report, so there is no new format and no new store.
  - The gate fails whenever the increase could not be **established**, not only when it is
    too large. A server that crossed the measured/unmeasured line, a config with no baseline,
    and a baseline config this run never found each exit 1 and name themselves — a server
    that measured yesterday and won't start today removes its tokens from the total exactly
    the way uninstalling it would, and reporting that as a saving is the one mistake this
    tool must not make.
- **Unknown flags are now a usage error (exit 2).** 0.3.0 and earlier ignored what they did
  not recognise, so the `--baseline`/`--max-increase` command in the README ran a plain audit
  against them and exited 0 — a passing CI check on a gate that never ran. Caught by an
  adversarial pass over this project's own tool.
- `audit --budget N` says what to drop, not just that you are over: a heaviest-first plan
  that gets the config under its limit, with the running arithmetic shown.
- `audit` names the 3 heaviest tools in each config and what disabling them would recover
  (tokens and share of that config's total), for clients that support per-tool filtering.
  Omitted rather than printed as a hollow 0% when there is nothing to trim.
- `audit --claude` annotates each measured server with its Anthropic-request cost from the
  published `tools-delta/v1` divergence run — an exact number when the published capture hash
  matches the local install, silence rather than a stale guess when it does not, and a
  recorded problem rather than a crash when the fetch fails. `--divergence-url` overrides the
  source.
- `measure --remote <url>`: one-off measurement of a remote server through the `mcp-remote`
  bridge, defaulting `--name` to a slug of the URL's hostname. Mirrors `verify --remote`.
- `examples/github-actions.yml`: the PR gate as a copy-pasteable workflow — measure the base
  branch, measure the head, fail on the difference.
- Dashboard: cost-over-time sparklines on leaderboard rows, built from each server's
  `results/history.csv` series. Servers with a single sweep on record show no line yet.
- Sweep isolation installs `git` in the container for git-backed launches (`uvx --from
  git+…`), via a per-server `needsGit` flag that does not touch the recorded launch command.
  `redis` and `serena` measure clean as a result.
- Fixed 6 startup-failures that were upstream, not here: `mcp` 2.0.0 removed the
  decorator-based low-level `Server` API that `git`, `fetch`, `time`, `sqlite`,
  `postgres-mcp` and `obsidian` are written against, so a fresh install of any of them fails
  for any user. Their launch commands now pin `mcp<2`, which fixes startup — not this
  project's code.

## 0.3.0 — 2026-08-17

- **`audit`**: measure the servers you actually have installed, not one at a time.
  Discovers MCP configs for Claude Desktop, Claude Code (`~/.claude.json` including
  per-project blocks, and `.mcp.json`), Cursor, VS Code (`.vscode/mcp.json`) and Windsurf,
  or takes `--config <path>` (repeatable). Reports each config's total, per-server share,
  share of the context window, the heaviest individual tools, and every server it could not
  measure with the reason.
  - `--budget N` exits 1 when the stack exceeds N tokens — a CI gate for agent repos. The
    gate is evaluated against the *heaviest* config found, not the average.
  - `--json` emits the whole report on stdout (progress goes to stderr). Env var **values**
    are never included — only names, same rule as `measurement.json`.
  - Totals are per config file and never merged across clients: a context window belongs to
    one client session. A server appearing in two configs is measured once and counted in
    both.
  - Measurement is the leaderboard's own path (dual `tools/list` capture, o200k_base over
    canonical bytes, full failure taxonomy), so a server measured here and in the sweep
    produces the same number. No color band is applied to a stack total — the bands were
    frozen against the per-server distribution and don't describe a sum.
  - Writes nothing to the working directory.
- Config parsing tolerates comments and trailing commas (VS Code's `mcp.json` allows both,
  and hand-edited configs pick them up), with string literals respected so a `//` inside a
  URL or description survives.
- `measureServer` gains `argv` (exact argv from a config, so paths containing spaces are not
  re-split) and `persist: false` (in-memory measurement).
- Fixed: `src/sweep/run.ts` treated any entry-point path ending in `run.ts`/`run.js` as
  itself, so adding `src/audit/run.ts` made unrelated scripts print its usage and exit 2.
  The check now compares resolved paths.

## 0.2.0 — 2026-08-17

- `verify --remote <url> [--json]`: fetch and verify a published `measurement.json`
  directly from a URL, no clone required. 15s request timeout.
- `verify --json`: machine-readable output (`{ ok, serverName, rederivedTokens,
  rederivedSha, problems, badge }`); documented exit codes (0 ok, 1 verification/
  measurement failed, 2 usage error).
- Claude divergence column (`tools-delta/v1`): the top 15 servers measured through Anthropic's
  `count_tokens` against a pinned model, published in the leaderboard and broken down per
  server into field selection (MCP-only fields an Anthropic request cannot carry) and
  tokenizer/framing. Closes the methodology's "planned" promise. `results/divergence.json`
  records the model, the date, and the capture hash each row was computed from, so a re-sweep
  marks a row stale rather than leaving it mismatched. The o200k definition and every
  published badge number are unchanged.
- `leaderboard.csv` gains `claudeTokens` and `claudeModel` (appended, so existing parsers
  keep working).

- Per-server detail pages (`docs/servers/`): the badge's click-through now lands on a page
  showing where that server's tokens are, tool by tool, plus launch command, isolation,
  canonical hash and the `verify` command. Generated by `src/sweep/regen.ts`; no package
  change, so the published CLI is unaffected.
- Dashboard rows and leaderboard server names link to those pages.
- Fixed two links on the published docs site that pointed outside `docs/` and 404'd.

## 0.1.0 — 2026-08-16

Initial public release.

- Methodology v1.0: canonical `tools/list` measurement, o200k_base, published raw captures
  with SHA-256 — every number re-derivable in five lines
- Sweep of 82 curated servers (57 measured; failures documented with reasons)
- Ranked leaderboard + per-tool breakdowns; color bands frozen against the observed
  distribution
- shields.io endpoint badges, refreshed weekly
- `mcp-context-cost` CLI: `verify` (re-derive any published measurement) and `measure`
- `results/history.csv`: per-(date, server) token series for cost-over-time tracking
- Badge-output contribution proposed upstream to sd2k/mcp-tokens-action (#5)
