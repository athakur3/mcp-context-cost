# clickhouse — context cost

**581 tokens** across 3 tools — *lean* (< 1K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-clickhouse v2.14.7 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx mcp-clickhouse` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | CLICKHOUSE_HOST, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD |
| canonical SHA-256 | `d266049ab550225c0ca1055960d43f29c64b3e7cf03fa1241e633f9b2049f240` |
| category | vendor-official |
| source | https://github.com/ClickHouse/mcp-clickhouse |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| list_tables | 370 | 63.7% | 191 | 104 |
| run_query | 133 | 22.9% | 50 | 19 |
| list_databases | 79 | 13.6% | 5 | 9 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 581 | 3 | — |
| 2026-08-18 | 581 | 3 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/clickhouse/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/clickhouse/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/clickhouse.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
