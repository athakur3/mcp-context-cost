# Roadmap

Six phases, in order. Each has one goal, a scope, and an exit that can be checked rather
than declared. Phases 0, 1 and 2 are sequential; 3 and 4 run in parallel once 1 is done; 5 is
gated by the calendar, not by work. Contributions welcome on any item.

Dated **2026-09-05**, against 0.11.3 on npm and the data of 2026-09-04. Each item names the
evidence it rests on, so a reader can check whether it is still true before picking it up.
Forward-looking only: what already shipped lives in the code and the git history. Items
marked *(maintainer)* need a decision or an account only the maintainer has.

## Where it stands

106 candidates, 83 measured, six published columns (tokens, session start, Claude,
mcp-tokens, movement, tool shape), 625 tests, four workflows, three weeks of history. The
measurement and its gates are further along than their audience: the adoption reading of
2026-09-03 found zero projects displaying the badge, and the repository has one star. So the
phases below do two different kinds of work — keeping the published data honest, which is the
discipline the project exists for, and getting it in front of the people it is for. Every
technical item here is worth less than one adopter, and the distribution track says when the
site is ready for them.

## The phases at a glance

| phase | goal | window | exit, in one line |
|---|---|---|---|
| **0** | Ship what trunk already holds | by 2026-09-07 | 0.12.0 on npm, with a dated changelog section |
| **1** | Every published sentence is established | by the 2026-09-09 sweep; hard stop 2026-09-16 | four contradictions gone, each held by a test; one bot run ends "no change to publish" |
| **2** | Sweeps that are cheaper and say more | 2026-09-10 → 2026-09-25 | movements name releases; `anki` declared; Claude column refreshed by the re-sweep; four issues filed |
| **3** | Others can add servers safely | 2026-09-21 → 2026-10-09 | a stranger's entry is measured read-only before any write-token job runs it |
| **4** | `audit` reaches the stacks people run | 2026-10-05 → 2026-10-23 | remote entries measured; three more clients, each with a who-pays row |
| **5** | The data tells its second story | from 2026-10-16 | state-of report #2 with per-tool attribution; rotation length decided on evidence |
| **∥** | Distribution *(maintainer)* | any time after phase 1 | one of: Marketplace listing, a badge PR merged, a post published |

---

## Phase 0 — Ship what trunk already holds

**Goal.** An install carries what CI already runs.

**Scope.**
- [ ] Write the *Unreleased* section for the eleven commits since the 0.11.3 bump. It is
      empty today. They include a new published status (`not-applicable`, declared and then
      corroborated by the failure's own words), a new isolation field (`arch`), a rewritten
      failure-evidence selector (noise dropped, head and tail kept, an overlong first line
      truncated rather than skipped), the re-sweep's `servers` input, the rebase-then-regen
      commit ordering, the `agent-device` recovery, and the `stripe` revert.
- [ ] Cut **0.12.0** — minor, because a consumer of `measurement.json` now sees a `status`
      value it has not seen before. Procedure as in CHANGELOG; `publish.yml` refuses a version
      with no section.
- [ ] Nothing to do for the `v1` tag: `action.yml` is unchanged since it was placed.

**Exit.** `npm view mcp-context-cost version` prints 0.12.0; the publish workflow was green on
its first attempt; CHANGELOG carries `## 0.12.0 — <date>`.

**Why first.** Every later phase adds schema — a version column in history, a `deprecated`
field, probe evidence — and each release's changelog should be about one thing. And the
evidence-selector fix is the one `measure` users are waiting on without knowing it.

**Size.** Half a day.

---

## Phase 1 — Every published sentence is established

**Goal.** The site does not contradict itself when someone arrives from a post.

**Scope.**
- [ ] **The movement report calls a held cost "nothing to compare".** `latestChange` returns
      null both for "fewer than two comparable rows" and for "the series never changed", and
      `regressions.ts` counts every null as `withoutComparison`, so the page says *66 servers
      carry a measurement but no second comparable one*. `history.csv` has 79 of the 81
      measured servers with two or more Docker rows: most of the 66 were measured again and
      held. Publish "unchanged at N since <date>, across k sweeps" — the most reassuring fact
      the data holds, currently unsaid. Reproduction in `test/regression.test.ts`.
- [ ] **README prose that carries a number by hand.** "nine servers ratcheting upward against
      one that got cheaper" sits ninety lines below the regen-maintained "11 moved up against
      6 that moved down"; "82 curated candidates" against 106 in `servers.yaml`. Neither is in
      `published-stats.ts`. Add them to the claim list, or reword so the sentence carries no
      number for the data to contradict.
- [ ] **A dashboard that always diffs.** `dashboard.ts` stamps `new Date()` into the page, so
      `docs/dashboard.html` changes on every regen and the bots' "no change to publish" guard
      has never once fired. Stamp the newest measurement date instead.
- [ ] **Declare what the words already allow.** `redis-legacy`'s record contains
      `ECONNREFUSED 127.0.0.1:6379`, which the existing evidence rule can match today.
      `grafana` (a Grafana at `localhost:3000`) qualifies if its timeout note carries a
      matchable line now that stderr survives into timeouts; otherwise it waits for the probe
      in phase 2. Both are backing-service absences, which is what `not-applicable` is for.
- [ ] **A `deprecated` annotation.** `gdrive`, `elasticsearch` and `neon` are deprecated
      upstream (`neon` points at `mcp.neon.tech`) and each is published as a bare failure. An
      entry field naming the replacement lets the row say "superseded by X" — a fact about the
      package, stated as one — while the entry is still attempted every sweep.

**Exit.**
- `regressions.md` has an *Unchanged* section, and its section counts sum to the measured
  total; a test holds the two null cases apart.
- No number in README, `docs/index.md` or METHODOLOGY sits outside the claim list; the
  drift-guard test fails if one is added.
- A dispatched re-sweep of one unchanged server (`servers=memory`) ends with "no change to
  publish" and pushes nothing.
- The leaderboard shows `redis-legacy` as `not-applicable` with its evidence, and the three
  deprecated rows name their replacement.

**Why here.** The claim the project makes is that a published number describes the server.
Two of these four are the project failing its own rule, on its own front page. Fix before
anyone is invited to look, and before the 2026-09-09 sweep so that run's regen publishes the
corrected aggregates rather than re-publishing the wrong ones.

**Size.** Two days.

---

## Phase 2 — Sweeps that are cheaper and say more

**Goal.** A movement names the release that caused it, and a harness limitation never costs
a retry.

**Scope.**
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
      Together with `grafana` that is about twenty minutes of runner time per cycle.
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
- [ ] **A schema test over `servers.yaml` in CI**: every field present, names unique, `remote`
      xor `command`, `notApplicable` carrying both `reason` and `evidence`, `requires` a
      well-formed address.
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
      by phase 2 which releases.
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

## Distribution track *(maintainer)* — parallel, any time after phase 1

Zero adopters after three weeks is the number that matters most in this file. The action is
already at `athakur3/mcp-context-cost@v1` and could be listed on the GitHub Marketplace; the
badge is good news for most servers it would land on (`chrome-devtools` at 5,717 tokens on
3.3M installs a week, `postgres` at 32); the state-of report is written and dated. Marketplace
listing, awesome-mcp entries, badge pull requests to measured servers, and one post are each
the maintainer's move, and any one of them outweighs the rest of this file. The end of phase 1
is the moment: that is when the site stops contradicting itself.

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
