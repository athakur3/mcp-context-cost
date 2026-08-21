# Changelog

## Unreleased

Where a change lands when it is made, rather than in the release after it. Cutting a version
renames this heading to that version and dates it. Every other section here describes bytes
someone can install; this one describes the trunk, which is the difference to hold in mind
while reading it.

- **The public check on the commit people install stops depending on what the machine
  running it had cached.** Four test files spawned the built CLI through `npx tsx` from a
  temporary directory outside the repository, so the `tsx` this project pins was off the
  resolution path and npx fetched its own copy from the registry at test time; four such
  spawns racing a cold shared cache is what turned CI red on the exact commit published as
  0.7.0, with nothing about the product changed between the green run before it and that
  one. They now run the `tsx` this repository locks, under the running node binary, and a
  guard in the suite fails if any test file goes back through `npx`. No change to the
  published package.
- **The front page stops stating a posture for the one machine the command refuses to
  answer for.** README's deferral table routed a settings `env` block holding the JSON
  boolean `false` to its `ENABLE_TOOL_SEARCH=false` row and told that reader deferral was
  off and every request carries the full total; `audit` on that machine says whether these
  tokens are deferred cannot be said. The table now carries that machine as its own row,
  and the closing list of what the report will not answer names all four refusals the
  resolver returns rather than two. README is the page inside the package, so this is a
  change to what an install carries.

## 0.7.0 — 2026-08-21

Two places that answered for a machine they had not established, and both now say what they
actually know.

- **A config that declares servers and switches every one of them off is told that, not
  that it declares nothing.** 0.6.0 dropped a `disabled: true` entry before anything counted
  it, found no servers left, and printed the sentence written for a file with no MCP block
  at all — a false statement about a file it had opened, parsed, and read the switched-off
  entries out of. The difference is now recorded at the only point it is still visible,
  before the off entries are dropped, and `audit` names per config either the servers it
  declares and switched off or that it declares none at all. On the same two-server file,
  0.6.0 prints `an MCP client config was found, and it declares no servers`; 0.7.0 prints
  `an MCP client config was found, and it has no server to measure` followed by
  `declares 2 servers, and every one of them is switched off: linear, redis`. `--json`
  carries it as a field rather than as prose: the `emptyConfigs` entry gains
  `allDisabled: [names]`. There is nothing to total either way, so neither gets a report
  line and both still exit 1; a name switched off in one block and live in another is a live
  server and is not reported as both; an unreadable config is still a problem rather than an
  empty one, and a config that is not on the machine still leaves no trace at all. The
  distinction is only reached when **no** config on the machine has a server — on a machine
  holding one live config beside an all-off one, the off one is not mentioned.
- **The published methodology stops predicting a posture for the machine the command
  refuses to answer for.** `docs/METHODOLOGY.md` §who-pays routed a machine whose settings
  hold the deciding variable as a JSON boolean straight past its decision table into
  "otherwise / nothing set anywhere", and told the reader every definition was deferred by
  default — the opposite of what 0.6.0's own refusal says when run there. The table now
  carries the unreadable value as its own row, refused at whichever of the three reads
  reaches it, and says in that row that a settings file holding `false` rather than
  `"false"` is this row and not the `false` row above it. The precedence sentence says the
  first place that sets a variable at all wins, readably or not, so a readable value above
  an unreadable one still decides and one beneath it decides nothing; the read / absent /
  unreadable mark is stated as the file's state rather than the value's; and the list of
  honest non-answers names the fourth one the code returns. Documentation only — no code
  moved, and this page is published on the docs site rather than inside the package, which
  ships `dist/`, `README.md` and `LICENSE`.

## 0.6.0 — 2026-08-21

Two things `audit` says changed, and both are places where it used to state an answer it
did not have.

- **A client config that was found and declares no servers is told apart from no client at
  all.** On a machine with Claude Code and Claude Desktop installed, both config files
  present and parsing cleanly and both declaring nothing, `audit` printed the sentence
  written for a machine with no MCP client anywhere — and sent the reader looking for an
  install they already have. Such a config is now carried through as itself: it gets no
  report line, because it has no total, but `audit` names each client and the file it read
  and says they were read and parsed and there is simply nothing declared to measure. Still
  exit 1, and still nothing measured. An unreadable config stays a problem, and a file that
  is not on the machine still leaves no trace at all — that is the direction being told
  apart. `--json` gains a top-level `emptyConfigs: [{client, source}]`.
- **A deferral setting held as something the audit cannot read is an unknown, not an
  unset.** The settings reader kept `ENABLE_TOOL_SEARCH` and its two companions only when
  the value was a string. `"ENABLE_TOOL_SEARCH": false` — the JSON boolean, which is what
  a person editing `settings.json` by hand writes — left a file that looked exactly like a
  file setting none of them, so the report reached the documented default and said these
  tokens are not loaded up front at any size. That was the one path in this model that
  states a wrong answer rather than no answer. The variable is now carried as set here
  unreadably: the report says the file sets it, says what it is set to is unknown, and
  gives no verdict at all. Precedence still decides, so a readable value in a
  higher-precedence file wins over an unreadable one beneath it, and an unreadable
  `ANTHROPIC_BASE_URL` behind an explicit `ENABLE_TOOL_SEARCH` refuses nothing. `--json`
  carries `unresolved: "value-unreadable"` and, per source, the variable **names** held
  unreadably — values are still never published.

## 0.5.0 — 2026-08-20

- **`audit` reads the deferral posture of each client it discovers.** For a Claude Code
  config it reads the setting that actually decides whether tool definitions are withheld
  from the context window, and says how far the stack sits from the threshold that
  activates it. The number stops being unconditional: you are told whether these tokens
  are loaded up front *here*, and what decides it.
- **An absence of a record is never printed as a measurement.** For the four discovered
  clients with no default on record — `claude-desktop`, `cursor`, `vscode`, `windsurf` —
  the tokens are counted as loaded up front and the report says so in those words. The
  front page now describes that behaviour instead of promising a silence the tool does
  not keep.
- **Badge adoption has an instrument** (`tools/measure-adoption.ts`, `docs/adoption.md`).
  How many third-party projects actually display the badge is now a reading, so a zero
  can be told apart from never having looked.
- **The front page agrees with the repository.** Test counts, measurement dates, the size
  of the measured set, and the version note are re-derived from what is on disk rather
  than copied from prose that cites them.

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
