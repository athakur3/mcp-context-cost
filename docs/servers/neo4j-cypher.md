# neo4j-cypher — context cost

**523 tokens** across 3 tools — *lean* (< 1K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-neo4j-cypher v2.13.3 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx mcp-neo4j-cypher` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD |
| canonical SHA-256 | `2e66ec7b2ea28f25f5b986a65cc950c06febad089b2c3033be49e15548f9c432` |
| category | vendor-official |
| source | https://github.com/neo4j-contrib/mcp-neo4j |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| get_neo4j_schema | 238 | 45.5% | 109 | 50 |
| read_neo4j_cypher | 143 | 27.3% | 13 | 56 |
| write_neo4j_cypher | 143 | 27.3% | 13 | 56 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 523 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 354 | 32.3% of the capture is MCP-only metadata |
| **Claude, same fields** | **884** | 1.69× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-18 | 523 | 3 | not recorded | not recorded | — |
| 2026-08-19 | 523 | 3 | not recorded | docker | no change |
| 2026-09-04 | 523 | 3 | 2.13.3 | docker | no change |
| 2026-09-05 | 523 | 3 | 2.13.3 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/neo4j-cypher/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/neo4j-cypher/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/neo4j-cypher.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
