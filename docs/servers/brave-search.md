# brave-search — context cost

**25,487 tokens** across 8 tools — *heavy* (15–30K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | brave-search-mcp-server v2.1.3 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @brave/brave-search-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | BRAVE_API_KEY |
| canonical SHA-256 | `ec3c4f85b22d1e4866faeb04af7038fc28568dc4a262416cea7ce77c63b2b015` |
| category | vendor-official |
| source | https://github.com/brave/brave-search-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| brave_place_search | 17,295 | 67.9% | 351 | 1,145 |
| brave_llm_context | 2,554 | 10.0% | 177 | 1,537 |
| brave_local_search | 1,417 | 5.6% | 157 | 1,213 |
| brave_web_search | 1,398 | 5.5% | 133 | 1,213 |
| brave_news_search | 1,004 | 3.9% | 249 | 696 |
| brave_image_search | 818 | 3.2% | 67 | 270 |
| brave_video_search | 690 | 2.7% | 86 | 556 |
| brave_summarizer | 309 | 1.2% | 154 | 103 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 25,456 | 8 | not recorded | not recorded | — |
| 2026-08-19 | 25,456 | 8 | not recorded | docker | no change |
| 2026-09-04 | 25,487 | 8 | 2.1.3 | docker | +31 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/brave-search/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/brave-search/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/brave-search.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
