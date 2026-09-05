# apify — context cost

**10,452 tokens** across 10 tools — *moderate* (5–15K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | apify-mcp-server v0.15.4 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @apify/actors-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | APIFY_TOKEN |
| canonical SHA-256 | `4dd4565165c7066d8e8ef666f79cd8b323bad3d7f66b4d34fbe769f07e979453` |
| category | vendor-official |
| source | https://github.com/apify/apify-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search-actors | 2,226 | 21.3% | 610 | 504 |
| call-actor | 1,875 | 17.9% | 377 | 496 |
| fetch-actor-details | 1,534 | 14.7% | 219 | 262 |
| get-actor-run | 1,290 | 12.3% | 192 | 108 |
| abort-actor-run | 1,165 | 11.1% | 112 | 69 |
| search-apify-docs | 722 | 6.9% | 251 | 291 |
| get-dataset-items | 664 | 6.4% | 130 | 289 |
| report-problem | 347 | 3.3% | 95 | 163 |
| get-key-value-store-record | 341 | 3.3% | 102 | 73 |
| fetch-apify-docs | 286 | 2.7% | 110 | 64 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 10,426 | 10 | not recorded | not recorded | — |
| 2026-08-19 | 10,426 | 10 | not recorded | docker | no change |
| 2026-09-04 | 10,452 | 10 | 0.15.4 | docker | +26 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/apify/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/apify/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/apify.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
