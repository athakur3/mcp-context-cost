# google-surf — context cost

**17,185 tokens** across 7 tools — *heavy* (15–30K). Measured 2026-09-30 under [methodology v1.0](../METHODOLOGY.html).

An Anthropic request carries 11,434 of those tokens as tool definitions. What Claude makes of them is not published for this server: its Claude count is missing, or was taken against a capture this measurement has since replaced.

| | |
|---|---|
| server (self-reported) | google-surf-mcp v1.1.3 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y google-surf-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `169cfd8e49a251baf2e62bed239afae4ee1999f6fb00a763fa4c66d35b26c515` |
| category | community |
| source | https://github.com/HarimxChoi/google-surf-mcp |

## Where the tokens are

| tool | tokens | share | description | input schema | output schema |
|---|---:|---:|---:|---:|---:|
| project_memory | 7,869 | 45.8% | 380 | 6,088 | 1,354 |
| project_memory_search | 2,742 | 16.0% | 208 | 1,130 | 1,354 |
| search_parallel | 1,996 | 11.6% | 482 | 631 | 833 |
| search | 1,873 | 10.9% | 478 | 612 | 735 |
| extract | 1,272 | 7.4% | 330 | 511 | 381 |
| scholar_search | 1,004 | 5.8% | 134 | 302 | 519 |
| health | 427 | 2.5% | 50 | 24 | 304 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-04 | 10,948 | 7 | 1.0.9 | docker | — |
| 2026-09-05 | 10,948 | 7 | 1.0.9 | docker | no change |
| 2026-09-09 | 10,948 | 7 | 1.0.9 | docker | no change |
| 2026-09-30 | 17,185 | 7 | 1.1.3 | docker | +6,237 |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/google-surf/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/google-surf/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/google-surf.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
