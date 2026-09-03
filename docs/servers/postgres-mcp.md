# postgres-mcp — context cost

**8,632 tokens** across 9 tools — *moderate* (5–15K). Measured 2026-09-02 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | postgres-mcp v1.29.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx --with "mcp\<2" postgres-mcp --access-mode=restricted` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | DATABASE_URI |
| canonical SHA-256 | `9bb1e5d26dd377de9dbfac88ffe77663a1169cddf66c6b1f52f57d3a740b0e54` |
| category | community |
| source | https://github.com/crystaldba/postgres-mcp |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| explain_query | 1,147 | 13.3% | 23 | 285 |
| analyze_db_health | 1,026 | 11.9% | 128 | 56 |
| analyze_query_indexes | 968 | 11.2% | 16 | 110 |
| get_top_queries | 957 | 11.1% | 21 | 97 |
| get_object_details | 942 | 10.9% | 7 | 95 |
| analyze_workload_indexes | 934 | 10.8% | 11 | 79 |
| list_objects | 916 | 10.6% | 5 | 73 |
| execute_sql | 878 | 10.2% | 6 | 34 |
| list_schemas | 862 | 10.0% | 6 | 16 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-03 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 8,632 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 1,178 | 86.4% of the capture is MCP-only metadata |
| **Claude, same fields** | **2,381** | 0.28× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-18 | 8,632 | 9 | not recorded | — |
| 2026-08-19 | 8,632 | 9 | docker | no change |
| 2026-09-02 | 8,632 | 9 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/postgres-mcp/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/postgres-mcp/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/postgres-mcp.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
