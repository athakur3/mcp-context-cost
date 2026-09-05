# Roadmap

Where this project is headed, and what a contributor can pick up. What already shipped is in
[CHANGELOG.md](CHANGELOG.md) and the git history — **a phase leaves this file when it ships**,
so the plan stays short and stays forward-looking. Phases 0 and 1 shipped on 2026-09-05 and
have left it; what they corrected is in the changelog sections for `0.12.0` and `0.13.0`.

Dated **2026-09-05**. Every item names the evidence it rests on, so you can check whether it is
still true before starting it. Items marked *(maintainer)* need an account or a decision only
the maintainer has. Contributions welcome on any item, especially new `servers.yaml` entries.

**This file states dated readings, never live counts.** A reading carries the day it was taken
and stays true; a count is wrong by the next sweep, and a plan is the last place anyone thinks
to look for a stale number. The current figures are on the [README](README.md) and the
[dashboard](https://athakur3.github.io/mcp-context-cost/dashboard.html), stated once, where
regen keeps them honest.

**Check an item's premise before starting it.** Four of phase 1's eight items were wrong about
*why* — not about the symptom, which was real every time, but about the mechanism behind it —
and phase 2 then ran the same way: two of its seven, one of which dissolved on contact with the
record. The pattern has been exact both times: every item that quoted the record held up, and
every item that inferred a cause from a category did not. So the first hour of a phase re-reads
the records its items name and either confirms the sentence or rewrites it. That hour would
have saved most of phase 1's rework, and it is the same discipline this project applies to its
own published numbers — a claim is worth what its evidence is worth, including a claim in here.

## Where it stands

The measurement and its gates are further along than their audience. The adoption reading of
**2026-09-03** found zero projects displaying the badge, against one star and three weeks of
published history. So the work here is two kinds — keeping the published data honest, which is
the discipline the project exists for, and getting it in front of the people it is for. Every
technical item below is worth less than one adopter, which is why the distribution track was
ordered ahead of the technical ones; it ran on **2026-09-05**. The next reading is due
**2026-09-19**, and it decides the code levers.

## The phases at a glance

| phase | goal | window | exit, in one line |
|---|---|---|---|
| **2** | Sweeps that are cheaper and say more | two things left | corroboration survives truncation; every divergence row describes its capture |
| **3** | Others can add servers safely | 2026-09-21 → 10-09 | a stranger's entry is measured read-only before any write-token job runs it |
| **4** | `audit` reaches the stacks people run | 2026-10-05 → 10-23 | remote entries measured; three more clients, each with a who-pays row |
| **5** | The data tells its second story | from 2026-10-16 | state-of report #2 with per-tool attribution; rotation length decided on evidence |
| **∥** | Distribution *(maintainer)* | continuing | a badge merged somewhere that is not this repository |

---

## Phase 2 — what is left of it

Seven of its eight items shipped in `0.13.0`, and the finding was that half the "broken
servers" in this set were broken by this harness rather than by their authors. Two things did
not close with it.

- [ ] **`not-applicable` corroboration survives a growing evidence tail.** A declared entry is
      only published as `not-applicable` when the failure's own text still contains the
      declared evidence — the guard that stops a stale annotation absorbing a real breakage.
      But the text it searches is a *truncated* tail (`evidenceTail` in `src/sweep/client.ts`
      keeps both ends of 600 characters and elides the middle), so an entry whose output grows
      until its evidence line falls into the elided middle reverts to `startup-failure` on its
      own — silently, and about someone else's working software. Not hypothetical: of the five
      entries declaring today, two are already having their middle elided, and the narrowest
      surviving margin is 64 characters. Wants a rule that does not depend on how much the
      server printed.
- [ ] **Every divergence row describes the capture it was computed from.** `--only` selections
      merge into `results/divergence.json`, so a row outside the selection keeps its old
      numbers and goes stale the moment its capture moves. `isCurrent` catches this and the
      page prints `—` rather than a wrong number, which is the right failure — but as of
      2026-09-05 seven of twenty-four rows are stale, `github` among them, and the README's
      Claude table draws a comparison from a cell it is therefore not printing. One bare
      divergence run refreshes every row; the durable fix is that a merge cannot leave a row
      describing a capture that no longer exists.

---

## Phase 3 — Others can add servers safely

**Goal.** A `servers.yaml` pull request from a stranger gets a measured number before any job
holding `contents: write` ever runs its launch command.

**Scope.**
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
      which releases. It can also say what held — the movement report separates confirmed
      unchanged costs from the ones with nothing to compare, and "most servers do not move, and
      the ones that do move up" is a finding the first edition could not state.
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
- Widening the failure taxonomy again without a corroboration rule for the new bucket.
- Bumping methodology v1.0 for anything above: none of it touches canonical bytes,
  `totalTokens`, or a hash.
