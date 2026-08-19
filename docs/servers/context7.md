# context7 — context cost

**1,052 tokens** across 2 tools — *light* (1–5K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Context7 v4.0.2 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @upstash/context7-mcp` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `699d8b33d6d2d90ce7deb777994bb408e1e07bb08fa997042b7cce19e6c1ecec` |
| category | vendor-official |
| source | https://github.com/upstash/context7 |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| resolve-library-id | 643 | 61.1% | 398 | 176 |
| query-docs | 407 | 38.7% | 87 | 273 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 1,052 | 2 | not recorded | — |
| 2026-08-18 | 1,052 | 2 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/context7/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/context7/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/context7.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
