# Changelog

## Unreleased

Where a change lands when it is made, rather than in the release after it. Cutting a version
renames this heading to that version and dates it. Every other section here describes bytes
someone can install; this one describes the trunk, which is the difference to hold in mind
while reading it.

Phase 3 of the roadmap — others can add servers safely — and the hour of checking that came
first found the phase's own goal sentence was false where it mattered most. Three of its four
items were wrong about the mechanism and the fourth held; the pattern is exact three phases
running. None of this ships bytes to an installer except the `--no-persist` flag; the rest is
what the repository does with a stranger's pull request.

- **A stranger's launch command never runs in a process that can push — after merge, too.**
  The phase promised it, and on the pull request it was true: `ci.yml` runs under a read-only
  token. But the write-token rotation checked out with `actions/checkout`'s default
  `persist-credentials: true`, so `resweep.yml` and `self-badge.yml` launched every entry's
  command with the token sitting in `.git/config`. Every workflow holding `contents: write` now
  checks out with `persist-credentials: false` and hands the token to the push and nowhere
  else; `ci.yml` states `contents: read` explicitly. A test over the whole workflow directory
  holds it, and its four teeth were mutation-checked before it was committed — a token on the
  cross-check step, a token in a job env, a checkout keeping credentials, and `ci.yml` without
  its block each turn the suite red.
- **A `servers.yaml` pull request is measured read-only before a write token ever launches it.**
  `src/sweep/pr-check.ts` diffs the file by name against the base — `validateServers` first, so
  a malformed entry fails with the schema's own words — and measures what a write-token job
  would otherwise launch first: entries the pull request *added*, and entries whose launch
  fields (`command`, `dockerImage`, `aptPackages`, `needsGit`, `env`, `envValues`,
  `timeoutSeconds`, `notApplicable`) it *changed*. It measures with `persist: false` in Docker,
  writes nothing, prints the number, and refuses above a per-request cap before any launch —
  the cap derived from the retry arithmetic, since one 240-second entry can cost 720. A
  self-containerised command (`docker run …`, the form `github`, `grafana` and `terraform`
  take) is listed rather than run from a pull request; a maintainer measures it by dispatch
  after review. `.github/workflows/pr-check.yml` runs it on `pull_request` for `servers.yaml`,
  `permissions: contents: read`, no secrets, and its docblock states the real boundary: a
  read-only token and no secrets, inside Docker with the bridge network on — credential-free,
  not an airgap. One predicate, `isSelfContainerised`, replaces four copies of the same test
  across `run.ts` and `cross-check.ts`.
- **`npm run sweep -- --no-persist` prints a number and writes nothing.** The README's own
  instruction for measuring your server wrote `results/<name>/measurement.json`,
  `badges/<name>.json` and a `history.csv` row into the tree by default, and there was no flag
  not to — the one in-repo measuring path a contributor would follow violated the rule that a
  laptop's number is never the published one. The instruction now uses the flag, and a test
  reads the README to keep it that way.
- **The adoption reading is taken on a schedule, and only a count gets committed.**
  `.github/workflows/adoption.yml` runs monthly and on dispatch, under the Actions token
  (`tools/measure-adoption.ts` already fell back to it), with `timeout-minutes` the tool's own
  fetches lack, `npm test` before the commit as every bot job now does, and an ordering that
  cannot reach the commit step when the reading is unresolved — the exit as first written
  would have accepted a page whose date advanced with no number on it. `--render-only`
  re-renders `docs/adoption.md` from the committed reading without a token and without
  advancing `checkedAt`, so a wording change to the renderer no longer needs a network run to
  keep the page and the reading equal; a test asserts they are. GitHub's documentation says the
  Actions token is accepted by code search; no run in this repository has shown it yet, and the
  workflow says so until the first dispatch is green.
- **The registry scan is written down, as a crawl and a ranking with the human step left
  where it was.** `tools/scan-registry.ts` walks `registry.modelcontextprotocol.io/v0/servers`
  with `version=latest` — the registry deduplicates server-side; the client keeps `active` —
  at the API's cap of 100 a page, ranks npm and PyPI stdio packages by live weekly downloads
  (bulk for unscoped npm names, single lookups for scoped, pypistats paced with wait-and-retry
  on 429), drafts entries in the schema's shape or refuses each with its reason, emits the two
  owner strings the provenance judgment reads, writes one dated file to the path the operator
  names and nothing anywhere else, and prints a summary line an expansion commit can quote. The
  pure parts live in `src/sweep/registry-scan.ts` and are tested from live-derived fixtures. It
  claims nothing about provenance beyond emitting its inputs: the 2026-09-04 selection was a
  human judgment by org and repo, and the numbers that had been attached to it — a count and a
  page cap — were in a memory file rather than in this repository.
- **`CONTRIBUTING.md` says what an entry needs, in the order that goes green, and is held to
  the records it cites.** What an entry is, from the schema; the add-an-entry order that a red
  pull request taught — append, regen, a changelog bullet, `npm test`, the gate; the launch
  command as the records state it (`agent-device mcp`, `githits mcp`, `emailmd` need their
  subcommand; `hana-cli` is a separate bin with an upstream bug, not a subcommand case; `anki`
  and `grafana` need their stdio flag); checking locally with `--no-persist`, and why a
  laptop's number is never the published one; a `timeoutSeconds` from a measured cold install,
  read off the pull-request check's line, with the one entry whose value carries a recorded
  basis named as the shape rather than the others counted as a precedent; env names only and
  what `envValues` is for; what the pull request runs and what a reviewer checks before
  *Approve and run*; the wait after merge — `not-yet-run` until the rotation slot, which is
  dealt by position, so up to six Wednesdays — and that a maintainer *may* dispatch sooner, not
  a promise; what gets in, including that an entry expected to fail is a finding and that no
  metric floor is on record. Thirty-eight tests hold it, each derived from the file it cites —
  the field table from `FIELDS`, the categories from the validator's own message, the commands
  from `servers.yaml`, the weekday and shard count from `resweep.yml`, the laptop rule quoted
  from `ROADMAP.md` — and three of them were mutation-checked before commit. One sentence of
  `docs/METHODOLOGY.md` moved with it: the `not-yet-run` row said such a row appears "in interim
  leaderboards only"; a merged entry carries the status on the published leaderboard until its
  slot comes round.
- **A registry-scan lookup that gives up refuses that candidate; it no longer kills the run.**
  The scan's first real use crawled for seven minutes, then died on one package's `429` from
  pypistats after six attempts — and wrote nothing, because the file is written last. A failed
  download lookup is now a fact about that candidate: it is refused with the reason the lookup
  gave, the rest are ranked, and when pypistats has rate-limited the run the remaining PyPI
  lookups are marked unmetered with that reason rather than asked a few hundred more times. The
  JSON carries the count and the reason, and the summary line an expansion commit quotes says
  how many went unmetered and why, so the number is honest about what it covers.
