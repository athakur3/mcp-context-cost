# Roadmap

Where this project is headed, and what a contributor can pick up. What already shipped is in
[CHANGELOG.md](CHANGELOG.md) and the git history — **a phase leaves this file when it ships**,
so the plan stays short and stays forward-looking. Phases 0, 1 and 2 shipped on 2026-09-05 and
have left it; what they built, and what they corrected, is in the changelog sections for
`0.12.0`, `0.13.0` and `0.13.1` and in the Unreleased section above them.

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

**Phases carry an order, not a schedule.** Nothing here has a start date, because a date on
development work is wrong in both directions: it rushes what is not ready and, more often,
delays what is. This file said phase 3 opened on 2026-09-21 for no better reason than that
phase 2 had been drawn as running to the 25th — and phase 2 finished on the 5th, five days
before it was scheduled to begin. The column below says what a phase is waiting for, which is
the only thing that was ever true. Dates live where a date is the point: a post, a dated
reading, the re-sweep cadence. They are all on the distribution track.

| phase | goal | waiting on | exit, in one line |
|---|---|---|---|
| **3** | Others can add servers safely | nothing | a stranger's entry is measured read-only before any write-token job runs it |
| **4** | `audit` reaches the stacks people run | nothing; shares no files with 3 | remote entries measured; three more clients, each with a who-pays row |
| **5** | The data tells its second story | tool vectors on both sides of most movements | state-of report #2 with per-tool attribution; rotation length decided on evidence |
| **∥** | Distribution *(maintainer)* | its own calendar, and someone else's answer | a badge merged somewhere that is not this repository |

---

## Phase 3 — Others can add servers safely

**Goal.** A `servers.yaml` pull request from a stranger gets a measured number before any job
holding `contents: write` ever runs its launch command — and *after* merge, too.

**The premise check, 2026-09-05.** Three of the four items were wrong about the mechanism, the
fourth held, and the walk along a stranger's actual path found the goal sentence itself was only
true on the pull request. The pattern is now exact three phases running: every item that quoted
a record held, every item that inferred did not. What the records established:

- **The goal was false after merge.** `resweep.yml` holds `contents: write` and checks out with
  `actions/checkout@v5`, whose default `persist-credentials: true` leaves the token in
  `.git/config` while an entry's launch command runs. Nothing in the phase listed it. One line
  fixes it — `persist-credentials: false`, the token supplied only to the push — and it is the
  boundary the whole phase claims.
- **Half the first exit was already met.** `ci.yml` runs on every pull request, fork or not,
  under a read-only token, and its `npm test` runs `validateServers` over the checked-out
  `servers.yaml` — a malformed entry already fails. The other half could not pass at all: a
  pull request that appends a real entry is red today in `npm test` (the published-stats drift
  test asserts regen would rewrite nothing) and again in the readiness gate (a commit touching
  `servers.yaml` with no changelog bullet). The order that goes green is append → regen →
  changelog bullet → `npm test` → gate, and nothing told a contributor so.
- **"Measures only the entries the PR added" does not reach the goal.** A pull request that
  changes an existing entry's `command`, `dockerImage`, `aptPackages`, `needsGit`, `env` or
  `envValues` changes what the write-token rotation launches next, and "added" never sees it.
  The set to measure is added *and relaunched*.
- **The read-only token is not the whole boundary, and the item implied it was.** The launch
  runs in Docker with the bridge network on by design — credential-free, not an airgap; egress
  is not prevented. And a first-time contributor's workflows do not run unattended: repository
  policy already holds them for a maintainer's *Approve and run*. The read-only job is what makes
  that click safe, which is the right shape.
- **`sweep-all` cannot be the measuring command** — it always persists, then rewrites
  `results/` and `docs/`. The job needs its own script with `persist: false`, which
  `measureServer` already takes. Nor can the README's own "Measure your own server" instruction
  be followed by a contributor: `npm run sweep` writes `results/<name>/measurement.json`,
  `badges/<name>.json` and a `history.csv` row into the tree by default, and there was no flag
  not to. The only in-repo measuring path violated the laptop rule.
