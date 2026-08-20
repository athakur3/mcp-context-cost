# Context-cost methodology — v1.0 <a id="m1"></a>

Every `context cost` badge links here. This page defines exactly what the number is, how to
reproduce it, and what it is not. Any change to this definition bumps the version and is
recorded in the [changelog](#changelog).

## What the number is

**The o200k_base token count of the canonical bytes of a server's `tools/list` result.**

Precisely:

1. Connect to the MCP server and call `initialize`, then `tools/list`, following pagination
   (`nextCursor`) to exhaustion. Concatenate the `tools` arrays in server-returned order.
2. **Canonical form** = UTF-8 of `JSON.stringify(tools)` over the **parsed** result value:
   no added whitespace, first-occurrence key order, standard JSON.parse semantics (duplicate
   keys last-wins, numbers re-serialized per ECMA-404). Defined on the parsed value rather
   than raw wire bytes so any JSON implementation reproduces it from the published capture.
3. **The number** = length of the token sequence produced by encoding the canonical string
   with tiktoken **`o200k_base`**.

That's all. No model calls, no API keys, no sampling — the same input yields the same number
on anyone's machine, in any language with a tiktoken port.

## Reproduce it

Every published badge has a companion `measurement.json` containing the raw `tools/list`
capture (`rawToolsCapture`), the SHA-256 of the canonical bytes, the exact launch command,
and env var *names* (values redacted). Re-derive the number in five lines:

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

## What the number is not

- **Not any client's exact context bill.** Clients (Claude Code, Cursor, ...) re-render tool
  schemas into their own internal prompt formats, which are not publicly specified. The badge
  is a documented, reproducible **index of schema payload cost** — a lower-bound proxy that
  ranks servers consistently — not a promise of the number your client charges.
- **Not what a deferring client loads at session start.** A client that defers definitions
  until a tool is used puts only names and instructions in context up front, which is a
  different and much smaller number. It is now measured and published beside the headline —
  see [session-start load](#session-start-load).
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

## Failure taxonomy — no silent drops

Every candidate server appears in published results with exactly one status:

| status | meaning |
|---|---|
| `measured` | clean measurement at default config |
| `dynamic` | tool set varied between runs; value is for the captured run |
| `auth-required` | won't start or list tools without real credentials |
| `startup-failure` | crashed or missing dependencies (stderr tail recorded) |
| `timeout` | no response within the configured timeout (recorded per measurement) |
| `remote-auth-wall` | OAuth-gated remote server; listed, not measured |
| `not-yet-run` | candidate not yet swept (appears in interim leaderboards only) |

**A failure is retried before it is published.** Two of these statuses can be produced by
the machine doing the measuring rather than by the server, so neither is published on a
single attempt:

- a `startup-failure` under Docker isolation is re-attempted with the shared package caches
  bypassed, because a poisoned cache entry and a genuinely broken package exit identically;
- a `timeout` is re-attempted on double the configured budget, because a server that starts
  slowly under sweep concurrency and one that never starts both come back `timeout`.

If the retry succeeds, the successful measurement is the published one. If it fails the same
way, the note says which retry it survived — so "broken upstream" and "broken here" read
differently without re-running the sweep. A `timeout` note always names the widest budget
tried, not the first one that failed.

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
reporting a pass.

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
the server list each week, so the whole set is refreshed on a rolling six-week cycle rather
than all at once — a fresh CI runner shares no package cache, and every server on it pays a
cold install. The slice is derived from the date alone, so a week the job doesn't run leaves
those servers to come round again next cycle; nothing is skipped permanently. Servers the
week's slice doesn't include keep their most recent measurement, unchanged, on the
leaderboard. One extra server, the reference server behind this project's own badge, is also
re-measured weekly.

## Color bands (provisional)

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
   array has nowhere to put them. Across the measured set this removes between 0.7% and
   **80.6%** of the payload (github: 54,422 → 10,535 tokens).
2. **Tokenizer and framing.** Anthropic's tokenizer is denser on schema text than o200k_base,
   and the API adds its own framing around the tools channel. A single minimal tool costs
   328 tokens more than no tools at all, which is an upper bound on the fixed part.

Because the effects can cancel or compound, the Claude number is **not** a fixed multiple of
the badge — it ranged from 0.34× to 1.92× across the top 15, and it reorders the leaderboard:
github is the heaviest server on o200k and notion is the heaviest on Claude.

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

**`≥` means the instructions half is missing.** `instructions` is not part of `tools/list`, so
no measurement taken before this method existed carries it. Those rows publish the names half
alone, marked `≥`: a floor, not a figure. The distinction is the point — a floor printed as a
figure would understate exactly the servers that ship the longest instructions. A row leaves
the floor either by being re-measured (every sweep now records `serverInstructions` inside the
measurement) or by a backfill capture in
[`results/session-start.json`](https://github.com/athakur3/mcp-context-cost/blob/main/results/session-start.json),
which is used only while its `capturedSha256` still matches the measurement on disk. When a
re-sweep moves that hash the row drops back to its floor rather than keeping instructions
captured against a tool set the server no longer serves.

**What it is not.** Not any client's exact session-start bill either. Clients prefix tool names
with a server identifier, wrap the list in their own framing, and choose independently whether
to inject `instructions` at all. Like every number here it is a documented, reproducible index
measured the same way for every server — the ratio between the two columns is the finding, not
the absolute figure.

## Known divergences

**sd2k/mcp-tokens** (the CLI our upstream GitHub Action contribution builds on) differs from
this definition in two documented ways: its tiktoken provider selects the encoding from a
`--model` argument with a **cl100k_base fallback** (pass `--model gpt-4o` for o200k), and it
counts a `serde_json` re-serialization of deserialized tool structs rather than the parsed
wire value (key order normalized to struct order; unmodeled fields dropped). Publishing the
CLI's number alongside ours as a cross-check column is planned for the launch leaderboard.
Details: [spec/upstream-notes.md](https://github.com/athakur3/mcp-context-cost/blob/main/spec/upstream-notes.md).

## Changelog <a id="changelog"></a>

- **v1.0** (2026-08-16) — initial definition: canonical form over the parsed `tools/list`
  value, o200k_base, bands frozen against first-sweep distribution, failure taxonomy,
  dual-run dynamic detection.

The Claude divergence column (`tools-delta/v1`, added 2026-08-16) and the session-start column
(`deferred-load/v1`, added 2026-08-20) are versioned separately and deliberately: each adds a
published number without touching the definition above. Every badge, every `totalTokens`, and
every canonical hash is byte-identical to before they existed, so bumping this page's version
would have signalled a change that did not happen.
