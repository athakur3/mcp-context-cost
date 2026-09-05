# Roadmap

Six phases, in order. Each has one goal, a scope, and an exit that can be checked rather
than declared. Phases 0 and 1 are done, the distribution track shipped on 2026-09-05, and
**phase 2 is five of seven items in**; 3 and 4 run in parallel; 5 is gated by the calendar,
not by work. Contributions welcome on any item.

Dated **2026-09-05**, against 0.12.0 on npm and the data of 2026-09-04. Each item names the
evidence it rests on, so a reader can check whether it is still true before picking it up.
Forward-looking only: what already shipped lives in the code and the git history. Items
marked *(maintainer)* need a decision or an account only the maintainer has.

**Check an item's premise before starting it.** Four of phase 1's eight items were wrong
about *why* — not about the symptom, which was real every time, but about the mechanism
behind it — and phase 2 then ran the same way: two of its seven, one of which dissolved on
contact with the record. The pattern has been exact both times: every item that quoted the
record held up, and every item that inferred a cause from a category did not. So the first hour of a phase re-reads the
records its items name and either confirms the sentence or rewrites it. That hour would have
saved most of phase 1's rework, and it is the same discipline this project applies to its own
published numbers — a claim is worth what its evidence is worth, including a claim in here.

## Where it stands

106 candidates, 83 measured, six published columns (tokens, session start, Claude,
mcp-tokens, movement, tool shape), 681 tests, four workflows, three weeks of history, and
`0.12.0` on npm as of 2026-09-05. The measurement and its gates are further along than their
audience: the adoption reading of
2026-09-03 found zero projects displaying the badge, and the repository has one star. So the
phases below do two different kinds of work — keeping the published data honest, which is the
discipline the project exists for, and getting it in front of the people it is for. Every
technical item here is worth less than one adopter — which is why the distribution track was
ordered ahead of the technical ones. It ran on 2026-09-05: the listing is live, three posts
are out and five badge pull requests are open, so it no longer blocks this file. That zero is
now a dated reading with six asks behind it rather than an absence of asking.

## The phases at a glance

| phase | goal | window | exit, in one line |
|---|---|---|---|
| **0** | Ship what trunk already holds | **done 2026-09-05** | 0.12.0 on npm, with a dated changelog section |
| **1** | Every published sentence is established | **done 2026-09-05** | eight items, each held by a test; `slack` and `redis-legacy` re-measured in CI |
| **∥** | **Distribution** *(maintainer)* | **shipped 2026-09-05** | listing live and three posts published; five badge PRs open |
| **2** | Sweeps that are cheaper and say more — **5 of 7 done** | 2026-09-05 → 2026-09-25 | movements name releases; `anki` and `grafana` measure; Claude column refreshed by the re-sweep; four issues filed |
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
  our own launch command, not something a port probe would corroborate. It was left undeclared
  with the reason written into the entry. Phase 2 then found `anki` to be the same bug, which
  closed the probe item altogether — both entries pass a stdio flag now and both measure.
- The bots' "no change to publish" guard was never blocked by the dashboard stamp; the exit
  that rested on it was unreachable, and wanted the behaviour phase 1's own first item depends
  on. `elasticsearch` was not a bare failure but a clean number for a deprecated package,
  which is worse. And the new number guard found a third hand-written figure on the front page.

**The distribution track was unblocked by this phase, and ran the same day.** See below.

---

## Distribution *(maintainer)* — shipped 2026-09-05

Zero adopters after three weeks was the number that mattered most in this file, and it sat
under phase 5 until 2026-09-05 while saying so. Moved above the technical phases that day,
the track then ran in one day rather than the five it was given.

**Two of its three exits are met.** The Action is listed on the GitHub Marketplace under
Continuous integration and Code quality, on the existing `v1` tag. Three posts are published:
r/mcp with the required showcase flair, the Cursor forum under Showcase → Built for Cursor,
and the MCP community Discord's `#showcase` forum. The third exit, a merged badge pull
request, is not ours to close: five are open.

Also out: an entry in `awesome-mcp-devtools`, ten repository topics, dated movement issues to
`obsidian` and `blender`, and a submission to Console.dev.

**What the day corrected.** Four of the eight badge targets had already been approached on
2026-08-16, and nothing in this file or the adoption reading recorded it: `clickhouse`
declined in words, `playwright` closed without comment, `qdrant` and `exa` are still open and
unanswered. None was re-sent. So the zero reads differently — not that nobody has been asked,
but that of six asks two were declined and two are still sitting. **Any outreach now starts by
listing what this account already sent that repository** (`gh pr list --repo <r> --state all
--author athakur3`, and the same for issues). A second unsolicited pull request to a
maintainer who declined is the one move here that costs more than it wins.

