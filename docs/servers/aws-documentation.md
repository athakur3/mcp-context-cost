# aws-documentation — context cost

**5,074 tokens** across 5 tools — *moderate* (5–15K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | awslabs.aws-documentation-mcp-server v1.29.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx awslabs.aws-documentation-mcp-server@latest` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `03d94c1d9bbcaf8fcaf375d1d6f14b975f108724d76ebe3d70ea7ce72eed13ac` |
| category | vendor-official |
| source | https://github.com/awslabs/mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search_documentation | 1,956 | 38.5% | 657 | 239 |
| search_table | 1,361 | 26.8% | 658 | 172 |
| read_sections | 634 | 12.5% | 467 | 75 |
| read_documentation | 571 | 11.3% | 377 | 125 |
| recommend | 550 | 10.8% | 354 | 41 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 5,074 | 5 | not recorded | — |
| 2026-08-18 | 5,074 | 5 | docker | no change |
| 2026-08-19 | 5,074 | 5 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/aws-documentation/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/aws-documentation/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/aws-documentation.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
