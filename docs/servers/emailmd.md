# emailmd — context cost

**585 tokens** across 3 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | emailmd v0.11.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y emailmd mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `991fa59036ab1d4a4c1270ba14025668cd37bad41d9a804544a5e6aa23564365` |
| category | community |
| source | https://github.com/anypost/emailmd |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| render | 227 | 38.8% | 65 | 138 |
| lint | 196 | 33.5% | 64 | 108 |
| read_docs | 160 | 27.4% | 58 | 77 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-09-03 | 585 | 3 | not recorded | docker | — |
| 2026-09-04 | 585 | 3 | 0.11.0 | docker | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/emailmd/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/emailmd/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/emailmd.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
