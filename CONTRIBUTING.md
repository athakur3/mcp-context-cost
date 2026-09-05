# Contributing a server

The most useful contribution is an entry in `servers.yaml`. This file says what an entry is,
the order of steps that leaves a pull request green, what the pull request's check does with
it, and what happens to it after merge. Every rule below names the record it rests on — a
file in this repository, a changelog section, a workflow — because the rules were learned
from published mistakes, and a rule with its record beside it can be checked before it is
followed. Where this file and a record disagree, the record wins; say so in a pull request.

The measurement itself is defined in [docs/METHODOLOGY.md](docs/METHODOLOGY.md). This file
does not restate it.

## What an entry is

`servers.yaml` is the hand-edited input behind every published number, and YAML's failure
mode is silence: a misspelled key parses, loads and does nothing, so
`src/sweep/servers-schema.ts` refuses any key nothing reads. The fields it knows are these,
and no others:

| field | | what it is for |
|---|---|---|
| `name` | required | A slug. It becomes `results/<name>/`, `badges/<name>.json` and `docs/servers/<name>.md`, which is why the shape is pinned. |
| `command` | required | The exact line a user runs — `npx -y …`, `uvx …`, or a `docker run …` of the vendor's own image. For an OAuth-walled endpoint it is the URL, with `remote: true` beside it. See [the launch command](#the-launch-command-is-not-the-package-id). |
| `package` | required | What was installed: the npm name, `<name> (PyPI)`, an image reference `(docker)`, or the remote form the file already uses. |
| `env` | required | The environment variable **names** the server wants, as a list — possibly empty. Never values. See [env](#env-names-never-values). |
| `metric` | required | The install figure the row is ranked by, a non-negative number. |
| `metricSource` | required | Where `metric` was read, in one of the forms below. |
| `category` | required | One of `official-reference`, `vendor-official`, `community` — the leaderboard groups on it. |
| `repo` | required | The source repository, the URL a reader follows to check provenance. |
| `remote` | optional | `true` marks an endpoint that is listed, not measured; the schema then requires `command` to be the URL. |
| `dockerImage` | optional | A base image other than the default, when the package says so — `accessibility-scanner` declares a Node engine the default image does not carry, and its comment records that. |
| `timeoutSeconds` | optional | The launch budget, replacing the rotation's default. See [timeoutSeconds](#timeoutseconds). |
| `needsGit` | optional | Install git inside the container before launch, for a `uvx --from git+…` install (`redis`, `serena`). |
| `aptPackages` | optional | Debian packages the runtime needs that the slim image lacks (`azure`); the isolation record names them. |
| `envValues` | optional | A shaped placeholder for a name in `env`, for a server that parses the variable before `tools/list`. See [env](#env-names-never-values). |
| `notApplicable` | optional | A declared harness limitation — `reason` and the `evidence` text the failure must contain. Corroborated on every sweep, never taken on trust: [METHODOLOGY](docs/METHODOLOGY.md#failure-taxonomy--no-silent-drops). |
| `deprecated` | optional | The package's own deprecation: `version`, `source` URL, `readOn` date, optional `replacement`. The row stays and is annotated. |

Which fields are required, and what each check says when it fails, is the table `FIELDS`
and the validator in `src/sweep/servers-schema.ts`; `test/contributing.test.ts` holds this
list to that one.

**The categories.** No page defines the three beyond the validator's enum and the file's own
section headings. What the file shows: `official-reference` is the
`modelcontextprotocol/servers` reference set; `vendor-official` holds servers whose `repo`
is the organisation of the product they front (`playwright` under Microsoft, `stripe` under
Stripe); `community` is everything else.

**The metric.** Two forms cover nearly the whole file, and the number is the one the endpoint
returned on the day the entry was written:

- npm — `https://api.npmjs.org/downloads/point/last-week/<pkg> (npm weekly)`, the point
  endpoint's `downloads` figure;
- PyPI — `https://pypistats.org/packages/<pkg> (PyPI weekly)`, the last-week figure on that
  page.

A server that is a Go binary or an image has no download count, and the file uses the
repository's GitHub stars with the reason in the parenthetical (`github`, `grafana`,
`terraform`). The parenthetical may carry a note; the base form stays. Be plain about what the
number is: the schema checks only that `metric` is a non-negative number and `metricSource`
a non-empty string, no job re-reads the source, and the row is ranked by the number as
written. It is published unverified, on the day it was read, and it goes stale from that day.

## Add an entry

A pull request that appends an entry and stops there is red today — not in review, in CI.
`npm test` reads the committed `servers.yaml` and asserts that regenerating the published
pages would change nothing (`test/published-stats.test.ts`), and a new row changes the
candidate count and adds a `not-yet-run` line to the leaderboard; and the readiness gate
(`tools/release-readiness.ts`) fails any non-`chore:` commit since the last release that
touches `servers.yaml` while `## Unreleased` in `CHANGELOG.md` carries no bullet at all. The
order that goes green:

1. **Append the entry at the end of the file.** Never insert it in the middle:
   `src/sweep/shard.ts` deals rotation slots by position, so an insertion shifts every entry
   after it into a different week. The dated block at the end of `servers.yaml` says the
   same in its header. Appending leaves every existing row's slot where it was.
2. **Run `npx tsx src/sweep/regen.ts` and commit what it rewrote.** The gate prints the list
   of files regen would change; do not guess at it. The README's candidate count, the
   leaderboard, the dashboard and the server index are all derived from `servers.yaml` and
   `results/`, and the committed copies have to match — that is what `tools/release-readiness.ts`
   checks on every push, in a throwaway copy of the tree, and fails as stale when they do not.
   Your entry appears in those files as `not-yet-run`, which is correct: nothing has measured
   it yet.
3. **Add one bullet under `## Unreleased` in `CHANGELOG.md` naming the entry.** The gate's
   second check, "the changelog says nothing about work that ships", fails any non-`chore:`
   commit since the last release that touches `servers.yaml` while that section has no
   bullet. It tests only that a bullet exists (`section.includes('\n- ')` in
   `tools/release-readiness.ts`) and never reads what the bullet says, so a section that
   already carries someone else's bullet lets an unmentioned entry through. Naming the entry
   is the convention, not the gate; the line `src/sweep/pr-check.ts` prints at the end of
   every run says the same — add a bullet, or start the commit subject with `chore:`. That
   prefix belongs to the bots' commits; write the bullet.
4. **Run `npm test`.** The suite validates the whole file (`test/servers-schema.test.ts`), so a
   misspelled key, a value in `env`, a category outside the enum or a duplicate name fails
   here in the schema's own words, before anyone reads the diff.
5. **Run `npx tsx tools/release-readiness.ts`.** It is the readiness step in `ci.yml` (the
   badge golden tests run after it), and it says `ready` or names the stale file.

Commit nothing under `results/`, `badges/` or `docs/servers/<name>.md` for the new entry.
Those come from CI after merge — see [after merge](#after-merge).

## The launch command is not the package id

A registry listing gives a package name. The line that starts the MCP server is often not
`npx -y <that name>`, and the repository learned this one entry at a time. Three shapes are on
record, each with its entry's `command` quoted from `servers.yaml`:

**A subcommand.** The bare package is a CLI whose MCP server is one of its commands:

- `npx -y agent-device mcp` — launched bare, `agent-device` exits non-zero writing nothing
  to stderr; that record's whole content was that a process had ended
  ([CHANGELOG 0.12.0](CHANGELOG.md)). Named as `agent-device mcp`, it measured — though the
  changelog is careful that the failing run and the measuring run were on different
  machines, so the recovery is not attributed to the argv alone.
- `npx -y githits mcp start`
- `npx -y emailmd mcp`

**A separate bin.** `hana-cli` is a different case, not a subcommand: the package declares a
second binary, so the entry is `npx -y -p hana-cli hana-cli-mcp`. It still fails from a
registry install, because that entrypoint imports a dependency the package does not declare —
an upstream packaging bug, filed and recorded in the entry's comment. The entry shows the
shape of the problem, not a recovery.

**A transport flag.** A server whose default transport is not stdio serves HTTP while the
harness waits on its stdin, and the run reads as a timeout:

- `npx -y @ankimcp/anki-mcp-server --stdio` — `anki` sat published as a timeout, read as "a
  desktop application is absent", until a probe showed it serving HTTP on a local port. The
  entry's comment says in so many words: a registry package id does not reveal its invocation.
- `docker run --rm -i -e GRAFANA_URL=http://localhost:3000 -e GRAFANA_SERVICE_ACCOUNT_TOKEN=dummy mcp/grafana --transport stdio`
  — here the image's own entrypoint forces SSE and the flag overrides it; the comment records
  how that was read off the image.

So before writing `command`, read the package's `bin` field, its `--help`, and its README's
quickstart — METHODOLOGY's rule is that a server is measured at its documented default
configuration, which is the README quickstart command with required variables set to dummy
values. Then check the line the way [the next section](#check-it-locally) describes.

Two shapes the pull request's check treats differently. A `command` that is already its own
`docker run …` is **listed, not launched** by the check: the harness would spawn it against the
runner's own daemon with the pull request's argv, so the check prints

> listed, not launched here — its command is its own `docker run`, which the harness would
> spawn against this runner's daemon with the pull request's argv. A maintainer measures it via
> resweep.yml servers=<name> after review.

and moves on with exit 0 (`src/sweep/pr-check.ts`). And an entry with `remote: true` is
listed and never launched anywhere: an OAuth-walled endpoint never reaches `initialize`
without credentials, and measuring one with a real key is on the roadmap's
[not-planned list](ROADMAP.md#not-planned). A remote endpoint that needs no credential is
measured through the `mcp-remote` bridge instead, with `npx -y mcp-remote <url>` as its
`command` and no `remote` flag (`cloudflare-docs`, `deepwiki`).

## Check it locally

```bash
npm ci
npm run sweep -- --no-persist --docker --name <name> --command "<cmd>"
```

That prints one line — `<name>: N tokens across M tools (measured)`, or the status and the
server's own words when it did not measure — followed by

> nothing written: results/<name>/measurement.json, badges/<name>.json and the
> results/history.csv row are published only by CI (.github/workflows/resweep.yml), never from
> a developer machine.

and exits 0 for `measured` or `dynamic`, 1 otherwise (`src/sweep/run.ts`). Three things to
know about it:

- **It runs the command line alone.** The CLI does not read `servers.yaml`: `env`,
  `envValues`, `needsGit`, `aptPackages`, `dockerImage` and `notApplicable` are not applied
  unless you pass what the CLI takes (`--timeout <ms>`, `--docker`, `--docker-image`). A server
  that wants a variable will fail differently here than in the check, which applies the
  entry. The default budget is sixty seconds; a cold install under Docker may need
  `--timeout 240000`, the rotation's budget.
- **Without `--no-persist` the same command writes** `results/<name>/measurement.json`,
  `badges/<name>.json` and a `results/history.csv` row into your checkout, and nothing in
  `.gitignore` refuses them. Those files must not be in the pull request.
- **The number it prints is never the published one.** The roadmap's not-planned list states
  the rule: "Publishing any measurement taken on a developer machine. CI measures; the
  laptop probes." The record behind it is `local-mcp`, published as a startup failure from
  an arm64 laptop when the finding was the laptop — it took recording `isolation.arch` on
  every measurement to tell the two apart ("A record says which machine made it",
  [CHANGELOG 0.12.0](CHANGELOG.md)), and `resweep.yml`'s header says why re-measuring a
  handful of entries never needs a laptop: a developer machine is a different architecture
  under different load, and a measurement taken there describes it rather than the server.

Use the command above rather than a hand-written `docker run` probe. The harness caps every
launch, and `measureServer` force-removes every container it created in its `finally` block
(`docker rm -f`, `src/sweep/run.ts`) because, as the comment above that block records, some
servers don't exit on stdin close (background timers keep the event loop alive) — the
container outlives the CLI that started it. A hand-written probe has neither the cap nor the
cleanup.

## timeoutSeconds

Leave it out unless the check shows the launch needs more than the default. The rotation and
the pull request check both run with `--default-timeout 240` because a fresh runner shares no
package cache and every entry pays a cold install (`resweep.yml`, `pr-check.yml`); an entry's
own `timeoutSeconds` replaces that default.

When you do set it, take the number from a measured cold install on a runner, not from a
neighbour. The check's line for a launched entry ends with the seconds it took —
`<name> (added): N tokens / M tools (measured, Ss)` — and that is the whole launch as the check
saw it, on a runner with no package cache (`summarise` in `src/sweep/pr-check.ts`). The local
line prints no duration, and a measurement's `timeoutMs` is the budget it ran under, not the
time it took. Write the measured figure in a comment beside the field, the way `agent-device`
does — "Cold install measured at 142s uncontended" beside `timeoutSeconds: 420`, the budget
the changelog says came from a measured install rather than a guess.

The other `timeoutSeconds` values in the file are not a precedent to copy: `agent-device`'s is
the one that carries a recorded basis, and the rest have no comment saying how they were
chosen. A copied value is a guess with a citation.

What a timeout costs is why the number matters. A `timeout` is retried once on
`TIMEOUT_RETRY_FACTOR` times its budget (`src/sweep/run.ts`, double), so a timed-out entry
holds a rotation runner for its budget once and then twice more — and retries are the
expensive part of a sweep ([CHANGELOG 0.12.0](CHANGELOG.md)). The pull request check refuses,
before any launch, a selection whose worst case exceeds what its job limit was sized to, so
a large `timeoutSeconds` can be the reason a check refuses to run.

## env: names, never values

`env` is a list of variable names. The schema rejects anything that is not a name a shell
accepts — `NAME=value` fails on shape — and in Docker mode every listed name is injected as
`NAME=dummy` (`src/sweep/docker.ts`). The measurement records the names and nothing else.

Some servers parse a variable's **shape** before ever reaching `tools/list` — a URI scheme, a
URL — and crash on `dummy` rather than on the absence of a real credential. `envValues` is for
those: a locally scoped placeholder that clears the parse step and is still not a credential.
`elasticsearch` sets `ES_URL` to a localhost URL, `keboola` sets `KBC_STORAGE_API_URL` to the
vendor's base URL, `neo4j-cypher` gives `NEO4J_URI` a `bolt://localhost` address; the
`DockerOptions` docblock in `src/sweep/docker.ts` names the failure that motivated it. The
schema requires every `envValues` key to be listed in `env`, because Docker mode iterates
`env` — an override for a name the entry never asks for is injected by nobody.

Two entries show the placeholder cutting the other way, and both are worth reading before
adding one. `stripe` has no `envValues` on purpose: a shaped key gets past the format check,
the server prints its banner, and it never answers `initialize` — the full budget and its
retry, and a record that says `timeout` instead of the truth. The literal `dummy` fails in
seconds with a message that names the cause. `hevy`'s honest placeholder was the empty string:
`dummy` got past a presence check and died with a message that named nothing.

A server that needs a real credential to list its tools is published as `auth-required`.
That is a finding, not a defect in the entry: the taxonomy in
[METHODOLOGY](docs/METHODOLOGY.md#failure-taxonomy--no-silent-drops) reads it as "won't start
or list tools without real credentials", and the second slice of the long-tail block in
`servers.yaml` was added expecting exactly that status — findings, not omissions.

A `command` that is itself a `docker run` carries its placeholders inline, because the
harness does not wrap a command that is already a container. `github` puts
`-e GITHUB_PERSONAL_ACCESS_TOKEN=dummy` on the line — the `NAME=dummy` shape. `grafana` puts
`-e GRAFANA_URL=http://localhost:3000` beside `-e GRAFANA_SERVICE_ACCOUNT_TOKEN=dummy` — a
shaped localhost URL for the variable the server parses and `dummy` for the one it only
carries, the same judgment `envValues` makes for a wrapped command. List the names in `env`
as well, so the record carries them.

## What happens on the pull request

What runs on `pull_request`, all of it under a read-only token:

**`ci.yml`** — the typecheck, `npm test` (which includes `validateServers` over your file and
the drift test that expects regen to change nothing), the readiness gate, and the bash badge
tests. This is the half that was already true before the check below existed: a malformed
entry failed here.

**`pr-check.yml`** — runs only when `servers.yaml` changed, with `permissions: contents: read`,
no secret referenced, and the checkout's credential not persisted. It runs
`src/sweep/pr-check.ts`, which diffs your `servers.yaml` against the base branch's **by name**
and measures what a write-token job would otherwise launch first: entries the pull request
**added**, and entries whose launch fields it **changed** — `command`, `dockerImage`,
`aptPackages`, `needsGit`, `env`, `envValues`, `timeoutSeconds`, `notApplicable`. A metric or
repo edit relaunches nothing. It measures in Docker with the rotation's budget
(`--docker --default-timeout 240`), one entry at a time, with `persist: false`: the number is
printed in the check log and nothing is written. The measured line is not the published
number and must not be quoted as one — a fresh runner resolves `@latest` on its own day.

Its refusals all happen before any launch and exit 2, so "nothing ran" reads differently
from "the entry failed": a head that does not parse, a head that fails the schema, more
entries than the cap on its run line (`--max-entries 4` — one entry can cost its budget and
the doubled retry, and the job's `timeout-minutes` is sized to that many of those), and a
selection whose summed worst case exceeds that same budget even under the cap. Each prints why
and asks you to split or shorten the pull request. A `docker run …` command is listed, not
launched, as [described above](#the-launch-command-is-not-the-package-id).

The exit policy, by the outcome of each launched entry (`failsCheck` in `pr-check.ts`):

- **pass**: `measured`, `auth-required`, and a declared `not-applicable` — findings the
  leaderboard publishes today.
- **fail**: `startup-failure` and `timeout`, which mean the entry does not launch as
  written, and `dynamic`, which means two captures disagreed and there is no one number to
  show. The evidence tail is printed so you see what the server said.

A Docker fault on the runner is reported as the runner's problem, not the entry's, and exits
1 saying so.

**If this is your first pull request here**, the workflows above wait for a maintainer's
*Approve and run* — repository policy holds a first-time contributor's runs. The check's
properties are what make that click safe: read-only token, no secrets, the launch inside a
resource-capped container. The container has the bridge network on, because `npx` and `uvx`
fetch the package at startup, so it is credential-free rather than an airgap; the
`pr-check.yml` header states that boundary exactly.

**What the reviewer checks** — the things only a reader can:

- `command` is what the package documents, not what happened to start.
- `env` holds names only, and any `envValues` placeholder is scoped to localhost or the
  vendor's own base URL, never a working credential.
- `metricSource` resolves, and the number on it is the number in `metric`.
- `timeoutSeconds`, if present, has a measured basis in a comment.
- Provenance: the registry name's owner and the repository's owner agree, or the entry's
  comment says why not. This is a human judgment — the long-tail block in `servers.yaml`
  records it as "provenance-checked by org and repo", and the registry scan
  (`tools/scan-registry.ts`) emits the two owner strings for it — and no script makes it.
- A `dockerImage`, `aptPackages` or `docker run …` command chosen by the contributor, each
  read for what it would run on the rotation's runner.

## After merge

Your entry is listed as `not-yet-run` — on the leaderboard (`src/sweep/report.ts`) and in
the server index (`docs/servers/index.md`) — and its own page under `docs/servers/` does not
exist until it has been measured. That lasts until its rotation slot comes round:
`resweep.yml` measures one slice of the list each Wednesday, the slices are dealt by position
(`src/sweep/shard.ts`), and the default cuts the list into six, so the wait is up to six
Wednesdays. The bot's commit that week carries the measurement, the badge, the history row
and the page, and regen rewrites the derived files around them.

A maintainer *may* measure it sooner by dispatching `resweep.yml` with `servers=<name>` —
minutes rather than hours, on the same runner under the same isolation. That is an option the
workflow offers, not a promise this file makes.

## What gets in

- **An entry expected to fail is still a finding.** Every candidate appears in published
  results with exactly one status ([METHODOLOGY](docs/METHODOLOGY.md#failure-taxonomy--no-silent-drops)),
  and the second slice of the long-tail block in `servers.yaml` was added knowing its rows
  would record as `auth-required` or platform failures under Docker — findings, not
  omissions.
- **Deprecated packages stay.** The row is annotated from the `deprecated` field (version,
  source URL, the date it was read) rather than removed, so the leaderboard says what the
  registry says about the package (`gdrive`, `neon`, `elasticsearch`).
- **Remote entries have limits.** A no-auth endpoint is measured through the `mcp-remote`
  bridge; an OAuth-walled one is listed with `remote: true` and not measured, and measuring it
  with real credentials is on the roadmap's [not-planned list](ROADMAP.md#not-planned): the
  isolation is credential-free by definition, and a number taken with a key would describe
  that key's account.
- **No metric floor is on record.** Nothing in the repository states a minimum download count,
  so this file does not invent one. What the record does state is how the long-tail block was
  chosen — ranked by live weekly downloads and provenance-checked by org and repo — which is
  the standard a reviewer holds a new entry to.
