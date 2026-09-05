# Roadmap

Six phases, in order. Each has one goal, a scope, and an exit that can be checked rather
than declared. Phases 0, 1 and 2 are sequential; 3 and 4 run in parallel once 1 is done; 5 is
gated by the calendar, not by work. Contributions welcome on any item.

Dated **2026-09-05**, against 0.12.0 on npm and the data of 2026-09-04. Each item names the
evidence it rests on, so a reader can check whether it is still true before picking it up.
Forward-looking only: what already shipped lives in the code and the git history. Items
marked *(maintainer)* need a decision or an account only the maintainer has.

**Check an item's premise before starting it.** Four of phase 1's eight items were wrong
about *why* — not about the symptom, which was real every time, but about the mechanism
behind it. The pattern was exact: every item that quoted the record held up, and every item
that inferred a cause from a category did not. So the first hour of a phase re-reads the
records its items name and either confirms the sentence or rewrites it. That hour would have
saved most of phase 1's rework, and it is the same discipline this project applies to its own
published numbers — a claim is worth what its evidence is worth, including a claim in here.

## Where it stands

106 candidates, 83 measured, six published columns (tokens, session start, Claude,
mcp-tokens, movement, tool shape), 644 tests, four workflows, three weeks of history, and
`0.12.0` on npm as of 2026-09-05. The measurement and its gates are further along than their
audience: the adoption reading of
2026-09-03 found zero projects displaying the badge, and the repository has one star. So the
phases below do two different kinds of work — keeping the published data honest, which is the
discipline the project exists for, and getting it in front of the people it is for. Every
technical item here is worth less than one adopter — which is why, as of 2026-09-05, the
distribution track is ordered ahead of the technical ones rather than beside them. Its gate
was the end of phase 1, and the site no longer contradicts itself.

## The phases at a glance

| phase | goal | window | exit, in one line |
|---|---|---|---|
| **0** | Ship what trunk already holds | **done 2026-09-05** | 0.12.0 on npm, with a dated changelog section |
| **1** | Every published sentence is established | **done 2026-09-05** | eight items, each held by a test; `slack` and `redis-legacy` re-measured in CI |
| **∥** | **Distribution** *(maintainer)* | **next — unblocked 2026-09-05** | one of: Marketplace listing, a badge PR merged, a post published |
| **2** | Sweeps that are cheaper and say more | 2026-09-10 → 2026-09-25 | movements name releases; `anki` declared; Claude column refreshed by the re-sweep; four issues filed |
| **3** | Others can add servers safely | 2026-09-21 → 2026-10-09 | a stranger's entry is measured read-only before any write-token job runs it |
| **4** | `audit` reaches the stacks people run | 2026-10-05 → 2026-10-23 | remote entries measured; three more clients, each with a who-pays row |
| **5** | The data tells its second story | from 2026-10-16 | state-of report #2 with per-tool attribution; rotation length decided on evidence |

---

## Phase 0 — Ship what trunk already holds · done 2026-09-05

`0.12.0` is on npm, published first-attempt through the pinned OIDC path, with
`## 0.12.0 — 2026-09-05` in the changelog and the published tarball re-deriving a published
number. Nothing was needed for the `v1` tag. Per this file's forward-looking rule the detail
lives in the git history and the changelog; what it left behind is in phase 1 below, because
writing that section is what found it.

---

## Phase 1 — Every published sentence is established · done 2026-09-05

All eight items shipped, each held by a test (644, from 625), and the two published statuses
that needed a measurement rather than an edit were re-measured in CI: `slack` no longer reads
`auth-required` on a TLS trust failure in this harness's own container, and `redis-legacy`
reads `not-applicable` with its declared reason and the raw failure behind it. Per this file's
forward-looking rule the detail is in the git history; the movement report now says
**17 moved + 64 held + 2 without = 83**, where it used to call 66 held costs an absence.

Four things this file asserted turned out to be wrong, and only one of them still points
forward:

- **`grafana` is not a backing-service absence.** Its record says the container came up and
  served SSE on `0.0.0.0:8000` while this harness waited on stdio — a transport mismatch in
  our own launch command, not something a port probe would corroborate. It is left undeclared
  with the reason written into the entry, and **phase 2's probe item is now `anki` alone**.
