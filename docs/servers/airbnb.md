# airbnb — context cost

**486 tokens** across 2 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | airbnb v0.3.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @openbnb/mcp-server-airbnb` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `79c3109b4fa4e4735ba1071cacbd98948c6aba20b70c9a4295a78e84850a81e0` |
| category | community |
| source | https://github.com/openbnb-org/mcp-server-airbnb |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| airbnb_search | 319 | 65.6% | 16 | 291 |
| airbnb_listing_details | 165 | 34.0% | 15 | 137 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

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