- **The registry scan had the least evidence behind it.** The tier-2 pass it proposed to run
  landed on 2026-09-04. The "14,283 servers" and the 500-page cap exist in a memory file, not
  in this repository — live, uncapped, it is 27,244 latest names in 405 seconds. The registry
  deduplicates server-side (`version=latest`), `limit` is capped at 100, and the step that
  actually chose the entries — provenance by org and repo — was never a script. What was "at
  risk of being lost" was a human judgment. The scan is still worth having, reproducibly, with
  that stated.
- **`servers.yaml` carried a refuted claim.** The `agent-device` comment said the bare launch
  prints help and exits 0, one of 68 subcommands; the 0.12.0 refutation found the only captured
  record is exit 1 with nothing on stderr and the count unsourced. `hana-cli` is not a subcommand
  case either — it declares a separate bin, and its failure is an upstream packaging bug. And of
  seventeen `timeoutSeconds` values, one carries a measured basis.
- **The adoption workflow held**, with amendments: the 2026-09-19 reading is a dispatch of it
  rather than a cron that first fires in October; a job holding a write token needs
  `timeout-minutes`; an *unresolved* reading advances the page's date with no number, which the
  exit as written would have accepted.

**Scope**, in build order — the dependency decides it.
- [ ] **`persist-credentials: false`** on every write-token checkout, the token reaching only
      the push, held by a test in `test/workflows.test.ts`.
- [ ] **The adoption workflow** — monthly cron plus `workflow_dispatch`, `timeout-minutes`,
      `npm test` before the commit as the other scheduled jobs do, and it never commits an
      unresolved reading. `--render-only` on the tool, so a renderer change can be re-rendered
      offline without advancing `checkedAt`.
- [ ] **`--no-persist` on `npm run sweep`**, and the README's measuring instruction rewritten
      to use it: a contributor checks a number; CI publishes one.
- [ ] **The `pull_request` measurement job.** `src/sweep/pr-check.ts` diffs `servers.yaml` by
      name against the base, runs `validateServers` first, measures added and relaunched entries
      with `persist: false` in Docker, caps the count per pull request and refuses above it
      before any launch, lists a self-containerised (`docker run …`) command rather than running
      it from a pull request, prints the number, writes nothing. `permissions: contents: read`,
      no secrets, `timeout-minutes` derived from the retry arithmetic.
- [ ] **CONTRIBUTING.md**, after the job it describes. The add-an-entry order that goes green;
      env var names only and what `envValues` is for; a `timeoutSeconds` from a measured cold
      install; the subcommand lesson as the records state it (`agent-device mcp`, `githits
      mcp`, `emailmd`); a laptop number is never the published one; what a reviewer checks before
      *Approve and run*; and what happens after merge — the entry sits `not-yet-run` until its
      rotation slot comes round, which is a fact `docs/METHODOLOGY.md` currently states as
      shorter than it is.
- [ ] **`tools/scan-registry.ts`**, honest scope: crawl `version=latest`, keep `active`, rank by
      live weekly downloads, draft entries in the schema's shape or refuse with a reason, emit
      the two owner strings the provenance judgment uses, write only to the path the operator
      names, and print a one-line summary an expansion commit can quote.
- [ ] **Correct `servers.yaml`'s `agent-device` comment** to what the record establishes.

**Exit.**
- Every workflow holding `contents: write` checks out without persisting credentials, and a
  test says so.
- A pull request appending a real entry, with regen and a changelog bullet committed, is green
  in `ci.yml` and shows the entry's measured tokens in `pr-check.yml` without writing anything;
  one changing an existing entry's launch fields measures that entry too.
- The adoption workflow has run once by dispatch and once on schedule, and `docs/adoption.md`
  carries a count from each.
- `npm run sweep -- --no-persist` writes nothing under `results/`, `badges/` or `history.csv`.
- `npm run scan-registry -- --out <path>` writes one dated file there and nothing elsewhere.

**Why here.** Contributions follow distribution, and the safety check must exist before the
first outside pull request arrives — not after. Runs beside phase 4; the two share no files.

**Left to the maintainer.** `main` is unprotected, with no CODEOWNERS and no pull-request
template; the merge is guarded only by the click. Whether to protect the branch is a repository
setting, not a build item.

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
- Widening the failure taxonomy again without a corroboration rule for the new bucket.
- Bumping methodology v1.0 for anything above: none of it touches canonical bytes,
  `totalTokens`, or a hash.
