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
  schemas into their own internal prompt formats, which are not publicly specified, and some
  defer-load schemas entirely. The badge is a documented, reproducible **index of schema
  payload cost** — a lower-bound proxy that ranks servers consistently — not a promise of
  the number your client charges.
- **Not a Claude token count.** Anthropic's tokenizer differs and drifts across model
  releases. A dated, model-pinned Claude divergence column is planned for the launch
  leaderboard (not yet published) so the gap becomes our data point, not a critic's.
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
