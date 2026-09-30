# brave-search — context cost

**25,500 tokens** across 8 tools — *heavy* (15–30K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 8,291 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | brave-search-mcp-server v2.1.4 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @brave/brave-search-mcp-server` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | BRAVE_API_KEY |
| canonical SHA-256 | `fed4dcff1fa9d22287c4a6332e8e13545db7952753f0e87eaf751c7812033d91` |
| category | vendor-official |
| source | https://github.com/brave/brave-search-mcp-server |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| brave_place_search | 17,295 | 67.8% | 351 | 1,145 | 15,737 |
| brave_llm_context | 2,554 | 10.0% | 177 | 1,537 | 787 |
| brave_local_search | 1,417 | 5.6% | 157 | 1,213 | 0 |
| brave_web_search | 1,398 | 5.5% | 133 | 1,213 | 0 |
| brave_news_search | 1,004 | 3.9% | 249 | 696 | 0 |
| brave_image_search | 831 | 3.3% | 67 | 283 | 432 |
| brave_video_search | 690 | 2.7% | 86 | 556 | 0 |
| brave_summarizer | 309 | 1.2% | 154 | 103 | 0 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 25,456 | 8 | not recorded | not recorded | — |
| 2026-08-19 | 25,456 | 8 | not recorded | docker | no change |
| 2026-09-04 | 25,487 | 8 | 2.1.3 | docker | +31 |
| 2026-09-05 | 25,487 | 8 | 2.1.3 | docker | no change |
| 2026-09-09 | 25,487 | 8 | 2.1.3 | docker | no change |
| 2026-09-30 | 25,500 | 8 | 2.1.4 | docker | +13 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/brave-search/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/brave-search/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/brave-search.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
