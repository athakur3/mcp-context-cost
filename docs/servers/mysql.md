# mysql — context cost

**393 tokens** across 3 tools — *lean* (< 1K). Measured 2026-08-19 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mysql_mcp_server v1.29.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx --from mysql-mcp-server mysql_mcp_server` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE |
| canonical SHA-256 | `48f53cd914e3137feabfb3087abdb3bb54df46907d605a4cf97fac272bba2afb` |
| category | community |
| source | https://github.com/designcomputer/mysql_mcp_server |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| get_table_sample | 139 | 35.4% | 47 | 61 |
| get_schema_info | 133 | 33.8% | 68 | 34 |
| execute_sql | 119 | 30.3% | 58 | 32 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## Over time

| date | tokens | tools | change |
|---|---:|---:|---:|
| 2026-08-16 | 393 | 3 | — |
| 2026-08-19 | 393 | 3 | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/mysql/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/mysql/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/mysql.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
