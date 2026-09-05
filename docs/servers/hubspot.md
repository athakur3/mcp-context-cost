# hubspot — context cost

**9,158 tokens** across 21 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | hubspot-mcp-server v0.4.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @hubspot/mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | PRIVATE_APP_ACCESS_TOKEN |
| canonical SHA-256 | `3389dd469cfc2f46f06e4be24ba13ff95595ee30fd8dd62df81809a95daf3791` |
| category | vendor-official |
| source | https://developers.hubspot.com/mcp (GitHub repo not public) |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| hubspot-search-objects | 964 | 10.5% | 318 | 576 |
| hubspot-create-property | 879 | 9.6% | 246 | 569 |
| hubspot-update-property | 669 | 7.3% | 112 | 500 |
| hubspot-batch-create-associations | 628 | 6.9% | 146 | 418 |
| hubspot-create-engagement | 569 | 6.2% | 251 | 256 |
| hubspot-batch-create-objects | 563 | 6.1% | 146 | 356 |
| hubspot-update-engagement | 530 | 5.8% | 217 | 249 |
| hubspot-list-objects | 505 | 5.5% | 150 | 294 |
| hubspot-batch-update-objects | 498 | 5.4% | 188 | 246 |
| hubspot-list-associations | 491 | 5.4% | 182 | 247 |
| hubspot-get-link | 422 | 4.6% | 122 | 241 |
| hubspot-batch-read-objects | 348 | 3.8% | 54 | 237 |
| hubspot-get-association-definitions | 339 | 3.7% | 74 | 205 |
| hubspot-list-properties | 322 | 3.5% | 104 | 163 |
| hubspot-get-user-details | 250 | 2.7% | 163 | 29 |
| hubspot-list-workflows | 250 | 2.7% | 98 | 94 |
| hubspot-get-property | 245 | 2.7% | 56 | 136 |
| hubspot-get-workflow | 200 | 2.2% | 91 | 51 |
| hubspot-get-schemas | 184 | 2.0% | 95 | 29 |
| hubspot-generate-feedback-link | 173 | 1.9% | 89 | 29 |
| hubspot-get-engagement | 127 | 1.4% | 19 | 58 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-03 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 9,158 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 8,433 | 7.9% of the capture is MCP-only metadata |
| **Claude, same fields** | **14,398** | 1.57× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 9,158 | 21 | not recorded | not recorded | — |
| 2026-08-19 | 9,158 | 21 | not recorded | docker | no change |
| 2026-09-04 | 9,158 | 21 | 0.4.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/hubspot/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/hubspot/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/hubspot.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
