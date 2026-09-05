# sqlite — context cost

**268 tokens** across 6 tools — *lean* (< 1K). Measured 2026-09-04 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | sqlite v0.1.0 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx --with "mcp\<2" mcp-server-sqlite --db-path /tmp/test.db` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `d432983abc546eac2725c9db1a07f5f8dad0e6cbfb12f925c1d4fb61743d1c6b` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers-archived |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| write_query | 50 | 18.7% | 13 | 26 |
| describe_table | 49 | 18.3% | 8 | 30 |
| append_insight | 49 | 18.3% | 7 | 30 |
| read_query | 46 | 17.2% | 8 | 27 |
| create_table | 45 | 16.8% | 8 | 26 |
| list_tables | 28 | 10.4% | 7 | 9 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 268 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 268 | 0.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **806** | 3.01× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-18 | 268 | 6 | not recorded | docker | — |
| 2026-09-04 | 268 | 6 | 0.1.0 | docker | no change |

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/sqlite/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/sqlite/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/sqlite.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