- **`servers.yaml` no longer says of `agent-device` what the record refutes.** Its comment had
  the bare launch printing help and exiting 0, one of 68 subcommands; the only captured record
  is exit 1 with nothing on stderr, and the count was never sourced. The comment says that and
  no more.

## 0.13.2 — 2026-09-05

Both entries below close the same rule, found in two places on the same day: **a truncation may
never remove the evidence a published claim rests on.** Phase 2 had left one item open and, when
its exits were checked rather than taken on trust, a second thing of the same shape was sitting
behind one of them.

- **A declared `not-applicable` no longer depends on how much the server printed.** An entry
  declares that a failure is this harness's limitation and names the phrase that proves it;
  the status is only published while the failure's own text still contains that phrase. The text
  searched was the *truncated* tail, so an entry whose output grew until its evidence line fell
  into the elided middle turned its own declaration off — the row reverting to
  `startup-failure`, which is this project asserting that someone else's working software is
  broken. Measured before fixing: of the five entries declaring, all five still matched, two
  were already having their middle elided, and the narrowest surviving margin was 64 characters.
  The declared phrase now travels with the launch. `evidenceTail` protects its line from the
  noise filters — npm prints `safari-mcp`'s `EBADPLATFORM` on a line of its own, which the
  filter would otherwise delete before any budget applied — and anchors the layout on that line
  when the ordinary both-ends budget would elide it, reserving the elision cost first so a
  layout cannot buy the evidence by overrunning the limit. `clampNotes` replaces a blind
  `.slice(0, 700)` on the record's notes: that cut is after classification and so can never move
  a status, but it could leave a record asserting `not-applicable` with the sentence justifying
  it deleted. `windows-mcp` sits at exactly that cap today. Nothing changes wherever the evidence
  already survived, which is every record on disk, and a declaration whose evidence never
  appeared still fails — there is a test that it cannot be talked into conjuring one.
- **A divergence row cannot outlive the capture it was computed from.** A selection preserves
  every row it does not measure, and a re-sweep moves the capture of every server it does — so
  between the two, a row could go on being merged forward long after its capture was gone. Eight
  of twenty-four had reached that state. Nothing false was published: `isCurrent` hides a row
  whose hash no longer matches and the cell prints an em dash instead. What it cost was
  countability — the file looked complete while the number of rows had stopped meaning the
  number of usable rows, and the README's Claude table was drawing its comparison from a
  `github` cell it was therefore not printing. `dropStaleRows` now decides one layer earlier than
  `isCurrent`, at the merge, and every run ends by saying how many measured servers carry a
  current row, so the gap is a number rather than something noticed later on a page.
- **The unit-conversion band is marginal, and the tool framework overhead is charged once.**
  Found by the refresh the entry above called for, and caused by phase 2's own widening of that
  run from the top twenty to every measured server. The band converts wire bytes into what a
  client sends to the API, and it was derived as `claudeDelta / o200kFull` — a quotient whose
  numerator includes the overhead the API charges once per request however many servers are
  attached. On a 54,000-token server a fixed 328 tokens is noise. On `postgres`, 32 tokens on
  the wire, it is the whole number: 328 of its 348 Claude tokens, read as a ratio of **10.88×**.
  Folded into the published band that took the upper bound from 1.92× to 10.88× and made `audit`
  refuse threshold questions it had been answering correctly the day before — a stack's range
  five times wider than the measurement supports, because the once-per-request overhead was
  being multiplied in once per server. The band is now taken over `claudeDelta − probeDelta`,
  the run's own reading of that overhead, and `estimate` adds it back a single time for the
  stack. Across the same 86 rows the band is **0.19×–1.93×**, which is where it already was when
  it was measured over 23 — a quarter of the set predicting the whole of it, and the reason the
  five-fold reading was worth disbelieving. Two derivations of the band also became one:
  `published-stats` had its own copy, over a different row set and without the correction, so
  the pages could state a conversion the tool did not perform. They now ask the same function
  the audit converts with, and the count beside the band is the number of rows that produced it
  rather than the number in the file — `gitlab` sits in the run with an API error and a zero
  delta, and "across 87 servers" counted it.
- **The scheduled jobs run the guards before they publish.** A push made with `GITHUB_TOKEN`
  does not start a workflow, so CI has never fired on a bot commit — not once, on any of them.
  The jobs that move published data were the only ones whose changes nothing checked, which is
  exactly backwards, and it is why the band above sat wrong on the front page for an hour with a
  green tick beside it. `self-badge` and `resweep` now run the suite after regenerating and
  before committing. A drift guard is not a heuristic: one failing means the page the job is
  about to publish would state something the data does not, so it stops rather than pushes.

## 0.13.1 — 2026-09-05

One server changed status in this release, and the interesting part is the three issues that
were *not* filed. Phase 2 ended holding four upstream bugs to report; re-verifying each against
its current published version left one. Two were this harness's own doing — `hevy`'s dummy
credential, corrected in 0.13.0, and `accessibility-scanner`'s base image, corrected here — one
was `heroku`, already open under someone else's name, and one was real. So a single issue went
out and a comment went onto an existing thread. The measured set goes 86 → 87, the divergence
run 23 → 24, and the regression page's three sections from 17 + 64 + 5 to 17 + 64 + 6; that
widening run is also what exposed the drift in the last entry below.

- **`accessibility-scanner` measures, and was never upstream's problem.** It published
  `ERR_PACKAGE_PATH_NOT_EXPORTED` out of `playwright-core` and was on its way to being reported
  as a broken package. The package declares `engines.node` of `^24.15.0 || >=26.0.0` and the
  isolation image is `node:22-slim`; on `node:24-slim` it starts and measures 8,959 tokens
  across 33 tools, so the exports error was the symptom of an unsupported engine rather than a
  defect. Sixth row this project was publishing as a defect in someone else's software.

  Worth recording is *why* the record did not say so. npm announces the mismatch as
  `npm warn EBADENGINE`, and the evidence tail drops `npm warn`/`npm notice` lines as
  installer noise (`client.ts`), so what survived into the published record was the downstream
  module-resolution error and a bare `Node.js v22.23.2` — everything except the line that
  explained it. The rule earns its place most of the time, and this is the case where it cost
  a true reading; the version was in the record all along for anyone who thought to check it
  against the package's own `engines`.
