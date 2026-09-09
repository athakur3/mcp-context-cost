# Context-cost methodology — v1.0 <a id="m1"></a>

Every `context cost` badge links here. This page defines exactly what the number is, how to
reproduce it, and what it is not. Any change to this definition bumps the version and is
recorded in the [changelog](#changelog).

## What the number is

**The o200k_base token count of the canonical bytes of a server's `tools/list` result.**

Precisely:

1. Connect to the MCP server and call `initialize`, then `tools/list`, following pagination
   (`nextCursor`) to exhaustion. Concatenate the `tools` arrays in server-returned order.
   The `initialize` declares **no client capabilities** — see "What the client declares" below,
   because that choice is visible in the number.
2. **Canonical form** = UTF-8 of `JSON.stringify(tools)` over the **parsed** result value:
   no added whitespace, first-occurrence key order, standard JSON.parse semantics (duplicate
   keys last-wins, numbers re-serialized per ECMA-404). Defined on the parsed value rather
   than raw wire bytes so any JSON implementation reproduces it from the published capture.
3. **The number** = length of the token sequence produced by encoding the canonical string
   with tiktoken **`o200k_base`**.

That's all. No model calls, no API keys, no sampling — the same input yields the same number
on anyone's machine, in any language with a tiktoken port.


### What the client declares, and why it is part of the number

This harness sends `capabilities: {}` at `initialize`. It can do nothing on the client side, and
it says so. That is not a neutral posture: the protocol lets a server decide which tools to
expose based on what the client declares, so a server may show a smaller set to this harness than
to a client that declares more. Where that happens, the number published here is a **floor**.

Measured in CI on 2026-09-06 (`tools/capability-probe.ts`, run under the same isolation as a
sweep, each entry captured twice and differing only in the declaration): of the **87** entries
that could be compared, **one** exposes a different tool set to a client declaring `roots` and
`elicitation` — the reference `everything` server, which gains `get-roots-list` and
`trigger-elicitation-request`, two tools and 197 tokens. That server exists to exercise every
part of the protocol, so it is the one entry where this was most likely to show. No other server
moved, none lost a tool, and no server's status changed between the two postures.

So the floor is real and it is narrow, and this harness keeps declaring nothing. Declaring more
would change the published number and the `canonicalSha256` of every affected capture, which is a
methodology change; on this evidence it would buy 197 tokens on one server built to demonstrate
the feature. The probe stays in the repository so the reading can be retaken when the set grows,
and it declares only what this client can answer truthfully — an empty root list and a declined
elicitation. It does not declare `sampling`, which would claim it can ask a model for a
completion.

## Reproduce it

Every published badge has a companion `measurement.json` containing the raw `tools/list`
capture (`rawToolsCapture`), the SHA-256 of the canonical bytes, the exact launch command,
env var *names* (values redacted), and both halves of the protocol handshake
(`requestedProtocolVersion`, `negotiatedProtocolVersion`) — the revision this harness asked
for and the revision the server answered with, which are not always the same; how to read
the pair is below. Re-derive the number in five lines:

```js
import { getEncoding } from "js-tiktoken";           // or tiktoken (py), tiktoken-rs
const m = JSON.parse(fs.readFileSync("measurement.json", "utf8"));
const canonical = JSON.stringify(m.rawToolsCapture);
console.log(getEncoding("o200k_base").encode(canonical).length); // === m.totalTokens
// crypto.createHash("sha256").update(canonical).digest("hex") === m.canonicalSha256
```

If you dispute a badge, the dispute reduces to a byte-level diff of captures — which is the
argument we want to have.

Each measured server also has a [detail page](servers/) carrying that server's per-tool
breakdown, launch command, isolation, canonical hash, and the one-line `verify` command —
the same facts, without reading the capture by hand.

### Which revision a record was taken under

The two handshake fields read differently, and the difference is deliberate.
`requestedProtocolVersion` is the revision this harness asked for at `initialize`, stamped
on every record, measured or failed. `negotiatedProtocolVersion` is the server's own
answer — a field the protocol requires it to send and allows to differ from the request —
so it is present only where `initialize` returned one. Absent means **not captured**: a
record that predates these fields, a run `initialize` never answered, or a server that
omitted the field it was required to send. An absence is never read as the requested value,
and never as agreement or disagreement.

They are stored as a pair because a record keeping only the server's answer would have to
be read against whatever revision this harness asks for *today* — and the day the harness
moves to a newer revision, every record taken before the move would start reading as a
disagreement about a run that agreed perfectly at the time.

On a measured record the two need not match, and a mismatch ends nothing. The specification
requires disconnecting only when the client *cannot support* the version the server names,
and the requests this probe sends are unchanged across every revision a server has answered
with — so a difference is recorded and measured through, never hung up on; a 2026-09-07
census found eleven of eighty-eight answering servers naming an older revision than the
request carried, and their numbers stand. What ends a run is a refusal: a server that
rejects a request by naming the protocol files as
[`protocol-mismatch`](#failure-taxonomy), with no number at all.

## What the number is not

- **Not any client's exact context bill.** Clients (Claude Code, Cursor, ...) re-render tool
  schemas into their own internal prompt formats, which are not publicly specified. The badge
  is a documented, reproducible **index of schema payload cost** — a lower-bound proxy that
  ranks servers consistently — not a promise of the number your client charges.
- **Not what a deferring client loads at session start.** A client that defers definitions
  until a tool is used puts only names and instructions in context up front, which is a
  different number — usually far smaller, but not always, because the instructions half is
  not bounded by the definitions being deferred. It is now measured and published beside the
  headline — see [session-start load](#session-start-load). *Whether* the client reading your
  config defers at all is a separate question, answered per machine by `audit` — see
  [who pays the number](#who-pays).
- **Not a Claude token count.** Anthropic's tokenizer differs and drifts across model
  releases. The gap is now measured and published rather than left to a critic — see
  [Claude divergence](#claude-divergence) below.
- **Not a quality judgment.** A heavy server can be worth every token. The badge makes the
  cost visible; the per-tool breakdown in `measurement.json` makes it actionable.

## Measurement configuration

- Servers are measured at their **documented default configuration**: the README quickstart
  command, with required env vars set to dummy values. The exact invocation is recorded in
  the measurement.
- `tools/list` is called **twice**; if the tool set differs between runs the measurement is
  flagged **`dynamic`** and the badge reads as measured-at-default-config.
- Sweep runs execute servers in Docker containers with a clean filesystem and no ambient
  credentials. **Network stays enabled** because npx/uvx launches fetch their package at
  startup; the isolation actually used (image, network mode) is recorded in every
  measurement's `isolation` field. Required env vars are set to the dummy value `dummy`.
  Commands that are already `docker run …` are host-spawned containers and recorded as such.
  No real tokens or secrets are ever present in the environment.

### Which machine a number applies to

**Every published number here was measured on Linux, on an x86-64 GitHub runner.** Nothing in
this repository has been measured on macOS or on Windows, and no number here is a claim about
either. Each record carries the machine that made it in `isolation.arch`, and each server page
prints it beside the image; records made before 0.12.0, which is where the field shipped, say
`architecture not on record` rather than borrowing the value from their neighbours. Absent means
unknown, never "the same as yours".

That matters because a package can run on one platform and not another, and then the machine
decides the result rather than the server. `local-mcp` is the case that taught it: published as a
broken server on the strength of a run whose real finding was the architecture. It is also why
this page does not promote a package's *declared* platform support into a claim about where it
runs. A declaration that **restricts** is enforced — npm refuses to install `safari-mcp` off
macOS, and the refusal is quoted in its record. A declaration that **permits** is the author's
word and can be false: `local-mcp` widened its declaration to include Linux on 2026-08-14 and
still had no Linux runtime three weeks later, when this project measured it. So a restricting
declaration is evidence and a permissive one is not, and only the first is ever cited here.

A row that could not be measured says which kind of blocker it hit, in its own words: a platform
the package refuses to install on, or a backing service the isolation deliberately does not
provide. The first would measure on a different machine; the second would not measure on any.

## Failure taxonomy — no silent drops <a id="failure-taxonomy"></a>

Every candidate server appears in published results with exactly one status:

| status | meaning |
|---|---|
| `measured` | clean measurement at default config |
| `dynamic` | tool set varied between runs; value is for the captured run |
| `auth-required` | won't start or list tools without real credentials |
| `startup-failure` | crashed or missing dependencies (stderr tail recorded) |
| `timeout` | no response within the configured timeout (recorded per measurement) |
| `not-applicable` | this harness cannot run it — an OS or architecture the package does not ship for, or a backing service the isolation deliberately does not provide |
| `protocol-mismatch` | the server refused a request by naming the protocol rather than itself — it launched, the transport worked, and it answered, so this is not a claim that it failed to come up. Either it has no `initialize` handler (the 2026-07-28 revision replaced the handshake with `server/discover`), or it rejected the protocol version the request carried. The status does not claim the server speaks any particular revision; only the server's own `data.supported` establishes that, and the note quotes it verbatim when it sent one |
| `remote-auth-wall` | OAuth-gated remote server; listed, not measured |
| `not-yet-run` | candidate not yet swept — a merged entry carries this status on the published leaderboard until its rotation slot comes round (see [Trends over time](#trends-over-time--same-conditions-or-no-line)) |

**A failure is retried before it is published.** Two of these statuses can be produced by
the machine doing the measuring rather than by the server, so neither is published on a
single attempt (`protocol-mismatch` is not among them, and deliberately: a cold package
cache does not change a protocol revision, and neither does a wider timeout budget):

- a `startup-failure` under Docker isolation is re-attempted with the shared package caches
  bypassed, because a poisoned cache entry and a genuinely broken package exit identically;
- a `timeout` is re-attempted on double the configured budget, because a server that starts
  slowly under sweep concurrency and one that never starts both come back `timeout`.

If the retry succeeds, the successful measurement is the published one. If it fails the same
way, the note says which retry it survived — so "broken upstream" and "broken here" read
differently without re-running the sweep. A `timeout` note always names the widest budget
tried, not the first one that failed.

**`not-applicable` is declared, and then corroborated.** Some entries cannot run here for a
reason that is a property of this harness rather than of the software: a package that ships
no build for the isolation's OS or architecture, or a server that connects to a backing
service the isolation deliberately does not provide. Publishing those as `startup-failure`
would assert that the server is broken, which the run did not establish.

So the entry declares the reason in `servers.yaml`, together with the text its failure is
expected to contain — and the status is only `not-applicable` when the failure's own words
contain it. An annotation left behind after upstream changes therefore cannot absorb a real
breakage: the server fails some other way, the evidence stops matching, and it is published
as the failure it actually is. Declared entries are still attempted every sweep, so the day
one starts working it simply measures. Neither retry above applies — a package that will not
install for this platform will not install on the second attempt either.

**A whole sweep is checked before any of it is published.** Both retries above re-run
through the same harness, so neither can see the failure mode that isn't about any
individual server: the machine doing the measuring is broken. That case is real — a wedged
Docker network stack once returned uniform timeouts for every server in a sweep, and the
per-server retries only confirmed them. The signal it leaves is population-level: servers
that measured fine before failing *together*, in bulk. Upstream breakages arrive a package
at a time; the largest genuine simultaneous one on record here was a handful of servers
sharing one unbounded dependency, single digits against ~65 measured.

So a batch sweep records what was published before it starts, and if at least 5 servers
that had a real number come back failed — and they are at least half of the servers that
could have regressed — it declares a harness fault: the leaderboard and `history.csv` are
not written, the previous measurements and badges are restored byte for byte, and the sweep
exits non-zero. Nothing about that sweep reaches the published data. Below either threshold
the sweep publishes normally, including failures, because a small number of servers breaking
at once is exactly what a real upstream breakage looks like. A sweep with no prior
measurements to compare against reports that the check could not be performed, rather than
reporting a pass. A server that answers `tools/list` with an empty array is measured as it
answered — zero tools, with a note saying whether it had declared a tools capability at
`initialize` — but a zero is not counted as a real number by this check: a broken harness
that gets nothing back would produce exactly that, a sweep of empty lists, and read as success.

## Trends over time — same conditions, or no line

`results/history.csv` carries one row per (date, server): the tokens a server measured on
the day it was measured. The leaderboard sparkline and each server page's *Over time* table
are drawn from it.

A row also records **how** it was measured — `docker` or `host` — because two numbers taken
under different isolation are not comparable. The same server can resolve an `@latest` tag
to a different package, run on a different Node, and see a different ambient environment on
a bare machine than inside a clean container. A step between two such numbers is a property
of the harness, not of the server, and publishing it as a trend would say the server changed
when it didn't.

So the published trend only spans the run of sweeps ending at the current one that were all
measured the same way. Earlier sweeps taken under a different isolation are left out, and the
server page names the date the comparable series starts at. Rows recorded before this column
existed read `not recorded`: unknown conditions are shown as unknown rather than back-filled
with a guess, and because unknown is not evidence of a difference either, those rows still
plot — with the page saying their conditions aren't on record.

**How often a row gets a new point.** A scheduled job re-measures one deterministic slice of
the server list each week, so the whole set is refreshed on a rolling three-week cycle rather
than all at once — a fresh CI runner shares no package cache, and every server on it pays a
cold install. The slice is derived from the date alone, so a week the job doesn't run leaves
those servers to come round again next cycle; nothing is skipped permanently. Servers the
week's slice doesn't include keep their most recent measurement, unchanged, on the
leaderboard. One extra server, the reference server behind this project's own badge, is also
re-measured weekly.

## Color bands <a id="color-bands"></a>

| tokens | color |
|---|---|
| < 1,000 | brightgreen |
| 1,000 – 4,999 | green |
| 5,000 – 14,999 | yellow |
| 15,000 – 29,999 | orange |
| ≥ 30,000 | red |

Bands were **frozen on 2026-08-16** against the observed distribution of the first full
sweep (n=57 measured servers: p25 = 581, median = 2,636, p75 = 5,258, p90 = 10,426,
max = 54,422): *lean* ends at the bottom quartile, *light* spans the interquartile middle,
*moderate* begins at p75, *heavy* covers the ~p95 tail, and *very heavy* marks true
outliers. Any future band change bumps this page's version.

## Claude divergence <a id="claude-divergence"></a>

Method `tools-delta/v1`. The headline number counts every byte a server returns from
`tools/list`, tokenized with o200k_base. Neither half of that describes what the tools cost
in an Anthropic request, so the gap is measured directly and published beside it.

**How it is measured.** For each server, project the capture onto the three fields an
Anthropic tool definition carries — `name`, `description`, `input_schema` — and send that
array to `POST /v1/messages/count_tokens` against a **pinned model id**, alongside a minimal
one-token user message. Subtract the same request's count with no `tools` at all. The
difference is the tokens the server's tools add to a request. Model id and date are recorded
in [`results/divergence.json`](https://github.com/athakur3/mcp-context-cost/blob/main/results/divergence.json)
with the `canonicalSha256` of the capture each row was computed from, so a re-sweep marks a
row stale instead of leaving a number that no longer matches its capture.

**Why it is published as three numbers, not one.** Two independent effects move the count in
opposite directions, and a single ratio hides the larger one:

1. **Field selection.** `title`, `annotations`, `outputSchema`, `execution`, and `icons` are
   real bytes the server ships and the canonical form counts them — but an Anthropic `tools`
   array has nowhere to put them. Across the measured set this removes between 0.0% and
   **89.9%** of the payload (xcodebuildmcp: 26,594 → 2,676 tokens, which Claude counts at
   5,335).
2. **Tokenizer and framing.** Anthropic's tokenizer is denser on schema text than o200k_base,
   and the API adds its own framing around the tools channel. A single minimal tool costs
   328 tokens more than no tools at all, which is an upper bound on the fixed part.

Because the effects can cancel or compound, the Claude number is **not** a fixed multiple of
the badge — it ranged from 0.19× to 1.93× across the 86 servers in the run, and it reorders the leaderboard:
github is the heaviest server on o200k and comfyui-mcp is the heaviest on Claude.

**What it is not.** It is not any client's context bill either. `count_tokens` is Anthropic's
accounting for tools sent through the API's `tools` parameter; a client that re-renders
schemas into a prompt, defer-loads them, or forwards MCP metadata will differ. It is a second
documented, reproducible index — measured the same way for every server — not a promise.

**Attribution spot check.** To confirm effect 2 is mostly the tokenizer rather than the tools
channel, notion's tool text was also counted as an ordinary user message: prose descriptions
came out 1.58× their o200k count, and the identical minified JSON 1.77×, against 1.92× when
sent as `tools`. So most of the multiplier is the tokenizer and the remainder is the channel.
That is one server on one date, not a constant — it is recorded here as the evidence for the
causal claim above, not as a conversion factor.

## Session-start load <a id="session-start-load"></a>

Method `deferred-load/v1`. The headline number is what a client pays when it loads every tool
definition into context up front. Increasingly, clients do not: they put a **list of tool
names** in context and fetch the definition only when the model reaches for one. That client's
session-start bill is a different quantity, and the headline number says nothing about it —
so it is measured too, and published in the `session start` column of the
[leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md).
It is the wire cost of that list, not what a particular client loads: Claude Code "truncates
tool descriptions and server instructions at 2KB each" (its MCP documentation, read
2026-09-06), so for a server whose instructions run past that, this column is more than that
client loads.

**What it is.** Two parts, counted separately with the same `o200k_base` tokenizer and added:

1. **Tool names** — `JSON.stringify` over the array of `name` values from the capture, in
   server order. Same serialization discipline as the headline, over the same published bytes,
   so it re-derives from `measurement.json` with the same five lines.
2. **Server instructions** — the `instructions` string a server returns from `initialize`,
   counted as ordinary text. Clients that support it place this in the system prompt whether
   or not any tool is ever called.

The two halves are counted separately and summed rather than tokenized as one joined string:
joining lets tokens merge across the seam, and a published total that does not equal the parts
printed beside it is a discrepancy no reader can account for.

**Deferring is not guaranteed to be cheaper.** The names half is a projection of the definition
bytes and so is always a small fraction of the headline. The instructions half is not: it is
separate bytes that the headline never counted, and its length is independent of how many tools
the server ships. A server whose `instructions` re-list and explain its tools therefore charges
a deferring client *more* than an eager one — the deferral saves the schemas and then pays for a
prose copy of them. This is not a hypothetical: it is true of a server in the published set, and
the leaderboard names every row where it happens, with both figures, rather than leaving the
reader to notice that one column is larger than the other. The count and the names live in the
[leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md)
because they are regenerated from the measurements on every sweep; a number written into this
page by hand would be a claim that quietly stops being true.

**`≥` means the instructions half is missing.** `instructions` is not part of `tools/list`, so
no measurement taken before this method existed carries it. Those rows publish the names half
alone, marked `≥`: a floor, not a figure. The distinction is the point — a floor printed as a
figure would understate exactly the servers that ship the longest instructions. A row leaves
the floor by being re-measured, and only that way: every sweep records `serverInstructions`
inside the measurement, off the same server process that produced the tools, so the two halves
cannot be stale relative to each other. A side capture filed beside the measurements did the
same job for rows measured before the field existed; every measured row now carries its own,
so it was removed once nothing was reading it (2026-09-08).

**What it is not.** Not any client's exact session-start bill either. Clients prefix tool names
with a server identifier, wrap the list in their own framing, and choose independently whether
to inject `instructions` at all. Like every number here it is a documented, reproducible index
measured the same way for every server — the ratio between the two columns is the finding, not
the absolute figure.

## Who pays the number, and where it is deferred away <a id="who-pays"></a>

Everything above measures what a server puts on the wire. Whether a **session** pays it is a
property of the client and of the machine that client runs on, not of the server — so it is
not part of the definition, moves no published number, and no badge or `totalTokens` changes
because of anything in this section. It is what `audit` answers for a config it discovers,
and it is stated here because a number nobody can attribute to a payer is not a cost.

**What deferring changes, and what it does not.** Deferring means the definitions stay out of
the model's context window until the model reaches for one — it does not mean they stop being
sent. For the mechanism Claude Code's deferral is documented as riding on, the vendor states it
in one sentence: "`defer_loading` controls what enters the context window, not what you send in
the request" — every tool's full definition still travels in the `tools` array of every
request, deferred ones included, because the API needs the definitions server-side to run the
search (Anthropic tool-search documentation, §Deferred tool loading,
`platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool.md`, read
**2026-09-09**). So a deferring client does not make the headline above moot: it is what that
stack puts into every request the session makes, before anything enters context. What deferral
moves is which of those bytes enter the window — the difference the
[session-start load](#session-start-load) column exists to measure. This is a statement about
that one documented mechanism, not about every deferring client: Cursor's record below
describes a different one, and what its backend sends is on no surface this project reads.

**What counts as a record.** A record is a first-party statement about the client's own
behaviour, on a surface that client's vendor controls, readable at a fixed address and
carrying a date. Four kinds qualify, and the rule admits all four as of **2026-09-07**:

| kind | what it settles |
|---|---|
| the client's own documentation, including its MCP configuration page | what the vendor commits to |
| the vendor's dated engineering blog or changelog | what the vendor says it built, and when |
| a named staff account posting on the vendor's own forum | what the vendor says its product does today |
| the client's public source — a merged pull request, or a settings default in the shipping tree | what the code does, at a commit |

**None of the four is a measurement**, and admitting them changes nothing about that. A
record establishes what a vendor says or ships; only a measurement establishes what a session
paid, and nothing published here has measured any client. So a record is published as a
record: what the vendor states, what it leaves open, and the addresses and dates behind it.

**Why the rule widened, which is the part worth checking.** Until 2026-09-07 it read one
surface — each client's own configuration page — and reported an absence of a record for
every client whose page did not mention deferring. Three clients say the opposite elsewhere.
Cursor's engineering blog described its MCP deferral on **2026-01-06**, eight months before
this project read Cursor's configuration page and recorded silence; that page is still silent
today. A rule that consults one surface cannot distinguish a vendor that does not defer from
a vendor that documents deferral somewhere else, and it reported the first when the second was
true. What is not admitted is unchanged: a third-party summary, a forum post by an account
that is not staff, or a recollection is not a record, and neither is a page that has stopped
being reachable at a fixed address.

**Where the vendor is on record as deferring.** For **Cursor**, **Codex CLI** and **VS Code**,
`audit` prints the record, its conditions and its sources, and stops where Claude Code's own
entry stops: the vendor says so, this audit has not measured it, and no config file it reads
states a posture. It does not report these stacks as deferred and therefore free — that would
be the same error as the one above, in the other direction.

- **Cursor**, mechanism *dynamic context discovery*. Cursor states the agent receives tool
  names and loads a tool's description and input schema on demand, and does not put every
  attached tool's complete schema in every request. Sources: the engineering blog post
  [Dynamic context discovery](https://cursor.com/blog/dynamic-context-discovery), dated
  2026-01-06; a staff reply on [forum.cursor.com/t/166405](https://forum.cursor.com/t/166405)
  post 5, 2026-07-22; and [cursor.com/docs/context/mcp](https://cursor.com/docs/context/mcp),
  which is silent on the mechanism and offers no setting for it. All read **2026-09-07**. Left
  open: definitions and results pulled in during a session stay in that session's history, so
  a deferring session is not a free one; and the vendor's 46.9% figure is an A/B result across
  runs that called an MCP tool, not a saving for any particular stack. Cursor's own context
  tray is not a check on our number either — staff describe its count as a calibrated estimate
  rather than a tokenizer count ([t/168744](https://forum.cursor.com/t/168744) post 5,
  2026-08-20).
- **Codex CLI**, mechanism *tool search*. Its source defers every effective MCP tool behind a
  tool-search tool when the model supports that tool and the provider supports namespaced
  tools, and exposes the definitions directly when either does not. Sources:
  [openai/codex#29486](https://github.com/openai/codex/pull/29486), merged 2026-06-22, first
  stable tag `rust-v0.142.2`, published 2026-06-25; `codex-rs/core/src/tools/spec_plan.rs` and
  `codex-rs/features/src/lib.rs` at `main`, read **2026-09-07**. Left open: the two conditions
  are properties of the running model and provider, which no config file states; a machine
  pinned below that tag is on the older rule, where tool search applied only above 100 tools or
  behind a feature flag. **`config.toml` exposes no switch** — the two keys that once forced
  the behaviour, `tool_search` and `tool_search_always_defer_mcp_tools`, are marked removed and
  skipped when the features table is applied, though both still appear in the published config
  schema.
- **VS Code** — conditions, not a verdict, and the only one of the three whose record does not
  amount to a default. Two documented facts share one numeral. A chat request "can have a
  maximum of **128 tools** enabled at a time" — a cap, and exceeding it is an error. And
  `github.copilot.chat.virtualTools.threshold`, an experimental setting defaulting to 128:
  above that count, virtual tools group the set for the model to activate on demand; the
  settings reference states no ceiling for it and describes it as the way to go
  beyond the 128-tool limit (the agent tools documentation and the AI settings reference on
  code.visualstudio.com, both read **2026-09-09**). Separately, `chat.agentHost.copilot.toolSearch.enabled` defaults to **true** in
  `src/vs/platform/agentHost/common/copilotCliConfig.ts` and defers MCP and non-core tools
  behind a tool-search tool, gated by an allowlist in
  `src/vs/platform/agentHost/node/copilot/toolSearchDeferral.ts` to the GPT-5.4, 5.5 and 5.6
  families and Claude 4.5 or later
  ([microsoft/vscode#326213](https://github.com/microsoft/vscode/pull/326213), merged
  2026-07-23; source read **2026-09-07**). Left open, and stated as such: at or below 128 tools
  nothing documented defers, and the cap is an error rather than a saving; **which VS Code
  release runs Copilot sessions on that agent host by default is not established here**; and
  the agent host's settings appear nowhere in the published settings documentation, though
  the virtual-tools threshold now does, as experimental (read **2026-09-09** — an earlier
  read of 2026-09-07 found none of them). Both switches
  live in VS Code's own settings rather than in the `.vscode/mcp.json` this audit reads.

**Where the cost is paid in full.** No default deferral is on record for Claude Desktop,
Windsurf, Gemini CLI, Zed, Kiro or Goose: for a config read by one of those, every request
carries the whole total. Each client's own configuration page was read on 2026-09-06 and says
nothing about deferring tool definitions — Windsurf's states a cap of 100 tools, which is a
different thing. Under the wider rule this is now an absence that was searched for rather than
an absence on one page: the three that are open source — Gemini CLI, Zed and Goose — were
searched for a tool-search or deferral mechanism on 2026-09-07, and none was found, while
Claude Desktop, Windsurf and Kiro are closed and only their pages have been read. That is an
absence of a record about the client, not a measurement of it, and `audit` prints it in those
words — the same rule this project follows for every value it has not observed. A config passed
as `--config <path>` is read the same way, because which client reads that file is not knowable
from the file.

**Where it is deferred away.** Claude Code defers MCP tool definitions by default, through
its **tool search**: the definitions are not in context at session start and load when the
model reaches for one. Which posture is in force is decided by three environment variables on
the audited machine, resolved in this order — a disagreement about a variable, or an unknown
in it, does not spoil an answer that variable would not have decided:

| read | value | posture |
|---|---|---|
| 1. `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` | `1`, `true`, `yes` or `on`, in any casing | tool search off — loads up front. Read first because it cannot be overridden by `ENABLE_TOOL_SEARCH` |
| | `0`, `false`, `no` or `off`, in any casing | it turned nothing off, so it decides nothing and the read moves on to `ENABLE_TOOL_SEARCH` |
| | any other value | **unrecognized** — no posture is claimed from it, the same as for an undocumented `ENABLE_TOOL_SEARCH` value below |
| 2. `ENABLE_TOOL_SEARCH` | `true` | every definition deferred, at any size |
| | `false` | loads up front |
| | `auto` / `auto:N` (N = 0–100) | deferred once the definitions reach 10% / N% of the context window |
| | anything else | **unrecognized** — no posture is claimed from it |
| 3. `ANTHROPIC_BASE_URL` | host other than `api.anthropic.com`, or a value that does not parse | loads up front. Consulted only while `ENABLE_TOOL_SEARCH` is unset |
| at 1, 2 or 3 | set by the place that would decide, to something that is not a readable string — an `env` block holding a JSON boolean, a number or `null` | **unreadable** — the variable is set there and what it is set to is unknown, so no posture is claimed and the report says whether these tokens are deferred cannot be said from it. A settings file holding `false` rather than `"false"` is this row, not the `false` row above |
| | otherwise / nothing set anywhere | the documented default: every definition deferred, no threshold |
| the entry itself | `alwaysLoad: true` | loads at session start whatever the setting says — read from the entry, named with its tokens, and left out of any threshold comparison |

`CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` is a boolean flag in the client, not a marker whose
presence alone is the signal, so a value it does not read as true leaves tool search on and the
read continues. Taking its presence for its meaning is how a machine that had set it to `0` was
told that every request carries these tokens.

**Two places set them, and both are read.** Claude Code takes those variables from the shell
it starts in *and* from the `env` block of its own settings files, so `audit` opens all of
them: the managed settings file for the platform
(`/Library/Application Support/ClaudeCode/managed-settings.json` on macOS,
`/etc/claude-code/managed-settings.json` on Linux, `C:\Program Files\ClaudeCode\managed-settings.json` on
Windows — not `%ProgramData%\ClaudeCode\managed-settings.json`, which the vendor names as a legacy path
Claude Code does not read, and which this opened instead until 2026-09-08), every
`managed-settings.d/*.json` drop-in beside it,
`<cwd>/.claude/settings.local.json`, `<cwd>/.claude/settings.json`, then
`~/.claude/settings.json`. The managed file and its drop-ins are **one** source, documented as
merged together, and the vendor does not say which file inside that pair wins: where they set the
same variable to different values the posture is refused rather than decided by an order this has
no source for. Among the settings files the first that sets a variable wins —
sets it at all, readably or not, so a readable value above an unreadable one is still the
value in force, and an unreadable one beneath it decides nothing. Every place consulted is
published with what it set — **by name, never by value** — and each is marked read, absent,
or unreadable, so a variable set nowhere can be told apart from a place this audit never
opened. That mark is the file's state, not the value's: a file that was read can still hold
the deciding variable to something unreadable, which is published as the variable's own
unknown rather than as a file this audit could not open. Reading only the shell is how an
earlier version reported "NOT loaded up front at any size" on a machine that had switched
deferral off in
`~/.claude/settings.json`.

**A pinned server is counted, not listed.** An entry carrying `alwaysLoad: true` loads at
session start whatever the setting says (Claude Code's MCP documentation, §"Exempt a server
from deferral", read 2026-09-06). `audit` reads it from the entry, names those servers with
their tokens, and leaves them out of any threshold comparison, since the documented `auto`
mode counts only "the tools it would otherwise defer". The per-tool form — a tool whose
`_meta` carries `"anthropic/alwaysLoad": true` — is not read from a capture and stays a
listed condition.

**Configs one session loads together face the question together.** Claude Code reads
`~/.claude.json` and `<cwd>/.mcp.json` into one session, so the threshold question is put to
their sum and answered once. Per-config totals are still never merged (see above): the sum
exists for the threshold and nowhere else. Where the managed MCP file below is deployed, the
session is that file alone, and the sum is its. The session is also the unit `--budget` gates
(decided **2026-09-09**): per-file totals stay file facts, the gate reads the costliest
session, and a server the denylist removes is nobody's bill.

**The managed tier owns the server list, where it exists.** `managed-mcp.json` — one fixed
path per platform, in the same system directory as the managed settings file and, unlike it,
with no drop-in directory — gives an organisation exclusive control: a claude-code session
loads only the servers that file defines, plus in-process servers the launching app
registers, which no config file describes; deployed with an empty server map it disables MCP
outright (code.claude.com/docs/en/managed-mcp.md, §Exclusive control, read **2026-09-09**).
`audit` reads that path, says which state it found, and keeps measuring the user and project
configs it suppresses — their totals are facts about those files — while every session-level
claim moves to the managed file. A managed file that exists and cannot be read is its own
refusal: which servers a session loads cannot be said, and the report says that instead of
picking a side.

**The allowlist and the denylist, and why only one of them is applied.** `allowedMcpServers`
and `deniedMcpServers` filter what loads, and they live in the same settings files this audit
already opens — and in tiers it does not: server-managed settings, an MDM profile, a registry
key. The two lists are treated by direction. A server matching a **deny** entry read here is
left out of the session's claims: the vendor says nothing overrides a deny, so that much is
certain, and a deny entry in an unread tier could only lower the bill further. An **allow**
verdict is reported and never subtracted: allowlists merge as a union across scopes, so an
entry in an unread tier can only broaden what loads, and removing a server for failing the
entries read here could understate a session. Neither list ever touches a file's own total.
An entry carrying `${}` expansion is returned as set-but-unevaluated — the two sides expand
from environments this audit does not hold — and `allowManagedMcpServersOnly` narrows the
counted allowlist to the managed tier when a managed source sets it readably (same page,
§Policy-based control and §How a server is evaluated, read **2026-09-09**).

**The threshold comparison is a range, not a point.** Only `auto`/`auto:N` makes size decide
anything. There the audit's number and the threshold are counted in different units — wire
bytes under `o200k_base` here, versus what the client sends to the API — so the stack is
converted through the published [Claude divergence](#claude-divergence) band (0.19×–1.93×
across 86 servers), taking the exact published count wherever a server's capture still
matches, and the verdict is `above` only when the low end clears the threshold and `below`
only when the high end does not.

**What it refuses to answer.** Deferral has one honest non-answer and the report prints it
rather than a guess: when two places set the same variable to different values and no order
between them is on record; when a settings file exists and cannot be read, since what it sets
is unknown rather than nothing; when the place that would decide sets the variable to a value
this cannot read, since it is set there and dropping it would argue from a silence that is
not silent; when `ENABLE_TOOL_SEARCH` holds an undocumented value; when the threshold range
straddles the line; and when the stack's total could not be established because two
configured entries collapsed onto one measurement. The first four are the ways a machine can
fail to state a posture readably, which is four refusals and not one: collapsing them into a
single "unknown" would hide that three of the four are answerable by the reader, who can look
at the file this audit could not. The managed tier adds a refusal of the same kind: a
`managed-mcp.json` that exists and cannot be read refuses the session's composition itself,
and an allow or deny entry that is set but not evaluable here is printed as exactly that.

**Deferral is not a blanket discount.** Even where the posture defers, the full number is
paid on a Microsoft Foundry deployment hosted on Azure (which rejects tool search
server-side), on Google Cloud's Agent Platform below the Claude 4.5 generation, on a model
without support for `tool_reference` blocks, and for any server pinned `"alwaysLoad": true`.
None of those is readable from a config or an environment, so they are printed as conditions
for the reader to check, never folded into the verdict. And deferring has its own bill: see
[session-start load](#session-start-load), where one server in the published set costs a
deferring client *more* than an eager one.

**Remote entries.** A `url` entry is asked what it says to an unauthenticated `initialize`
before anything is launched, and the answer is the row: an endpoint that answers is measured
through the `mcp-remote` bridge and joins the total as any server does; one that answers
`401` or `403` is `auth-walled`, quoting the status and the `WWW-Authenticate` header it sent,
with the URL, and makes the total a floor; one that answers by refusing the revision the
request carries is `protocol-mismatch`, quoting the revisions it says it does speak when it
names them — the endpoint works, the refusal is about what this harness sends, and the total
is a floor for the same reason; one that gives no MCP answer is `unreachable`, with
the reason. The probe exists because the bridge alone would open a browser against an
OAuth-walled endpoint on a developer machine, and would read `timeout` in a headless run — a
word that blames the clock for a credential. Probed 2026-09-06: Linear, Zapier and Vercel
answer `401` with a `WWW-Authenticate: Bearer …` header; DeepWiki, Microsoft Learn, Cloudflare
Docs and Hugging Face answer `200`. Header values an entry carries are sent
and never reported; only their names are.

**Source, and its date.** Most of the above is a model of another product's documented
behaviour, not an observation of it: Claude Code MCP documentation, §"Scale with MCP tool
search", read **2026-08-20** and re-read **2026-09-06**. On the re-read the value table
stands as quoted, and four things moved around it, each recorded in
`src/audit/deferral.ts`: tool search is on by default on Google Cloud's Agent Platform for
the Claude 4.5 generation and later (before v2.1.221 it was off there for every model);
managed settings can keep tool search on under `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` from
v2.1.227, which **is** read here as of 2026-09-08 and is described below; `alwaysLoad` is an
entry field on every server type, now read as above; and tool
descriptions and server instructions are truncated at 2 KB each. Nothing here measured
Claude Code deferring or not deferring anything. If that documentation changes, this section
and `src/audit/deferral.ts` are what have to change with it.

**The organisation override, and why it is refused rather than answered.** From Claude Code
v2.1.227 an organisation can keep tool search on under the very variable that turns it off, through
managed settings — `code.claude.com/docs/en/llm-gateway-protocol.md`, read **2026-09-08**. The
value that arms it appears in no vendor document, so this names none and claims nothing about what
it does. What it does say: the administrator tier is read, and where that tier sets
`ENABLE_TOOL_SEARCH` to a value the vendor does not document, the disabling variable is no longer
what decides, so the posture is refused and the value is printed for the reader to check. Two of
the override's own conditions are not readable from a file either — the same page says it has no
effect on a cloud provider, or when signed in through a Claude apps gateway. The audit reads one of
the four administrator sources the vendor documents; remote settings, MDM policy and a policy
helper are not opened, and a helper's output replaces the file tier entirely. Every one of those
misses can only make this report **over**-state what a request carries, never understate it.

**One rule above is not a quotation, and it is marked.** How
`CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` is read comes from two sources rather than one.
`code.claude.com/docs/en/env-vars.md`, read **2026-09-08**, states the convention: for a
variable that turns a behaviour on or off, `1` or `true` turns it on and `0` or `false` turns
it off, in any casing. That page also names the variables which instead read any non-empty
value, and this is not one of them. The remaining values it accepts — `yes`, `on`, `no`, `off`
— were read out of the Claude Code v2.1.233 bundle installed on the machine this was written
on, dated **2026-09-08**, and the boolean reading was confirmed by running that client under
each value and reading whether its startup event listed the tool-search tool. That is one
build on one machine, and it is the only claim in this section resting on something other than
a published page. If it is wrong, it is wrong in the direction that over-states what a request
carries.

## CLI cross-check <a id="cli-cross-check"></a>

The leaderboard's **mcp-tokens** column (method `cli-cross-check/v1`) publishes what the
other CLI that measures this — [`sd2k/mcp-tokens`](https://github.com/sd2k/mcp-tokens),
release pinned per run and recorded in `results/cross-check.json` — counts for the same
server.

**How a row is made.** In one sitting, the server is measured by our client exactly as a
sweep measures it (same isolation, dummy env and retries), then launched again by the CLI,
invoked as `analyze --provider tiktoken --model gpt-4o --format json`. `--model gpt-4o` is
load-bearing: it selects o200k_base in tiktoken-rs, and without it the CLI falls back to
cl100k_base — a systematic difference that would swamp the one being measured. The CLI
binary is fetched from its release and verified against the release's own SHA-256 before it
is ever executed; in docker mode it is bind-mounted read-only into the same image, limits
and package caches the measurement ran under. The row records both counts, both tool sets,
the `canonicalSha256` of our fresh capture, and our o200k count of that capture's
name/description/input\_schema projection (`mappedTokens` — the same projection the Claude
divergence starts from).

**When a row prints.** Only while the comparison is between like and like: the CLI saw the
same tool names our capture holds — the CLI launches the server itself, so a server that
changed between the two launches, or lists dynamically, handed the two tools different
schemas, and their difference would not be a divergence of counters — and our capture is
still the published one. Everything else stays in the run file as data and prints silence,
the same staleness rule the claude column follows.

**What the divergence is.** Two layers, and the column separates them. The CLI's structs
model the three request fields, so against the full capture its number sits low by exactly
each server's field-selection share — a documented modeling choice, published per server on
its page, not a disagreement of counters. The published percentage is the disagreement of
counters: the CLI's count against ours of the same three-field projection, where the only
remaining differences are serialization details (struct-order keys, `serde_json` bytes)
against wire order. Measured at first run, that residual is a fraction of a percent — two
independent implementations agreeing on the fields both count — and the run's aggregate
range is stated in the leaderboard header, derived on every write.

## Cost movement <a id="cost-movement"></a>

[results/regressions.md](https://github.com/athakur3/mcp-context-cost/blob/main/results/regressions.md)
(method `cost-regression/v1`) reports each server's **most recent movement**: the change that
produced the cost it carries today. Most entries launch unpinned (`npx -y <pkg>`), so a
movement between two measurements is a real upstream release landing in real context windows.

**What may be compared.** Only measurements within the run a trend line may be drawn across —
the isolation rule above, applied once by `plottableSeries` and inherited here, so a change of
harness can never read as a change of server. A failed measurement contributes no row to the
series at all, so a server that stopped starting reads as a gap, never as a drop to zero.

**Which pair.** Not the newest one. A server that grew once and has held that cost since has a
newest pair of zero, and reporting only that would hide the largest movement in the set behind
a week of stability. The walk goes back through the trailing run of identical measurements to
the change that produced the current cost, so the window is **when the change happened**
(`2026-08-19 → 2026-08-26`), and how long the new cost has held is reported separately.

**What is claimed about it.** From the totals alone: the *mechanism* — whether the server
shipped more tools or made the tools it already had heavier, with a movement where count and
cost went opposite ways left as `mixed` rather than guessed. Per-tool attribution needs both
sides' captures, and `results/<server>/measurement.json` holds only the newest, so
`results/<server>/tool-vectors.json` accrues a short, hash-deduped history of per-tool token
vectors from the sweep that introduced this method onward. A change older than that file says
its breakdown is unavailable, in those words. Where attribution is available, the remainder
that belongs to no single tool is published as `unattributed` rather than distributed.

**What is called out.** A movement is emphasised only when it clears both thresholds — at
least 5% *and* at least 25 tokens. Relative alone would headline a fifth of a cheap server;
absolute alone would headline drift on an expensive one. Everything comparable is listed
either way, which is the same rule the leaderboard applies to failures.

## Capture index <a id="capture-index"></a>

`audit --changed` answers "did the servers in my config get heavier?" — which turns entirely on
joining an installed server to the published history. It joins by **canonical hash**, never by
name: a config's keys are arbitrary local labels, so a server a user calls `github` may be a
fork, a pin, or something else, and reporting the official server's movement against it would
be a confident false statement. `results/capture-index.json` (method `capture-index/v1`) maps
every published capture's `canonicalSha256` to the server and date it belongs to, plus each
server's current capture, and is derived from the per-server tool vectors in the same regen
pass that appends them.

A local measurement therefore lands in exactly one of three states, and there is no fourth to
be fuzzy about:

| the installed bytes | reported as |
|---|---|
| a published capture that is no longer current | **behind** — with the exact tokens moving to current would add to every request, and both dates |
| the server's current published capture | **current** — identified, nothing to update |
| anything else | **unidentified** — a version never measured here, or one published before the index began. Nothing is claimed about it |

When the local label and the published server disagree, the report prints both
(`my-alias (published as github)`): the bytes decide which server it is, and a name that
disagrees with them is a fact worth seeing rather than one to smooth over. Because the index
is derived from the tool vectors, it can only see as far back as they go — a version published
before the vectors existed reads as unidentified, which is an absence of a record about that
version, not a statement that it never moved.

## Tool shape <a id="tool-shape"></a>

`audit --suggest` (method `tool-shape/v1`) places each of your tools in the measured set's
distribution of tool *composition* — every published measurement already splits every tool
into whole / description / input-schema token counts, and the baseline is a nearest-rank
quantile table (101 points per metric) over all complete tool measurements, published at
[results/tool-shape.json](https://github.com/athakur3/mcp-context-cost/blob/main/results/tool-shape.json)
and regenerated from the same measurement files as the leaderboard. The table is published
whole so every percentile claim the tool makes can be re-read off the same JSON by anyone.

**What draws advice, and what never does.** Only descriptions: a schema is functional
surface, and trimming it changes what the tool can do; a description is prose about the
tool, and trimming it changes only what every request pays to carry it. A description earns
a suggestion only at or above the **90th percentile** of the measured distribution, the
suggestion names the exact percentile it fired at, and the recovery figure — description
minus the measured median — is marked approximate, because component counts sum only
approximately across token boundaries and a rewritten description tokenizes as itself. A
config where nothing is measurably unusual is told that in those words; no advice is
invented to have some. A baseline that cannot be fetched is a named problem in the report,
never a silently skipped check.

Versioned independently of the o200k methodology, like the columns before it: an advisory
reading, no `totalTokens` and no canonical hash moves.

## Known divergences

**sd2k/mcp-tokens** (the CLI behind the [cross-check column](#cli-cross-check)) differs from
this definition in two documented ways: its tiktoken provider selects the encoding from a
`--model` argument with a **cl100k_base fallback** (pass `--model gpt-4o` for o200k), and it
counts a `serde_json` re-serialization of deserialized tool structs rather than the parsed
wire value (key order normalized to struct order; unmodeled fields dropped). The CLI's
number is published beside ours in the leaderboard's **mcp-tokens** column.
Details: [spec/upstream-notes.md](https://github.com/athakur3/mcp-context-cost/blob/main/spec/upstream-notes.md).

## Changelog <a id="changelog"></a>

- **v1.0** (2026-08-16) — initial definition: canonical form over the parsed `tools/list`
  value, o200k_base, bands frozen against first-sweep distribution, failure taxonomy,
  dual-run dynamic detection.

The Claude divergence column (`tools-delta/v1`, added 2026-08-16), the session-start column
(`deferred-load/v1`, added 2026-08-20), the CLI cross-check column (`cli-cross-check/v1`,
added 2026-09-03), the tool-shape baseline (`tool-shape/v1`, added 2026-09-04) and the
cost-movement report (`cost-regression/v1`, added 2026-09-04) and the capture index
(`capture-index/v1`, added 2026-09-04) are
versioned separately and deliberately: each adds a published number
without touching the definition above. Every badge, every `totalTokens`, and every canonical
hash is byte-identical to before they existed, so bumping this page's version would have
signalled a change that did not happen.