- The bots' "no change to publish" guard was never blocked by the dashboard stamp; the exit
  that rested on it was unreachable, and wanted the behaviour phase 1's own first item depends
  on. `elasticsearch` was not a bare failure but a clean number for a deprecated package,
  which is worse. And the new number guard found a third hand-written figure on the front page.

**The distribution track is unblocked as of today.** Its gate was the end of this phase.

---

## Distribution *(maintainer)* — the next thing, unblocked 2026-09-05

Zero adopters after three weeks is the number that matters most in this file, and this
section sat under phase 5 until 2026-09-05 while saying so. Its gate was the end of phase 1,
and phase 1 is done, so it is ordered where its own argument puts it: **before phase 2**, not
beside it. Phases 2 to 5 keep the data honest for an audience that does not exist yet. The action is
already at `athakur3/mcp-context-cost@v1` and could be listed on the GitHub Marketplace; the
badge is good news for most servers it would land on (`chrome-devtools` at 5,717 tokens on
3.3M installs a week, `postgres` at 32); the state-of report is written and dated. Marketplace
listing, awesome-mcp entries, badge pull requests to measured servers, and one post are each
the maintainer's move, and any one of them outweighs the rest of this file. Phase 1 closed on
2026-09-05, which was the gate: the site no longer contradicts itself, so the moment is now.

---

## Phase 2 — Sweeps that are cheaper and say more

**Goal.** A movement names the release that caused it, and a harness limitation never costs
a retry.

**Scope.**
- [ ] **A schema test over `servers.yaml` in CI** — moved here from phase 3 on 2026-09-05.
      Every field present, names unique, `remote` xor `command`, `notApplicable` carrying both
      `reason` and `evidence`, `deprecated` carrying `version`, `source` and `readOn`. The
      file now holds three optional structured fields that nothing validates at load, phase 1
      added one of them, and the next item adds a fourth — a schema test written *after*
      `requires` lands is a schema test written too late. A day's work, and it guards the rest
      of this phase.
- [ ] **Name the release a movement came from.** Every `measurement.json` records
      `serverVersion` from `initialize`; `history.csv` and `tool-vectors.json` do not, so
      `regressions.md` says "a real upstream release" and cannot say which. Carry the version
      into both; print `obsidian 1.28.x → 1.29.1`. Rows written before the column read "not
      recorded", never a guess.
