# tavily — context cost

**1,653 tokens** across 5 tools — *light* (1–5K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | tavily-mcp v0.2.22 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y tavily-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | TAVILY_API_KEY |
| canonical SHA-256 | `b2bcd45339fe42caa0f55e5ca1196091b2dcda4b868fedd209177b54f2ef51ef` |
| category | vendor-official |
| source | https://github.com/tavily-ai/tavily-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| tavily_search | 615 | 37.2% | 29 | 574 |
| tavily_crawl | 412 | 24.9% | 20 | 379 |
| tavily_map | 288 | 17.4% | 18 | 258 |
| tavily_extract | 178 | 10.8% | 15 | 151 |
| tavily_research | 158 | 9.6% | 50 | 95 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 1,653 | 5 | — |
| 2026-08-18 | 1,653 | 5 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/tavily/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/tavily/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/tavily.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
