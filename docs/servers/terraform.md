# terraform — context cost

**2,061 tokens** across 9 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | terraform-mcp-server v1.3.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `docker run -i --rm hashicorp/terraform-mcp-server` |
| isolation | docker · linux/amd64 · command is itself a docker run (host-spawned container) |
| env vars supplied | none |
| canonical SHA-256 | `7205f4d29a1a97d6fa9d13d2e9b3c2ccc5e8dda8539cf836d5895380c56c4b3b` |
| category | vendor-official |
| source | https://github.com/hashicorp/terraform-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search_providers | 484 | 23.5% | 132 | 293 |
| get_provider_capabilities | 305 | 14.8% | 138 | 110 |
| search_modules | 240 | 11.6% | 129 | 54 |
| search_policies | 228 | 11.1% | 138 | 31 |
| get_latest_module_version | 200 | 9.7% | 13 | 139 |
| get_module_details | 157 | 7.6% | 37 | 71 |
| get_policy_details | 156 | 7.6% | 37 | 67 |
| get_provider_details | 149 | 7.2% | 42 | 55 |
| get_latest_provider_version | 148 | 7.2% | 13 | 87 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 2,061 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 1,718 | 16.6% of the capture is MCP-only metadata |
| **Claude, same fields** | **3,248** | 1.58× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 2,061 | 9 | not recorded | not recorded | — |
| 2026-08-19 | 2,061 | 9 | not recorded | docker | no change |
| 2026-08-26 | 2,061 | 9 | not recorded | docker | no change |
| 2026-09-03 | 2,061 | 9 | not recorded | docker | no change |
| 2026-09-04 | 2,061 | 9 | 1.3.0 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/terraform/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/terraform/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/terraform.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
