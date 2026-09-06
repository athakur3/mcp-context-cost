# airbnb — context cost

**486 tokens** across 2 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | airbnb v0.3.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @openbnb/mcp-server-airbnb` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · architecture not on record · network enabled for package fetch; clean FS, no host credent |
| env vars supplied | none |
| canonical SHA-256 | `79c3109b4fa4e4735ba1071cacbd98948c6aba20b70c9a4295a78e84850a81e0` |
| category | community |
| source | https://github.com/openbnb-org/mcp-server-airbnb |

## Where the tokens are

| tool | tokens | share | description | input schema |
|---|---:|---:|---:|---:|
| airbnb_search | 319 | 65.6% | 16 | 291 |
| airbnb_listing_details | 165 | 34.0% | 15 | 137 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 486 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 486 | 0.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **1,169** | 2.41× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 486 | 2 | not recorded | not recorded | — |
| 2026-08-19 | 486 | 2 | not recorded | docker | no change |
| 2026-09-04 | 486 | 2 | 0.3.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/airbnb/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/airbnb/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/airbnb.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
