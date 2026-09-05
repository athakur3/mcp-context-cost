# Roadmap

Six phases, in order. Each has one goal, a scope, and an exit that can be checked rather
than declared. Phases 0, 1 and 2 are sequential; 3 and 4 run in parallel once 1 is done; 5 is
gated by the calendar, not by work. Contributions welcome on any item.

Dated **2026-09-05**, against 0.12.0 on npm and the data of 2026-09-04. Each item names the
evidence it rests on, so a reader can check whether it is still true before picking it up.
Forward-looking only: what already shipped lives in the code and the git history. Items
marked *(maintainer)* need a decision or an account only the maintainer has.

## Where it stands

106 candidates, 83 measured, six published columns (tokens, session start, Claude,
mcp-tokens, movement, tool shape), 644 tests, four workflows, three weeks of history, and
`0.12.0` on npm as of 2026-09-05. The measurement and its gates are further along than their
audience: the adoption reading of
2026-09-03 found zero projects displaying the badge, and the repository has one star. So the
phases below do two different kinds of work — keeping the published data honest, which is the
discipline the project exists for, and getting it in front of the people it is for. Every
technical item here is worth less than one adopter, and the distribution track says when the
site is ready for them.

## The phases at a glance

| phase | goal | window | exit, in one line |
|---|---|---|---|
| **0** | Ship what trunk already holds | **done 2026-09-05** | 0.12.0 on npm, with a dated changelog section |
| **1** | Every published sentence is established | by the 2026-09-09 sweep; hard stop 2026-09-16 | **code complete 2026-09-05**; eight items, each held by a test; one CI re-measure left |
| **2** | Sweeps that are cheaper and say more | 2026-09-10 → 2026-09-25 | movements name releases; `anki` declared; Claude column refreshed by the re-sweep; four issues filed |
| **3** | Others can add servers safely | 2026-09-21 → 2026-10-09 | a stranger's entry is measured read-only before any write-token job runs it |
| **4** | `audit` reaches the stacks people run | 2026-10-05 → 2026-10-23 | remote entries measured; three more clients, each with a who-pays row |
| **5** | The data tells its second story | from 2026-10-16 | state-of report #2 with per-tool attribution; rotation length decided on evidence |
| **∥** | Distribution *(maintainer)* | any time after phase 1 | one of: Marketplace listing, a badge PR merged, a post published |

---

## Phase 0 — Ship what trunk already holds · done 2026-09-05

`0.12.0` is on npm, published first-attempt through the pinned OIDC path, with
`## 0.12.0 — 2026-09-05` in the changelog and the published tarball re-deriving a published
number. Nothing was needed for the `v1` tag. Per this file's forward-looking rule the detail
lives in the git history and the changelog; what it left behind is in phase 1 below, because
writing that section is what found it.

---

## Phase 1 — Every published sentence is established

**Goal.** The site does not contradict itself when someone arrives from a post.

**Scope.**
- [x] **The movement report calls a held cost "nothing to compare".** `latestChange` returns
      null both for "fewer than two comparable rows" and for "the series never changed", and
      `regressions.ts` counts every null as `withoutComparison`, so the page says *66 servers
      carry a measurement but no second comparable one*. `history.csv` has 79 of the 81
      measured servers with two or more Docker rows: most of the 66 were measured again and
      held. Publish "unchanged at N since <date>, across k sweeps" — the most reassuring fact
      the data holds, currently unsaid. Reproduction in `test/regression.test.ts`.
- [x] **README prose that carries a number by hand.** "nine servers ratcheting upward against
      one that got cheaper" sits ninety lines below the regen-maintained "11 moved up against
      6 that moved down"; "82 curated candidates" against 106 in `servers.yaml`. Neither is in
      `published-stats.ts`. Add them to the claim list, or reword so the sentence carries no
      number for the data to contradict.
- [x] **A dashboard that always diffs.** `dashboard.ts` stamps `new Date()` into the page, so
      `docs/dashboard.html` changes on every regen and the bots' "no change to publish" guard
      has never once fired. Stamp the newest measurement date instead.
- [x] **Declare what the words already allow.** `redis-legacy`'s record contains
      `ECONNREFUSED 127.0.0.1:6379`, which the existing evidence rule can match today.
      `grafana` (a Grafana at `localhost:3000`) qualifies if its timeout note carries a
      matchable line now that stderr survives into timeouts; otherwise it waits for the probe
      in phase 2. Both are backing-service absences, which is what `not-applicable` is for.
- [x] **The auth classifier matches inside other words, and one record is wrong today.**
      `classifyFailure` tests a bare `auth` alternative, which matches inside `authority`, so
      `slack` is published as `auth-required` on the strength of "tls: failed to verify
      certificate: x509: certificate signed by unknown authority" — a record that reports this
      harness's container not trusting a CA, not a server wanting a credential. The same
      function's bare `token` matched inside `PublicKeyToken=null`, which is how `azure` was
      previously published as `auth-required`. Both are named in the 0.12.0 changelog and
      neither is fixed. Word-boundary the pattern, keep the six genuine auth records passing,
      and re-measure through CI rather than editing the published record.
