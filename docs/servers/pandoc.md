# pandoc — context cost

**1,425 tokens** across 1 tools — *light* (1–5K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-pandoc v0.11.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx mcp-pandoc` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `4d8f9de25d7aa74f0fb5e0c828a904d74b3934e62cb1032bc6cf0fada1f0d952` |
| category | community |
| source | https://github.com/vivekVells/mcp-pandoc |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| convert-contents | 1,423 | 99.9% | 996 | 361 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 1,425 | 1 | not recorded | not recorded | — |
| 2026-08-19 | 1,425 | 1 | not recorded | docker | no change |
| 2026-09-04 | 1,425 | 1 | 0.11.1 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/pandoc/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/pandoc/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/pandoc.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
