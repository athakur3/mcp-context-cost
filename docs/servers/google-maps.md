# google-maps — context cost

**549 tokens** across 7 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-server/google-maps v0.1.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @modelcontextprotocol/server-google-maps` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | GOOGLE_MAPS_API_KEY |
| canonical SHA-256 | `a88e204db09aa56954e3e041d6a9814aee9ac888fdfc7d5cb47aec1877441986` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers-archived |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| maps_distance_matrix | 124 | 22.6% | 10 | 102 |
| maps_directions | 99 | 18.0% | 5 | 82 |
| maps_search_places | 95 | 17.3% | 7 | 76 |
| maps_elevation | 78 | 14.2% | 8 | 58 |
| maps_reverse_geocode | 56 | 10.2% | 5 | 38 |
| maps_place_details | 50 | 9.1% | 7 | 31 |
| maps_geocode | 45 | 8.2% | 6 | 27 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 549 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 549 | 0.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **1,332** | 2.43× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 549 | 7 | not recorded | not recorded | — |
| 2026-08-18 | 549 | 7 | not recorded | docker | no change |
| 2026-09-03 | 549 | 7 | not recorded | docker | no change |
| 2026-09-04 | 549 | 7 | 0.1.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/google-maps/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/google-maps/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/google-maps.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
