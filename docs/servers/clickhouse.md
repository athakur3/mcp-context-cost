# clickhouse — context cost

**632 tokens** across 3 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-clickhouse v0.6.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx mcp-clickhouse` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | CLICKHOUSE_HOST, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD |
| canonical SHA-256 | `6f42fcefaf49e720fe8ec5acf8dafc7ae6065bf541957572b6a6abbe61f111d4` |
| category | vendor-official |
| source | https://github.com/ClickHouse/mcp-clickhouse |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| list_tables | 353 | 55.9% | 63 | 230 |
| run_query | 201 | 31.8% | 121 | 24 |
| list_databases | 78 | 12.3% | 5 | 14 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-16 | 581 | 3 | not recorded | — |
| 2026-08-18 | 581 | 3 | docker | no change |
| 2026-09-02 | 694 | 3 | docker | +113 |
| 2026-09-04 | 632 | 3 | docker | -62 |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/clickhouse/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/clickhouse/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/clickhouse.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
