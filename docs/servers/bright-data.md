# bright-data — context cost

**978 tokens** across 5 tools — *lean* (< 1K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Bright Data v2.11.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @brightdata/mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | API_TOKEN |
| canonical SHA-256 | `bd26660364200a7866906bbfecc185e41ea6a42e43ed5d6380b1c3b77a699eae` |
| category | vendor-official |
| source | https://github.com/brightdata/brightdata-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| discover | 347 | 35.5% | 38 | 281 |
| search_engine_batch | 191 | 19.5% | 17 | 142 |
| search_engine | 186 | 19.0% | 41 | 115 |
| scrape_batch | 141 | 14.4% | 36 | 73 |
| scrape_as_markdown | 115 | 11.8% | 37 | 43 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 978 | 5 | — |
| 2026-08-19 | 978 | 5 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/bright-data/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/bright-data/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/bright-data.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
