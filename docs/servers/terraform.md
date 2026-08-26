# terraform — context cost

**2,061 tokens** across 9 tools — *light* (1–5K). Measured 2026-08-26 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | terraform-mcp-server v1.2.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `docker run -i --rm hashicorp/terraform-mcp-server` |
| isolation | docker · command is itself a docker run (host-spawned container) |
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

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 2,061 | 9 | not recorded | — |
| 2026-08-19 | 2,061 | 9 | docker | no change |
| 2026-08-26 | 2,061 | 9 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/terraform/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/terraform/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/terraform.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
