# searxng — context cost

**1,481 tokens** across 4 tools — *light* (1–5K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | ihor-sokoliuk/mcp-searxng v1.15.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y mcp-searxng` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | SEARXNG_URL |
| canonical SHA-256 | `2a5a607d2614632059e9f98e5fa7468374a9086312071f8895f4ba10a3a4618a` |
| category | community |
| source | https://github.com/ihor-sokoliuk/mcp-searxng |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| searxng_web_search | 770 | 52.0% | 114 | 627 |
| web_url_read | 429 | 29.0% | 259 | 145 |
| searxng_instance_info | 162 | 10.9% | 34 | 100 |
| searxng_search_suggestions | 118 | 8.0% | 23 | 66 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 1,481 | 4 | not recorded | — |
| 2026-08-19 | 1,481 | 4 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/searxng/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/searxng/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/searxng.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
