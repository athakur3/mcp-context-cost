# redis — context cost

**9,246 tokens** across 53 tools — *moderate* (5–15K). Measured 2026-09-02 under [methodology v1.0](../METHODOLOGY.html).

| | |
|---|---|
| server (self-reported) | Redis MCP Server v1.29.1 |
| status | measured |
| tokenizer | tiktoken / o200k_base |
| launch command | `uvx --from git+https://github.com/redis/mcp-redis.git redis-mcp-server --url redis://localhost:6379/0` |
| isolation | docker · ghcr.io/astral-sh/uv:python3.12-bookworm-slim · network bridge · network enabled for package fetch; clean FS, no host credentials, git installed |
| env vars supplied | none |
| canonical SHA-256 | `92a01e079c4436e651586a0fa4117e21204dc481de169763e621253280225570` |
| category | vendor-official |
| source | https://github.com/redis/mcp-redis |

## Where the tokens are

| tool | tokens | share | description | schema |
|---|---:|---:|---:|---:|
| hybrid_search | 510 | 5.5% | 271 | 140 |
| scan_keys | 482 | 5.2% | 341 | 58 |
| create_vector_index_hash | 352 | 3.8% | 191 | 100 |
| search_redis_documents | 345 | 3.7% | 231 | 31 |
| vector_search_hash | 319 | 3.5% | 119 | 123 |
| xreadgroup | 317 | 3.4% | 138 | 120 |
| scan_all_keys | 267 | 2.9% | 143 | 46 |
| json_set | 228 | 2.5% | 94 | 81 |
| hset | 220 | 2.4% | 73 | 94 |
| xgroup_create | 215 | 2.3% | 80 | 80 |
| set | 214 | 2.3% | 69 | 95 |
| set_vector_in_hash | 207 | 2.2% | 75 | 68 |
| zadd | 207 | 2.2% | 75 | 79 |
| zrange | 203 | 2.2% | 78 | 72 |
| read_messages | 202 | 2.2% | 77 | 67 |
| rename | 201 | 2.2% | 91 | 47 |
| xadd | 193 | 2.1% | 70 | 71 |
| lrem | 191 | 2.1% | 65 | 76 |
| sadd | 184 | 2.0% | 64 | 68 |
| xack | 182 | 2.0% | 61 | 69 |
| json_get | 151 | 1.6% | 56 | 44 |
| json_del | 150 | 1.6% | 55 | 44 |
| lrange | 149 | 1.6% | 31 | 55 |
| lpush | 146 | 1.6% | 17 | 87 |
| rpush | 146 | 1.6% | 17 | 87 |
| xgroup_destroy | 145 | 1.6% | 46 | 46 |
| xdel | 144 | 1.6% | 48 | 45 |
| xrange | 143 | 1.5% | 48 | 44 |
| expire | 139 | 1.5% | 46 | 44 |
| zrem | 139 | 1.5% | 46 | 42 |

*23 smaller tools omitted (2,553 tokens combined) — all of them are in the [raw capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/redis/measurement.json).*

Each tool is tokenized on its own, so the parts do not sum exactly to the whole: the array adds its own brackets and commas, and the tokenizer merges tokens across object boundaries. The badge number is always the count of the whole array, never a sum of parts.

## What this costs on Claude

Measured 2026-09-03 against `claude-opus-5` via Anthropic's `count_tokens` (method `tools-delta/v1`).

| | tokens | |
|---|---:|---|
| o200k, full capture | 9,246 | the badge number — every byte `tools/list` returned |
| o200k, Anthropic fields only | 7,489 | 19.0% of the capture is MCP-only metadata |
| **Claude, same fields** | **13,221** | 1.43× the badge number |

An Anthropic tool definition carries `name`, `description`, and `input_schema` and nothing else, so `title`, `annotations`, `outputSchema`, `execution`, and `icons` are dropped before the request — that is the second row. The third row is the same tools counted by Anthropic, which is larger than the second because Anthropic's tokenizer is denser on this content than o200k_base *and* the API adds its own framing (at most 328 tokens of it fixed, measured against a single minimal tool). The two effects run in opposite directions, which is why the Claude number is not a fixed multiple of the badge.

## Over time

| date | tokens | tools | measured in | change |
|---|---:|---:|---|---:|
| 2026-08-17 | 9,246 | 53 | not recorded | — |
| 2026-08-19 | 9,246 | 53 | docker | no change |
| 2026-09-02 | 9,246 | 53 | docker | no change |

> Some of these sweeps predate the `isolation` column, so the conditions they were measured under are not on record.

Full series: [results/history.csv](https://github.com/athakur3/mcp-context-cost/blob/main/results/history.csv).

## Re-derive it

```bash
npx -y mcp-context-cost verify results/redis/measurement.json
```

That re-tokenizes the [published capture](https://github.com/athakur3/mcp-context-cost/blob/main/results/redis/measurement.json) and checks the count and the hash. If it disagrees with the badge, the badge is wrong — [open an issue](https://github.com/athakur3/mcp-context-cost/issues) and it gets corrected.

[Badge JSON](https://github.com/athakur3/mcp-context-cost/blob/main/badges/redis.json) · [All servers](index.html) · [Leaderboard](https://github.com/athakur3/mcp-context-cost/blob/main/results/leaderboard.md) · [Methodology](../METHODOLOGY.html)
