# Roadmap

Where this project is headed, and what a contributor can pick up. What already shipped is in
[CHANGELOG.md](CHANGELOG.md) and the git history — **a phase leaves this file when it ships**,
so the plan stays short and stays forward-looking. Phases 0, 1 and 2 shipped on 2026-09-05,
phase 3 followed as `0.14.0` and phase 4 as `0.15.0`; all five have left it, and what they
built, and what they corrected, is in the changelog sections from `0.12.0` to `0.15.0`.

Dated **2026-09-08**. Every item names the evidence it rests on, so you can check whether it is
still true before starting it. Items marked *(maintainer)* need an account or a decision only
the maintainer has. Contributions welcome on any item, especially new `servers.yaml` entries.

**This file states dated readings, never live counts.** A reading carries the day it was taken
and stays true; a count is wrong by the next sweep, and a plan is the last place anyone thinks
to look for a stale number. The current figures are on the [README](README.md) and the
[dashboard](https://athakur3.github.io/mcp-context-cost/dashboard.html), stated once, where
regen keeps them honest.

**Check an item's premise before starting it.** Across phases 1 to 5 the pattern was exact
every time: an item that quoted the record held up, and an item that inferred a cause from a
category did not — the symptom was real in every case, the mechanism behind it often was not.
So the first hour of a phase re-reads the records its items name and either confirms the
sentence or rewrites it. It is the same discipline this project applies to its own published
numbers: a claim is worth what its evidence is worth, including a claim in here. Which items
were wrong, and about what, is in the changelog and the git history — this file states the
rule, not the tally.

## Where it stands

The measurement and its gates are further along than their audience. The adoption reading of
**2026-09-07** found zero projects displaying the badge, three weeks into published history.
So the work here is two kinds — keeping the published data honest, which is the discipline the
project exists for, and getting it in front of the people it is for. Every
technical item below is worth less than one adopter, which is why the distribution track was
ordered ahead of the technical ones; it ran on **2026-09-05**. The next reading is due
**2026-09-19**, and it decides the code levers.

## The phases at a glance

**Phases carry an order, not a schedule.** Nothing here has a start date, because a date on
development work is wrong in both directions: it rushes what is not ready and, more often,
delays what is. This file said phase 3 opened on 2026-09-21 for no better reason than that
phase 2 had been drawn as running to the 25th — and phase 2 finished on the 5th, five days
before it was scheduled to begin. The column below says what a phase is waiting for, which is
the only thing that was ever true. Dates live where a date is the point: a post, a dated
reading, the re-sweep cadence. They are all on the distribution track.

| phase | goal | waiting on | exit, in one line |
|---|---|---|---|
| **5** | The data tells its story | tool vectors on both sides of most movements | a state-of report with per-tool attribution (rotation length decided on evidence, 2026-09-06) |
| **∥** | Distribution *(maintainer)* | its own calendar, and someone else's answer | a badge merged somewhere that is not this repository |

---

## Phase 5 — The data tells its story

**Goal.** A state-of report says which *tools* grew, and the rotation is as short as
the runner allows.

**The September edition was withdrawn on 2026-09-08**, so this is the report rather than a
second one. It attributed 81% of github's capture to `annotations`/`outputSchema` metadata —
a server that ships no `outputSchema` at all and 1.7% annotations, the 78% being `icons` — and
it published a badge figure from a divergence row computed against bytes already re-swept,
which contradicted its own headline nineteen lines above. Neither error was reachable by any
guard: the file was hand-written, outside `PAGE_FILES`, and regen never wrote it, so
`regenIsAFixedPoint` passed on it unconditionally. Whatever replaces it states its numbers
through claims regen maintains.

**The rotation half is settled**, on 2026-09-06, by dispatching it rather than arguing about
it: a `shards=3` slice measured 34 servers in 3m46s against the job's 120-minute cap, and the
slowest weeks on record — the two half-set slices of 2026-09-04, 52 servers in 61 and 62
minutes — leave a third of the list far inside it either way. The schedule cuts the list into
three, every row comes round within three Wednesdays, and `resweep.yml` carries the timings
beside the number they chose. What remains here is the report, and it waits on data.

**Scope.**
- [ ] **State-of report.** Waiting on data rather than on a date: tool vectors began
      accruing 2026-09-04 and a movement needs one on both sides, so the report can be written
      once the rotation has come round, which is now three weeks rather than six. It can say
      which *tools* grew and which releases moved them, not only which servers. It can also
      say what held — the movement report separates confirmed unchanged costs from the ones
      with nothing to compare, and "most servers do not move, and the ones that do move up" is
      a finding the withdrawn edition could not state.
- [ ] **Stretch: replace the documented deferral model with a measured one.** Nothing here has
      measured a client deferring or not, and it would be the first measurement of its kind
      published anywhere. **The premise hour of 2026-09-06 refuted this item's obvious
      mechanism**, so read this before starting it. "An instrumented session that counts what
      actually reached the API" invites a local recorder on `ANTHROPIC_BASE_URL` — which is
      itself a documented condition that switches deferral off: *"Claude Code disables it when
      `ANTHROPIC_BASE_URL` points to a non-first-party host, since most proxies don't forward
      `tool_reference` blocks"* (Claude Code MCP docs, §Configure tool search, raw page read
      2026-09-06). The instrument would measure itself, and report "loads everything up front"
      for a client whose default is the opposite. The same sentence gives the way through —
      *"Set `ENABLE_TOOL_SEARCH` explicitly to override that fallback"* — so `true` and `false`
      are observable behind a recorder while the **unset default is not**, and the default is
      the row the audit's headline verdict rests on. Two first-party paths would leave the base
      URL alone and so could reach the default, and neither has been tried: the debug log
      (`--debug`, `--debug-file`, `CLAUDE_CODE_DEBUG_LOGS_DIR`), and the OpenTelemetry
      `console` exporter, which needs no endpoint and no credential and reports per-request
      token usage. Whether either records what this needs is unverified. Both spend real
      requests on a real account *(maintainer)*, which is the only part of this that is not a
      code question. **Update, 2026-09-06: the debug-log path was tried and it works, so the
      measurement now exists and only the decision to publish it does not.** Claude Code writes
      its own deferral decision to the log before it sends anything, which reaches the unset
      default that a recorder cannot. The default defers every MCP tool definition; `auto` and
      `auto:N` do not defer at ordinary sizes and cost an extra `count_tokens` call; the
      project's own projection came within about 4% of what was actually sent. None of it is
      published, because it was measured on a developer machine and a client can only be
      measured where it runs — which is a line for the maintainer to draw rather than a thing
      to fix, and the item stays open on exactly that. What the same session found in passing is
      already shipped: `audit`'s unstated context-window assumption as `0.16.0`, and the
      harness's own capability posture, measured across the whole set in CI and settled at one
      server in eighty-seven, in `0.17.0`.
      **Update, 2026-09-08: this item is still open, and the model it would replace has since
      been corrected in five places.** The documented model was wrong about how
      `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` is read, about the Windows managed path, about
      `managed-settings.d`, about the organisation override, and about comparing a base URL's
      host — each against a first-party page, none of it needing a measurement. So the gap this
      item names is narrower than it was: what a measurement would still add is the **unset
      default**, which no page states and no file can be read for. A **third** first-party path
      turned up while checking the above and is cheaper than the debug log for a yes/no
      question — `claude --output-format stream-json --verbose -p`, whose `init` event lists the
      session's tools, so the presence of `ToolSearch` in that array answers "is tool search on
      here" in one request. It spends a real request on a real account, so the same
      maintainer's line applies and nothing measured that way is published.
