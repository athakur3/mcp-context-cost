# memory — context cost

**2,378 tokens** across 9 tools — *light* (1–5K). Measured 2026-09-05 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | memory-server v0.6.3 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `npx -y @modelcontextprotocol/server-memory@2026.7.4` |
| isolation | docker · public.ecr.aws/docker/library/node:22-slim · network bridge · linux/amd64 · network enabled for package fetch; clean FS, no host credentials |
| env vars supplied | none |
| canonical SHA-256 | `d028274f76dc9aa2e622ae02a17ce313aa65d7b5935254ca53889d4094238abb` |
| category | official-reference |
| source | https://github.com/modelcontextprotocol/servers |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| search_nodes | 323 | 13.6% | 11 | 51 |
| open_nodes | 322 | 13.5% | 10 | 51 |
| create_entities | 294 | 12.4% | 8 | 111 |
| create_relations | 294 | 12.4% | 17 | 106 |
| read_graph | 291 | 12.2% | 5 | 24 |
| add_observations | 249 | 10.5% | 10 | 97 |
| delete_relations | 225 | 9.5% | 7 | 115 |
| delete_observations | 212 | 8.9% | 9 | 98 |
| delete_entities | 166 | 7.0% | 11 | 53 |

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-05 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 2,378 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 901 | 62.1% of the capture is MCP-only metadata |
| **Claude, same fields** | **1,880** | 0.79× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | release | measured in | change |
|---|---:|---:|---|---|---:|
| 2026-08-16 | 2,378 | 9 | not recorded | not recorded | — |
| 2026-08-17 | 2,378 | 9 | not recorded | not recorded | no change |
| 2026-08-18 | 2,378 | 9 | not recorded | docker | no change |
| 2026-08-19 | 2,378 | 9 | not recorded | docker | no change |
| 2026-08-24 | 2,378 | 9 | not recorded | docker | no change |
| 2026-08-31 | 2,378 | 9 | not recorded | docker | no change |
| 2026-09-03 | 2,378 | 9 | not recorded | docker | no change |
| 2026-09-04 | 2,378 | 9 | 0.6.3 | docker | no change |
| 2026-09-05 | 2,378 | 9 | 0.6.3 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/memory/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/memory/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/memory.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
