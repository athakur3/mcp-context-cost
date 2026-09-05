# Roadmap

Where this project is headed, and what a contributor can pick up. What already shipped is in
[CHANGELOG.md](CHANGELOG.md) and the git history — **a phase leaves this file when it ships**,
so the plan stays short and stays forward-looking. Phases 0, 1 and 2 shipped on 2026-09-05,
phase 3 followed as `0.14.0` and phase 4 as `0.15.0`; all five have left it, and what they
built, and what they corrected, is in the changelog sections from `0.12.0` to `0.15.0`.

Dated **2026-09-06**. Every item names the evidence it rests on, so you can check whether it is
still true before starting it. Items marked *(maintainer)* need an account or a decision only
the maintainer has. Contributions welcome on any item, especially new `servers.yaml` entries.

**This file states dated readings, never live counts.** A reading carries the day it was taken
and stays true; a count is wrong by the next sweep, and a plan is the last place anyone thinks
to look for a stale number. The current figures are on the [README](README.md) and the
[dashboard](https://athakur3.github.io/mcp-context-cost/dashboard.html), stated once, where
regen keeps them honest.

**Check an item's premise before starting it.** Four of phase 1's eight items were wrong about
*why* — not about the symptom, which was real every time, but about the mechanism behind it —
phase 2 then ran the same way, two of its seven, one of which dissolved on contact with the
record; phase 3 the same again, three of its four, and its goal sentence was false in the one
place no item looked, the job that runs after merge; and phase 4 the same, two of its three,
one of them a mechanism that would have opened a browser on the user's machine. The pattern
has been exact four times: every item that quoted the record held up, and every item that
inferred a cause from a category did not. So the first hour of a phase re-reads the records
its items name and either confirms the sentence or rewrites it. That hour would have saved
most of phase 1's rework, and it is the same discipline this project applies to its own
published numbers — a claim is worth what its evidence is worth, including a claim in here.

## Where it stands

The measurement and its gates are further along than their audience. The adoption reading of
**2026-09-03** found zero projects displaying the badge, against one star and three weeks of
published history. So the work here is two kinds — keeping the published data honest, which is
the discipline the project exists for, and getting it in front of the people it is for. Every
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
| **5** | The data tells its second story | tool vectors on both sides of most movements | state-of report #2 with per-tool attribution; rotation length decided on evidence |
| **∥** | Distribution *(maintainer)* | its own calendar, and someone else's answer | a badge merged somewhere that is not this repository |

---

## Phase 5 — The data tells its second story

**Goal.** The second state-of report says which *tools* grew, and the rotation is as short as
the runner allows.

**Scope.**
- [ ] **State-of report #2.** Waiting on data rather than on a date: tool vectors began
      accruing 2026-09-04 and a movement needs one on both sides, so the report can be written
      once the rotation has come round — sooner if the rotation is shortened, which is the item
      below. The September edition could say which servers moved; this one can say which tools,
      and which releases. It can also say what held — the movement report separates confirmed
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

**Why here.** The only phase with a real wait in it, and it is a wait for data rather than for
a date: the attribution does not exist until the rotation has measured both sides of a movement,
whatever anyone does. Shortening the rotation is the one lever on it.

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
