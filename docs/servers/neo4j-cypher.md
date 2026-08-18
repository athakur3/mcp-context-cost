# neo4j-cypher — context cost

**523 tokens** across 3 tools — *lean* (< 1K). Measured 2026-08-18 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | mcp-neo4j-cypher v2.13.3 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx mcp-neo4j-cypher` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials |
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

## Re-derive it

```bash
npx -y mcp-context-cost verify results/neo4j-cypher/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/neo4j-cypher/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/neo4j-cypher.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
