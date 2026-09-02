# duckduckgo — context cost

**724 tokens** across 2 tools — *lean* (< 1K). Measured 2026-09-02 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | ddg-search v1.29.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx duckduckgo-mcp-server` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `61f82494284ccb413e9cb213ed93d7b79f43769229713b2748056a7f1018db14` |
| category | community |
| source | https://github.com/nickclyde/duckduckgo-mcp-server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| fetch_content | 387 | 53.5% | 246 | 88 |
| search | 335 | 46.3% | 226 | 58 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 724 | 2 | not recorded | — |
| 2026-08-19 | 724 | 2 | docker | no change |
| 2026-09-02 | 724 | 2 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/duckduckgo/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/duckduckgo/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/duckduckgo.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