- [x] **`not-applicable` reaches only one of the three sweep paths.** `measureServer` takes the
      option, and `sweep-all.ts` passes it; `cross-check.ts` and `session-start.ts` iterate the
      same entries and omit it, so either would publish a declared entry as `startup-failure` —
      the assertion about someone else's software the bucket exists to prevent. Latent only
      because the three declared servers are absent from those two outputs. Two lines and a
      structural test that every `ServerEntry` call site forwards the field.
- [x] **A docstring that claims more than the record.** `src/core/types.ts` says `local-mcp`
      was published as a startup failure "for weeks"; the record was a day old. It ships inside
      `dist/`, so it is a published sentence like any other.
- [x] **A `deprecated` annotation.** `gdrive`, `elasticsearch` and `neon` are deprecated
      upstream (`neon` points at `mcp.neon.tech`) and each is published as a bare failure. An
      entry field naming the replacement lets the row say "superseded by X" — a fact about the
      package, stated as one — while the entry is still attempted every sweep.

**Exit.**
- ✅ `regressions.md` has an *Unchanged* section, and its section counts sum to the measured
  total; a test holds the two null cases apart. (17 + 64 + 2 = 83: only **two** of the 66 were
  ever really without a comparison.)
- ✅ Every count of the measured set in README, `docs/index.md` or METHODOLOGY is either
  regen-maintained or in a written-down static list with the reason it cannot drift;
  `test/page-numbers.test.ts` fails if a third kind is added. Re-introducing either original
  sentence fails a test.
- ✅ Regenerating from unchanged results rewrites nothing — **replaces** "a dispatched re-sweep
  of `servers=memory` ends with *no change to publish*", which was unreachable and, on the
  evidence, wrong to want. See *Found while building* below.
- ✅ The three deprecated rows name their replacement, on the leaderboard and on the server
  page. ⏳ `redis-legacy` reads `not-applicable` on the leaderboard — declared, corroborated by
  the record on disk, published by the next CI measurement of it.
- ✅ A test holds the six genuine auth records passing and both false positives failing.
  ⏳ `slack` stops reading `auth-required` — the code no longer classifies it that way; the
  published record moves when CI re-measures.
- ✅ A test fails if any `ServerEntry` call site stops forwarding `notApplicable`.

**What is left.** One dispatch, and only the maintainer can make it:
`gh workflow run resweep.yml -f servers=slack,redis-legacy`, from a main that carries this
work. Nothing here publishes a status; a status is published by a measurement, and a
measurement comes from CI.

**Found while building** — four things the plan above had wrong, each verified:
- **The bots' guard does not fire for the reason this file gave.** `sweep-all` regenerates
  history, the movement report and the leaderboard — not the dashboard — so the wall-clock
  stamp in `dashboard.ts` was never what the guard saw. What it sees is
  `results/<server>/measurement.json`, whose `measuredAt` is fresh on every measured server:
  any run that measured anything has something to publish. And it *should*. A new history row
  for an unchanged server is exactly what makes "unchanged at N across k sweeps" provable —
  the fix in the first item depends on the behaviour the third item wanted to remove. The
  dashboard stamp was still wrong and is still fixed: it now dates the newest measurement, so
  regen is byte-stable and a bot commit's diff carries only what moved.
- **`grafana` is not a backing-service absence.** Its record does not say a Grafana is
  missing; it says `msg="Starting Grafana MCP server using SSE transport" address=0.0.0.0:8000`
  — the container came up and served SSE while this harness waited on stdio. That is a
  transport mismatch in our own launch command, not something a port probe would corroborate.
  Left undeclared, with the reason written into `servers.yaml`. **This changes phase 2**, below.
- **`elasticsearch` is not published as a bare failure.** It measures cleanly at 374 tokens
  and is deprecated — a clean number for a package nobody should adopt, which is worse than a
  failure row, not better. So the annotation renders beside measured rows too, not only in the
  "not measured" table.
- **A third hand-written number, on the same page.** The guard found README's own copy of the
  divergence ratio range — "measured at 0.20×–1.92× across 20 servers" — three numbers written
  by hand beside the two sentences regen already kept true. Now a claim.

**Why here.** The claim the project makes is that a published number describes the server.
Four of these are the project failing its own rule — two on its own front page, and two found
by writing the 0.12.0 changelog, which is why they sit here and not in the version that
shipped them. Fix before anyone is invited to look, and before the 2026-09-09 sweep, so that
run's regen publishes the corrected aggregates rather than re-publishing the wrong ones.

**Size.** Three days.

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
      `grafana` is **not** a second case for this, as of 2026-09-05: its record says the
      container served SSE on `0.0.0.0:8000` while this harness waited on stdio, so its six
      minutes a cycle are a transport mismatch in our own launch command and want a command
      fix, not a probe. `anki` alone is about eight minutes a cycle. A probe
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