**Still open:** a Show HN on Wednesday 2026-09-09 after that morning's re-sweep, and a dated
adoption reading from 2026-09-19 that decides the code levers (a Claude Code plugin, an
MCP-server mode, a native shields service). Neither blocks any technical phase. The plan and
the response log are at https://claude.ai/code/artifact/42d26d8e-b533-4bde-a424-49f98adf800b

---

## Phase 2 — Sweeps that are cheaper and say more · **in progress**

**Goal.** A movement names the release that caused it, and a harness limitation never costs
a retry.

**Five of seven items are done (2026-09-05).** The premise check this file mandates paid for
itself again: two items were wrong about the mechanism, and one of them dissolved entirely.

**Scope.**
- [x] **A schema test over `servers.yaml` in CI** — done 2026-09-05. `validateServers` in
      `src/sweep/servers-schema.ts`, run by the suite CI already runs. The plan had two things
      wrong. `notApplicable` and `deprecated` were *already* checked, by their own test files;
      what nothing checked was entry shape — required fields, unique names, types, and a key
      nobody reads, which is the real hole because YAML makes a misspelled key an absent field.
      And remote entries are not `remote` xor `command`: they keep the endpoint *in* `command`,
      and both directions are now checked. The field table is
      `satisfies Record<keyof ServerEntry, …>`, so a field added to the type without being
      declared fails typecheck.
- [x] **Name the release a movement came from** — done 2026-09-05. `history.csv` has a seventh
      column and `ToolVectorEntry` an optional field; `regressions.md` and the per-server pages
      carry a **release** column. Short rows read as not recorded and nothing is back-filled, so
      it says `0 of 17` movements can name both sides today and fills in as the rotation
      re-measures. It can also now say `still 1.29.1` — the cost moved while the version did
      not, which is a dependency the server does not pin rather than a release.
- [x] ~~**Corroborate `not-applicable` by probe as well as by words.**~~ **Not built, and the
      item is closed: its only case was a bug in this repository.** `anki` was the case — twelve
      minutes a cycle to establish, supposedly, that a desktop application is absent. Run in the
      isolation it prints a banner and serves HTTP on `127.0.0.1:3000` while this harness waits
      on stdio, exactly the mismatch phase 1 found in `grafana`; `ankimcp --help` names
      `--stdio`. `grafana` is the same story one level down: the binary's own default transport
      *is* stdio, and the `mcp/grafana` image's ENTRYPOINT hard-codes
      `--transport sse --address 0.0.0.0:8000`. Both entries now pass a stdio flag, and probed
      that way both **measure** — anki 20,037 tokens across 50 tools, grafana 16,774 across 65,
      in under a minute where they had been spending twenty-one. With both timeouts explained
      the probe has zero cases, and this file does not widen a bucket without one. The
      truncation hole it would also have closed is still open and is listed below on its own.
- [x] **`isolation.arch` can name the wrong machine** — done 2026-09-05, and the obvious fix
      was also wrong. `docker image inspect` reports the variant the local store prefers: on
      this machine it answered `linux/arm64` for a tag whose container, under
      `DOCKER_DEFAULT_PLATFORM=linux/amd64`, came up `x86_64` — the same wrong answer as the
      host inference. `containerPlatform` starts a container and reads `uname -sm`. A command
      that is itself a `docker run` records no `arch` at all, because this harness did not
      choose that container.
- [x] **The Claude column refreshes in the job that re-measures, and covers every row** — done
      2026-09-05. `resweep.yml` refreshes it after the cross-check, selecting with the same
      `${SELECT}` string, and a bare run now covers every measured server rather than the top
      20. `divergence.json` is staged with the measurements rather than the derived files, or
      the rebase would discard it. Two published sentences that claimed a rank now state the
      count regen maintains.
- [ ] **`not-applicable` corroboration survives a growing evidence tail.** Split out of the
      probe item above, which is closed. Corroboration is a substring test against the
      *truncated* tail, so a declared entry whose output grows until its evidence line falls in
      the elided middle reverts to `startup-failure` on its own — silently, and about someone
      else's working software. Four entries declare today. Wants a rule that does not depend on
      how much the server printed.
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
- ~~Every movement in `regressions.md` whose two records both carry a version names both.~~
  Met by construction; `0 of 17` today, and the page says why.
- ~~`anki` reads `not-applicable` with probe evidence, and the slice containing it finishes at
  least twelve minutes faster.~~ Superseded: `anki` and `grafana` both **measure**, and the
  slice loses twenty-one minutes rather than twelve. Checkable once CI has run them — the
  numbers above were probed on a laptop and are not published.
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