- [ ] **Routine:** vitest 5 (major), `@anthropic-ai/sdk` 0.124; neither blocks anything.

**Exit.** A state-of report published and dated, stating its numbers through claims regen
maintains. The other half — the shard count in `resweep.yml` carrying the timing that chose
it — was met on 2026-09-06.

**Why here.** The only phase with a real wait in it, and it is a wait for data rather than for
a date: the attribution does not exist until the rotation has measured both sides of a movement,
whatever anyone does. Shortening the rotation was the one lever on it, and it has been pulled —
three weeks now, so the wait is half what it was.

---

## Distribution *(maintainer)* — continuing

The track ran on 2026-09-05: the Action is listed on the GitHub Marketplace, three posts are
published (r/mcp with the required showcase flair, the Cursor forum, and the MCP community
Discord's `#showcase`), an entry is in `awesome-mcp-devtools`, and badge pull requests and
dated movement issues are open. The remaining exit is not ours to close — a badge merged in
somebody else's README.

**Still open:** a Show HN on **2026-09-09** after that morning's re-sweep, and the dated
adoption reading from **2026-09-19** that decides the code levers (a Claude Code plugin, an
MCP-server mode, a native shields service). Neither blocks a technical phase.

**Before any outreach, list what this account already sent that repository** — `gh pr list
--repo <r> --state all --author athakur3`, and the same for issues. Four of the 2026-09-05
badge targets had already been approached on 2026-08-16 and nothing recorded it: one declined
in words, one closed without comment, two are still open and unanswered. A second unsolicited
pull request to a maintainer who declined is the one move here that costs more than it wins.

---

## Decisions that are the maintainer's, not bugs

- **`elasticsearch` and `OTEL_SDK_DISABLED=true`.** With it the cross-check row becomes
  comparable (confirmed: 4 tools, 374, +0.0%); without it the row is `—`. Adding it changes
  launch conditions away from what a plain `npx -y` user runs. Either answer is defensible;
  the entry should say which was chosen and why.
- **`--budget` per config file or per Claude Code session.** The README states per-file
  totals as a product rule, while the deferral model treats Claude Code as reading two files
  into one session. Changing the gate's denominator is a product decision.

## Not planned

- Merging per-client totals into one number: a context window belongs to one session.
- Measuring OAuth-walled remotes (`linear`, `zapier`, `vercel`) with real credentials: the
  isolation is credential-free by definition, and a number taken with a key would describe
  that key's account.
- Publishing any measurement taken on a developer machine. CI measures; the laptop probes.
- Requiring pull requests or green checks on `main` while the bots push with `GITHUB_TOKEN`.
  On a personal repository the Actions app cannot be a bypass actor — GitHub says so in words —
  so either rule breaks every scheduled job on its next run; and the route around it, a
  write-access deploy key for the bots, is a long-lived credential in the job that runs
  strangers' commands. `main` refuses deletion and force-push (ruleset 22351158, decided
  2026-09-06); `.github/CODEOWNERS` and the pull-request template carry the merge side, and the
  click is a maintainer who reads the checks.
- Widening the failure taxonomy again without a corroboration rule for the new bucket.
- Bumping methodology v1.0 for anything above: none of it touches canonical bytes,
  `totalTokens`, or a hash.