- [ ] **Corroborate `not-applicable` by probe as well as by words.** An entry that declares a
      backing service (`requires: tcp://127.0.0.1:6379`) is checked by the harness inside the
      isolation, and "port closed" is recorded as the evidence. The safety property is kept —
      the status still cannot be asserted by declaration alone — and a server that hangs
      silently becomes declarable. `anki` is the case: no `timeoutSeconds`, so 240s and then
      480s on the doubled budget, every cycle, to learn that a desktop application is absent.
      `grafana` is **not** a second case for this, as of 2026-09-05: its record says the
      container served SSE on `0.0.0.0:8000` while this harness waited on stdio, so its six
      minutes a cycle are a transport mismatch in our own launch command and want a command
      fix, not a probe. `anki` alone is **twelve** minutes a cycle (240s budget then 480s on
      the doubled retry; `grafana`'s 180/360 was the other nine), so the exit below is
      unchanged. A probe
      also closes the hole the 0.12.0 changelog documents: corroboration is a substring test
      against the truncated evidence, so a declared entry whose output grows until its evidence
      line falls in the elided middle reverts to `startup-failure` on its own.
- [ ] **`isolation.arch` can name the wrong machine.** It is the measuring process's own
      platform rather than an observation of the container: under Docker the platform half is
      assumed to be `linux` and the architecture is the host's, and nothing passes `--platform`
      or reads `DOCKER_DEFAULT_PLATFORM`. So an amd64 container emulated on Apple Silicon
      records `linux/arm64`. The field exists precisely to tell a broken server from a
      wrong-architecture one, so it has to be read from the container, not inferred from the
      host.
- [ ] **The Claude column refreshes in the job that re-measures, and covers every row.**
      `npm run divergence` runs only in `self-badge.yml` (Mondays, top 20). Re-sweeps land on
      Wednesdays, so a re-measured top-20 row prints `—` for five days each cycle — today the
      front page's own "what it costs on Claude" table shows `—` for `github`, the heaviest
      server in the set. Run divergence in `resweep.yml` after the sweep, over the servers just
      measured (`continue-on-error`, the existing secret), and widen from the top 20 to every
      measured server.
- [ ] **Heal failure rows upstream, one reproduction each.** `heroku` (cannot find
      `@modelcontextprotocol/sdk/dist/esm/server/mcp`), `accessibility-scanner`
      (`ERR_PACKAGE_PATH_NOT_EXPORTED`), `hana-cli` (`ERR_MODULE_NOT_FOUND`), `hevy` (a fatal
      that names no cause) each reduce to one `docker run --rm node:22-slim …` line. Record the
      issue link in the entry so the row can say "filed <date>".
- [ ] **Probe before telling anyone anything.** `azure` exits **0** with a .NET tracing dump,
      which looks like the slim image lacking ICU rather than a broken server (if
      `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1` fixes it, adding it is a launch-condition
      decision like `elasticsearch`'s below). `local-mcp` on amd64 starts downloading
      `LMCP v3.0.404 (linux-amd64)` and fails, so the arm64 finding was only half of it.

**Exit.**
- Every movement in `regressions.md` whose two records both carry a version names both.
- `anki` reads `not-applicable` with probe evidence, and the slice containing it finishes at
  least twelve minutes faster than its last run (workflow durations are public).
- After a re-sweep dispatch that touches `github`, the front page's Claude cell for it is a
  number.
- Four upstream issues filed, links in `servers.yaml`; `azure` and `local-mcp` each have a
  probe result recorded, whichever way it went.

**Why here.** The version column and probe evidence are schema; they ship together as 0.13.0
after phase 0 has cleared the previous batch. The declarations in phase 1 come first because
they need no code.

**Size.** A week.

---

## Phase 3 — Others can add servers safely

**Goal.** A `servers.yaml` pull request from a stranger gets a measured number before any job
holding `contents: write` ever runs its launch command.

**Scope.**
- [ ] *(The schema test moved to phase 2 on 2026-09-05: phase 2 adds a fourth structured
      entry field, and the check has to exist before the field does.)*
- [ ] **A `pull_request` job with read-only permissions** that diffs `servers.yaml` against
      the base branch, measures only the entries the PR added, and prints the number in the
      check log. It pushes nothing; the rotation publishes it later under its own rules.
- [ ] **CONTRIBUTING.md** stating what an entry needs — the subcommand lesson (`agent-device
      mcp`, `githits mcp`, `emailmd`, `hana-cli`: a registry id does not reveal it), a
      `timeoutSeconds` taken from a measured cold install and not a guess, env var names only,
      and that a measurement from a laptop is never accepted as the published one.
- [ ] **Commit the registry scan.** The 2026-09-04 long-tail expansion came from a script that
      was never committed; the only record of the method is a comment in `servers.yaml`. Land
      it as `tools/scan-registry.ts` (page `/v0/servers`, dedupe by name keeping the latest
      active, rank via npm bulk / pypistats), then run the uncapped rescan and the tier-2 pass
      from its output.
- [ ] **Schedule the adoption reading.** `npm run adoption` is manual and needs a token; the
      page is dated 2026-09-03 and its date is most of its meaning. A monthly workflow using the
      Actions token keeps the one number the project keeps about itself from going stale.

**Exit.**
- A test PR adding a malformed entry fails the schema check; one adding a real entry shows
  its measured tokens in the check without pushing.
- `tools/scan-registry.ts` exists and the next `servers.yaml` expansion commit cites its
  output.
- The adoption workflow has run once on schedule and `docs/adoption.md`'s date advanced.

**Why here.** Contributions follow distribution, and the safety check must exist before the
first outside PR arrives — not after. Runs in parallel with phase 4; the two share no files.

**Size.** Three to four days.

---

## Phase 4 — `audit` reaches the stacks people actually run

**Goal.** `audit` measures what is in the config, not the subset the harness finds
convenient.

**Scope.**
- [ ] **Remote entries.** A config entry with a `url` is skipped as `remote-not-measurable`
      while `measure --remote` already bridges through `mcp-remote`. Vendor servers are moving
      to hosted endpoints, so the skip under-counts exactly the stacks the audit is for. Route
      no-auth remotes through the bridge; report OAuth-walled ones as auth-walled in those
      words, with the URL, never as "not measurable".
- [ ] **More clients**, in order of user base: Codex CLI (`~/.codex/config.toml` — TOML,
      which means a parser decision for a package that today depends on two things), Gemini
      CLI (`~/.gemini/settings.json`), Zed (`context_servers`), then Goose, Cline, Kiro. Each
      needs its "no default deferral on record" row in the who-pays table as much as its path
      in `config.ts`: discovery without the posture would publish a number with no statement
      of who pays it.
- [ ] **Re-read the deferral model, dated.** The who-pays table is a model of Claude Code's
      documentation read 2026-08-20. A dated re-read each month is the floor; the measured
      version is phase 5's stretch item.

**Exit.**
- A fixture config with an `http` entry produces a number or an auth-walled line; the
  status `remote-not-measurable` no longer appears in output.
- Each added client has a fixture test, a discovery path, a who-pays row, and a line in the
  README's client list.
- METHODOLOGY's "read on" date for the deferral model has advanced, with any change noted.

**Why here.** Independent of the sweep, so it runs beside phase 3. Ordered after phase 2
because the people distribution brings are audit users, and this is the audit they will run.

**Size.** A week, most of it clients.

---

## Phase 5 — The data tells its second story

**Goal.** The second state-of report says which *tools* grew, and the rotation is as short as
the runner allows.

**Scope.**
- [ ] **State-of report #2.** Tool vectors accrue from 2026-09-04 and the rotation is six
      weeks, so from about **2026-10-16** both sides of nearly every movement are on record.
      The September edition could say which servers moved; this one can say which tools, and
      by phase 2 which releases. It can also say what held: as of 2026-09-05 the movement
      report separates 64 confirmed-unchanged costs from the 2 with nothing to compare, and
      "most servers do not move, and the ones that do move up" is a finding the first edition
      could not state.
- [ ] **A shorter rotation, decided on evidence.** A movement's window can be six weeks wide,
      and a window that wide describes the schedule rather than the server (`resweep.yml` says
      as much at its top). Dispatch `shards=3` once, time it against the 120-minute cap, and
      halve the cycle if it fits — Actions minutes are free on a public repository.
- [ ] **Stretch: replace the documented deferral model with a measured one.** Nothing here has
      measured a client deferring or not. An instrumented session that counts what actually
      reached the API would be the first measurement of its kind published anywhere.
- [ ] **Routine:** vitest 5 (major), `@anthropic-ai/sdk` 0.124; neither blocks anything.

**Exit.** Report #2 published and dated; the shard count in `resweep.yml` carries a comment
with the timing that chose it.

**Why here.** Gated by the calendar: the attribution data does not exist before mid-October
whatever anyone does.

---

## Decisions that are the maintainer's, not bugs

- **`elasticsearch` and `OTEL_SDK_DISABLED=true`.** With it the cross-check row becomes
  comparable (confirmed: 4 tools, 374, +0.0%); without it the row is `—`. Adding it changes
  launch conditions away from what a plain `npx -y` user runs. Either answer is defensible;
  the entry should say which was chosen and why. `azure` may pose the same question after
  its phase-2 probe.
- **`--budget` per config file or per Claude Code session.** The README states per-file
  totals as a product rule, while the deferral model treats Claude Code as reading two files
  into one session. Changing the gate's denominator is a product decision.

## Not planned

- Merging per-client totals into one number: a context window belongs to one session.
- Measuring OAuth-walled remotes (`linear`, `zapier`, `vercel`) with real credentials: the
  isolation is credential-free by definition, and a number taken with a key would describe
  that key's account.
- Publishing any measurement taken on a developer machine. CI measures; the laptop probes.
- Widening the failure taxonomy again without a corroboration rule for the new bucket.
- Bumping methodology v1.0 for anything above: none of it touches canonical bytes,
  `totalTokens`, or a hash.