- **The one real upstream bug is filed.** `hana-cli` publishes `bin.hana-cli-mcp`, whose
  entrypoint imports three subpaths of `@modelcontextprotocol/sdk` — a package absent from all
  50 of its declared dependencies, so it resolves in a checkout and never from the registry
  (SAP-samples/hana-developer-cli-tool-example#231). `heroku` is real too and was already filed
  by someone else (heroku/heroku-mcp-server#249); what we could add went there as a comment
  rather than as a second issue.

- **One number, one source: both pages derive the divergence band from the run.** README's copy
  of the band is regen-maintained; METHODOLOGY's was hand-written and held to
  `PUBLISHED_WIRE_TO_CLIENT_RATIO` by a test. That kept the two equal only while the constant
  tracked the run exactly — and the constant is a release-time snapshot deliberately allowed to
  lag — so they came apart the first time a sweep measured a new server, and CI went red: the
  run went 23 → 24 and README moved alone. METHODOLOGY's parenthetical is a `PAGE_CLAIMS` entry
  now, and the test derives the band from `results/divergence.json` rather than from the
  constant, so both pages state the run. The constant keeps a guard of its own, asking the two
  things that actually matter of a snapshot: the band still correct to the precision it is
  published at, and a count that never exceeds the run. The rule behind it, which this
  repository broke twice in one day in opposite directions: a number derived somewhere should be
  derived everywhere, or stated once and quoted.
- **Two published artifacts are dated by their data, not by the clock.**
  `results/capture-index.json` and `results/tool-shape.json` were stamped with the moment they
  were written, so each claimed to be as fresh as the last run over them rather than as fresh
  as the data behind them — and regenerating on any later day produced a diff whether or not
  anything had moved. Both now carry the newest measurement date they describe, which is the
  rule the dashboard was moved to for the same reason. `buildToolShapeBaseline` still defaults
  to today for a caller that supplies no measurement dates.

- **README stated a tool-shape baseline the data had left behind.** It said 1,150 tools across
  81 servers, in prose and again inside the `--suggest` sample block a reader compares their
  own output against, while `results/tool-shape.json` held 1,430 across 87. Both figures are
  maintained claims now. The page guard had been excusing them as "regen-maintained in
  results/tool-shape.json" and nothing maintained them — `PublishedStats` did not read the
  file at all. A false reason in the static list is worse than no entry, because it answers
  the question that would otherwise have found the drift.

- **The repository refuses a stale release, and cutting one is a single action.** Nothing here
  ships to npm; it is trunk, which this section describes. `npm run check:release` fails when
  regenerating would rewrite a committed artifact — meaning what is published is not what the
  data says — or when commits that ship bytes leave the Unreleased section empty, and CI runs
  it on every push so a release is never a cleanup job. Findings it cannot decide, such as a
  number written into source, print without failing. `release.yml` runs the gate, the suite,
  the cut, the two-commit bump, the push, the publish and the verification from npm in order;
  it dispatches `publish.yml` rather than absorbing it, because npm's trust is bound to that
  workflow and it is the one path that cannot be tested without publishing.

## 0.13.0 — 2026-09-05

Seven servers changed status in this release and **not one of them changed because the server
changed** — the same sentence the last release opened with, and it is still the point. Five were
defects here: two launch commands that spoke the wrong transport, a base image missing the
native libraries a .NET server needs, a placeholder credential that manufactured a crash, and a
classifier that read a word inside another word as a credential request. The other two are true
statements this harness could have made all along and did not: a backing service the isolation
deliberately withholds, and a runtime the vendor has not shipped. The measured set went 83 → 86
and the two remaining timeouts went to zero.

- **Five rows were calling a server broken that this harness was breaking.** Each was published
  as a failure this project should never have asserted, and each is now a true statement:
  - `anki` and `grafana` were **timeouts**, together costing twenty-one minutes of every sweep
    cycle. Neither was hanging on anything: `anki` serves HTTP on `127.0.0.1:3000` and takes
    `--stdio`, and the `mcp/grafana` image's ENTRYPOINT hard-codes `--transport sse` over a
    binary whose own default is stdio. Both now measure — 20,037 tokens across 50 tools and
    16,774 across 65.
  - `azure` was a **startup-failure** on a .NET stack dump that was the *bottom* of its output;
    the message above it reads "Couldn't find a valid ICU package installed on the system."
    `node:22-slim` carries neither libicu nor libssl3, and a .NET server needs both. With them
    present it measures 15,239 tokens across 68 tools.
  - `hevy` was a **startup-failure** this harness manufactured. `HEVY_API_KEY=dummy` clears the
    server's presence check and then dies as "Fatal error in main() { category: 'Error' }",
    which names no cause. With the variable empty it says "Hevy API key is required" and reads
    `auth-required` — it works, and it needs a credential the isolation will never have.
  - `slack` is the fifth, and the only one whose fix was in the classifier rather than in a
    launch condition — it was published as `auth-required` on a TLS failure reading "certificate
    signed by unknown authority". See the credential-word entry below; it is published as the
    startup-failure it is.

- **Two more rows moved because the honest status finally existed to put them in.** No defect
  was fixed for either; what changed is that this project stopped calling a limitation of its
  own a defect of somebody else's. `redis-legacy` reads `not-applicable` with its declared
  reason — the isolation deliberately provides no Redis — and the raw failure behind it.
  `local-mcp` is the same shape but upstream's calendar rather than ours: the vendor has not
  shipped a Linux runtime, so the package downloads its own Go binary and reports that "The
  Windows/Linux Go server is in preview", on both amd64 and arm64. Its evidence deliberately
  omits the version and the architecture, because both move and the sentence stating the fact
  does not.
- **Entries can name Debian packages the base image lacks** (`aptPackages`). The same argument
  as `needsGit`: these are libraries a user's own machine already has, so installing them moves
  the container towards what a plain `npx -y` run would find rather than away from it — unlike
  an environment variable that changes the server's own behaviour, which stays a separate
  decision. The isolation record names what was installed, so no number is published without
  saying what the container carried.
- **A movement can name the release it came from.** `measurement.json` has always recorded
  `serverVersion` from `initialize`, but it holds one sweep — the moment a re-sweep overwrote
  it, the earlier side of a diff was gone, and the regression report could say a movement was
  "a real upstream release landing in real context windows" without ever saying which.
  `history.csv` gains a seventh column and `ToolVectorEntry` an optional field, and
  `results/regressions.md` and the per-server pages gain a **release** column. Nothing is
  back-filled: a short row parses as unversioned and a stored vector does not acquire a version
  retroactively, because identical bytes are the same definitions and what upstream called them
  that day is not on disk. Two readings it can now state — `1.28.0 → 1.29.1`, and
  `still 1.29.1`, where the cost moved while the version did not, which is a dependency the
  server does not pin rather than a release of its own. Reading `history.csv` with a fixed
  six-column expectation will now see a seventh; `parseHistory` reads both shapes.
- **`isolation.arch` is observed rather than inferred, and the obvious fix was wrong too.** The
  field exists to tell a broken server apart from one that ships no build for the architecture
  it was tried on, and it was derived: the platform half assumed `linux`, the architecture half
  was the *host's* `process.arch`. Nothing passes `--platform`, but `docker run` honours
  `DOCKER_DEFAULT_PLATFORM` and an image with no manifest for the host is emulated, so an amd64
  container on an Apple Silicon machine recorded `linux/arm64`. `docker image inspect` does not
  answer it either — it reports the variant the local store prefers, and answered `linux/arm64`
  for a tag whose container came up `x86_64`. So a container is started and `uname -sm` read,
  once per image, mapped through an explicit table that returns nothing for a machine name it
  does not know. A command that is *itself* a `docker run` now records no architecture at all:
  this code did not choose that container, and the host's would be a claim about someone else's.
  `measuringArch` loses its `docker` parameter and answers only for the measuring process.
- **A cost that held is published as a measurement, not as a missing one.** `latestChange`
  returned `null` both for "this server has moved" being false and for "there is nothing to
  compare", and the report counted every `null` as an absence — so 64 costs that several sweeps
  had *confirmed unchanged* read exactly like a server measured once. `readSeries` answers with
  three readings instead of two, and `regressions.md` gained an **Unchanged** section: the page
  now says 17 moved + 64 held + 5 without, which sums to the measured set. "Most servers do not
  move, and the ones that do move up" is a finding it could not state before.
- **A word inside another word is not a credential request.** `classifyFailure` matched
  `/auth/i`, so a TLS failure reading "certificate signed by unknown authority" published as
  `auth-required` — a claim that a server works and wants a key, made about a server this
  harness could not reach. The credential words are now bounded by letter-only lookarounds
  rather than `\b`, which counts `_` and would have missed `tracker_token`. Every record on
  disk was re-classified against the new rule and exactly one moved, which is how the change
  was safe to make; `slack` is published as the startup-failure it is.
- **A deprecated package says so beside its number.** `gdrive` and `neon` were bare failure
  rows, which reads as "this server is broken" when upstream stopped shipping it — and
  `elasticsearch` was worse, a clean 374-token measurement of a package nobody should adopt
  with nothing on the row to say so. An entry can now carry a `deprecated` block, and it is a
  dated reading like every other one here: `version`, because an npm deprecation is per-version,
  `source`, because a published claim carries its evidence, and `readOn`, because both can
  change without anything in this repository moving.
- **`servers.yaml` is validated before anything measures from it.** Five call sites parsed it
  and cast straight to `ServerEntry[]`; nothing checked it. A misspelled key was an absent
  field, and an absent optional field was indistinguishable from one nobody wanted — so
  `timeoutSecond: 240` would have swept at the default budget for as long as it took someone to
  reread the line. `validateServers` checks entry shape, unique names, the slug a name becomes
  on disk, `env` holding names rather than values, and — the part nothing else did — rejects a
  key nobody reads instead of ignoring it.
- **The Claude divergence column refreshes beside the sweep, over every measured server.** It
  ran only in the Monday self-badge job while re-sweeps land on Wednesdays, so a re-measured
  row printed `—` for five days of every cycle; on 2026-09-05 that included `github`, the
  heaviest server in the set, in the front page's own Claude table. The re-sweep now refreshes
  it with the same selection string it swept with, so a Claude row and the capture beside it
  cannot come from different sets, and a bare run covers every measured server rather than the
  top 20 — the rank a row happens to hold no longer decides whether it has a number at all.
- **The band the installed package states offline is a snapshot, and now says so.**
  `PUBLISHED_WIRE_TO_CLIENT_RATIO` is the wire-to-client ratio used when no live divergence run
  is supplied, and it read `20 servers` from the day the run covered the top 20 — the pages
  derive the same band from the run, and nothing compared the two. Widening the run exposed it.
  The guard added is deliberately not an equality check: the run grows whenever a sweep measures
  a server for the first time, and those commits are made by a bot that cannot edit a TypeScript
  constant. A snapshot may lag; it may not be wrong. The band must stay accurate to the
  precision it is published at, because it decides an above/below verdict against a client
  threshold, and the count must never exceed the run.
- **Two pages stopped stating a number nothing kept true.** The dashboard was stamped with
  `new Date()`, so it claimed to be as fresh as the moment it was generated rather than as fresh
  as the data it was generated from; it is dated by its newest measurement now. And a guard over
  the front pages requires every count of the measured set to be either regen-maintained or
  written down as deliberately static with the reason — it found three hand-written figures on
  first run, and caught a fourth going stale in this release.

## 0.12.0 — 2026-09-05

Eight servers changed status while this release was made, and none of them is known to have
changed because the server changed. Four are retractions of claims this project should not
have published, two are the same kind of claim made wrongly again, and two moved for reasons
the repository cannot separate. All eight are written up below as what they are.

- **`not-applicable`: a status for "we cannot run this", so the set stops calling it broken.**
  `startup-failure` was doing duty for two different claims. One is about the server — it came
  up wrong. The other is about this harness: the package ships no build for the isolation's OS
  or architecture, or the server wants a backing service the isolation deliberately withholds.
  Publishing the second as the first asserts a defect in someone else's software that the run
  never established, which is what `safari-mcp` (`EBADPLATFORM`, darwin-only), `windows-mcp`
  (pywin32 publishes no wheels with a matching platform tag) and `kubernetes-containers` ("no
  current-context is set") had each been carrying. The bucket cannot be claimed by declaration
  alone: an entry states the reason **and** the text its failure is expected to contain, and it
  applies only when the failure's own words contain it. Nor does a declaration exempt an entry
  from a sweep — it is read out of a failure that already happened, never consulted before the
  launch — so the first time its shard comes round after it starts working, it simply measures.
  Neither retry applies to a declared entry, and retries are the expensive part of a sweep: 11
  failing servers cost 2,563 of 7,104 server-seconds in the run this was measured against.
  Published records and badges now carry a `status` no consumer has seen, and the exported
  `MeasurementStatus` union gains a member — which is why this is a minor and not a patch. One
  direction is not yet covered: corroboration is a substring test against the truncated evidence
  described below, so a declared entry whose output grew until its evidence line fell in the
  elided middle would fail the match and revert to `startup-failure` on its own.
- **A failure record now contains the failure.** The evidence kept for a dead server was the
  last 600 characters of its stderr, which is the right 600 only when the explanation comes
  last. It usually does not: `npx` prints a deprecation warning per transitive dependency, a
  CLI that rejects its environment says why once and then prints its whole help screen, and a
  crash prints its message above its stack. The budget now drops npm `warn`/`notice` lines and
  `at …` frames first — unless they are the entire output, which `neon`'s record of two
  deprecation warnings still is — then spends what remains on **both ends** of what survives,
  eliding the middle and cutting on line boundaries. One shape needed a further concession: a
  server whose whole message is a single JSON line longer than the head budget used to lose that
  line, because taking whole lines only left the head empty. Structured logging makes the most
  explanatory line the longest one, which is backwards from what the rule assumed, so an
  over-long first line is now truncated to the 356 characters the budget allows — `slack`'s
  published head is exactly that. Timeouts carry stderr too, which they never did: a process
  killed mid-hang never reaches the exit handler, so a timed-out record used to report only that
  the harness had waited. This runs on the path `measure` and `audit` take, so it rewrites the
  `notes` of a measurement taken on any machine, and such a note may now carry `[…]` in its
  middle.
- **Two records are still decided by which characters survived, not by what the server said.**
  `azure`'s old `auth-required` was an artifact: its raw tail was 600 characters of .NET stack
  frames, two carrying `PublicKeyToken=null`, and `token` was the only one of the auth pattern's
  seven alternatives to match anything at all. With frames dropped, what remains is a
  66-character orphan — `r(System.Diagnostics.Tracing.EventSourceSettings, System.String[])` —
  which reads as `startup-failure`. The label it replaced was false, but the evidence beside it
  is worse: 66 characters naming nothing, where 600 at least named
  `Azure.Mcp.Server.Program.Main`. It begins mid-word because the selector runs downstream of a
  raw 4,000-character slice that has already cut mid-token. `slack` fails the same test from the
  other side — its surviving head is "tls: failed to verify certificate: x509: certificate
  signed by unknown authority", and its published `auth-required` comes from `auth` matching
  inside `authority`, not from anything the server said about a credential. That record does not
  report a server wanting a token; it reports this harness's container not trusting a CA.
  Neither is corrected here, because a classifier change moves published statuses and wants a
  re-measurement behind it. Both are written down because publishing them quietly is the thing
  this project exists to refuse.
- **A timeout is the clock's verdict, not a word in the output.** Because those messages now
  carry stderr, the check that reads them was matching the bare word `timeout` against text the
  *server* wrote — so a server that printed "connection timeout" and then exited was filed as a
  timeout, which blames the clock for a breakage. It now requires this harness's own phrasing,
  `timeout after <N>ms waiting for`; the pattern is not anchored to the start of a message that
  carries the server's own output, so this is narrower rather than airtight. What follows is a
  swap and not a saving: a run reclassified out of `timeout` loses the doubled-budget retry and
  picks up the cold-cache one, floored at 240s in a Docker sweep.
- **Two entries were asking the wrong question.** `agent-device` was launched as bare `npx -y
  agent-device`, which exits non-zero writing nothing to stderr — a record whose whole content
  was that a process had ended. Its MCP server is a subcommand, and asked as `agent-device mcp`
  it measures **53,669 tokens across 57 tools**, second in the published set between `github`
  (54,622) and `comfyui-mcp` (50,640), on a package with 138,188 weekly downloads; its budget
  comes from a measured 142s cold install rather than a guess. The recovery is not cleanly
  attributable to the argv fix, and the records say so: the failing run was made on an arm64
  laptop and the measuring one in `linux/amd64` CI, so the command and the machine moved
  together. `google-surf` is the control — it went from `startup-failure` to 10,948 tokens on
  that same CI sweep with its entry untouched and nothing about it changed here. `stripe`
  separately drops `--tools=all`, which upstream removed in favour of permissions carried by the
  key; it now dies at the key-format check instead, reading "Invalid API key format. Expected
  sk_* (secret key) or rk_* (restricted key)." A shaped placeholder key was tried and reverted:
  the server accepts the shape, prints a startup banner and never answers `initialize` — 901s,
  the full budget plus its doubled retry. Starting is not answering.
- **A record says which machine made it.** `isolation` named the image and the network but not
  the architecture, so a reader had no way to tell a server that fails from a server that was
  never built for the machine that asked. `local-mcp` prompted it: a record whose stderr named
  an architecture the record itself did not, "LMCP 3.0.404 is not yet available for
  linux-arm64", from a run on an arm64 laptop. Every measurement now records `isolation.arch`,
  including a plain local `measure`; 52 of the 103 published records carry it so far, and absent
  means unknown on the rest, never "the same as yours". It is the measuring process's own
  platform rather than an observation of the container: under Docker the platform half is
  assumed to be `linux` and the architecture is the host's, so a run emulating a foreign
  platform would be recorded as the host's.
- **The re-sweep can be told what to measure, and publishes what it measured.** Repository
  plumbing rather than shipped bytes. Re-measuring three named servers used to mean re-running a
  whole slice for about seventy minutes, which is why they got run on a laptop instead; the job
  now takes a `servers` input mapped to the `--only` that `sweep-all` already had, and one
  `SELECT` expression feeds both the sweep and the cross-check so the two cannot end up on
  different sets. A slice cutting below the harness guard's five-server floor is refused rather
  than measured, since under it the guard cannot tell a broken runner from a bad week. And a
  62-minute run that measured all 51 of its servers published none of them, having hit conflicts
  in `results/leaderboard.md` and its neighbours — derived files that two runs regenerate from
  different starting points, so git was asked to merge two independently rebuilt leaderboards.
  The measured records commit and rebase first, the per-server files two runs touch being
  disjoint, and the aggregates are rebuilt from the merged tree afterwards.

Also: none of these status changes reaches the trend data. A failed measurement contributes no
row to `results/history.csv`, so a server that starts being measured, or stops, reads as a gap
in its series and never as a movement in its cost. And the composite action defaults to
`version: latest`, so a workflow already using it takes all of the above on its next run
without an upgrade step.

## 0.11.3 — 2026-09-04

The rest of the full-codebase review. Fourteen findings, none live in published output,
each fixed with its reproduction kept as a test. They sort into three habits.

**Answering more than was known.** `identify()` called a server *current* when what is
current for it could not be established — a missing pointer, or one aimed at a capture the
index had dropped as ambiguous — which the audit renders as "no server here is running a
published capture that has since moved", told to someone who may be far behind; unknown
currency now reads as unknown. Adoption counted *any* shields endpoint badge wrapped in a
link to this project as displaying ours, a coverage badge included: the URL cannot decide it
(self-hosted JSON lives wherever its author put it, and the staged action publishes to a
gist), so the badge's own label is now read, and captured for the first time — this is the
one number the project keeps about itself and the last place to be generous.
`fieldSelectionShare` could go negative, since the projection can *add* bytes, and rendered
as "−11.1% of the capture is MCP-only metadata". `percentileOf` took the top of a tie, so a
description tied with half the measured set was published as p100. `audit --config /typo`
reported having looked in the standard locations, which it had not done, and advised doing
the thing just done.

**Failing harder than the fact warranted.** One thrown error in `session-start` rejected
`Promise.all` and ended the process before anything was written, discarding every capture
already completed and skipping the cleanup that removes containers. `loadRows` threw on a
half-written `measurement.json` that `appendHistory` deliberately tolerates, so one truncated
file broke the leaderboard, server pages, dashboard, tool-shape baseline and published-stats
at once, with a `SyntaxError` naming no file; the dashboard now shares that loader rather
than keeping a second copy. `verify` crashed on a missing file or a non-JSON body — reachable
remotely, since a proxy or error page served with status 200 passes the fetch check —
producing a stack trace and empty stdout where `--json` is documented to put `{ok,…}`.

**Reading a label where the bytes were available.** `--claude` looked the published Claude
cost up by the config's own key, so a server called `github-work` that is byte-identical to
the published `github` printed `—`, which the report defines as "the install doesn't match
what was published"; it now joins by canonical hash first, as `--changed` in the same report
already did. `attribute()` matched tools by name, so a duplicated name lost one tool silently
and its tokens resurfaced as `unexplainedTokens` — explained to the reader as canonical-array
framing bytes — which is reachable both from a server shipping duplicate names and from
`measureTools` recording every nameless tool as the single invented key `(unnamed)`; where
names cannot identify tools there is no attribution to give. The `sole-config` baseline
fallback paired one config on each side without checking they were configs for the same
client. `loadConfigs` loaded one path twice when it was nominated twice. `cross-check`
published a comparison from a CLI report carrying `total: 0`, which renders as −100%.

Also: the two harness-fault checks were counted separately over different denominators, so a
flaky daemon that threw for 6 of 14 servers and timed out 4 more tripped neither. A server
that could have produced a number and did not is one fact however it failed; they now share
a threshold.

## 0.11.2 — 2026-09-04

A full-codebase review found the same failure in six more places: a number compared against a
line without establishing that the number was whole. Two were live in published files; four
were gates that passed.

- **The staleness gate now guards every published Claude figure.** README carried github at
  **54,622** from the measurement and, three lines below, **54,422** from a divergence row
  computed against bytes that no longer exist — `leaderboard.md` had already printed `—` for
  that row while `published-stats.ts` read the same run raw, the rule guarding one number and
  not its neighbour ten lines apart in one function. The badge column now comes from the
  measurement, the Claude column carries the em-dash the leaderboard already uses, and the
  ranges METHODOLOGY quotes are computed over current rows only, naming whichever shows the
  field-selection effect most rather than a server hardcoded into prose. The dashboard had the
  same class three times — Claude costs for four servers whose captures had moved, hardcoded
  prose contradicting its own table, and a count of sweeps labelled as days (`+200 / 3d` for
  an 18-day span) — and now shares the canonical gate instead of a second copy of the rule.
- **`--max-increase` no longer passes when a server was added and could not be measured.** Its
  cost is unknown, not zero, so the total it is subtracted from does not contain it; the
  comparison is now inexact and the gate refuses. This was the ordinary CI case — a server
  added in a PR has no credential on the runner — and it cleared even a zero-token allowance.
- **A baseline that cannot be read is never "no change".** `parseBaselineReport` shape-checked
  each config's `source` but not its `totalTokens`, so a hand-trimmed or `jq`-filtered report
  produced `after − undefined === NaN`; `typeof NaN` is `'number'`, so the gate reported an
  increase of **0** and passed. The baseline is refused at the door, and the gate now tests
  `Number.isFinite` rather than `typeof`.
- **`--budget` no longer passes on a total that is missing a server.** A server that fails to
  start contributes 0, so the stack read lighter than it is and the budget passed — on exactly
  the pull request the front page says this gate catches. It now fails when any audited server
  produced no number, naming which and saying which way the total is wrong. The server-level
  gate already refused this; the two now agree.
- **Movement attribution joins the capture in force, not the date.** Vectors are deduped by
  capture and keep the first date one was seen; the previous side of a change is the last row
  of the previous plateau. Those coincide only when a cost was measured exactly once, so with
  weekly sweeps the report almost always printed "only one of the two captures is on record"
  while holding both. It now resolves each side to the newest capture recorded on or before
  that day, prefers the one whose total is the number history recorded for it (a same-day
  re-sweep can leave two under one date), and still refuses when neither agrees — rather than
  attributing a delta to the wrong capture and publishing the mismatch as framing bytes.

## 0.11.1 — 2026-09-04

A review of 0.11.0 found three places where the new code stated something it had not
established — the failure this project exists to refuse, committed by the code written to
enforce it. All three are fixed, and each is now a named test.

- **A gate flag given without its value silently skipped the gate.** `measure --baseline b.json
  --max-increase` — the flag last, which is what a CI template renders from an empty variable —
  read as "no gate was asked for" and exited **0** on a change that should have failed the
  build. `--max-increase=100` failed the same way by a second door: the unknown-flag check
  splits on `=` and accepted it, while the reader only matched the bare token, so the flag was
  accepted and then invisible. This is precisely the green-check-on-a-gate-that-never-ran that
  `unknownFlags` was added in 0.4.0 to prevent, reached through doors it did not cover. Flag
  values are now read in one place that understands both spellings, and a value-taking flag
  present without a usable value is a **usage error (exit 2)**, refused beside unknown flags
  and for the same stated reason. `audit`, `measure` and `verify` all read through it, so
  `--flag=value` now works everywhere it is accepted.
- **A baseline describing a different server was diffed as though it described this one.**
  Nothing checked that `--baseline` belonged to the server being measured, so a crossed path in
  a monorepo produced a confident delta between two unrelated servers — and because an
  unrelated heavier baseline makes the delta *negative*, it read as an improvement and
  **passed** the gate. Both sides record the name the server gave itself at `initialize`; where
  both carry one and they disagree, the comparison is refused and the gate fails as
  unestablished. A measurement that predates the field, or a server that reports no name, stays
  unknown rather than mismatched — unknown is not evidence, the same rule the isolation column
  follows.
- **A capture hash shared by two servers named whichever was written last.** The capture index
  is keyed by hash across all servers, so one package listed under two slugs (the set already
  holds near-duplicate pairs) would let the later write silently rename the earlier server's
  capture, and `audit --changed` would print the wrong server with full confidence — the exact
  by-bytes attribution the feature exists to get right. An ambiguous hash is now dropped from
  the index, so `identify` answers `unknown`: an absence of a record, which is true.

## 0.11.0 — 2026-09-04

- **`measure --baseline --max-increase --budget`, and a composite action: server authors can
  now defend the number they publish.** The front page has always offered two halves — audit
  your own config, *or badge the server you publish* — and only the first half had a gate. A
  maintainer could display a cost and had no way to notice the release that added 1,200 tokens
  to every user's context, which the movement report shows is the norm and not the exception:
  nine servers ratcheting upward, none of them with a check that would have said so first.
  `measure` now takes the same flags `audit` does. Because both sides are single measurements
  carrying per-tool counts, an established change is attributed exactly — `added: bulk_export
  (43), grew: search 30 → 108 (+78)` — which the config-level diff cannot do. And it inherits
  the refusal that matters: a server that stops starting on the branch makes the total go
  *down*, so a change that could not be established fails the gate rather than passing as an
  improvement, and a budget that could not be checked fails rather than being skipped.
  `action.yml` wraps it as a composite action (`athakur3/mcp-context-cost@v1`), so adopting the
  gate is five lines instead of a hand-written workflow; inputs reach the shell through the
  environment rather than `${{ }}` interpolation, the CLI's exit code is the job's verdict, and
  `tokens` / `tools` / `status` / `measurement` / `badge` are exposed as outputs whether the
  gate passed or not. Guard tests assert the seam between the action's command line and the
  CLI's flags, which nothing in the type system connects.
- **`audit --changed`: which published version you actually have, decided by bytes.** The
  movement report says the ecosystem ratchets; this says whether *your* config is carrying it.
  The whole question is the join, and joining by name would be a confident false statement —
  a config's keys are labels a user chose, so a server called `github` may be a fork or a pin.
  So `results/capture-index.json` (`capture-index/v1`, derived from the tool vectors in the
  same regen pass) maps every published capture's `canonicalSha256` to the server and date it
  belongs to, and an installed server lands in exactly one of three states: **behind** a
  published capture that has since moved, carrying the exact tokens updating would add to
  every request and both dates; **current**; or **unidentified**, which is a version never
  measured here or one published before the index began, and about which nothing is claimed.
  Where the local label and the identified server disagree the report prints both
  (`notes (published as obsidian)`), because a name that disagrees with the bytes is a fact
  worth seeing. An index that cannot be fetched is a named problem, never a silently skipped
  check. README is the page inside the package, so this changes what an install carries.
- **The history stops being decoration: what the measured set's cost has *done* is published.**
  Every row's number was already re-measured on a rotation, and most entries launch unpinned,
  so the series has been recording real upstream releases landing in real context windows —
  and nothing read it back except a sparkline. `results/regressions.md`
  (`cost-regression/v1`, regenerated with the leaderboard) reports each server's most recent
  movement, and the first reading is a finding: **9 servers moved up against 1 that moved
  down, a net +4,357 tokens**, with `obsidian` +82% in a week, `blender` +27%, `arxiv` +23%.
  MCP servers ratchet, and nobody was counting.
  Three rules keep a delta a claim about a server rather than about the harness, and two are
  inherited rather than invented: comparisons happen only inside the run a trend line may be
  drawn across, so a change of isolation can never read as a change of server; a failed
  measurement contributes no row, so a server that stopped starting is a gap and never a drop
  to zero; and the pair compared is deliberately **not** the newest one — a server that grew
  once and held that cost since has a newest pair of zero, which would have hidden the largest
  movement in the set behind a week of stability, so the walk goes back to the change that
  produced today's cost and dates the window to when it happened. What the totals support on
  their own is the mechanism — *shipped more tools* versus *same tools, rewritten*, with a
  movement whose count and cost went opposite ways left as `mixed` rather than guessed.
  Per-tool attribution needs both captures and `measurement.json` keeps only the newest, so
  `results/<server>/tool-vectors.json` now accrues a short hash-deduped history (a server that
  has not changed writes nothing); until it covers both sides, the report says the breakdown is
  unavailable in those words rather than estimating one. A movement is called out only when it
  clears 5% *and* 25 tokens — relative alone would headline a fifth of a cheap server, absolute
  alone would headline drift on an expensive one — and everything comparable is listed either
  way. The leaderboard carries the aggregate, README states it as a maintained claim, and the
  regen order now folds history before generating the pages that describe it.

## 0.10.0 — 2026-09-04

- **`audit --suggest`: trim advice with a measured distribution behind it.** The roadmap's
  schema-size suggestions, built the only way this project gives advice — with a number
  attached and a population to place it in. Every published measurement already splits each
  tool into whole/description/schema token counts; a nearest-rank quantile table over all
  1,150 complete tool measurements is now published as `results/tool-shape.json`
  (`tool-shape/v1`, regenerated with the leaderboard, re-derivable from the same files —
  the suite asserts the committed baseline equals its own re-derivation). `--suggest`
  fetches it and advises only on descriptions — schemas are functional surface;
  descriptions are prose every request carries — and only at or above the 90th percentile,
  naming the exact percentile it fired at, the measured median it suggests trimming toward,
  and an explicitly approximate recovery. A config where nothing is measurably unusual is
  told that in those words; a baseline that cannot be fetched is a named problem, never a
  silently skipped check. README is the page inside the package, so this changes what an
  install carries.
- **The data gets its first state-of report.** The roadmap's "periodic data summary, when
  the deltas tell a story" — the deltas now do. Six findings, every number read from the
  data of 2026-09-04 and linked to its measurement, published as a dated reading at
  [docs/state-of-mcp-context-cost.md](docs/state-of-mcp-context-cost.md) and linked from the
  front page and README's status section. A dated essay is allowed to be a snapshot for the
  same reason adoption.md is: it says its date, and the live numbers stay the leaderboard's.

## 0.9.0 — 2026-09-04

- **A Docker failure on the measuring machine can no longer be published as a server's
  failure.** The 2026-08-26 re-sweep recorded `sequential-thinking` — 992 tokens on both
  prior sweeps — as a startup-failure because the runner's pull of the base image failed:
  `docker run` exited 125 without ever launching the server, both per-server retries re-ran
  through the same missing image and read as confirmation, and the harness guard stayed
  quiet because five servers must regress before it will blame the machine. Three changes
  close that seam. The base image is pulled, with retries, before any measurement depends on
  it; a `docker run` that fails as docker — exit 125 in docker's own stderr voice, which a
  contained server exiting 125 does not have — raises a harness fault instead of returning a
  measurement, so nothing is written and the previous record stands; and each runner handles
  the fault as its own honesty requires — the batch sweep names the servers it could not
  measure and publishes the rest, refusing the whole sweep when the faults reach the guard's
  own thresholds; the single-server sweep exits non-zero before a scheduled job can reach
  its commit step; `audit --docker` refuses the run whole rather than reporting every server
  in the config broken. The row the 2026-08-26 sweep got wrong was re-measured on 2026-09-03
  and stands at 1,003 tokens.
- **The numbers the front pages state are written by the regeneration that writes the
  leaderboard, and read against the data by the suite.** README and docs/index.md carried
  counts and dates as hand-written prose — "69 of 82", "sweeps of 2026-08-18 and
  2026-08-19", "46 of the 69 numbers come from…" — true the day they were written and
  drifting with every scheduled re-sweep: by 2026-09-03 the leaderboard said 68 measured
  while both pages said 69, the front-page-contradicts-the-data failure already repaired by
  hand once (2026-08-20). The deferral tables' fix — a test quoting the page against the
  code — is not enough here, because these numbers move when data moves, on a schedule, with
  nobody in the loop: a check alone would schedule its own red main. So the sentences that
  dated themselves are gone (each row carries its own date), and every number either page
  still states — the counts, the span, the sample tables, the Claude pair, the verify
  transcript — is a claim `regen` patches in place from `results/` and the suite asserts
  already agrees on the committed pages; the scheduled jobs commit README.md beside the data
  they change. The first verification caught a live drift: the count of rows still matching
  the published Claude run had moved 19 → 18 with the 2026-09-03 re-measurement of
  `mcp-atlassian`, and only the leaderboard had been told. README is the page inside the
  package, so this changes what an install carries.
- **The weekly divergence refresh covers the run it publishes, and METHODOLOGY's divergence
  prose is maintained like the front pages' numbers.** `npm run divergence` defaulted to
  re-measuring the top 15 while the published run holds 20 rows, so ranks 16–20 were carried
  forward from the original run and never refreshed on the Monday cadence — `blender`, rank
  19, sat blank behind its 2026-08-26 capture while the 15 rows above it refreshed twice.
  Run bare, the tool now writes the whole run — the top 20 by tokens today, exactly, so the
  file never holds a row the refresh no longer covers — and a count argument stays a
  touch-up that preserves the rest. The ranges METHODOLOGY quotes from that run had drifted
  the same way the front pages' counts had: it said the field-selection effect tops out at
  80.6% when the run says 89.9% (`xcodebuildmcp`), and that the ratio ranged 0.34×–1.92×
  "across the top 15" when it ranges 0.20×–1.92× across the 20. Those sentences are claims
  now — patched by regen, asserted by the suite — alongside the heaviest-on-each-tokenizer
  pair.
- **Publishing refuses a version the changelog has no section for.** This file's convention
  is that cutting a version renames the `Unreleased` heading to that version and dates it;
  0.8.0 was cut and published on 2026-08-21 with the rename skipped, so npm served bytes
  this file said were unreleased for thirteen days. The `0.8.0` heading below is that
  rename, made late, and the publish workflow now looks for the section of the version it
  was asked to publish and exits before `npm publish` when it is missing.
- **The leaderboard carries the other CLI's number beside ours.** The roadmap's cross-check
  column, built the way spec/upstream-notes.md specified on day one: the divergence is
  published, not discovered by critics. Each server is measured twice in one sitting — once
  by our client exactly as a sweep measures it, once by `sd2k/mcp-tokens` (release pinned,
  fetched and verified against the release's own SHA-256 before it is ever executed,
  bind-mounted read-only into the same container image, limits and package caches the
  measurement ran under), invoked with `--model gpt-4o` so both columns count o200k tokens
  rather than the CLI's cl100k fallback. The first rows settled the open question in the
  notes: the CLI's count lands within a fraction of a percent of our count of the
  name/description/input\_schema projection — not of the full capture — so its "unmodeled
  fields dropped" is, in practice, everything outside the three request fields, and the
  published percentage compares it against our `mappedTokens` of the same fresh capture:
  the disagreement of counters, with the field-selection gap already published per server.
  A row prints only while it compares like with like — the CLI saw the same tool names our
  fresh capture holds, and that capture is still the published one — everything else stays
  in `results/cross-check.json` as data and prints silence. Method `cli-cross-check/v1`;
  the rotating re-sweep cross-checks each week's shard minutes after re-measuring it,
  best-effort, so a CLI outage costs a week of silence and never a stale number.

- **The sweep grows by the registry long-tail: 106 candidates, 81 measured.** The official
  registry was scanned whole — 14,283 distinct active servers, 5,785 npm/PyPI stdio
  packages not yet tracked, 1,995 of those with a live weekly-download metric — and its top
  curated by provenance rather than counts alone: download counts are gameable, the scan
  surfaced a cluster that pattern-matches inflation, and that cluster was left out with its
  reasons recorded. Twenty-four entries landed, appended so no existing row changes
  rotation slot. Twelve measured on arrival — `comfyui-mcp` straight in at #2 (50,640
  tokens; 141k installs/week), `chrome-devtools-mcp`, the original curation's biggest
  omission at 3.3M installs/week, costing a modest 5,717, and `githits` and `emailmd`
  measurable only after their commands were corrected to the `mcp` subcommands their
  packages actually serve from — every one cross-checked within ±1.2% on arrival. Twelve
  are findings with their reasons on the leaderboard: packages broken as published (ESM
  resolution failing from a cold cache, a fatal on launch that survives one), hosts a
  container cannot be (two macOS integrations, one Windows), servers that block on a
  companion app through a doubled budget or dump usage without a kubeconfig, and services
  that validate credentials before naming their tools. A twenty-fifth candidate was dropped
  at the doorstep: AWS's SigV4 proxy serves a remote endpoint's tools, not its own, so
  there is nothing of its to measure.

## 0.8.0 — 2026-08-21

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
- **A published deferral table that stops describing the resolver now fails the suite.**
  Both pages that tell a reader what `audit` will say about their machine have drifted from
  `src/audit/deferral.ts` while every check reported success — the methodology table was
  repaired by hand on 2026-08-21 and the front page's on 2026-08-22, and nothing in 425
  tests had ever opened either page. Every row of both tables is now a case that names a
  machine, quotes the page's own words for it, and puts that machine to `evaluateDeferral`:
  the words have to be on the page as written and the resolver has to agree with them, so
  either side moving alone is a red check. The row counts are asserted, so a table cannot
  gain a row nothing checks, and the postures are read out of the union that declares them,
  so a posture the resolver can return with nothing published about it fails too. No change
  to the published package.

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
