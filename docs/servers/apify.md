# apify — context cost

**10,426 tokens** across 10 tools — *moderate* (5–15K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | apify-mcp-server v0.14.3 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @apify/actors-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | APIFY_TOKEN |
| canonical SHA-256 | `45e69bb7d3ab57903ca84555f5bb3851cbc806ae35ce9398eb88eea7f587ec91` |
| category | vendor-official |
| source | https://github.com/apify/apify-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search-actors | 2,200 | 21.1% | 585 | 504 |
| call-actor | 1,884 | 18.1% | 395 | 496 |
| fetch-actor-details | 1,480 | 14.2% | 167 | 262 |
| get-actor-run | 1,314 | 12.6% | 225 | 108 |
| abort-actor-run | 1,151 | 11.0% | 108 | 69 |
| search-apify-docs | 726 | 7.0% | 255 | 291 |
| get-dataset-items | 685 | 6.6% | 151 | 289 |
| get-key-value-store-record | 351 | 3.4% | 112 | 73 |
| report-problem | 347 | 3.3% | 95 | 163 |
| fetch-apify-docs | 286 | 2.7% | 110 | 64 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-08-24 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 10,426 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 4,797 | 54.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **8,313** | 0.80× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 10,426 | 10 | not recorded | — |
| 2026-08-19 | 10,426 | 10 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/apify/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/apify/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/apify.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
